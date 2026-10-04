import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { openCompetitionPage, setFormat } from "./competition-page";
import {
  openForBracket,
  runQuery,
  xiCompetitionEntries,
  xiCompetitionId,
} from "./db";
import { E2E_BASE_URL } from "./env";
import { axePodium, expectPodium, shootPodium } from "./podium";
import {
  E2E_PARTICIPANT_EMAIL,
  asOrganizer,
  participantPageAs,
  signIn,
} from "./session";

// Beyblades is an individual War Week XI Competition with Placement Points
// 5 / 3 / 1. None of these four is on the seeded Beyblades sheet (it places only a Team).
const COMPETITION = "Beyblades";

// The seeded Competitions are Finalized Placement sheets; open each for a
// Bracket and put the sheet back afterwards.
let restoreCompetition: (() => Promise<void>) | null = null;
test.beforeEach(async () => {
  restoreCompetition = await openForBracket(await xiCompetitionId(COMPETITION));
});
test.afterEach(async () => {
  await restoreCompetition?.();
  restoreCompetition = null;
});
const ENTRANTS = [
  "Ashley Schuliger",
  "Sam Schantz",
  "Ryan Shendler",
  "Alex Kelly",
];

/** Whose "Your next Match" the flow reads: a Match has no time or place. */
const YOU_ENTRANT = "Ashley Schuliger";
/** On XI's first Day, in the evening (ET). */
const HOME_AT = "2026-02-22T18:30:00-05:00";

const VIEWPORT_WIDTHS = [375, 768, 1280] as const;
/** Only these widths get a screenshot; 768 is checked for overflow only. */
const SCREENSHOT_WIDTHS: readonly number[] = [375, 1280];

/**
 * Checks no horizontal overflow at 375/768/1280, screenshotting 375/1280
 * as `<name>-<width>.png`.
 */
