import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";
import { teamTotal } from "./standings";

test("an Organizer's Points Entry raises the Team's total on the leaderboard", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.goto("/xi/leaderboard");
  const before = await teamTotal(page, "Blue");

  await page.goto("/admin/points");
  const form = page.getByRole("form", { name: "Points Entry" });
  await form
    .getByRole("combobox", { name: "Competition" })
    .fill("HQ Attendance");
  await page.getByRole("option", { name: /^HQ Attendance/ }).click();
  await form.getByRole("combobox", { name: "Team" }).fill("Blue");
  await page.getByRole("option", { name: /^Blue/ }).click();
  await form.getByLabel("Points", { exact: true }).fill("2.5");
  await form.getByLabel("Note (optional)").fill("e2e Points Entry");
  await form.getByRole("button", { name: "Add Points Entry" }).click();
  await expect(page.getByText("Points Entry saved")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("points-entry-saved.png"),
    fullPage: true,
  });

  await page.goto("/xi/leaderboard");
  expect(await teamTotal(page, "Blue")).toBeCloseTo(before + 2.5, 2);
  await page.screenshot({
    path: testInfo.outputPath("leaderboard-after.png"),
    fullPage: true,
  });
});
