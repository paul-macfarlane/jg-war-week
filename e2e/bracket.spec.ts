import { type Page, expect, test } from "@playwright/test";

import { xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Beyblades is an individual War Week XI Competition with Placement Points
// 5 / 3 / 1. None of these four has a hand-entered Beyblades Points Entry.
const COMPETITION = "Beyblades";
const ENTRANTS = [
  "Ashley Schuliger",
  "Sam Schantz",
  "Ryan Shendler",
  "Alex Kelly",
];

/** Records the Heat named `heat`, with its first-listed Entrant winning. */
async function recordHeat(page: Page, heat: string): Promise<string> {
  await page.getByRole("button", { name: `Record ${heat}` }).click();
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
  await sheet.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return name;
}

test("a Bracket is built, run and finalized into Points Entries", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);

  await page.goto(`/admin/setup/competitions/${id}/bracket`);
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Single elimination" }).click();
  await expect(
    page.getByText("Format set to Single elimination"),
  ).toBeVisible();

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
  await expect(page.getByText("Entrants saved")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("bracket-built.png"),
    fullPage: true,
  });

  await page.getByRole("link", { name: "Run results" }).click();
  await expect(
    page.getByRole("heading", { name: `${COMPETITION} · Results` }),
  ).toBeVisible();
  await recordHeat(page, "Semifinal 1");
  await recordHeat(page, "Semifinal 2");
  // Both semifinal winners advanced, so the Final is recordable.
  const champion = await recordHeat(page, "Final");
  await expect(page.getByLabel("Champion", { exact: true })).toContainText(
    champion,
  );

  await page.getByRole("button", { name: "Finalize" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Finalize" })
    .click();
  await expect(page.getByText("Bracket finalized")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("bracket-finalized.png"),
    fullPage: true,
  });

  await page.goto(`/xi/competitions/${id}`);
  const entries = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Points Entries" }) })
    .getByRole("listitem")
    .filter({ hasText: "From bracket" });
  // Placement Points 5 / 3 / 1: the champion, the runner-up, and both
  // semifinal losers tied for third.
  await expect(entries).toHaveCount(4);
  await expect(entries.filter({ hasText: champion })).toHaveText(
    /From bracket\s*5$/,
  );
  await page.screenshot({
    path: testInfo.outputPath("competition-points-entries.png"),
    fullPage: true,
  });
});
