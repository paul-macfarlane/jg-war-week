import AxeBuilder from "@axe-core/playwright";
import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";
import { PROVISIONAL_TEXT } from "@/lib/results-table";
import type { ColorScheme } from "@/lib/theme";

import { openCompetitionPage } from "./competition-page";
import { runQuery, xiCompetitionEntries, xiParticipantId } from "./db";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

// Epic R20, deliverable D1 (.scratch/competition-results/spec.md, decisions
// 1 and 2): every ranked view is one results table that sorts by each
// header (`aria-sort` set, Rank by default), marks the Winner with text,
// has no "Score" text in its cells and never scrolls the page sideways;
// an open Competition's points are Provisional (a tooltip reachable by
// keyboard), and once Closed they equal the generated Points Entries. The
// Placement Competition is this spec's own `E2E R20 …` row in XI, deleted
// in `finally`; the leaderboard checks only read.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** Four placed by hand, a tie at 2nd; Placement Points 10 / 6 / 3. */
const ROWS = [
  { name: "Ashley Schuliger", place: 1, score: 50 },
  { name: "Graham Macbeth", place: 2, score: 40 },
  { name: "Sam Schantz", place: 2, score: 40 },
  { name: "Brandon Badgett", place: 4, score: 30 },
] as const;
/**
 * Worked by hand: 1st gets 10; the tie at 2nd each get 6 in full; 4th is
 * beyond the list and gets nothing ("–").
 */
const PROVISIONAL_POINTS = ["10", "6", "6", "–"];

/** The names in each order a header gives, worked by hand from ROWS. */
const ORDER = {
  rankAscending: [
    "Ashley Schuliger",
    "Graham Macbeth",
    "Sam Schantz",
    "Brandon Badgett",
  ],
  rankDescending: [
    "Brandon Badgett",
    "Graham Macbeth",
    "Sam Schantz",
    "Ashley Schuliger",
  ],
  nameAscending: [
    "Ashley Schuliger",
    "Brandon Badgett",
    "Graham Macbeth",
    "Sam Schantz",
  ],
  nameDescending: [
    "Sam Schantz",
    "Graham Macbeth",
    "Brandon Badgett",
    "Ashley Schuliger",
  ],
  scoreDescending: [
    "Ashley Schuliger",
    "Graham Macbeth",
    "Sam Schantz",
    "Brandon Badgett",
  ],
  scoreAscending: [
    "Brandon Badgett",
    "Graham Macbeth",
    "Sam Schantz",
    "Ashley Schuliger",
  ],
  // Brandon has no points, so he's last both ways.
  pointsDescending: [
    "Ashley Schuliger",
    "Graham Macbeth",
    "Sam Schantz",
    "Brandon Badgett",
  ],
  pointsAscending: [
    "Graham Macbeth",
    "Sam Schantz",
    "Ashley Schuliger",
    "Brandon Badgett",
  ],
};

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

