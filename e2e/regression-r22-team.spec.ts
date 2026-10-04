import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";

import { runQuery } from "./db";
import { finaleStage, nextUntil, openFinale } from "./finale-slides";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
} from "./r21-logging";
import { asOrganizer } from "./session";
import { resultsRow } from "./standings";

// Epic R22, Decision 4 (.scratch/people-and-admin/spec.md): in a teams War
// Week (XI) every surface where a Participant competes or scores shows
// their Team: by NAME beside the name where the row has room, by COLOR (the
// Avatar's `data-team-color`, a ring on a picture) where it doesn't (Bracket
// tree nodes, Finale steps, and below `md` the Heat result form). A
// free-for-all War Week (XII) shows none. Expected Teams come from the
// database, not from the page. The specs' own Competitions, the Discretionary
// points and the XII rows are made by SQL and removed in `finally`.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

const ASHLEY = "Ashley Schuliger"; // Red
const ABBY = "Abby Rivera"; // Blue
const SAM = "Sam Schantz"; // Red
const REASON = "E2E R22 Team rule";
const NAMES = {
  bracket: "E2E R22 Team Bracket",
  series: "E2E R22 Team Series",
  table: "E2E R22 Team Head-to-head",
  best: "E2E R22 Team Best score",
  placement: "E2E R22 Team Placement",
} as const;

type Team = { name: string; color: string };
let teamOf: Map<string, Team>;
const ids = {} as Record<keyof typeof NAMES, string>;

async function loadTeams(edition: string): Promise<Map<string, Team>> {
  const rows = await runQuery<{ person: string; team: string; color: string }>(
    `select p.display_name as person, t.name as team, t.color
     from participant p join team t on t.id = p.team_id
     join war_week w on w.id = p.war_week_id where w.edition = $1`,
    [edition],
  );
  return new Map(rows.map((r) => [r.person, { name: r.team, color: r.color }]));
}

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

/** Visits `path` at both viewports; `check` runs at each, then screenshots. */
async function atBothViewports(
  page: Page,
  testInfo: TestInfo,
  path: string,
  surface: string,
  check: (width: "1440" | "390") => Promise<void>,
  prepare?: () => Promise<void>,
) {
  for (const [width, viewport] of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await page.goto(path);
    await prepare?.();
    await check(width);
    await shoot(page, testInfo, `${surface}-${width}`);
    if (width === "390") await expectNoSidewaysScroll(page);
  }
}

/** The Participant's Avatar in `scope` carries their Team's color. */
async function expectTeamColor(scope: Locator, person: string) {
  const color = teamOf.get(person)!.color;
  await expect(
    scope.locator(`[data-slot="avatar"][data-team-color="${color}"]`).first(),
  ).toBeAttached();
}

/** The Participant's Team shows by name in `scope`, visible (or hidden). */
async function expectTeamName(scope: Locator, person: string, shown: boolean) {
  const tag = scope
    .locator(`[data-team-name="${teamOf.get(person)!.name}"]`)
    .first();
  if (shown) {
    await expect(tag).toBeVisible();
    await expect(tag).toHaveText(teamOf.get(person)!.name);
  } else {
    await expect(tag).toBeHidden();
  }
}

