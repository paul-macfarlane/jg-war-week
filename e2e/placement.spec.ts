import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery, xiTeamPointsBreakdown } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  signIn,
} from "./session";
import { teamTotal } from "./standings";

// Epic R16, part 90 (red-team W8): an individual Placement Competition,
// counting toward the Team, higher Score wins, Placement Points 10 / 6 / 3,
// inserted into the live XI demo with the e2e Host as its Host. The Host
// records six Participants with Scores (Places fill from them, a tie at
// 2nd), breaks the tie, edits another row's Score (the tie-break stays),
// and Finalizes: the Standings move by exactly the
// Teams' points, Recent results shows the Finalize, Reopen withdraws them,
// and a Participant is refused the sheet. The Competition is deleted after
// (its rows and Points Entries cascade), so XI is unchanged for other specs.

/** The six, with their Teams, Scores and the Place the Scores give. */
const ROWS = [
  { name: "Ashley Schuliger", team: "Red", score: "50", place: "1" },
  { name: "Graham Macbeth", team: "Blue", score: "40", place: "2" },
  { name: "Sam Schantz", team: "Red", score: "40", place: "2" },
  { name: "Brandon Badgett", team: "Blue", score: "30", place: "4" },
  { name: "Ryan Shendler", team: "Red", score: "20", place: "5" },
  { name: "Victoria Campbell", team: "Blue", score: "10", place: "6" },
] as const;
/** The Host breaks the tie at 2nd: Sam Schantz is 3rd. */
const TIE_BROKEN = "Sam Schantz";
/**
 * Worked by hand from 10 / 6 / 3: Ashley 1st (10) and Sam 3rd (3) for Red,
 * Graham 2nd (6) for Blue; 4th and below are beyond the list.
 */