/** An individual Placement Competition in XI with ROWS placed, still open. */
async function addOpenPlacement(name: string): Promise<string> {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, counts_toward_team, format, score_direction, placement_points)
     select id, $1, 'individual', true, 'placement', 'higher', '{10,6,3}'
     from war_week where edition = 'xi'
     returning id`,
    [name],
  );
  for (const row of ROWS) {
    await runQuery(
      `insert into placement (competition_id, participant_id, place, score)
       values ($1, $2, $3, $4)`,
      [id, await xiParticipantId(row.name), row.place, row.score],
    );
  }
  return id;
}

function headerOf(table: Locator, name: string) {
  return table
    .getByRole("columnheader")
    .filter({ has: table.page().getByRole("button", { name, exact: true }) });
}

/** Presses a header's sort button and checks its `aria-sort` and the order. */
async function sortBy(
  table: Locator,
  header: string,
  direction: "ascending" | "descending",
  names: string[],
) {
  await table.getByRole("button", { name: header, exact: true }).click();
  await expect(headerOf(table, header)).toHaveAttribute("aria-sort", direction);
  await expect(table.locator('[data-slot="results-name"]')).toHaveText(names);
}

/** Every header's sort, both ways, on the Placement results table. */
async function sortEveryHeader(table: Locator) {
  await sortBy(table, "Participant", "ascending", ORDER.nameAscending);
  await expect(headerOf(table, "Rank")).toHaveAttribute("aria-sort", "none");
  await sortBy(table, "Participant", "descending", ORDER.nameDescending);
  await sortBy(table, "Score", "descending", ORDER.scoreDescending);
  await sortBy(table, "Score", "ascending", ORDER.scoreAscending);
  await sortBy(table, "War Week points", "descending", ORDER.pointsDescending);
  await sortBy(table, "War Week points", "ascending", ORDER.pointsAscending);
  await sortBy(table, "Rank", "ascending", ORDER.rankAscending);
  await sortBy(table, "Rank", "descending", ORDER.rankDescending);
  await sortBy(table, "Rank", "ascending", ORDER.rankAscending);
}

test("r20 D1 a Placement's results table sorts by every header, marks the Winner, shows Provisional points until Close, then the generated Points Entries", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R20 Darts ${Date.now()}`;
  const id = await addOpenPlacement(name);
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await page.goto(`/xi/competitions/${id}`);
    const region = page.getByRole("region", { name: "Placements" });
    const table = region.getByRole("table", { name: "Placement results" });

    // Default: Rank, best first; the Winner by mark and text.
    await expect(headerOf(table, "Rank")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(table.locator('[data-slot="results-name"]')).toHaveText(
      ORDER.rankAscending,
    );
    const first = table.locator('tr[data-slot="results-row"]').first();
    await expect(first.getByRole("rowheader")).toContainText("Winner");
    await expect(
      table
        .locator('tr[data-slot="results-row"]')
        .filter({ hasText: "Winner" }),
    ).toHaveCount(1);
    await expect(
      table.locator('tr[data-slot="results-row"]').getByRole("cell"),
    ).toHaveText(
      ROWS.flatMap((row, i) => [
        String(row.place),
        String(row.score),
        PROVISIONAL_POINTS[i],
      ]),
    );
    // Values only: no "Score" inside the body.
    await expect(table.locator("tbody")).not.toContainText("Score");
    // Top finishers above the table: the decided places, 1st the Winner.
    const top = region.getByRole("region", { name: "Top finishers" });
    await expect(top.getByRole("listitem")).toHaveCount(3);
    await expect(top.getByRole("listitem").first()).toContainText("1st");
    await expect(top.getByRole("listitem").first()).toContainText("Winner");
    await expect(top.getByRole("listitem").first()).toContainText("10 points");

    // Open: Provisional on the points header; Tab reaches its tooltip.
    const provisional = table.getByRole("button", { name: "Provisional" });
    await expect(provisional).toBeVisible();
    await table
      .getByRole("button", { name: "War Week points", exact: true })
      .focus();
    await page.keyboard.press("Tab");
    await expect(provisional).toBeFocused();
    await expect(page.getByText(PROVISIONAL_TEXT)).toBeVisible();
    await shoot(page, testInfo, "placement-provisional-tooltip-1440");
    await page.keyboard.press("Escape");

    await sortEveryHeader(table);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "placement-open-1440");

    // 390: the points fold under the name (with their own sort button);
    // nothing is dropped and the page doesn't scroll sideways.
    await page.setViewportSize(PHONE);
    await page.reload();
    await expect(
      table.locator('[data-slot="results-points-folded"]'),
    ).toHaveText(["10 points", "6 points", "6 points", "No points"]);
    await expect(
      table.getByRole("button", { name: "Provisional" }),
    ).toBeVisible();
    await sortEveryHeader(table);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "placement-open-390");

    // Close the sheet as an Organizer.
    await page.setViewportSize(DESKTOP);
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "Close this Competition?" })
      .getByRole("button", { name: "Close" })
      .click();
    await expect(page.getByText("Competition closed")).toBeVisible();

    // Closed: no badge; each row's points are its generated Points Entries.
    await page.goto(`/xi/competitions/${id}`);
    await expect(region.getByText("Closed", { exact: true })).toBeVisible();
    await expect(
      table.getByRole("button", { name: "Provisional" }),
    ).toHaveCount(0);
    const entries = await xiCompetitionEntries(name);
    expect(entries.length).toBe(3);
    expect(entries.every((entry) => entry.generated)).toBe(true);
    const byName = new Map(
      entries.map((entry) => [entry.target, entry.points]),
    );
    for (const row of ROWS) {
      const tableRow = table
        .locator('tr[data-slot="results-row"]')
        .filter({ hasText: row.name });
      const shown = byName.get(row.name);
      await expect(tableRow.locator('[data-slot="results-points"]')).toHaveText(
        shown === undefined ? "–" : String(shown),
      );
    }
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "placement-closed-1440");
    await page.setViewportSize(PHONE);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "placement-closed-390");
  } finally {
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});

