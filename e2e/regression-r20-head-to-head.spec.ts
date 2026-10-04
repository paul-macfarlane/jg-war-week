import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { openCompetitionPage } from "./competition-page";
import { runQuery, xiCompetitionEntries, xiParticipantId } from "./db";
import { E2E_BASE_URL } from "./env";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

// Epic R20, deliverable D3 (.scratch/competition-results/spec.md, decision
// 7): a Head-to-head Competition with exactly two Entrants shows a series,
// not a leaderboard: its Matches in order with both Scores and each one's
// Winner (or Draw), the series score and Winner, and the Placement Points
// each Entrant gets, Provisional until Closed and then the generated
// Points Entries. The Competition is this spec's own `E2E R20 …` row in XI
// (Matches inserted directly), deleted in `finally`.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";

/**
 * Oldest first: Ashley wins 21–15, Sam wins 21–18, a draw with no Scores,
 * Ashley wins 21–9. Worked by hand: a Best of 3 Ashley takes 2–1 (the
 * draw counts for nobody); 1st gets 5 points, 2nd gets 2.
 */
const MATCHES: {
  ashley: [number, number | null];
  sam: [number, number | null];
  minutesAgo: number;
}[] = [
  { ashley: [1, 21], sam: [2, 15], minutesAgo: 40 },
  { ashley: [2, 18], sam: [1, 21], minutesAgo: 30 },
  { ashley: [1, null], sam: [1, null], minutesAgo: 20 },
  { ashley: [1, 21], sam: [2, 9], minutesAgo: 10 },
];

async function addSeries(name: string): Promise<string> {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, format, game_config, entrants_open, placement_points)
     select id, $1, 'individual', 'head-to-head', $2::jsonb, false, '{5,2}'
     from war_week where edition = 'xi'
     returning id`,
    [name, JSON.stringify({ drawsAllowed: true, bestOf: 3 })],
  );
  const ashley = await xiParticipantId(ASHLEY);
  const sam = await xiParticipantId(SAM);
  for (const [seed, who] of [ashley, sam].entries()) {
    await runQuery(
      `insert into entrant (competition_id, participant_id, seed_position)
       values ($1, $2, $3)`,
      [id, who, seed + 1],
    );
  }
  for (const match of MATCHES) {
    const [game] = await runQuery<{ id: string }>(
      `insert into game (competition_id, logged_at, logged_by_email)
       values ($1, now() - make_interval(mins => $2), 'e2e-organizer@jahnelgroup.com')
       returning id`,
      [id, match.minutesAgo],
    );
    for (const [who, [place, score]] of [
      [ashley, match.ashley],
      [sam, match.sam],
    ] as const) {
      await runQuery(
        `insert into game_player (game_id, participant_id, place, score)
         values ($1, $2, $3, $4)`,
        [game.id, who, place, score],
      );
    }
  }
  return id;
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

/** The series view, as a Participant sees it, with no table on the page. */
async function expectSeries(page: Page, provisional: boolean) {
  const series = page.getByRole("region", { name: "Series" });
  await expect(series.locator('[data-slot="series-score"]')).toHaveText("2–1");
  await expect(series.locator('[data-slot="series-winner"]')).toContainText(
    "Winner",
  );
  await expect(series.locator('[data-slot="series-winner"]')).toContainText(
    ASHLEY,
  );
  await expect(series).toContainText("1 draw");

  const matches = page
    .getByRole("region", { name: "Matches" })
    .locator('[data-slot="series-match"]');
  await expect(matches).toHaveCount(4);
  await expect(matches.locator('[data-slot="series-match-score"]')).toHaveText([
    "21–15",
    "18–21",
    "vs",
    "21–9",
  ]);
  await expect(matches.locator('[data-slot="series-match-result"]')).toHaveText(
    [`Winner: ${ASHLEY}`, `Winner: ${SAM}`, "Draw", `Winner: ${ASHLEY}`],
  );
  for (let i = 0; i < 4; i++) {
    await expect(matches.nth(i)).toContainText(`Match ${i + 1}`);
  }

  const points = page.getByRole("region", { name: "Placement Points" });
  const places = points.locator('[data-slot="series-points"]');
  await expect(places).toHaveCount(2);
  await expect(places.nth(0)).toContainText("1st");
  await expect(places.nth(0)).toContainText(ASHLEY);
  await expect(places.nth(1)).toContainText("2nd");
  await expect(places.nth(1)).toContainText(SAM);
  await expect(points.locator('[data-slot="series-points-value"]')).toHaveText([
    "5 points",
    "2 points",
  ]);
  await expect(points.getByRole("button", { name: "Provisional" })).toHaveCount(
    provisional ? 1 : 0,
  );

  // No leaderboard: no table and no "Leaderboard" heading.
  await expect(page.getByRole("table")).toHaveCount(0);
  // (The site's nav links to the War Week leaderboard; the results don't.)
  await expect(
    page.getByRole("region", { name: "Results" }).getByText(/leaderboard/i),
  ).toHaveCount(0);
}

test("r20 D3 a two-Entrant Head-to-head shows the series (Matches, series score, Winner, Provisional points) and no leaderboard; after Close the same points come from the Points Entries", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R20 Series ${Date.now()}`;
  const id = await addSeries(name);
  const organizerContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      await expectSeries(page, true);
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `series-open-${label}`);
    }

    // An Organizer Closes it from the admin Competition page.
    await asOrganizer(organizerContext);
    const admin = await organizerContext.newPage();
    await admin.setViewportSize(DESKTOP);
    await openCompetitionPage(admin, id);
    // The admin side keeps its list of Matches.
    await expect(
      admin.getByRole("region", { name: "Matches" }).getByRole("listitem"),
    ).toHaveCount(4);
    await admin.getByRole("button", { name: "Close", exact: true }).click();
    await admin
      .getByRole("alertdialog", { name: "Close this Competition?" })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(admin.getByText("Competition closed")).toBeVisible();

    // The generated Points Entries, read independently: Ashley 5, Sam 2.
    const entries = await xiCompetitionEntries(name);
    expect(
      entries.map(({ target, points, generated }) => ({
        target,
        points,
        generated,
      })),
    ).toEqual([
      { target: ASHLEY, points: 5, generated: true },
      { target: SAM, points: 2, generated: true },
    ]);

    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      await expectSeries(page, false);
      await expect(
        page
          .getByRole("region", { name: "Placement Points" })
          .getByText("Closed", { exact: true }),
      ).toBeVisible();
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `series-closed-${label}`);
    }
  } finally {
    await organizerContext.close();
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});