const MOVES = { Red: 13, Blue: 6 };

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** Screenshots `page` at both viewports as `<step>-<width>.png`, with no sideways scroll. */
async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const { name, width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${step}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const sum = (rows: { points: number }[]) =>
  rows.reduce((total, row) => total + row.points, 0);

/** Red's and Blue's totals from the independent SQL breakdowns. */
async function breakdownTotals() {
  return {
    Red: sum(await xiTeamPointsBreakdown("Red")),
    Blue: sum(await xiTeamPointsBreakdown("Blue")),
  };
}

/** The same totals as `/xi/leaderboard` shows them. */
async function leaderboardTotals(page: Page) {
  await page.goto("/xi/leaderboard");
  return {
    Red: await teamTotal(page, "Red"),
    Blue: await teamTotal(page, "Blue"),
  };
}

test("r16 90 a Host records placements with Scores, breaks a tie and Finalizes: the Standings move, Recent results shows it, Reopen withdraws, a Participant is refused", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `R16 Darts ${Date.now()}`;
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, counts_toward_team, format, score_direction, placement_points)
     select id, $1, 'individual', true, 'placement', 'higher', '{10,6,3}'
     from war_week where edition = 'xi'
     returning id`,
    [name],
  );
  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)`,
      [id, E2E_HOST_EMAIL],
    );
    const before = await breakdownTotals();
    await asHost(context);
    expect(await leaderboardTotals(page)).toEqual(before);

    // The Host adds the six by search.
    await page.goto(`/admin/placements/${id}`);
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();
    await expect(page.getByText("No one yet.")).toBeVisible();
    const search = page.getByRole("combobox", { name: "Add a Participant" });
    for (const row of ROWS) {
      await search.click();
      await search.fill(row.name);
      await page.getByRole("option", { name: new RegExp(row.name) }).click();
      await expect(page.getByText(`${row.name} added`)).toBeVisible();
      await expect(
        page.getByRole("textbox", { name: `Score for ${row.name}` }),
      ).toBeVisible();
    }
    const sheet = page.getByRole("list", { name: "Placements" });
    await expect(sheet.getByRole("listitem")).toHaveCount(ROWS.length);

    // Higher wins: Places fill from Scores as they're typed, a tie at 2nd.
    for (const row of ROWS) {
      await page
        .getByRole("textbox", { name: `Score for ${row.name}` })
        .fill(row.score);
    }
    for (const row of ROWS) {
      await expect(
        page.getByRole("textbox", { name: `Place for ${row.name}` }),
      ).toHaveValue(row.place);
    }
    await shoot(page, testInfo, "sheet-scores");

    // The Host breaks the tie, then edits another row's Score: no computed
    // place moves, so the tie-break stays; then saves.
    await page
      .getByRole("textbox", { name: `Place for ${TIE_BROKEN}` })
      .fill("3");
    await page
      .getByRole("textbox", { name: `Score for ${ROWS[5].name}` })
      .fill("15");
    await expect(
      page.getByRole("textbox", { name: `Place for ${TIE_BROKEN}` }),
    ).toHaveValue("3");
    await expect(
      page.getByRole("textbox", { name: `Place for ${ROWS[1].name}` }),
    ).toHaveValue("2");
    await expect(
      page.getByRole("textbox", { name: `Place for ${ROWS[5].name}` }),
    ).toHaveValue("6");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Placements saved")).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: `Place for ${TIE_BROKEN}` }),
    ).toHaveValue("3");

    await page.getByRole("button", { name: "Finalize", exact: true }).click();
    const confirm = page.getByRole("alertdialog", {
      name: "Finalize this Competition?",
    });
    await confirm.getByRole("button", { name: "Finalize" }).click();
    await expect(page.getByText("Competition finalized")).toBeVisible();
    await expect(page.getByText("Finalized: its Points Entries")).toBeVisible();
    await shoot(page, testInfo, "sheet-finalized");

    // The Standings move by exactly the Teams' points, matching SQL.
    const after = await breakdownTotals();
    expect(after).toEqual({
      Red: before.Red + MOVES.Red,
      Blue: before.Blue + MOVES.Blue,
    });
    expect(await leaderboardTotals(page)).toEqual(after);

    // Recent results shows the Finalize with its winner.
    await page.goto("/xi");
    const recent = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Recent results" }) });
    const result = recent
      .getByRole("listitem")
      .filter({ has: page.getByRole("link", { name }) });
    await expect(result.getByText("Finalized", { exact: true })).toBeVisible();
    await expect(result.getByText(ROWS[0].name)).toBeVisible();
    await shoot(page, testInfo, "recent-results");

    // The Participant page lists the Placements by place.
    await page.goto(`/xi/competitions/${id}`);
    const placements = page.getByRole("region", { name: "Placements" });
    const first = placements.getByRole("listitem").first();
    await expect(first).toContainText("1st");
    await expect(first).toContainText(ROWS[0].name);
    await expect(first).toContainText("Score 50");
    await expect(first).toContainText("10");
    await expect(placements.getByRole("listitem")).toHaveCount(ROWS.length);
    await shoot(page, testInfo, "participant-page");

    // Reopen withdraws the points.
    await page.goto(`/admin/placements/${id}`);
    await page.getByRole("button", { name: "Reopen", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "Reopen this Competition?" })
      .getByRole("button", { name: "Reopen" })
      .click();
    await expect(page.getByText("Competition reopened")).toBeVisible();
    expect(await breakdownTotals()).toEqual(before);
    expect(await leaderboardTotals(page)).toEqual(before);

    // A signed-in Participant is refused the sheet.
    await signIn(participantContext, E2E_PARTICIPANT_EMAIL);
    const participant = await participantContext.newPage();
    await participant.goto(`/admin/placements/${id}`);
    await expect(
      participant.getByRole("heading", { name: "Organizers and Hosts only." }),
    ).toBeVisible();
    await expect(participant.getByText(name)).toHaveCount(0);
    await shoot(participant, testInfo, "participant-refused");
  } finally {
    await participantContext.close();
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});
