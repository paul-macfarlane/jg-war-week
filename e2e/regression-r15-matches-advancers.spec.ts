import { expect, test } from "@playwright/test";

import {
  expectEntrantsSaved,
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import { openForBracket, xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Epic R15, ticket 84 (.scratch/regression-2026-10/issues/84-matches-advancers-highlighted.md):
// a recorded Matches Match marks every advancing place, in the form and in the
// results. Pool is shared with other specs, so its format, Entrants and Matches
// are put back in `finally`. The eight are the Participants
// bracket-matches.spec.ts uses.
const COMPETITION = "Pool";
const ENTRANTS = [
  "Albert Hernandez",
  "Alex Nikolis",
  "Andrew Bushey",
  "Austin Gage",
  "Awad Khawaja",
  "Ben Sadick",
  "Brian France",
  "Bryan Sambrook",
];

test("r15 84 a recorded Match of 4 with 2 advancing highlights both advancers in admin", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);
  const restore = await openForBracket(id);

  try {
    await openCompetitionPage(page, id);
    await setFormat(page, "Bracket");
    // A Group (spec R21, decision 10) shows its Match size fields.
    await page.getByRole("button", { name: "Group", exact: true }).click();
    await expectSaved(page);
    await page.getByRole("combobox", { name: "Entrants per Match" }).click();
    await page.getByRole("option", { name: "4 per Match" }).click();
    await page.getByRole("combobox", { name: "How many advance" }).click();
    await page.getByRole("option", { name: "Top 2 advance" }).click();
    await expectSaved(page);

    const find = page.locator("#bracket-entrants");
    for (const entrant of ENTRANTS) {
      await find.fill(entrant);
      await page
        .getByRole("option", { name: new RegExp(`^${entrant}`) })
        .click();
    }
    await expect(page.getByText("(8 chosen)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expectEntrantsSaved(page);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    await openCompetitionPage(page, id);
    const match = "Round 1 Match 1";
    // From the admin Bracket's tree, the one Participants see (100).
    await page
      .locator("[data-bracket-tree]")
      .getByRole("button", { name: `Record result for ${match}` })
      .click();
    const sheet = page.getByRole("dialog", { name: match });
    await expect(sheet).toBeVisible();
    const buttons = sheet
      .getByRole("group", { name: "Finishing order" })
      .getByRole("button");
    const count = await buttons.count();
    expect(count).toBe(4);
    // The button also shows the Avatar's initials; keep the Entrant's name.
    const firstText = await buttons.first().innerText();
    const winner = ENTRANTS.find((entrant) => firstText.includes(entrant))!;
    for (let i = 0; i < count; i++) await buttons.nth(i).click();
    // Both top places are marked as advancing before saving.
    await expect(sheet.locator("[data-advances]")).toHaveCount(2);
    await sheet.getByRole("button", { name: "Save Match Result" }).click();
    await expect(page.getByText(`${winner} wins ${match}`)).toBeVisible();
    await expect(sheet).toBeHidden();

    // The decided Match's box in the tree marks 1st and 2nd, not 3rd or 4th.
    const advancers = page
      .locator("[data-bracket-tree]")
      .getByRole("group", { name: match, exact: true })
      .locator("[data-advances]");
    await expect(advancers).toHaveCount(2);
    await expect(
      advancers.filter({ has: page.getByLabel("Place 1", { exact: true }) }),
    ).toHaveCount(1);
    await expect(
      advancers.filter({ has: page.getByLabel("Place 2", { exact: true }) }),
    ).toHaveCount(1);
    await expect(
      advancers.filter({ has: page.getByLabel("Place 3", { exact: true }) }),
    ).toHaveCount(0);

    // The recorded Match's Edit is secondary (outline), not the solid primary.
    await expect(
      page.getByRole("button", { name: `Edit ${match}`, exact: true }),
    ).toHaveClass(/\bbg-background\b/);

    // Shoot once the Sheet's overlay and the toast have gone.
    await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
    await expect(page.getByText(`${winner} wins ${match}`)).toBeHidden({
      timeout: 15_000,
    });
    await page.screenshot({
      path: testInfo.outputPath("admin-bracket-advancers.png"),
      fullPage: true,
      animations: "disabled",
    });
  } finally {
    await restore();
  }
});
