import { type Page, expect, test } from "@playwright/test";

import {
  entrantsStatus,
  expectEntrantsSaved,
  openCompetitionPage,
} from "./competition-page";
import { runQuery } from "./db";
import { addXiCompetition, deleteCompetitions, shoot } from "./r21-logging";
import { expectNoSidewaysScroll } from "./scale-demo";
import { asOrganizer } from "./session";

// Epic R26, decisions 5 and 6, AC 5 and AC 6
// (.scratch/cuts-and-consistency/spec.md): Entrants autosave on Bracket,
// League and Head-to-head, with no Save button and the autosave status
// beside their legend; a change the server refuses (a League paired since
// the page loaded) shows the server's message and puts the picker back;
// Head-to-head picks "A vs B" in two pickers, each leaving out the other's
// choice, and saves only once both are set. Each test makes its own XI
// Competitions by SQL and deletes them in `finally`. Screenshots at 1440
// and 390 (`shoot`).

test.use({ actionTimeout: 20_000 });

const PEOPLE = [
  "Abby Rivera",
  "Adam Wilson-Hwang",
  "Ashley Schuliger",
  "Brandon Badgett",
  "Graham Macbeth",
];

/** The server's reason a League's Entrants are locked once paired. */
const LOCKED_BY_PAIRING = "Locked once round 1 is paired.";

/** A Competition's saved Entrants, by name. */
async function savedEntrants(id: string): Promise<string[]> {
  const rows = await runQuery<{ name: string }>(
    `select p.display_name as name from entrant e
     join participant p on p.id = e.participant_id
     where e.competition_id = $1 order by p.display_name`,
    [id],
  );
  return rows.map((row) => row.name);
}

/** Picks Participants in a multi-select Entrants picker. */
async function pickMany(page: Page, pickerId: string, names: string[]) {
  const find = page.locator(`#${pickerId}`);
  for (const name of names) {
    await find.fill(name);
    await page
      .getByRole("option", { name: new RegExp(`^${name}`) })
      .first()
      .click();
  }
  await page.keyboard.press("Escape");
}

/** Picks one Participant in a Head-to-head side ("a" or "b"). */
async function pickSide(page: Page, side: "a" | "b", name: string) {
  const find = page.locator(`#series-entrants-${side}`);
  await find.click();
  await find.fill(name);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
}

/** The side doesn't offer `name`: it's the other side's choice. */
async function expectNotOffered(page: Page, side: "a" | "b", name: string) {
  const find = page.locator(`#series-entrants-${side}`);
  await find.click();
  // Its first letter: other Participants match, so the list is open.
  await find.fill(name.slice(0, 1));
  await expect(page.getByRole("option").first()).toBeVisible();
  await expect(
    page.getByRole("option", { name: new RegExp(`^${name}`) }),
  ).toHaveCount(0);
  await page.keyboard.press("Escape");
}

