import AxeBuilder from "@axe-core/playwright";
import { type Locator, type Page, expect, test } from "@playwright/test";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";
import type { ColorScheme } from "@/lib/theme";

import { openCompetitionPage } from "./competition-page";
import { runQuery } from "./db";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
  shoot,
} from "./r21-logging";
import {
  type SqlMatch,
  addLeagueMatches,
  matchLines,
  matchRows,
  roundSection,
} from "./r23-league";
import {
  E2E_PARTICIPANT_EMAIL,
  asOrganizer,
  participantPageAs,
  signIn,
} from "./session";

// Epic R23, AC 7 (.scratch/league/spec.md, decisions 10 and 11; reading
// R6, R7): a round robin of 5 made by SQL, its results the hand-worked
// fixture of the plan (Ashley A, Sam B, Graham C, Brandon D, Abby E): the
// table's headers and values, the Provisional badge, every header sorting,
// the rounds, "Your next Match" for a linked Participant, no sideways
// scroll at 390 and axe (wcag2a/aa) in light and dark; and a round-robin
// Edit pairings that would repeat a Match shows the swap warning. Each
// League is the test's own, deleted in `finally`.

const [A, B, C, D, E] = [
  "Ashley Schuliger",
  "Sam Schantz",
  "Graham Macbeth",
  "Brandon Badgett",
  "Abby Rivera",
];
const PEOPLE = [A, B, C, D, E];
const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/**
 * Five rounds, each Entrant sitting out once; results from the plan's AC 1
 * fixture: A beat B, A-C draw, A beat D, E beat A, B beat C, B-D draw, B
 * beat E, C beat D, C-E draw, D-E draw (left unplayed at first).
 */
const ROUNDS: SqlMatch[] = [
  { round: 1, position: 0, a: A, b: B, result: "a" },
  { round: 1, position: 1, a: C, b: D, result: "a" },
  { round: 1, position: 2, a: E, b: null },
  { round: 2, position: 0, a: A, b: C, result: "draw" },
  { round: 2, position: 1, a: B, b: E, result: "a" },
  { round: 2, position: 2, a: D, b: null },
  { round: 3, position: 0, a: A, b: D, result: "a" },
  { round: 3, position: 1, a: C, b: E, result: "draw" },
  { round: 3, position: 2, a: B, b: null },
  { round: 4, position: 0, a: A, b: E, result: "b" },
  { round: 4, position: 1, a: B, b: D, result: "draw" },
  { round: 4, position: 2, a: C, b: null },
  { round: 5, position: 0, a: B, b: C, result: "a" },
  { round: 5, position: 1, a: D, b: E },
  { round: 5, position: 2, a: A, b: null },
];

/** Worked by hand: rank, W, D, L, Match points, H2H, SB (tied on points only). */
const TABLE: Record<string, string[]> = {
  [A]: ["1", "2", "1", "1", "2½", "1", "4.5"],
  [B]: ["2", "2", "1", "1", "2½", "0", "4.5"],
  [E]: ["3", "1", "2", "1", "2", "½", "4"],
  [C]: ["4", "1", "2", "1", "2", "½", "3.25"],
  [D]: ["5", "0", "2", "2", "1", "–", "2.25"],
};
const RANK_ORDER = [A, B, E, C, D];

async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

function headerOf(table: Locator, name: string) {
  return table
    .getByRole("columnheader")
    .filter({ has: table.page().getByRole("button", { name, exact: true }) });
}

async function names(table: Locator) {
  return table.locator('[data-slot="results-name"]').allInnerTexts();
}

/** A stat column's cells, in row order, as numbers ("½" counts as .5; "–" is none). */
async function column(table: Locator, slot: string) {
  const texts = await table.locator(`[data-slot="${slot}"]`).allInnerTexts();
  return texts.map((text) => {
    if (text === "–") return null;
    const half = text.endsWith("½");
    const whole = text.replace("½", "");
    return Number(whole || 0) + (half ? 0.5 : 0);
  });
}

/** Sorted by a stat header: aria-sort set and the column monotonic, missing last. */
async function sortStat(
  table: Locator,
  header: string,
  slot: string,
  direction: "ascending" | "descending",
) {
  await table.getByRole("button", { name: header, exact: true }).click();
  await expect(headerOf(table, header)).toHaveAttribute("aria-sort", direction);
  const values = await column(table, slot);
  const present = values.filter((v): v is number => v !== null);
  const tail = values.slice(present.length);
  expect(
    tail.every((v) => v === null),
    header,
  ).toBe(true);
  expect(values.slice(0, present.length), header).toEqual(
    [...present].sort((x, y) => (direction === "ascending" ? x - y : y - x)),
  );
}

