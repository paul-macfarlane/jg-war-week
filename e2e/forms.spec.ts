import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

test.describe("forms", () => {
  test("a Points Entry refused on the server shows under Points and focuses it", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.goto("/admin/points");
    const form = page.getByRole("form", { name: "Points Entry" });
    await form
      .getByRole("combobox", { name: "Competition" })
      .fill("HQ Attendance");
    await page.getByRole("option", { name: /^HQ Attendance/ }).click();
    await form.getByRole("combobox", { name: "Team" }).fill("Blue");
    await page.getByRole("option", { name: /^Blue/ }).click();
    const points = form.getByLabel("Points", { exact: true });
    await points.fill("9999999");
    await form.getByRole("button", { name: "Add Points Entry" }).click();

    const pointsField = form
      .getByRole("group")
      .filter({ has: page.getByLabel("Points", { exact: true }) });
    await expect(
      pointsField.getByRole("alert").filter({
        hasText: "Points must be at most 999999.99.",
      }),
    ).toBeVisible();
    await expect(points).toHaveAttribute("aria-invalid", "true");
    const pointsId = await points.getAttribute("id");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe(pointsId);
    await page.screenshot({
      path: testInfo.outputPath("points-entry-field-error.png"),
      fullPage: true,
    });
  });
});
