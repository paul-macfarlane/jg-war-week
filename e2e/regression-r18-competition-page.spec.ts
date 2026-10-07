import { type Page, expect, test } from "@playwright/test";

import {
  type FormatName,
  RUN_AREA_TITLE,
  addCompetition,
  chooseOption,
  expectEntrantsSaved,
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import { addE2eHost, deleteXiCompetition, runQuery } from "./db";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

// Epic R18, ticket 101 (.scratch/regression-2026-10/issues/101-one-admin-competition-page.md):
// one admin page per Competition, its Settings autosaving per field, locked
// with a one-line reason once a result exists. Each test adds its own
// `E2E R18 …` Competition in demo XI and deletes it in `finally`; no seeded
// Competition changes.

/** The lock reason the page shows, worded as `LOCKED_BY_RESULT`. */
const LOCKED_BY_RESULT = "Locked once the Competition has a result.";

/** A field's lock reason under it (`data-slot="lock-reason"`). */
function lockReason(page: Page, reason: string) {
  return page.locator('[data-slot="lock-reason"]', { hasText: reason });
}

/** Leaves for the Competitions list and comes back through the row's Edit. */
async function leaveAndReturn(page: Page, name: string, id: string) {
  await page.goto("/admin/competitions");
  await page
    .getByRole("list", { name: "Competitions" })
    .getByRole("link", { name: `Edit ${name}`, exact: true })
    .click();
  await page.waitForURL(`**/admin/competitions/${id}`);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
}

/**
 * One Format's case: the setting it changes, how to see it was kept, and
 * the result it adds through its run area.
 */
type FormatCase = {
  format: FormatName;
  /** The Add sheet's Scoring, when not the War Week's Team default. */
  scoring?: string;
  change: (page: Page) => Promise<void>;
  kept: (page: Page) => Promise<void>;
  addResult: (page: Page) => Promise<void>;
};

/**
 * A Head-to-head's result: its two Entrants, Red vs Blue, picked in the run
 * area's two pickers; the pair autosaves.
 */
async function addSeriesEntrants(page: Page) {
  for (const [side, team] of [
    ["a", "Red"],
    ["b", "Blue"],
  ] as const) {
    const find = page.locator(`#series-entrants-${side}`);
    await find.click();
    await find.fill(team);
    await page.getByRole("option", { name: new RegExp(`^${team}`) }).click();
  }
  await expectEntrantsSaved(page);
}

/** A Best score result: an Attempt, logged from the run area. */
async function logAttempt(page: Page) {
  await page.getByRole("button", { name: "Log an Attempt" }).click();
  const form = page.getByRole("dialog", { name: "Log an Attempt" });
  await form.getByRole("combobox", { name: "Participant" }).click();
  await page.getByRole("option", { name: /^Ashley Schuliger/ }).click();
  await form.getByLabel(/^Score/).fill("12");
  await form.getByRole("button", { name: "Log Attempt" }).click();
  await expect(page.getByText("Attempt logged")).toBeVisible();
}

const CASES: FormatCase[] = [
  {
    format: "Placement",
    // Its result adds a Participant, so the sheet lists Participants.
    scoring: "Individual",
    change: (page) => chooseOption(page, "Score direction", "Higher is better"),
    kept: (page) =>
      expect(
        page.getByRole("combobox", { name: "Score direction", exact: true }),
      ).toContainText("Higher is better"),
    addResult: async (page) => {
      const search = page.getByRole("combobox", { name: "Add a Participant" });
      await search.click();
      await search.fill("Ashley Schuliger");
      await page
        .getByRole("option", { name: /Ashley Schuliger/ })
        .first()
        .click();
      await expect(page.getByText("Ashley Schuliger added")).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Score direction", exact: true }),
      ).toBeDisabled();
    },
  },
  {
    format: "Head-to-head",
    change: (page) =>
      page.getByRole("switch", { name: "Draws allowed" }).click(),
    kept: (page) =>
      expect(page.getByRole("switch", { name: "Draws allowed" })).toBeChecked(),
    addResult: async (page) => {
      await addSeriesEntrants(page);
      // Entrants are a result, but Head-to-head's settings wait for a Match.
      await expect(
        page.getByRole("switch", { name: "Draws allowed" }),
      ).toBeEnabled();
      await chooseOption(page, "Best of", "Best of 5");
      await expectSaved(page);
      await page.reload();
      await expect(
        page.getByRole("combobox", { name: "Best of", exact: true }),
      ).toContainText("Best of 5");
    },
  },
  {
    format: "Best score",
    change: (page) => chooseOption(page, "Score direction", "Lower is better"),
    kept: (page) =>
      expect(
        page.getByRole("combobox", { name: "Score direction", exact: true }),
      ).toContainText("Lower is better"),
    addResult: async (page) => {
      await logAttempt(page);
      await expect(
        page.getByRole("combobox", { name: "Score direction", exact: true }),
      ).toBeDisabled();
      // The unit is a label: it never locks.
      await expect(page.getByLabel("Unit")).toBeEnabled();
    },
  },
  {
    format: "Bracket",
    change: (page) =>
      page
        .getByRole("switch", { name: "Participants can log their own results" })
        .click(),
    kept: (page) =>
      expect(
        page.getByRole("switch", {
          name: "Participants can log their own results",
        }),
      ).toBeChecked(),
    addResult: async (page) => {
      await page.getByRole("button", { name: "All Teams" }).click();
      await expect(page.getByText("(2 chosen)")).toBeVisible();
      await expectEntrantsSaved(page);
      // Entrants are a result; the match settings wait for a Match Result.
      await expect(
        page.getByRole("button", { name: "Group", exact: true }),
      ).toBeEnabled();
    },
  },
  {
    format: "Participation",
    change: (page) =>
      page.getByRole("switch", { name: "Participants can check in" }).click(),
    kept: (page) =>
      expect(
        page.getByRole("switch", { name: "Participants can check in" }),
      ).toBeChecked(),
    addResult: async (page) => {
      const who = "Adam Wilson-Hwang";
      await page
        .getByRole("searchbox", { name: "Search the roster" })
        .fill(who);
      await page.getByRole("checkbox", { name: new RegExp(who) }).click();
      await expect(page.getByText(`${who} took part`)).toBeVisible();
    },
  },
];