async function makeRoundRobin(name: string, matches = ROUNDS) {
  const id = await addXiCompetition(name, {
    format: "league",
    leagueConfig: { pairing: "round-robin", rounds: null },
    placementPoints: [10, 6, 3],
  });
  await addEntrants(id, PEOPLE);
  await addLeagueMatches(id, matches);
  return id;
}

test("r23 AC7 a round robin's Participant page: table with tiebreaks and the Provisional badge, every header sorts, the rounds and Your next Match, no sideways scroll", async ({
  browser,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `E2E R23 Page ${Date.now()}`;
  const id = await makeRoundRobin(name);
  const opened: Awaited<ReturnType<typeof participantPageAs>>[] = [];
  try {
    const brandon = await participantPageAs(browser, D);
    opened.push(brandon);
    const page = brandon.page;
    await page.setViewportSize(DESKTOP);
    await page.goto(`/xi/competitions/${id}`);

    // Your next Match: the round and the opponent.
    const next = page.getByRole("region", { name: "Your next Match" });
    await expect(next).toContainText(`Round 5 · v ${E}`);
    await shoot(page, testInfo, "page-next-match");

    // The rounds: 5, each with 2 Matches and a sit-out; unplayed reads "v".
    for (const round of [1, 2, 3, 4, 5]) {
      await expect(roundSection(page, round)).toBeVisible();
      await expect(matchRows(page, round)).toHaveCount(3);
    }
    expect(await matchLines(page, 1)).toEqual([
      `${A} 1–0 ${B}`,
      `${C} 1–0 ${D}`,
      `${E} sits out`,
    ]);
    expect(await matchLines(page, 5)).toEqual([
      `${B} 1–0 ${C}`,
      `${D} v ${E}`,
      `${A} sits out`,
    ]);
    await expect(
      page.locator('li[data-slot="league-match"][data-you]'),
    ).toHaveCount(5); // Brandon's 4 Matches and his sit-out

    // The last Match is played (a draw): the card goes, the table is final.
    await runQuery(
      `update league_match m set result = 'draw', recorded_at = now()
       from entrant e join participant p on p.id = e.participant_id
       where m.entrant_a_id = e.id and m.competition_id = $1
         and p.display_name = $2 and m.round = 5`,
      [id, D],
    );
    await page.reload();
    await expect(next).toHaveCount(0);

    const table = page.getByRole("table", { name: "League results" });
    await expect(
      table.getByRole("button", { name: "Provisional" }),
    ).toBeVisible();
    for (const header of [
      "Rank",
      "Participant",
      "W",
      "D",
      "L",
      "Match points",
      "H2H",
      "SB",
      "War Week points",
    ]) {
      await expect(
        table.getByRole("button", { name: header, exact: true }),
        header,
      ).toBeVisible();
    }
    await expect(table.getByRole("columnheader")).toHaveCount(9);
    expect(await names(table)).toEqual(RANK_ORDER);
    const rows = table.locator('tr[data-slot="results-row"]');
    for (const person of RANK_ORDER) {
      const row = rows.filter({ hasText: person });
      const cells = await Promise.all(
        [
          "",
          "-wins",
          "-draws",
          "-losses",
          "-matchPoints",
          "-headToHead",
          "-sonnebornBerger",
        ].map(async (suffix, i) =>
          i === 0
            ? row.getByRole("cell").first().innerText()
            : row.locator(`[data-slot="results-stat${suffix}"]`).innerText(),
        ),
      );
      expect(
        cells.map((cell) => cell.trim()),
        person,
      ).toEqual(TABLE[person]);
    }
    // Provisional points: 10 / 6 / 3, then none; a tie shares in full.
    await expect(rows.locator('[data-slot="results-points"]')).toHaveText([
      "10",
      "6",
      "3",
      "–",
      "–",
    ]);

    // Every header sorts.
    await expect(headerOf(table, "Rank")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await table
      .getByRole("button", { name: "Participant", exact: true })
      .click();
    expect(await names(table)).toEqual([...PEOPLE].sort());
    await sortStat(table, "W", "results-stat-wins", "descending");
    await sortStat(table, "W", "results-stat-wins", "ascending");
    await sortStat(table, "D", "results-stat-draws", "descending");
    await sortStat(table, "L", "results-stat-losses", "descending");
    await sortStat(
      table,
      "Match points",
      "results-stat-matchPoints",
      "descending",
    );
    await sortStat(
      table,
      "Match points",
      "results-stat-matchPoints",
      "ascending",
    );
    await sortStat(table, "H2H", "results-stat-headToHead", "descending");
    await sortStat(table, "H2H", "results-stat-headToHead", "ascending");
    await sortStat(table, "SB", "results-stat-sonnebornBerger", "descending");
    await sortStat(table, "SB", "results-stat-sonnebornBerger", "ascending");
    await table
      .getByRole("button", { name: "War Week points", exact: true })
      .click();
    await expect(headerOf(table, "War Week points")).toHaveAttribute(
      "aria-sort",
      "descending",
    );
    await table.getByRole("button", { name: "Rank", exact: true }).click();
    await expect(headerOf(table, "Rank")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    expect(await names(table)).toEqual(RANK_ORDER);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "page-table");

    // 390: the tiebreaks fold under the name; nothing scrolls sideways.
    await page.setViewportSize(PHONE);
    await page.reload();
    await expect(
      table.locator('[data-slot="results-stats-folded"]').first(),
    ).toContainText("2 W");
    await expect(
      table.locator('[data-slot="results-stats-folded"]'),
    ).toHaveCount(5);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "page-table-phone");
  } finally {
    for (const session of opened) await session.close();
    await deleteCompetitions(name);
  }
});

for (const scheme of ["light", "dark"] as ColorScheme[]) {
  test(`r23 AC7 a League's Participant page has no axe violations (${scheme})`, async ({
    context,
    page,
  }) => {
    test.setTimeout(120_000);
    const name = `E2E R23 Axe ${scheme} ${Date.now()}`;
    const id = await makeRoundRobin(name);
    try {
      await signIn(context, E2E_PARTICIPANT_EMAIL);
      await context.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [DISPLAY_STORAGE_KEY, scheme] as const,
      );
      await page.emulateMedia({
        colorScheme: scheme === "dark" ? "light" : "dark",
      });
      for (const viewport of [DESKTOP, PHONE]) {
        await page.setViewportSize(viewport);
        await page.goto(`/xi/competitions/${id}`);
        await expect(
          page.getByRole("table", { name: "League results" }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.dataset.display),
        ).toBe(scheme);
        await page.evaluate(() =>
          Promise.allSettled(
            document
              .getAnimations()
              .filter((a) => a.effect?.getTiming().iterations !== Infinity)
              .map((a) => a.finished),
          ),
        );
        const results = await new AxeBuilder({ page })
          .include("main")
          .withTags(["wcag2a", "wcag2aa"])
          .analyze();
        expect(results.violations).toEqual([]);
      }
    } finally {
      await deleteCompetitions(name);
    }
  });
}

