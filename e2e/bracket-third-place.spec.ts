import { type Page, expect, test } from "@playwright/test";

import {
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import { openForBracket, runQuery, xiCompetitionId } from "./db";
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

/** Records the Heat named `heat`, with its first-listed Entrant winning. */
async function recordHeat(page: Page, heat: string) {
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
  const name = entrantNames.find((entrant) => text.includes(entrant));
  if (!name) throw new Error(`No Entrant named in "${text}"`);
  await winner.click();
  await sheet.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
  await expect(sheet).toBeHidden();
}

test("a head-to-head Bracket of 8 with a 3rd place game is run to Finalize, placing 10, 7, 5 and 3", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await asOrganizer(context);
  await openCompetitionPage(page, competitionId);
  await setFormat(page, "Bracket");

  // Under 4 Entrants the 3rd place game is off and disabled, with its reason.
  const thirdPlace = page.getByRole("switch", { name: "3rd place game" });
  await expect(thirdPlace).toBeDisabled();
  await expect(
    page.getByText("A 3rd place game needs at least 4 Entrants."),
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
  for (const heat of [
    "Round 1 Heat 1",
    "Round 1 Heat 2",
    "Round 1 Heat 3",
    "Round 1 Heat 4",
    "Semifinal 1",
    "Semifinal 2",
    "Final",
  ]) {
    await recordHeat(page, heat);
  }

  // The Final alone doesn't finish the Bracket: the 3rd place game is left.
  await expect(page.getByRole("button", { name: "Finalize" })).toBeDisabled();
  await expect(page.getByText("Finish every Heat to finalize.")).toBeVisible();
  await recordHeat(page, "3rd place game");

  await page.getByRole("button", { name: "Finalize" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Finalize" })
    .click();
  await expect(page.getByText("Bracket finalized")).toBeVisible();

  // The final's and the 3rd place game's places, from the database.
  const placed = await runQuery<{
    display_name: string;
    third_place: boolean;
    place: number;
  }>(
    `select p.display_name, h.third_place, he.place from heat h
     join heat_entrant he on he.heat_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1
       and h.round = (select max(round) from heat where competition_id = $1)`,
    [competitionId],
  );
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
     where pe.competition_id = $1 and pe.generated_by_bracket`,
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
  await expect(page.getByText("3rd place game").first()).toBeVisible();
  const listed = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Points Entries" }) })
    .getByRole("listitem")
    .filter({ hasText: "From bracket" });
  await expect(listed).toHaveCount(4);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({
    path: testInfo.outputPath("third-place-finalized-1440.png"),
    fullPage: true,
  });
});