for (const { format, scoring, change, kept, addResult } of CASES) {
  test(`r18 101 a ${format} Competition's setting autosaves, survives reload and leaving, and locks with its reason once it has a result`, async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const name = `E2E R18 ${format} ${Date.now()}`;
    try {
      await asOrganizer(context);
      await page.setViewportSize({ width: 1440, height: 900 });
      const id = await addCompetition(page, { name, format, scoring });
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: RUN_AREA_TITLE[format],
          exact: true,
        }),
      ).toBeVisible();
      // No result yet: the Format can change.
      await expect(
        page.getByRole("combobox", { name: "Format", exact: true }),
      ).toBeEnabled();

      await change(page);
      await expectSaved(page);
      await kept(page);

      // Reload: kept.
      await page.reload();
      await kept(page);

      // Leave and return: kept.
      await leaveAndReturn(page, name, id);
      await kept(page);

      // A result: the Format locks, with its one-line reason.
      await addResult(page);
      await expect(
        page.getByRole("combobox", { name: "Format", exact: true }),
      ).toBeDisabled();
      await expect(lockReason(page, LOCKED_BY_RESULT).first()).toBeVisible();
      await page.screenshot({
        path: testInfo.outputPath(`locked-${format}.png`),
        fullPage: true,
      });

      // The lock is the server's too: after a reload it still shows.
      await page.reload();
      await expect(
        page.getByRole("combobox", { name: "Format", exact: true }),
      ).toBeDisabled();
      await expect(lockReason(page, LOCKED_BY_RESULT).first()).toBeVisible();
    } finally {
      await deleteXiCompetition(name);
    }
  });
}

