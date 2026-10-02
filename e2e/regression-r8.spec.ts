import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

// Epic R8: quick fixes (.scratch/regression-2026-09/epics/R8-*).

test("r8 50 the date range picker stays open until Done", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/setup/war-week");

  const trigger = page.getByLabel("Dates");
  await trigger.click();
  const popup = page.getByRole("dialog");
  // Every Day sits inside a range that spans both visible months.
  const cells = popup.locator("[data-day]");
  const count = await cells.count();
  await cells.nth(count - 8).click();
  await cells.nth(7).click();
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("button", { name: "Done" })).toBeVisible();

  // A third tap starts over; the fourth finishes the new range.
  await cells.nth(3).click();
  await cells.nth(count - 4).click();
  await expect(popup).toBeVisible();
  const start = await cells.nth(3).getAttribute("data-day");
  const end = await cells.nth(count - 4).getAttribute("data-day");
  if (!start || !end) throw new Error("Calendar cells missing data-day");

  await popup.getByRole("button", { name: "Done" }).click();
  await expect(popup).toBeHidden();
  await expect(page.locator('input[name="startDate"]')).toHaveValue(start);
  await expect(page.locator('input[name="endDate"]')).toHaveValue(end);
});