test("r26 AC5 Bracket and League Entrants autosave with no button, and a locked change shows the server's message and reverts", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const bracketName = `E2E R26 Entrants Bracket ${stamp}`;
  const leagueName = `E2E R26 Entrants League ${stamp}`;
  try {
    const bracket = await addXiCompetition(bracketName, { format: "bracket" });
    const league = await addXiCompetition(leagueName, { format: "league" });
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Bracket: two picks save on their own.
    await openCompetitionPage(page, bracket);
    await expect(
      page.getByRole("button", { name: "Save Entrants" }),
    ).toHaveCount(0);
    await expect(entrantsStatus(page)).toHaveText("Changes save automatically");
    await pickMany(page, "bracket-entrants", PEOPLE.slice(0, 2));
    await expect(page.getByText("(2 chosen)")).toBeVisible();
    await expectEntrantsSaved(page);
    await shoot(page, testInfo, "bracket-saved");
    expect(await savedEntrants(bracket)).toEqual(PEOPLE.slice(0, 2));
    await page.reload();
    await expect(page.getByText("(2 chosen)")).toBeVisible();
    await expect(page.locator("#bracket-entrants")).toBeEnabled();

    // League: four picks save on their own.
    await openCompetitionPage(page, league);
    await expect(
      page.getByRole("button", { name: "Save Entrants" }),
    ).toHaveCount(0);
    await pickMany(page, "league-entrants", PEOPLE.slice(0, 4));
    await expect(page.getByText("(4 chosen)")).toBeVisible();
    await expectEntrantsSaved(page);
    expect(await savedEntrants(league)).toEqual(PEOPLE.slice(0, 4));
    await page.reload();
    await expect(page.getByText("(4 chosen)")).toBeVisible();

    // Another tab pairs the League, which locks its Entrants; this page
    // hasn't heard, so its picker is still on.
    const other = await context.newPage();
    try {
      await openCompetitionPage(other, league);
      await other.getByRole("button", { name: "Pair rounds" }).click();
      await expect(other.getByText("Paired", { exact: true })).toBeVisible();
      // The run area's lock line under the Entrants.
      await expect(
        other.getByText(LOCKED_BY_PAIRING, { exact: true }).last(),
      ).toBeVisible();
    } finally {
      await other.close();
    }
    await expect(page.locator("#league-entrants")).toBeEnabled();
    await pickMany(page, "league-entrants", [PEOPLE[4]]);
    // Refused: the server's message under the picker, and the picker back
    // to the 4 saved.
    await expect(entrantsStatus(page)).toHaveText(
      "Not saved: see the field marked below",
    );
    await expect(page.locator('[data-slot="field-error"]')).toHaveText(
      LOCKED_BY_PAIRING,
    );
    await expect(page.getByText("(4 chosen)")).toBeVisible();
    await expect(
      page.getByRole("button", { name: `Remove ${PEOPLE[4]}` }),
    ).toHaveCount(0);
    // The refusal refreshes the page, so the new lock shows and the
    // picker turns off.
    await expect(page.locator("#league-entrants")).toBeDisabled();
    await shoot(page, testInfo, "league-refused");
    expect(await savedEntrants(league)).toEqual(PEOPLE.slice(0, 4));
    await page.reload();
    await expect(page.getByText("(4 chosen)")).toBeVisible();
    await expect(page.locator("#league-entrants")).toBeDisabled();
  } finally {
    await deleteCompetitions(bracketName, leagueName);
  }
});

test("r26 AC6 Head-to-head picks A vs B, each leaving out the other's choice, and saves once both are set", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R26 Entrants Head-to-head ${Date.now()}`;
  const [a, b, c] = PEOPLE;
  try {
    const id = await addXiCompetition(name, { format: "head-to-head" });
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCompetitionPage(page, id);

    const sideA = page.getByRole("combobox", {
      name: "Participant A",
      exact: true,
    });
    const sideB = page.getByRole("combobox", {
      name: "Participant B",
      exact: true,
    });
    await expect(sideA).toBeVisible();
    await expect(sideB).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Save Entrants" }),
    ).toHaveCount(0);

    // A alone saves nothing.
    await pickSide(page, "a", a);
    await expect(sideA).toHaveValue(a);
    await expect(entrantsStatus(page)).toHaveText("Changes save automatically");
    // B leaves out A's choice; picking B saves the pair.
    await expectNotOffered(page, "b", a);
    await pickSide(page, "b", b);
    await expectEntrantsSaved(page);
    expect(await savedEntrants(id)).toEqual([a, b]);
    // A leaves out B's choice.
    await expectNotOffered(page, "a", b);
    await expect(sideA).toHaveValue(a);
    await shoot(page, testInfo, "head-to-head-pair");

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoSidewaysScroll(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    // The pair is saved: a reload shows it.
    await page.reload();
    await expect(sideA).toHaveValue(a);
    await expect(sideB).toHaveValue(b);

    // Clearing one side leaves the saved pair alone, past the autosave's
    // delay and through a reload.
    await page.getByRole("button", { name: "Clear Participant A" }).click();
    await expect(sideA).toHaveValue("");
    await expect(entrantsStatus(page)).toHaveText("Changes save automatically");
    await page.waitForTimeout(1_500);
    expect(await savedEntrants(id)).toEqual([a, b]);
    await page.reload();
    await expect(sideA).toHaveValue(a);
    await expect(sideB).toHaveValue(b);

    // Both set again saves the new pair.
    await page.getByRole("button", { name: "Clear Participant A" }).click();
    await pickSide(page, "a", c);
    await expectEntrantsSaved(page);
    expect(await savedEntrants(id)).toEqual([b, c].sort());
    await page.reload();
    await expect(sideA).toHaveValue(c);
    await expect(sideB).toHaveValue(b);
  } finally {
    await deleteCompetitions(name);
  }
});
