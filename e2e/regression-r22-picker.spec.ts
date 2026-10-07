import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { spawnSync } from "node:child_process";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { localSeedFiles } from "@/seed/local-files";

import { deleteXiCompetition, runQuery } from "./db";
import { addXiCompetition } from "./r21-logging";
import { asOrganizer } from "./session";

// Epic R22, Decision 3 and ACs 6-8 (.scratch/people-and-admin/spec.md): one
// `ParticipantPicker` everywhere a Participant is chosen. Every row is
// avatar, name and (in a teams War Week) Team; it finds a Participant by
// display name alone with no cap at 100; an email finds nothing; and the
// Participation filter shows the same rows. The 100-Participant free-for-all
// XII scale demo (`pnpm seed:demo:scale`) is loaded in beforeAll and the
// seeded War Weeks put back in afterAll; the Team rows are checked on the
// live XI demo, which global setup loads.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

/** A roster email in the scale seed: nothing in any name says "ocelot@jahnel". */
const SCALE_EMAIL = "pim.ocelot@jahnelgroup.com";

function pnpm(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

async function organizerPage(browser: Browser) {
  const context = await browser.newContext();
  await asOrganizer(context);
  return { context, page: await context.newPage() };
}

async function competitionId(edition: string, name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = $1 and c.name = $2`,
    [edition, name],
  );
  if (!row) throw new Error(`No ${edition} Competition named "${name}"`);
  return row.id;
}

/** The page never scrolls sideways at 390. */
async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
}

/** The shown names of the rows (the span after the avatar; the avatar's initials are not a name). */
async function namesOf(rows: Locator): Promise<string[]> {
  return rows.evaluateAll((els) =>
    els.map(
      (el) =>
        el.querySelector('[data-slot="avatar"] + span')?.textContent ?? "",
    ),
  );
}

/** No option's row wraps: each one is a single line at its own width. */
async function expectRowsDoNotWrap(options: Locator) {
  const wrapped = await options.evaluateAll((rows) =>
    rows
      .filter((row) => {
        const box = row.getBoundingClientRect();
        const line = parseFloat(getComputedStyle(row).lineHeight) || 20;
        return box.height > line * 2.2;
      })
      .map((row) => row.textContent),
  );
  expect(wrapped).toEqual([]);
}

/**
 * Drives one picker (already on screen, closed) in the scale demo: it lists
 * all 100 with no cap, each row an avatar and a name (a free-for-all War
 * Week has no Team), finds a Participant past the 50th by part of their
 * name, and finds nothing for an email or part of one.
 */
async function exerciseScalePicker(
  page: Page,
  picker: Locator,
  testInfo: TestInfo,
  shot: string,
  size: (typeof VIEWPORTS)[number],
  /** How many it offers: all 100, or fewer where a choice is left out. */
  total = 100,
) {
  const [width, viewport] = size;
  const options = page.getByRole("option");
  await picker.click();
  // No cap: every one offered is listed.
  await expect(options).toHaveCount(total);
  const names = await namesOf(options);
  expect(new Set(names).size).toBe(total);
  expect(names.every(Boolean)).toBe(true);
  // Avatar and name on each row, and no Team text in a free-for-all.
  const last = options.last();
  await expect(last.locator('[data-slot="avatar"]')).toHaveCount(1);
  // Nothing beside the name: no Team in a free-for-all. (The Hosts picker's
  // "Can't sign in" note is the one other thing a row may carry.)
  const beside = await last.locator("span.truncate").allTextContents();
  expect(beside.length).toBeGreaterThanOrEqual(1);
  expect(beside.slice(1).every((text) => text === "Can't sign in")).toBe(true);
  await expect(last).toContainText(names[total - 1]);
  await expectRowsDoNotWrap(options);
  if (viewport === PHONE) await expectNoSidewaysScroll(page);

  // A Participant past the 50th, found by part of their name.
  const beyond = names[75];
  const part = beyond.slice(2, 8).toLowerCase();
  await picker.fill(part);
  // (A Hosts row may add "Can't sign in" after the name.)
  await expect(page.getByRole("option", { name: beyond })).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath(`${shot}-${width}.png`),
    animations: "disabled",
  });

  // An email, or any part of one, finds nothing.
  for (const query of [SCALE_EMAIL, "@jahnelgroup", "jahnelgroup.com", "@"]) {
    await picker.fill(query);
    await expect(options).toHaveCount(0);
  }
  await page.keyboard.press("Escape");
}

test.describe("100 Participants in the XII scale demo", () => {
  test.beforeAll(() => {
    pnpm(["seed:demo:scale"]);
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    pnpm(["seed:load", "--reset", ...localSeedFiles()]);
  });

  test("r22 picker: Discretionary points finds a Participant by name past the 50th and never by email, at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      for (const size of VIEWPORTS) {
        await page.setViewportSize(size[1]);
        await page.goto("/admin/discretionary-points");
        await page
          .getByRole("button", { name: "Give Discretionary points" })
          .click();
        await exerciseScalePicker(
          page,
          page.getByRole("combobox", { name: "Participant" }),
          testInfo,
          "discretionary",
          size,
        );
      }
    } finally {
      await context.close();
    }
  });

  test("r22 picker: the Awards recipients and the Hosts find by name, never by email, at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      const trivia = await competitionId("xii", "Trivia Night");
      for (const size of VIEWPORTS) {
        await page.setViewportSize(size[1]);
        await page.goto("/admin/awards");
        await page.getByRole("button", { name: "Add Award" }).click();
        await exerciseScalePicker(
          page,
          page.getByRole("combobox", { name: /^Participants/ }),
          testInfo,
          "awards",
          size,
        );
        await page.goto(`/admin/competitions/${trivia}`);
        await exerciseScalePicker(
          page,
          page.getByRole("combobox", { name: "Hosts", exact: true }),
          testInfo,
          "hosts",
          size,
        );
      }
    } finally {
      await context.close();
    }
  });

  test("r22 picker: the Placement sheet, Head-to-head Entrants and an Attempt's Participant find by name, never by email, at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const { context, page } = await organizerPage(browser);
    try {
      const trivia = await competitionId("xii", "Trivia Night");
      const cornhole = await competitionId("xii", "Cornhole");
      const darts = await competitionId("xii", "Darts");
      for (const size of VIEWPORTS) {
        await page.setViewportSize(size[1]);
        await page.goto(`/admin/competitions/${trivia}`);
        await exerciseScalePicker(
          page,
          page.getByRole("combobox", { name: "Add a Participant" }),
          testInfo,
          "placement-sheet",
          size,
        );
        await page.goto(`/admin/competitions/${cornhole}`);
        // Head-to-head picks "A vs B": Participant A, emptied (which saves
        // nothing), offers the 99 who aren't Participant B.
        await page.getByRole("button", { name: "Clear Participant A" }).click();
        await exerciseScalePicker(
          page,
          page.getByRole("combobox", { name: "Participant A", exact: true }),
          testInfo,
          "entrants",
          size,
          99,
        );
        await page.goto(`/admin/competitions/${darts}`);
        await page.getByRole("button", { name: "Log an Attempt" }).click();
        await exerciseScalePicker(
          page,
          page
            .getByRole("dialog", { name: "Log an Attempt" })
            .getByRole("combobox", { name: "Participant" }),
          testInfo,
          "attempt",
          size,
        );
      }
    } finally {
      await context.close();
    }
  });

  test("r22 picker: the Participation filter shows avatar and name rows and filters by name alone, at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      const stretch = await competitionId("xii", "Morning Stretch");
      for (const [width, size] of VIEWPORTS) {
        await page.setViewportSize(size);
        await page.goto(`/admin/competitions/${stretch}`);
        const roster = page.getByRole("list", { name: "Roster" });
        const rows = roster.locator("> li");
        await expect(rows).toHaveCount(100);
        const names = await namesOf(rows);
        const beyond = names[75];
        // Avatar and name on each row.
        await expect(rows.nth(75).locator('[data-slot="avatar"]')).toHaveCount(
          1,
        );
        await expect(rows.nth(75).locator("span.truncate")).toHaveText(beyond);
        const search = page.getByRole("searchbox", {
          name: "Search the roster",
        });
        await search.fill(beyond.slice(2, 8).toLowerCase());
        await expect(rows.filter({ hasText: beyond })).toHaveCount(1);
        await roster.scrollIntoViewIfNeeded();
        await page.screenshot({
          path: testInfo.outputPath(`participation-filter-${width}.png`),
          animations: "disabled",
        });
        // An email finds no one.
        for (const query of [SCALE_EMAIL, "@jahnelgroup", "jahnelgroup.com"]) {
          await search.fill(query);
          await expect(rows).toHaveCount(0);
          await expect(page.getByText("No one matches.")).toBeVisible();
        }
        if (size === PHONE) await expectNoSidewaysScroll(page);
      }
    } finally {
      await context.close();
    }
  });
});

test("r22 picker: in a teams War Week every row shows avatar, name and Team, and the Team is not searched, at 1440 and 390", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const { context, page } = await organizerPage(browser);
  try {
    // Demo XI is live, with Teams (Red and Blue among them).
    const [{ name, team }] = await runQuery<{ name: string; team: string }>(
      `select p.display_name as name, t.name as team
       from participant p join team t on t.id = p.team_id
       join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name = 'Ashley Schuliger'`,
    );
    for (const [width, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      await page.goto("/admin/discretionary-points");
      await page
        .getByRole("button", { name: "Give Discretionary points" })
        .click();
      const picker = page.getByRole("combobox", { name: /Participant$/ });
      await picker.fill("Ashley");
      const row = page.getByRole("option", { name: new RegExp(`^${name}`) });
      await expect(row).toHaveCount(1);
      await expect(row.locator('[data-slot="avatar"]')).toHaveCount(1);
      await expect(row).toContainText(team);
      await expectRowsDoNotWrap(page.getByRole("option"));
      await page.screenshot({
        path: testInfo.outputPath(`teams-discretionary-${width}.png`),
        animations: "disabled",
      });
      // The Team's name is not a search term: a Team name finds the Team
      // itself (offered here beside Participants), not its members.
      await picker.fill(team);
      await expect(
        page.getByRole("option", { name: new RegExp(`^${name}`) }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    }

    // The Participation filter on a team-scoring Competition: each row is
    // avatar, name and Team, and the filter takes a name, not a Team.
    const checkin = await competitionId("xi", "Daily Workout Check-in");
    for (const [width, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      await page.goto(`/admin/competitions/${checkin}`);
      const rows = page.getByRole("list", { name: "Roster" }).locator("> li");
      const search = page.getByRole("searchbox", { name: "Search the roster" });
      await search.fill("Ashley");
      const row = rows.filter({ hasText: name });
      await expect(row).toHaveCount(1);
      await expect(row.locator('[data-slot="avatar"]')).toHaveCount(1);
      await expect(row).toContainText(team);
      await rows.first().scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`teams-participation-${width}.png`),
        animations: "disabled",
      });
      await search.fill(team);
      await expect(row).toHaveCount(0);
    }
  } finally {
    await context.close();
  }
});

test("r22 picker: the Squads picker shows avatar, name and Team rows, finds by name and not by Team, at 1440 and 390", async ({
  browser,
}, testInfo) => {
  test.setTimeout(90_000);
  const { context, page } = await organizerPage(browser);
  const name = "E2E R22 Picker Squads";
  try {
    // A team-scoring Bracket in demo XI: its Squads are made on its page.
    const id = await addXiCompetition(name, {
      format: "bracket",
      scoring: "team",
      scoreDirection: "higher",
      bracketConfig: DEFAULT_BRACKET_CONFIG,
    });
    const [{ person, team }] = await runQuery<{
      person: string;
      team: string;
    }>(
      `select p.display_name as person, t.name as team
       from participant p join team t on t.id = p.team_id
       join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name = 'Ashley Schuliger'`,
    );
    for (const [width, size] of VIEWPORTS) {
      await page.setViewportSize(size);
      await page.goto(`/admin/competitions/${id}`);
      await page.getByRole("button", { name: "Add Squad" }).click();
      const sheet = page.getByRole("dialog", { name: "Add Squad" });
      await sheet.getByRole("combobox", { name: "Team", exact: true }).click();
      await page.getByRole("option", { name: team, exact: true }).click();
      const find = sheet.getByRole("combobox", { name: /^Participants/ });
      await find.click();
      const options = page.getByRole("option");
      expect(await options.count()).toBeGreaterThan(1);
      // Every row is avatar, name and the Squad's Team.
      for (const row of await options.all()) {
        await expect(row.locator('[data-slot="avatar"]')).toHaveCount(1);
        await expect(row).toContainText(team);
      }
      await expectRowsDoNotWrap(options);
      await page.screenshot({
        path: testInfo.outputPath(`squads-picker-${width}.png`),
        animations: "disabled",
      });
      // Found by name; the Team's name is not a search term.
      await find.fill("Ashley");
      await expect(
        page.getByRole("option", { name: new RegExp(`^${person}`) }),
      ).toHaveCount(1);
      await find.fill(team);
      await expect(
        page.getByRole("option", { name: new RegExp(`^${person}`) }),
      ).toHaveCount(0);
      await page.keyboard.press("Escape");
    }
  } finally {
    await deleteXiCompetition(name);
    await context.close();
  }
});