async function checkViewports(page: Page, testInfo: TestInfo, name: string) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (SCREENSHOT_WIDTHS.includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** The name of the Round 1 Heat that holds `displayName` (the draw is random). */
async function round1HeatOf(
  competitionId: string,
  displayName: string,
): Promise<string> {
  const [row] = await runQuery<{ position: number }>(
    `select h.position from heat h
     join heat_entrant he on he.heat_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1 and h.round = 1 and p.display_name = $2`,
    [competitionId, displayName],
  );
  if (!row) throw new Error(`No Round 1 Match holds "${displayName}"`);
  return `Semifinal ${row.position}`;
}

/** Records the Heat named `heat`, with its first-listed Entrant winning. */
async function recordHeat(page: Page, heat: string): Promise<string> {
  // From the admin Bracket's tree, the one Participants see.
  await page
    .locator("[data-bracket-tree]")
    .getByRole("button", { name: `Record result for ${heat}` })
    .click();
  const sheet = page.getByRole("dialog", { name: heat });
  const winner = sheet
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  // The button also shows the Avatar's initials; keep the Entrant's name.
  const text = await winner.innerText();
  const name = ENTRANTS.find((entrant) => text.includes(entrant));
  if (!name) throw new Error(`No Entrant named in "${text}"`);
  await winner.click();
  await sheet.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return name;
}

test("a Bracket is built, run and Closed into Points Entries, its podium 1st and 2nd", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);
  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");

  // Not by accessible name: its FieldLabel is "Pick Participants (N chosen)"
  // and changes as Entrants are added, so a fixed-name role locator would
  // stop matching after the first pick.
  const find = page.locator("#bracket-entrants");
  for (const entrant of ENTRANTS) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await expect(page.getByText("(4 chosen)")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("bracket-built.png"),
    fullPage: true,
  });

  // Your next Match names the round and opponent, with no time or place.
  const yourHeat = await round1HeatOf(id, YOU_ENTRANT);
  const you = await participantPageAs(browser, YOU_ENTRANT);
  await you.page.goto(`/xi/competitions/${id}`);
  // Visible only: while a reload streams, React holds the new page in a
  // hidden container before swapping it in, and getByLabel counts it.
  const nextHeat = you.page
    .getByLabel("Your next Match")
    .filter({ visible: true });
  await expect(nextHeat).toContainText(`Your next Match · ${yourHeat}`);
  await expect(nextHeat).toContainText("vs ");
  await expect(nextHeat).not.toContainText(/\bET\b|AM|PM/);
  await checkViewports(you.page, testInfo, "participant-next-heat");

  // Heats are not on Home's Now/Next.
  await you.page.goto(`/xi?at=${encodeURIComponent(HOME_AT)}`);
  await expect(
    you.page.getByRole("heading", { name: /standings/i }).first(),
  ).toBeVisible();
  await expect(you.page.getByText(`${COMPETITION} · ${yourHeat}`)).toHaveCount(
    0,
  );
  await you.close();

  // The Bracket tree is on the same page, below the Entrants.
  await expect(page.locator("[data-bracket-tree]")).toBeVisible();
  await recordHeat(page, "Semifinal 1");
  // A played Heat says when it was recorded.
  await expect(page.getByText(/^Recorded .+ ET$/).first()).toBeVisible();
  await recordHeat(page, "Semifinal 2");
  // Both semifinal winners advanced, so the Final is recordable.
  const winner = await recordHeat(page, "Final");
  const [runnerUp] = await runQuery<{ display_name: string }>(
    `select p.display_name from heat h
     join heat_entrant he on he.heat_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1 and he.place = 2
       and h.round = (select max(round) from heat where competition_id = $1)`,
    [id],
  );
  // No 3rd place match: Top finishers is the final's 1st and 2nd only,
  // Provisional until the Bracket is Closed.
  const podium = [
    { place: "1st", name: winner, points: "5 points" },
    { place: "2nd", name: runnerUp.display_name, points: "3 points" },
  ];
  await expectPodium(page, podium);
  const topFinishers = page.getByRole("region", { name: "Top finishers" });
  await expect(
    topFinishers.getByRole("button", { name: "Provisional" }),
  ).toBeVisible();

  await page
    .getByRole("region", { name: "Bracket", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByText("Bracket closed")).toBeVisible();
  await expect(
    topFinishers.getByRole("button", { name: "Provisional" }),
  ).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("bracket-finalized.png"),
    fullPage: true,
  });

  await page.goto(`/xi/competitions/${id}`);
  // The participant view shows "Recorded <time>" on every played Heat.
  await expect(page.getByText(/^Recorded .+ ET$/)).toHaveCount(3);
  // The Participant page lists no Points Entries (R20): read what Finalize
  // wrote from the database.
  await expect(
    page.getByRole("heading", { name: "Points Entries" }),
  ).toHaveCount(0);
  const entries = (await xiCompetitionEntries(COMPETITION)).filter(
    (entry) => entry.generated,
  );
  // Placement Points 5 / 3 / 1, but with no 3rd place match only the Winner
  // and the runner-up are placed: the semifinal losers get nothing.
  expect(
    entries
      .map((entry) => ({ target: entry.target, points: entry.points }))
      .sort((a, b) => b.points - a.points),
  ).toEqual([
    { target: winner, points: 5 },
    { target: runnerUp.display_name, points: 3 },
  ]);
  // The podium shows the Points Entries Close wrote: 1st and 2nd only.
  await expectPodium(page, podium);
  await expect(
    page
      .getByRole("region", { name: "Top finishers" })
      .getByRole("button", { name: "Provisional" }),
  ).toHaveCount(0);
  await shootPodium(page, testInfo, "podium-no-third-place");
  await axePodium(page, testInfo, "podium-no-third-place-axe");
  await page.screenshot({
    path: testInfo.outputPath("competition-participant-page.png"),
    fullPage: true,
  });

  // The Bracket Finale (reached from /admin/finale, unchanged) plays the
  // placings and ends on the champion.
  await page.goto(`/xi/finale/${id}`);
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
    timeout: 20_000,
  });
  const championCard = page.getByLabel("Winner", { exact: true });
  await expect(championCard).toContainText(winner);
  await expect(championCard).toContainText(`Winner of ${COMPETITION}`);
  await checkViewports(page, testInfo, "bracket-finale");

  // Reduced motion shows the final state as soon as Start is pressed:
  // well inside the ~3.9 s a four-Entrant count-in takes with motion.
  const still = await browser.newContext({
    baseURL: E2E_BASE_URL,
    reducedMotion: "reduce",
  });
  await signIn(still, E2E_PARTICIPANT_EMAIL);
  const stillPage = await still.newPage();
  await stillPage.goto(`/xi/finale/${id}`);
  await stillPage.getByRole("button", { name: "Start" }).click();
  await expect(stillPage.locator('[data-finale="done"]')).toBeVisible({
    timeout: 2_000,
  });
  await expect(stillPage.getByLabel("Winner", { exact: true })).toContainText(
    winner,
    { timeout: 2_000 },
  );
  await still.close();
});