test.beforeAll(async () => {
  teamOf = await loadTeams("xi");
  // Ashley (Red) and Abby (Blue) in a Bracket whose one Match is played.
  ids.bracket = await addXiCompetition(NAMES.bracket, {
    format: "bracket",
    bracketConfig: DEFAULT_BRACKET_CONFIG,
    scoreDirection: "higher",
  });
  await addEntrants(ids.bracket, [ASHLEY, ABBY]);
  const [match] = await runQuery<{ id: string }>(
    `insert into bracket_match
       (competition_id, round, position, status, slot_count, advance_count, recorded_at)
     values ($1, 1, 1, 'played', 2, 1, now()) returning id`,
    [ids.bracket],
  );
  await runQuery(
    `insert into bracket_match_entrant (bracket_match_id, entrant_id, slot, place, score)
     select $1, e.id, e.seed_position - 1, e.seed_position, 3 - e.seed_position
     from entrant e where e.competition_id = $2`,
    [match.id, ids.bracket],
  );
  // A two-Entrant Head-to-head (the series view) with one Match played.
  ids.series = await addXiCompetition(NAMES.series, {
    format: "head-to-head",
    scoreDirection: "higher",
  });
  await addEntrants(ids.series, [ASHLEY, ABBY]);
  // A three-Entrant Head-to-head (the results table).
  ids.table = await addXiCompetition(NAMES.table, {
    format: "head-to-head",
    scoreDirection: "higher",
  });
  await addEntrants(ids.table, [ASHLEY, ABBY, SAM]);
  for (const id of [ids.series, ids.table]) {
    const [m] = await runQuery<{ id: string }>(
      `insert into series_match (competition_id, logged_by_email)
       values ($1, 'e2e-organizer@jahnelgroup.com') returning id`,
      [id],
    );
    await runQuery(
      `insert into series_match_entrant (series_match_id, entrant_id, place, score)
       select $1, e.id, e.seed_position, 10 - e.seed_position
       from entrant e where e.competition_id = $2 and e.seed_position <= 2`,
      [m.id, id],
    );
  }
  // Best score: an Attempt each.
  ids.best = await addXiCompetition(NAMES.best, {
    format: "best-score",
    scoreDirection: "higher",
  });
  for (const [person, score] of [
    [ASHLEY, 30],
    [ABBY, 20],
  ] as const) {
    await runQuery(
      `insert into attempt (competition_id, participant_id, score, logged_by_email)
       select $1, p.id, $3, 'e2e-organizer@jahnelgroup.com'
       from participant p join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name = $2`,
      [ids.best, person, score],
    );
  }
  // A Placement sheet, open.
  ids.placement = await addXiCompetition(NAMES.placement, {
    format: "placement",
    scoreDirection: "higher",
  });
  for (const [i, person] of [ASHLEY, ABBY].entries()) {
    await runQuery(
      `insert into placement (competition_id, participant_id, place, score)
       select $1, p.id, $3, $4
       from participant p join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name = $2`,
      [ids.placement, person, i + 1, 20 - i],
    );
  }
  // Discretionary points to Ashley: Recent results and the admin ledger.
  await runQuery(
    `insert into points_entry (war_week_id, participant_id, points, note, entered_by_email)
     select w.id, p.id, 2, $1, 'e2e-organizer@jahnelgroup.com'
     from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xi' and p.display_name = $2`,
    [REASON, ASHLEY],
  );
});

test.afterAll(async () => {
  await runQuery(`delete from points_entry where note = $1`, [REASON]);
  await deleteCompetitions(...Object.values(NAMES));
});

test.beforeEach(async ({ context }) => {
  await asOrganizer(context);
});

test("r22 team: the individual leaderboard names each Participant's Team beside the name at 1440 and 390", async ({
  page,
}, testInfo) => {
  await atBothViewports(
    page,
    testInfo,
    "/xi/leaderboard",
    "leaderboard",
    async () => {
      const rows = page
        .getByRole("table", { name: "Individual leaderboard", exact: true })
        .locator('tr[data-slot="results-row"]');
      expect(await rows.count()).toBeGreaterThan(2);
      for (let i = 0; i < 3; i++) {
        const row = rows.nth(i);
        const person = (
          await row.locator('[data-slot="results-name"]').innerText()
        ).trim();
        expect(teamOf.has(person)).toBe(true);
        await expectTeamName(row, person, true);
        await expectTeamColor(row, person);
      }
    },
  );
});

test("r22 team: Recent results names the Participant's Team beside them", async ({
  page,
}, testInfo) => {
  await atBothViewports(page, testInfo, "/xi", "recent-results", async () => {
    const section = page.getByRole("region", { name: "Recent results" });
    const row = section
      .getByRole("listitem")
      .filter({ hasText: "Discretionary points" })
      .filter({ hasText: REASON });
    await expect(row).toBeVisible();
    await expectTeamName(row, ASHLEY, true);
    await expectTeamColor(row, ASHLEY);
  });
});

test("r22 team: Now/Next tiles are Schedule Items with no Participant, so carry no Team", async ({
  page,
}, testInfo) => {
  await atBothViewports(page, testInfo, "/xi", "now-next", async () => {
    // The tile, when the schedule has something on, holds no Team mark.
    const tile = page
      .locator("main")
      .locator('div:has(> div > a[href$="/schedule"])')
      .first();
    if ((await tile.count()) > 0) {
      await expect(tile.locator("[data-team-name]")).toHaveCount(0);
      await expect(tile.locator("[data-team-color]")).toHaveCount(0);
    }
  });
});

