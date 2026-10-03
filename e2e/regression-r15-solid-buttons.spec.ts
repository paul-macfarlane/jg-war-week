import { expect, test } from "@playwright/test";

import { xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Winning the Day Challenge is an individual War Week XI Competition no
// other spec runs as a Bracket; its Bracket is built here from scratch.
const COMPETITION = "Winning the Day Challenge";
const ENTRANTS = [
  "Albert Hernandez",
  "Alex Nikolis",
  "Andrew Bushey",
  "Austin Gage",
];

test("the admin Bracket's unrecorded Heat has a solid Record result button", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);

  await page.goto(`/admin/competitions/${id}/bracket`);
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Heats" }).click();
  await expect(page.getByText("Format set to Heats")).toBeVisible();

  const find = page.locator("#bracket-entrants");
  for (const entrant of ENTRANTS) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();

  await page.goto(`/admin/brackets/${id}`);
  const record = page.getByRole("button", { name: /^Record result/ }).first();
  await expect(record).toBeVisible();
  const background = await record.evaluate(
    (el) => getComputedStyle(el).backgroundColor,
  );
  expect(background).not.toBe("rgba(0, 0, 0, 0)");
  expect(background).not.toBe("transparent");

  await page.screenshot({
    path: testInfo.outputPath("admin-bracket-record-result.png"),
    fullPage: true,
  });
});
