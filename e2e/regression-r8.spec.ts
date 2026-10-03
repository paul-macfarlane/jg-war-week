import { type Page, expect, test } from "@playwright/test";

import { formatDateLabel, parseDateValue } from "@/lib/date-value";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R8: quick fixes (.scratch/regression-2026-09/epics/R8-*).

type XiDates = { start_date: string; end_date: string };

function readXiDates() {
  return runQuery<XiDates>(
    "select start_date::text, end_date::text from war_week where edition = 'xi'",
  ).then(([row]) => row);
}

test("r8 50 the date range picker stays open until Done, then the range saves itself", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  const before = await readXiDates();
  try {
    await rangePickerStaysOpenUntilDone(page);
  } finally {
    await runQuery(
      "update war_week set start_date = $1::date, end_date = $2::date where edition = 'xi'",
      [before.start_date, before.end_date],
    );
  }
});

async function rangePickerStaysOpenUntilDone(page: Page) {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/admin/settings");

  const form = page.getByRole("form", { name: "War Week settings" });
  const trigger = form.getByLabel("Dates");
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
  await expect(form.locator('input[name="startDate"]')).toHaveValue(start);
  await expect(form.locator('input[name="endDate"]')).toHaveValue(end);

  // r9 59: after Done the range autosaves, start and end together.
  await expect(page.locator('[data-slot="autosave-status"]')).toHaveText(
    "Saved",
  );
  expect(await readXiDates()).toEqual({ start_date: start, end_date: end });
}