test("r22 team: a Bracket's tree marks nodes by Team color, the podium and the Match result form name the Team", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await atBothViewports(
    page,
    testInfo,
    `/xi/competitions/${ids.bracket}`,
    "bracket",
    async () => {
      // Tree nodes: color only, never the name.
      const tree = page.getByRole("region", { name: "Rounds" });
      await expectTeamColor(tree, ASHLEY);
      await expectTeamColor(tree, ABBY);
      await expect(tree.locator("[data-team-name]")).toHaveCount(0);
      // Top finishers: the Team by name.
      const podium = page.getByRole("region", { name: "Top finishers" });
      await expectTeamName(podium, ASHLEY, true);
      await expectTeamName(podium, ABBY, true);
      await expectTeamColor(podium, ASHLEY);
    },
  );
  // The Match result form, opened from the admin tree.
  await atBothViewports(
    page,
    testInfo,
    `/admin/competitions/${ids.bracket}`,
    "bracket-admin",
    async (width) => {
      // The Match result form: color on each choice; the name at 1440 only.
      await page
        .getByRole("button", {
          name: /^(Edit|Record result for) (?!.*settings)/,
        })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      const winner = dialog.getByRole("group", { name: "Winner" });
      await expectTeamColor(winner, ASHLEY);
      await expectTeamColor(winner, ABBY);
      await expectTeamName(winner, ASHLEY, width === "1440");
      await expectTeamName(winner, ABBY, width === "1440");
      await shoot(page, testInfo, `bracket-form-${width}`);
      await page.keyboard.press("Escape");
      await expect(dialog).toBeHidden();
    },
  );
});

test("r22 team: Head-to-head's series view and results table name the Team", async ({
  page,
}, testInfo) => {
  await atBothViewports(
    page,
    testInfo,
    `/xi/competitions/${ids.series}`,
    "series",
    async () => {
      const series = page.getByRole("region", { name: "Series" });
      await expectTeamName(series, ASHLEY, true);
      await expectTeamName(series, ABBY, true);
      await expectTeamColor(series, ASHLEY);
    },
  );
  await atBothViewports(
    page,
    testInfo,
    `/xi/competitions/${ids.table}`,
    "head-to-head-table",
    async () => {
      const table = page.getByRole("table", {
        name: "Head-to-head results",
        exact: true,
      });
      for (const person of [ASHLEY, ABBY, SAM]) {
        const row = table
          .locator('tr[data-slot="results-row"]')
          .filter({ hasText: person });
        await expectTeamName(row, person, true);
        await expectTeamColor(row, person);
      }
    },
  );
});

test("r22 team: Best score and Placement results tables and Top finishers name the Team", async ({
  page,
}, testInfo) => {
  for (const [key, table, surface] of [
    ["best", "Best score results", "best-score"],
    ["placement", "Placement results", "placement"],
  ] as const) {
    await atBothViewports(
      page,
      testInfo,
      `/xi/competitions/${ids[key]}`,
      surface,
      async () => {
        const results = page.getByRole("table", { name: table, exact: true });
        for (const person of [ASHLEY, ABBY]) {
          const row = resultsRow(page, table, person);
          await expect(row).toHaveCount(1);
          await expectTeamName(row, person, true);
          await expectTeamColor(row, person);
        }
        await expect(results).toBeVisible();
        const finishers = page.getByRole("region", { name: "Top finishers" });
        await expectTeamName(finishers, ASHLEY, true);
        await expectTeamName(finishers, ABBY, true);
      },
    );
  }
});

test("r22 team: Award recipients name the Team on /awards and the Award's history, and the Finale's Awards step marks it by color", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const recipients = await runQuery<{ person: string }>(
    `select p.display_name as person from award a
     join award_participant ap on ap.award_id = a.id
     join participant p on p.id = ap.participant_id
     join war_week w on w.id = a.war_week_id
     where w.edition = 'xi' and a.name = 'Black Midnight'`,
  );
  expect(recipients.length).toBeGreaterThan(1);
  for (const [path, surface] of [
    ["/xi/awards", "awards"],
    ["/history/awards/black-midnight", "history-award"],
  ] as const) {
    await atBothViewports(page, testInfo, path, surface, async () => {
      for (const { person } of recipients) {
        const row = page
          .getByRole("listitem")
          .filter({ hasText: person })
          .last();
        await expectTeamName(row, person, true);
        if (surface === "awards") await expectTeamColor(row, person);
      }
    });
  }
  for (const [width, viewport] of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await openFinale(page);
    await nextUntil(page, "awards");
    const stage = finaleStage(page);
    // Step to an Award with recipients: Finale steps show color only.
    for (let i = 0; i < 12; i++) {
      if (
        (await stage.locator('[data-slot="avatar"][data-team-color]').count()) >
        0
      )
        break;
      await page.keyboard.press("ArrowRight");
    }
    await expect(
      stage.locator('[data-slot="avatar"][data-team-color]').first(),
    ).toBeAttached();
    await expect(stage.locator("[data-team-name]")).toHaveCount(0);
    await shoot(page, testInfo, `finale-awards-${width}`);
    if (width === "390") await expectNoSidewaysScroll(page);
  }
});

