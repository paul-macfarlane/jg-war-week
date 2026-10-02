import { expect, test } from "@playwright/test";

import { formatDateLabel, parseDateValue } from "@/lib/date-value";

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
  // react-day-picker's `td[data-day]` carries the ISO date (the buttons
  // inside carry a locale string). Every Day sits inside a range that spans
  // both visible months.
  const cells = popup.locator("td[data-day]");
  const count = await cells.count();
  const tap = (index: number) => cells.nth(index).getByRole("button").click();
  await tap(count - 8);
  await tap(7);
  await expect(popup).toBeVisible();
  await expect(popup.getByRole("button", { name: "Done" })).toBeVisible();

  // Adjusting the start: a third tap starts a new range, the fourth ends it.
  await tap(3);
  await tap(count - 4);
  await expect(popup).toBeVisible();
  const start = await cells.nth(3).getAttribute("data-day");
  const end = await cells.nth(count - 4).getAttribute("data-day");
  const startDate = start && parseDateValue(start);
  const endDate = end && parseDateValue(end);
  if (!start || !end || !startDate || !endDate) {
    throw new Error("Calendar cells missing an ISO data-day");
  }

  await popup.getByRole("button", { name: "Done" }).click();
  await expect(popup).toBeHidden();
  await expect(trigger).toContainText(
    `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`,
  );
  await expect(page.locator('input[name="startDate"]')).toHaveValue(start);
  await expect(page.locator('input[name="endDate"]')).toHaveValue(end);
});