test("r23 R7 a round robin's Edit pairings that would repeat a Match warns, naming the pairs, and saves anyway", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R23 Swap ${Date.now()}`;
  // 4 Entrants: R1 A-B, C-D; R2 A-C, B-D; R3 A-D, B-C; nothing played.
  const id = await addXiCompetition(name, {
    format: "league",
    leagueConfig: { pairing: "round-robin", rounds: null },
  });
  await addEntrants(id, [A, B, C, D]);
  await addLeagueMatches(id, [
    { round: 1, position: 0, a: A, b: B },
    { round: 1, position: 1, a: C, b: D },
    { round: 2, position: 0, a: A, b: C },
    { round: 2, position: 1, a: B, b: D },
    { round: 3, position: 0, a: A, b: D },
    { round: 3, position: 1, a: B, b: C },
  ]);
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await openCompetitionPage(page, id);
    await roundSection(page, 1)
      .getByRole("button", { name: "Edit pairings" })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit pairings" });
    for (const [label, person] of [
      ["Swap", B],
      ["With", C],
    ]) {
      await edit.getByRole("combobox", { name: label, exact: true }).click();
      await expect(page.getByRole("listbox")).toBeVisible();
      await page.evaluate(() =>
        Promise.allSettled(
          document
            .getAnimations()
            .filter((a) => a.effect?.getTiming().iterations !== Infinity)
            .map((a) => a.finished),
        ),
      );
      await page.getByRole("option", { name: person, exact: true }).click();
    }
    // A-C and B-D would meet twice (round 2); A-B and C-D would never meet.
    const warning = edit.locator('[data-slot="swap-warning"]');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(
      new RegExp(`(${A} and ${C}|${C} and ${A}) would meet twice\\.`),
    );
    await expect(warning).toContainText(
      new RegExp(`(${B} and ${D}|${D} and ${B}) would meet twice\\.`),
    );
    await expect(warning).toContainText(
      new RegExp(`(${A} and ${B}|${B} and ${A}) would never meet\\.`),
    );
    await expect(warning).toContainText(
      new RegExp(`(${C} and ${D}|${D} and ${C}) would never meet\\.`),
    );
    await expect(
      edit.getByRole("button", { name: "Save pairings" }),
    ).toHaveCount(0);
    await shoot(page, testInfo, "swap-warning");
    await edit.getByRole("button", { name: "Swap anyway" }).click();
    await expect(
      page.getByText("Pairings updated", { exact: true }),
    ).toBeVisible();
    await expect(edit).toBeHidden();
    await expect
      .poll(async () => (await matchLines(page, 1)).join("|"))
      .toMatch(new RegExp(`${A} v ${C}\\|${B} v ${D}`));
  } finally {
    await deleteCompetitions(name);
  }
});