test("r18 101 a new Competition with no result changes Format, Placement → Bracket → Head-to-head, and each Format's settings and run area appear", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R18 Formats ${Date.now()}`;
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    // Individual, so Record placements adds Participants.
    const id = await addCompetition(page, { name, scoring: "Individual" });

    // Placement: Score direction, and Record placements.
    await expect(
      page.getByRole("combobox", { name: "Score direction", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Add a Participant" }),
    ).toBeVisible();

    // Bracket: match settings (Head-to-head / Group) and self-report, and
    // the Entrants and Generate.
    await setFormat(page, "Bracket");
    await expect(
      page.getByRole("button", { name: "Head-to-head", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("switch", {
        name: "Participants can log their own results",
      }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate" })).toBeVisible();
    // Every Format with Scores takes a direction and unit (R21, decision 6).
    await expect(
      page.getByRole("combobox", { name: "Score direction", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("format-bracket.png"),
      fullPage: true,
    });

    // Head-to-head: draws and Best of, Entrants, no close time; Close.
    await setFormat(page, "Head-to-head");
    await expect(
      page.getByRole("switch", { name: "Draws allowed" }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Best of", exact: true }),
    ).toBeVisible();
    await expect(page.getByText(/closes/i)).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Close", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Group", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Generate" })).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("format-head-to-head.png"),
      fullPage: true,
    });

    // Stored, independently of the page.
    const [row] = await runQuery<{ format: string; series_config: unknown }>(
      `select format::text as format, series_config from competition where id = $1`,
      [id],
    );
    expect(row.format).toBe("head-to-head");
    expect(row.series_config).toEqual({ drawsAllowed: false, bestOf: 3 });
  } finally {
    await deleteXiCompetition(name);
  }
});

test("r18 101 a Host edits their Competition's settings, sees Hosts as names only, and the page holds no email but their own", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R18 Hosted ${Date.now()}`;
  // A co-Host whose email must never reach the Host's page: on the roster,
  // so the page names them by their roster name. The Host themself has
  // neither a Profile name nor a roster name.
  const coHost = "e2e-r18-cohost@jahnelgroup.com";
  const coHostName = `E2E R18 Co-Host ${Date.now()}`;
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition (war_week_id, name, scoring, format)
     select id, $1, 'team', 'placement' from war_week where edition = 'xi'
     returning id`,
    [name],
  );
  try {
    await runQuery(
      `insert into participant (war_week_id, display_name, email)
       select id, $1, $2 from war_week where edition = 'xi'`,
      [coHostName, coHost],
    );
    await addE2eHost(id, E2E_HOST_EMAIL);
    await runQuery(
      `insert into competition_host (competition_id, participant_id)
       select $1, id from participant where email = $2`,
      [id, coHost],
    );
    await asHost(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCompetitionPage(page, id);

    // Hosts: read-only names, no field to change them.
    const settings = page.getByRole("form", { name: "Competition settings" });
    await expect(settings.getByRole("textbox", { name: "Hosts" })).toHaveCount(
      0,
    );
    await expect(
      settings.getByText("Only an Organizer assigns Hosts."),
    ).toBeVisible();
    const names = settings.locator('[data-slot="host-names"]');
    await expect(names).toContainText(coHostName);
    await expect(names).toContainText("E2E Host");

    // No email in the page (its HTML and the props it carries) but the
    // Host's own: the co-Host's never loads for a Host, nor any part of it.
    const html = await page.content();
    expect(html).not.toContain(coHost);
    expect(html).not.toContain("e2e-r18-cohost");
    const others = [
      ...new Set(html.match(/[\w.%+-]+@[\w-]+(?:\.[\w-]+)*\.[a-z]{2,}/gi)),
    ].filter((email) => email.toLowerCase() !== E2E_HOST_EMAIL);
    expect(others).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("host-page.png"),
      fullPage: true,
    });

    // The Host edits a setting; it autosaves and is kept after a reload.
    const descriptionEditor = settings.locator(".ProseMirror");
    await descriptionEditor.click();
    await page.keyboard.type("Bring your own darts.");
    await expectSaved(page);
    await page.reload();
    await expect(
      page
        .getByRole("form", { name: "Competition settings" })
        .locator(".ProseMirror"),
    ).toContainText("Bring your own darts.");
    const [stored] = await runQuery<{ description: unknown }>(
      `select description from competition where id = $1`,
      [id],
    );
    expect(JSON.stringify(stored.description)).toContain(
      "Bring your own darts.",
    );
  } finally {
    await deleteXiCompetition(name);
    await runQuery(`delete from participant where email = $1`, [coHost]);
  }
});