test("r22 team: the admin Placement sheet, Participation list, Discretionary points and Award recipients name the Team", async ({
  page,
}, testInfo) => {
  const [{ id: participationId }] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.name = 'Daily Workout Check-in'`,
  );
  await atBothViewports(
    page,
    testInfo,
    `/admin/competitions/${ids.placement}`,
    "admin-placement-sheet",
    async () => {
      const sheet = page.getByRole("list").filter({ hasText: ASHLEY });
      await expect(sheet.first()).toBeVisible();
      await expect(sheet.first()).toContainText(teamOf.get(ASHLEY)!.name);
      await expect(sheet.first()).toContainText(teamOf.get(ABBY)!.name);
    },
  );
  await atBothViewports(
    page,
    testInfo,
    `/admin/competitions/${participationId}`,
    "admin-participation",
    async () => {
      const roster = page.getByRole("list", { name: "Roster" });
      const first = roster.getByRole("listitem").first();
      await expect(first).toBeVisible();
      const person = (
        await first.locator("span.truncate").first().innerText()
      ).trim();
      expect(teamOf.has(person)).toBe(true);
      await expect(first).toContainText(teamOf.get(person)!.name);
      await expectTeamColor(first, person);
    },
  );
  await atBothViewports(
    page,
    testInfo,
    "/admin/points",
    "admin-discretionary",
    async () => {
      const row = page.getByRole("listitem").filter({ hasText: REASON });
      await expect(row).toBeVisible();
      await expectTeamName(row, ASHLEY, true);
    },
  );
  await atBothViewports(
    page,
    testInfo,
    "/admin/awards",
    "admin-awards",
    async () => {
      const [{ person }] = await runQuery<{ person: string }>(
        `select p.display_name as person from award a
       join award_participant ap on ap.award_id = a.id
       join participant p on p.id = ap.participant_id
       join war_week w on w.id = a.war_week_id
       where w.edition = 'xi' and a.name = 'Catan Champion'`,
      );
      const row = page
        .getByRole("listitem")
        .filter({ hasText: "Catan Champion" });
      await expect(row.first()).toContainText(
        `${person} (${teamOf.get(person)!.name})`,
      );
    },
  );
});

test("r22 team: a free-for-all War Week (XII) shows no Team anywhere a Participant scores", async ({
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const [{ id: xiiWeek }] = await runQuery<{ id: string }>(
    `select id from war_week where edition = 'xii'`,
  );
  // XII's roster is empty: one Participant with no Team scores and wins.
  const [xiiPerson] = await runQuery<{ id: string; display_name: string }>(
    `insert into participant (war_week_id, display_name)
     values ($1, 'E2E R22 Free Agent') returning id, display_name`,
    [xiiWeek],
  );
  await runQuery(
    `insert into points_entry (war_week_id, participant_id, points, note, entered_by_email)
     values ($1, $2, 3, $3, 'e2e-organizer@jahnelgroup.com')`,
    [xiiWeek, xiiPerson.id, REASON],
  );
  const [{ id: awardId }] = await runQuery<{ id: string }>(
    `insert into award (war_week_id, name) values ($1, 'E2E R22 Team Award') returning id`,
    [xiiWeek],
  );
  await runQuery(
    `insert into award_participant (award_id, participant_id) values ($1, $2)`,
    [awardId, xiiPerson.id],
  );
  try {
    for (const [path, surface] of [
      ["/xii/leaderboard", "xii-leaderboard"],
      ["/xii", "xii-home"],
      ["/xii/awards", "xii-awards"],
    ] as const) {
      await atBothViewports(page, testInfo, path, surface, async () => {
        // The Participant is on the page (the test can fail), with no Team.
        await expect(
          page.getByText(xiiPerson.display_name).first(),
        ).toBeVisible();
        await expect(page.locator("[data-team-name]")).toHaveCount(0);
        await expect(page.locator("[data-team-color]")).toHaveCount(0);
      });
    }
  } finally {
    await runQuery(`delete from award where id = $1`, [awardId]);
    await runQuery(`delete from participant where id = $1`, [xiiPerson.id]);
    await runQuery(
      `delete from points_entry where note = $1 and war_week_id = $2`,
      [REASON, xiiWeek],
    );
  }
});