test("r20 D1 a team Participation's results table ranks Teams by headcount with Provisional points, at 1440 and 390", async ({
  context,
  page,
}, testInfo) => {
  const name = `E2E R20 Check-in ${Date.now()}`;
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, format, placement_points)
     select id, $1, 'team', 'participation', '{5,3}'
     from war_week where edition = 'xi'
     returning id`,
    [name],
  );
  try {
    // Two from Red, one from Blue (their Teams in the XI demo).
    for (const who of ["Ashley Schuliger", "Sam Schantz", "Graham Macbeth"]) {
      await runQuery(
        `insert into participation
           (competition_id, participant_id, marked_by_email, checked_in)
         values ($1, $2, 'e2e-host@jahnelgroup.com', false)`,
        [id, await xiParticipantId(who)],
      );
    }
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    for (const viewport of [DESKTOP, PHONE]) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      const table = page.getByRole("table", { name: "Team counts" });
      await expect(headerOf(table, "Rank")).toHaveAttribute(
        "aria-sort",
        "ascending",
      );
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        "Red",
        "Blue",
      ]);
      await expect(
        table.getByRole("button", { name: "Score (headcount)", exact: true }),
      ).toBeVisible();
      await expect(
        table
          .locator('tr[data-slot="results-row"]')
          .first()
          .getByRole("rowheader"),
      ).toContainText("Winner");
      await expect(
        table.getByRole("button", { name: "Provisional" }),
      ).toBeVisible();
      await expect(table.locator("tbody")).not.toContainText("Score");
      if (viewport === DESKTOP) {
        // Rank, headcount and points (1st's 5, 2nd's 3), worked by hand.
        await expect(
          table.locator('tr[data-slot="results-row"]').getByRole("cell"),
        ).toHaveText(["1", "2", "5", "2", "1", "3"]);
      } else {
        await expect(
          table.locator('[data-slot="results-points-folded"]'),
        ).toHaveText(["5 points", "3 points"]);
      }
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `participation-${viewport.width}`);
    }
  } finally {
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});

/** The ranks, names and points a results table shows, row by row. */
async function tableRows(table: Locator) {
  const rows = table.locator('tr[data-slot="results-row"]');
  const ranks = (await rows.locator("td:first-child").allInnerTexts()).map(
    (text) => Number(text.trim()),
  );
  const names = (
    await table.locator('[data-slot="results-name"]').allInnerTexts()
  ).map((text) => text.trim());
  const points = (
    await table.locator('[data-slot="results-points"]').allInnerTexts()
  ).map((text) => Number(text.replace(/,/g, "")));
  return { ranks, names, points };
}

const nonIncreasing = (values: number[]) =>
  values.every((value, i) => i === 0 || values[i - 1] >= value);
const nonDecreasing = (values: number[]) =>
  values.every((value, i) => i === 0 || values[i - 1] <= value);

/** Every header's sort on a leaderboard table, checked against its rows. */
async function sortLeaderboard(table: Locator, entrantHeader: string) {
  const byRank = await tableRows(table);
  expect(byRank.names.length).toBeGreaterThan(1);
  expect(nonDecreasing(byRank.ranks)).toBe(true);
  expect(nonIncreasing(byRank.points)).toBe(true);

  await table.getByRole("button", { name: entrantHeader, exact: true }).click();
  await expect(headerOf(table, entrantHeader)).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  const byName = await tableRows(table);
  expect(byName.names).toEqual(
    [...byRank.names].sort((a, b) => a.localeCompare(b)),
  );

  await table
    .getByRole("button", { name: "War Week points", exact: true })
    .click();
  await expect(headerOf(table, "War Week points")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  expect(nonIncreasing((await tableRows(table)).points)).toBe(true);
  await table
    .getByRole("button", { name: "War Week points", exact: true })
    .click();
  await expect(headerOf(table, "War Week points")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  expect(nonDecreasing((await tableRows(table)).points)).toBe(true);

  await table.getByRole("button", { name: "Rank", exact: true }).click();
  await expect(headerOf(table, "Rank")).toHaveAttribute(
    "aria-sort",
    "ascending",
  );
  await table.getByRole("button", { name: "Rank", exact: true }).click();
  await expect(headerOf(table, "Rank")).toHaveAttribute(
    "aria-sort",
    "descending",
  );
  expect(nonIncreasing((await tableRows(table)).ranks)).toBe(true);
}

/** XI's Team totals from independent SQL, best first. */
async function xiTeamTotalsBestFirst(): Promise<string[]> {
  const rows = await runQuery<{ name: string; total: number }>(
    `select t.name, (
       coalesce((select sum(pe.points) from points_entry pe
                 where pe.team_id = t.id), 0)
       + coalesce((select sum(pe.points) from points_entry pe
                   join participant p on p.id = pe.participant_id
                   left join competition c on c.id = pe.competition_id
                   where p.team_id = t.id
                     and (pe.competition_id is null or c.counts_toward_team)), 0)
     )::float as total
     from team t join war_week w on w.id = t.war_week_id and w.edition = 'xi'
     order by total desc, t.name asc`,
  );
  return rows.map((row) => row.name);
}

test("r20 D1 the leaderboard's tables sort by every header, mark the Winner and fit at 390", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  for (const viewport of [DESKTOP, PHONE]) {
    await page.setViewportSize(viewport);
    await page.goto("/xi/leaderboard");
    const teams = page.getByRole("table", {
      name: "Team standings",
      exact: true,
    });
    const people = page.getByRole("table", {
      name: "Individual leaderboard",
      exact: true,
    });
    // Default: Rank; no Score column and no Provisional badge.
    await expect(headerOf(teams, "Rank")).toHaveAttribute(
      "aria-sort",
      "ascending",
    );
    await expect(teams.locator("thead")).not.toContainText("Score");
    await expect(page.getByRole("button", { name: "Provisional" })).toHaveCount(
      0,
    );
    await expect(teams.locator("tbody")).not.toContainText("Score");
    await expect(
      teams
        .locator('tr[data-slot="results-row"]')
        .first()
        .getByRole("rowheader"),
    ).toContainText("Winner");
    await expect(
      people
        .locator('tr[data-slot="results-row"]')
        .first()
        .getByRole("rowheader"),
    ).toContainText("Winner");

    if (viewport === DESKTOP) {
      // The Team order is the independent SQL totals' order.
      await expect(teams.locator('[data-slot="results-name"]')).toHaveText(
        await xiTeamTotalsBestFirst(),
      );
      await sortLeaderboard(teams, "Team");
      await sortLeaderboard(people, "Participant");
    } else {
      // At 390 the points fold under the name, and their sort still works.
      await expect(
        teams.locator('[data-slot="results-points-folded"]').first(),
      ).toBeVisible();
      await teams
        .getByRole("button", { name: "War Week points", exact: true })
        .click();
      await expect(headerOf(teams, "Team")).toBeVisible();
      await expect(teams.locator('[data-slot="results-name"]')).toHaveText(
        await xiTeamTotalsBestFirst(),
      );
    }
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, `leaderboard-${viewport.width}`);
  }
});

const SCHEMES: ColorScheme[] = ["light", "dark"];

for (const scheme of SCHEMES) {
  test(`r20 D1 the results table and Top finishers have no axe violations (${scheme})`, async ({
    context,
    page,
  }, testInfo) => {
    const name = `E2E R20 Axe ${scheme} ${Date.now()}`;
    const id = await addOpenPlacement(name);
    try {
      await signIn(context, E2E_PARTICIPANT_EMAIL);
      await context.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [DISPLAY_STORAGE_KEY, scheme] as const,
      );
      await page.emulateMedia({
        colorScheme: scheme === "dark" ? "light" : "dark",
      });
      await page.setViewportSize(DESKTOP);
      for (const { path, include } of [
        {
          path: `/xi/competitions/${id}`,
          include: ["table", '[aria-label="Top finishers"]'],
        },
        { path: "/xi/leaderboard", include: ["table"] },
      ]) {
        await page.goto(path);
        await expect(page.locator("table").first()).toBeVisible();
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
        const builder = new AxeBuilder({ page });
        for (const selector of include) builder.include(selector);
        const results = await builder.withTags(["wcag2a", "wcag2aa"]).analyze();
        expect(results.violations).toEqual([]);
      }
      await shoot(page, testInfo, `leaderboard-${scheme}`);
    } finally {
      await runQuery(`delete from competition where id = $1`, [id]);
    }
  });
}
