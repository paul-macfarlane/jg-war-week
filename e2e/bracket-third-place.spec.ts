import { type Page, expect, test } from "@playwright/test";

import {
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import {
  openForBracket,
  runQuery,
  xiCompetitionEntries,
  xiCompetitionId,
} from "./db";
import { axePodium, expectPodium, shootPodium } from "./podium";
import { asOrganizer } from "./session";

// Beyblades is an individual War Week XI Competition. This flow sets its
// Placement Points to 10 / 7 / 5 / 3 and puts the old ones back afterwards.
const COMPETITION = "Beyblades";
const PLACEMENT_POINTS = [10, 7, 5, 3];

let competitionId = "";
let entrantNames: string[] = [];
let restoreCompetition: (() => Promise<void>) | null = null;
let savedPlacementPoints: number[] | null = null;

test.beforeEach(async () => {
  competitionId = await xiCompetitionId(COMPETITION);
  restoreCompetition = await openForBracket(competitionId);
  const [row] = await runQuery<{ placement_points: number[] | null }>(
    `select placement_points from competition where id = $1`,
    [competitionId],
  );
  savedPlacementPoints = row.placement_points;
  await runQuery(`update competition set placement_points = $2 where id = $1`, [
    competitionId,
    PLACEMENT_POINTS,
  ]);
  // Eight XI Participants with distinct names, picked by name.
  const rows = await runQuery<{ display_name: string }>(
    `select p.display_name from participant p
     join war_week w on w.id = p.war_week_id
     where w.edition = 'xi'
     group by p.display_name having count(*) = 1
     order by p.display_name limit 8`,
  );
  entrantNames = rows.map((r) => r.display_name);
  expect(entrantNames).toHaveLength(8);
});

test.afterEach(async () => {
  await restoreCompetition?.();
  restoreCompetition = null;
  await runQuery(`update competition set placement_points = $2 where id = $1`, [
    competitionId,
    savedPlacementPoints,
  ]);
});

/** Records the Match named `match`, with its first-listed Entrant winning. */
async function recordMatch(page: Page, match: string) {
  // From the admin Bracket's tree, the one Participants see.
  await page
    .locator("[data-bracket-tree]")
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const sheet = page.getByRole("dialog", { name: match });
  const winner = sheet
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  // The button also shows the Avatar's initials; keep the Entrant's name.
  const text = await winner.innerText();
  const name = entrantNames.find((entrant) => text.includes(entrant));
  if (!name) throw new Error(`No Entrant named in "${text}"`);
  await winner.click();
  await sheet.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${name} wins ${match}`)).toBeVisible();
  await expect(sheet).toBeHidden();
}
/** The last Round's places by name: the final's, then the 3rd place Match's. */
async function lastRoundPlaces() {
  return runQuery<{
    display_name: string;
    third_place: boolean;
    place: number;
  }>(
    `select p.display_name, h.third_place, he.place from bracket_match h
     join bracket_match_entrant he on he.bracket_match_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1 and he.place is not null
       and h.round = (select max(round) from bracket_match where competition_id = $1)
     order by h.third_place, he.place`,
    [competitionId],
  );
}

const PLACES = ["1st", "2nd", "3rd", "4th"];

/** The podium the last Round's places give, with Placement Points. */
async function expectedPodium() {
  return (await lastRoundPlaces()).map((row) => {
    const place = (row.third_place ? 2 : 0) + row.place;
    return {
      place: PLACES[place - 1],
      name: row.display_name,
      points: `${PLACEMENT_POINTS[place - 1]} points`,
    };
  });
}

test("a head-to-head Bracket of 8 with a 3rd place Match is run to Close, its podium 1st to 4th with 10, 7, 5 and 3", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await asOrganizer(context);
  await openCompetitionPage(page, competitionId);
  await setFormat(page, "Bracket");

  // Under 4 Entrants the 3rd place Match is off and disabled, with its reason.
  const thirdPlace = page.getByRole("switch", { name: "3rd place Match" });
  await expect(thirdPlace).toBeDisabled();
  await expect(
    page.getByText("A 3rd place Match needs at least 4 Entrants."),
  ).toBeVisible();

  const find = page.locator("#bracket-entrants");
  for (const entrant of entrantNames) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await expect(page.getByText("(8 chosen)")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved", { exact: true })).toBeVisible();

  await expect(thirdPlace).toBeEnabled();
  await expect(thirdPlace).not.toBeChecked();
  await thirdPlace.click();
  await expect(thirdPlace).toBeChecked();
  await expectSaved(page);
  const [saved] = await runQuery<{ third: boolean }>(
    `select (bracket_config->>'thirdPlaceGame')::boolean as third
     from competition where id = $1`,
    [competitionId],
  );
  expect(saved.third).toBe(true);

  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();

  // The Bracket tree is on the same page, below the Entrants.
  await expect(page.locator("[data-bracket-tree]")).toBeVisible();
  for (const match of [
    "Round 1 Match 1",
    "Round 1 Match 2",
    "Round 1 Match 3",
    "Round 1 Match 4",
    "Semifinal 1",
    "Semifinal 2",
    "Final",
  ]) {
    await recordMatch(page, match);
  }

  // The Final alone doesn't finish the Bracket: the 3rd place Match is left.
  await expect(
    page
      .getByRole("region", { name: "Bracket", exact: true })
      .getByRole("button", { name: "Close", exact: true }),
  ).toBeDisabled();
  await expect(page.getByText("Finish every Match to close.")).toBeVisible();
  // Only the decided places show: 1st and 2nd, not yet 3rd and 4th.
  const finalOnly = await expectedPodium();
  expect(finalOnly).toHaveLength(2);
  await expectPodium(page, finalOnly);
  await recordMatch(page, "3rd place Match");
  const podium = await expectedPodium();
  expect(podium.map((place) => place.points)).toEqual([
    "10 points",
    "7 points",
    "5 points",
    "3 points",
  ]);
  await expectPodium(page, podium);

  await page
    .getByRole("region", { name: "Bracket", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByText("Bracket closed")).toBeVisible();

  // The final's and the 3rd place Match's places, from the database.
  const placed = await lastRoundPlaces();
  expect(placed).toHaveLength(4);
  const expected = Object.fromEntries(
    placed.map((row) => [
      row.display_name,
      PLACEMENT_POINTS[(row.third_place ? 2 : 0) + row.place - 1],
    ]),
  );
  const entries = await runQuery<{ display_name: string; points: string }>(
    `select p.display_name, pe.points::text as points from points_entry pe
     join participant p on p.id = pe.participant_id
     where pe.competition_id = $1 and pe.generated`,
    [competitionId],
  );
  // Exactly the four placed Entrants get Points Entries, and nobody else.
  expect(entries).toHaveLength(4);
  expect(
    Object.fromEntries(
      entries.map((row) => [row.display_name, Number(row.points)]),
    ),
  ).toEqual(expected);
  expect(Object.values(expected).sort((a, b) => b - a)).toEqual(
    PLACEMENT_POINTS,
  );

  await page.goto(`/xi/competitions/${competitionId}`);
  await expect(page.getByText("3rd place Match").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Points Entries" }),
  ).toHaveCount(0);
  const listed = (await xiCompetitionEntries(COMPETITION)).filter(
    (entry) => entry.generated,
  );
  expect(listed).toHaveLength(4);
  // Closed: 1st to 4th with the points Close wrote, no Provisional badge.
  await expectPodium(page, podium);
  await expect(
    page
      .getByRole("region", { name: "Top finishers" })
      .getByRole("button", { name: "Provisional" }),
  ).toHaveCount(0);
  await shootPodium(page, testInfo, "podium-third-place");
  await axePodium(page, testInfo, "podium-third-place-axe");
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("third-place-closed-1440.png"),
    fullPage: true,
  });
});
