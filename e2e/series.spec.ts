import { type Page, type TestInfo, expect, test } from "@playwright/test";
import path from "node:path";

import { openCompetitionPage } from "./competition-page";
import {
  runQuery,
  setParticipantEmail,
  xiCompetitionId,
  xiParticipantId,
  xiParticipantPointsBreakdown,
  xiTeamPointsBreakdown,
} from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  asOrganizer,
  signIn,
} from "./session";
import { resultsRow, rowPoints, teamTotal } from "./standings";

// Bouncy Pong is seeded as an individual Head-to-head (counts toward Team),
// Best of 3 between its two Entrants, with Placement Points 3 / 2 / 1.
const COMPETITION = "Bouncy Pong";
/** Logs the Match; linked to the e2e Participant session by email. */
const PLAYER = { name: "Albert Hernandez", team: "Red" };
/** Bouncy Pong's other Entrant, on the same Team. */
const OPPONENT = { name: "Austin Gage", team: "Red" };

/** Screenshots at 375 and 1280 under `test-results/e2e/series-<step>/`. */
async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(
        testInfo.project.outputDir,
        `series-${step}`,
        `${width}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/**
 * The series: its score between the two Entrants in Seed order, and each
 * Entrant's place and points in Placement Points order (the ranked one
 * first).
 */
async function expectSeries(
  page: Page,
  score: string,
  points: [place: string, name: string, points: string][],
) {
  const series = page.getByRole("region", { name: "Series" });
  await expect(series.locator('[data-slot="series-score"]')).toHaveText(score);
  const rows = page
    .getByRole("region", { name: "Placement Points" })
    .locator('[data-slot="series-points"]');
  for (const [place, name, value] of points) {
    const row = rows.filter({ hasText: name });
    await expect(row).toContainText(place);
    await expect(row.locator('[data-slot="series-points-value"]')).toHaveText(
      value,
    );
  }
}

/** A Participant's total on `/xi/leaderboard`, 0 when they have no row. */
async function participantTotal(page: Page, name: string): Promise<number> {
  const row = resultsRow(page, "Individual leaderboard", name);
  if ((await row.count()) === 0) return 0;
  return rowPoints(row);
}

const sum = (rows: { points: number }[]) =>
  rows.reduce((total, row) => total + row.points, 0);

/** Every total the flow moves, from the independent SQL breakdowns. */
async function breakdownTotals() {
  return {
    player: sum(await xiParticipantPointsBreakdown(PLAYER.name)),
    opponent: sum(await xiParticipantPointsBreakdown(OPPONENT.name)),
    playerTeam: sum(await xiTeamPointsBreakdown(PLAYER.team)),
    opponentTeam: sum(await xiTeamPointsBreakdown(OPPONENT.team)),
  };
}

/** The same totals as `/xi/leaderboard` shows them. */
async function leaderboardTotals(page: Page) {
  await page.goto("/xi/leaderboard");
  return {
    player: await participantTotal(page, PLAYER.name),
    opponent: await participantTotal(page, OPPONENT.name),
    playerTeam: await teamTotal(page, PLAYER.team),
    opponentTeam: await teamTotal(page, OPPONENT.team),
  };
}

test("series: a Participant logs a Head-to-head Match from home, the Host edits it and closes the Competition, the Standings move", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const id = await xiCompetitionId(COMPETITION);
  const playerId = await xiParticipantId(PLAYER.name);
  await runQuery(
    `insert into competition_host (competition_id, email) values ($1, $2)
     on conflict do nothing`,
    [id, E2E_HOST_EMAIL],
  );
  await setParticipantEmail(playerId, E2E_PARTICIPANT_EMAIL);
  const participantContext = await browser.newContext({
    baseURL: E2E_BASE_URL,
  });
  try {
    await asHost(context);
    const before = await breakdownTotals();
    expect(await leaderboardTotals(page)).toEqual(before);

    // The Participant, linked by email, follows the home shortcut.
    await signIn(participantContext, E2E_PARTICIPANT_EMAIL);
    const you = await participantContext.newPage();
    await you.goto("/xi");
    const shortcut = you
      .locator("section")
      .filter({ has: you.getByRole("heading", { name: "Log a result" }) });
    await expect(shortcut).toBeVisible();
    await shoot(you, testInfo, "home-shortcut");
    await shortcut.getByRole("link", { name: new RegExp(COMPETITION) }).click();
    await expect(you).toHaveURL(`${E2E_BASE_URL}/xi/competitions/${id}?log=1`);
    await expect(
      you.getByText("Head-to-head", { exact: true }).first(),
    ).toBeVisible();

    const form = you.getByRole("dialog", { name: "Log a Match" });
    await expect(form).toBeVisible();
    await expect(form.getByRole("combobox", { name: "Player A" })).toHaveValue(
      PLAYER.name,
    );
    // Filled in on a phone, then widened past `md` (768px): the form keeps its input.
    await you.setViewportSize({ width: 375, height: 900 });
    // Only the series' two Entrants are offered.
    await form.getByRole("combobox", { name: "Player B" }).click();
    await expect(you.getByRole("option")).toHaveText([
      PLAYER.name,
      OPPONENT.name,
    ]);
    await you.getByRole("option", { name: OPPONENT.name, exact: true }).click();
    await expect(you.getByRole("listbox")).toHaveCount(0);
    const won = form
      .getByRole("group", { name: "Who won?" })
      .getByRole("button", { name: `${PLAYER.name} won` });
    await won.click();
    await you.setViewportSize({ width: 820, height: 900 });
    await expect(form.getByRole("combobox", { name: "Player B" })).toHaveValue(
      OPPONENT.name,
    );
    await expect(won).toHaveAttribute("aria-pressed", "true");
    await shoot(you, testInfo, "log-form");
    await form.getByRole("button", { name: "Log Match" }).click();
    await expect(you.getByText("Match logged")).toBeVisible();
    await expect(form).toBeHidden();

    // The series shows the win 1–0, with Provisional points 3 and 2
    // (Placement Points 3 / 2 / 1).
    await expectSeries(you, "1–0", [
      ["1st", PLAYER.name, "3 points"],
      ["2nd", OPPONENT.name, "2 points"],
    ]);
    const matches = you.getByRole("region", { name: "Matches" });
    await expect(
      matches.locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${PLAYER.name}`]);
    await shoot(you, testInfo, "logged");
    const logged = `Match 1: ${PLAYER.name} vs ${OPPONENT.name}`;

    // The Host flips the winner on the Competition page.
    await page.goto(`/xi/competitions/${id}`);
    await page.getByRole("button", { name: `Edit Match: ${logged}` }).click();
    const edit = page.getByRole("dialog", { name: "Edit Match" });
    await expect(edit).toBeVisible();
    await shoot(page, testInfo, "host-edit");
    // Keyboard proof: arrow off the pressed item onto the other, Space to
    // choose it, all without a mouse.
    const editOutcome = edit.getByRole("group", { name: "Who won?" });
    const editPlayerWon = editOutcome.getByRole("button", {
      name: `${PLAYER.name} won`,
    });
    const editOpponentWon = editOutcome.getByRole("button", {
      name: `${OPPONENT.name} won`,
    });
    await editPlayerWon.focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Space");
    await expect(editOpponentWon).toHaveAttribute("aria-pressed", "true");
    await expect(editPlayerWon).toHaveAttribute("aria-pressed", "false");
    await edit.getByRole("button", { name: "Save Match" }).click();
    await expect(page.getByText("Match updated")).toBeVisible();
    await expect(edit).toBeHidden();
    await expectSeries(page, "0–1", [
      ["1st", OPPONENT.name, "3 points"],
      ["2nd", PLAYER.name, "2 points"],
    ]);
    await expect(
      page
        .getByRole("region", { name: "Matches" })
        .locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${OPPONENT.name}`]);

    // Ending the War Week while this Competition is still open warns an
    // Organizer, naming it with a link to its Competition page, and never
    // refuses; Cancel, so the Host can close it below.
    const organizerContext = await browser.newContext({
      baseURL: E2E_BASE_URL,
    });
    try {
      await asOrganizer(organizerContext);
      const organizerPage = await organizerContext.newPage();
      await organizerPage.goto("/admin/settings");
      await organizerPage.getByRole("button", { name: "End War Week" }).click();
      const endDialog = organizerPage.getByRole("alertdialog");
      await expect(endDialog).toContainText("Still open:");
      await expect(endDialog).toContainText(COMPETITION);
      await expect(
        endDialog.getByRole("link", { name: COMPETITION }),
      ).toHaveAttribute("href", `/admin/competitions/${id}`);
      await shoot(organizerPage, testInfo, "end-warning");
      await endDialog.getByRole("button", { name: "Cancel" }).click();
      await expect(endDialog).toBeHidden();
    } finally {
      await organizerContext.close();
    }

    // The Host closes it from the Competition's page.
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    const closeConfirm = page.getByRole("alertdialog", {
      name: "Close this Competition?",
    });
    await shoot(page, testInfo, "close-confirm");
    await closeConfirm
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Competition closed")).toBeVisible();
    await expect(page.getByRole("button", { name: "Reopen" })).toBeVisible();

    await page.goto(`/xi/competitions/${id}`);
    // By role: until React reveals the streamed page, a hidden copy of it
    // (Next's `<div hidden id="S:0">`) can still be in the document.
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .getByText("Closed — its Placement Points are in the Standings."),
    ).toBeVisible();
    // Closed: no Provisional badge, and the points are the Points Entries;
    // Closed short of the Best of, the leader takes the series.
    await expect(
      page
        .getByRole("region", { name: "Placement Points" })
        .getByRole("button", { name: "Provisional" }),
    ).toHaveCount(0);
    await expectSeries(page, "0–1", [
      ["1st", OPPONENT.name, "3 points"],
      ["2nd", PLAYER.name, "2 points"],
    ]);
    await expect(page.locator('[data-slot="series-winner"]')).toContainText(
      OPPONENT.name,
    );
    await expect(page.getByRole("button", { name: "Log a Match" })).toHaveCount(
      0,
    );
    await shoot(page, testInfo, "closed");

    // Placement Points: the opponent 1st (3), the player 2nd (2), both to
    // their Team, Red, as well (Bouncy Pong counts toward Team).
    const after = await breakdownTotals();
    expect(after).toEqual({
      player: before.player + 2,
      opponent: before.opponent + 3,
      playerTeam: before.playerTeam + 5,
      opponentTeam: before.opponentTeam + 5,
    });
    expect(await leaderboardTotals(page)).toEqual(after);
    await shoot(page, testInfo, "standings");

    // Reopen and delete the Match: the Standings go back.
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Reopen" }).click();
    await page
      .getByRole("alertdialog", { name: "Reopen this Competition?" })
      .getByRole("button", { name: "Reopen" })
      .click();
    await expect(page.getByText("Competition reopened")).toBeVisible();
    await page.goto(`/xi/competitions/${id}`);
    await page.getByRole("button", { name: `Delete Match: ${logged}` }).click();
    await page
      .getByRole("alertdialog", { name: "Delete this Match?" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(page.getByText("Match deleted")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Matches" })
        .getByText("No Matches yet."),
    ).toBeVisible();
    expect(await breakdownTotals()).toEqual(before);
  } finally {
    await participantContext.close();
    // Whatever the flow reached: no Match, not closed, no generated entries.
    await runQuery(
      `delete from points_entry where competition_id = $1 and generated`,
      [id],
    );
    await runQuery(`update competition set closed_at = null where id = $1`, [
      id,
    ]);
    await runQuery(`delete from series_match where competition_id = $1`, [id]);
    await setParticipantEmail(playerId, null);
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [id, E2E_HOST_EMAIL],
    );
  }
});
