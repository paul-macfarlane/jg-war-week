import { expect, test } from "@playwright/test";

import { openForBracket, xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Epic R15, ticket 84 (.scratch/regression-2026-10/issues/84-heats-advancers-highlighted.md):
// a recorded Heats Heat marks every advancing place, in the form and in the
// results. Pool is shared with other specs, so its format, Entrants and Heats
// are put back in `finally`. The eight are the Participants
// bracket-heats.spec.ts uses.
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

test("r15 84 a recorded Heat of 4 with 2 advancing highlights both advancers in admin", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);
  const restore = await openForBracket(id);

  try {
    await page.goto(`/admin/competitions/${id}/bracket`);
    await page.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Bracket", exact: true }).click();
    await expect(page.getByText("Format set to Bracket")).toBeVisible();
    await page.getByRole("combobox", { name: "Entrants per Heat" }).click();
    await page.getByRole("option", { name: "4 per Heat" }).click();
    await page.getByRole("combobox", { name: "How many advance" }).click();
    await page.getByRole("option", { name: "Top 2 advance" }).click();
    await page.getByRole("button", { name: "Save Heat settings" }).click();
    await expect(page.getByText("Heat settings saved")).toBeVisible();

    const find = page.locator("#bracket-entrants");
    for (const entrant of ENTRANTS) {
      await find.fill(entrant);
      await page
        .getByRole("option", { name: new RegExp(`^${entrant}`) })
        .click();
    }
    await expect(page.getByText("(8 chosen)")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    await page.goto(`/admin/brackets/${id}`);
    const heat = "Round 1 Heat 1";
    await page
      .getByRole("button", { name: `Record result for ${heat}` })
      .click();
    const sheet = page.getByRole("dialog", { name: heat });
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
    await sheet.getByRole("button", { name: "Save Heat Result" }).click();
    await expect(page.getByText(`${winner} wins ${heat}`)).toBeVisible();
    await expect(sheet).toBeHidden();

    // The decided Heat's results mark 1st and 2nd, not 3rd or 4th.
    const advancers = page.locator("li[data-advances]");
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

    // The recorded Heat's Edit is secondary (outline), not the solid primary.
    await expect(
      page.getByRole("button", { name: `Edit ${heat}`, exact: true }),
    ).toHaveClass(/\bbg-background\b/);

    // Shoot once the Sheet's overlay and the toast have gone.
    await expect(page.locator('[data-slot="sheet-overlay"]')).toHaveCount(0);
    await expect(page.getByText(`${winner} wins ${heat}`)).toBeHidden({
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
