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
    // Enter in Points submits; the refused value must survive the
    // post-action form reset.
    await points.press("Enter");

    const pointsField = form
      .getByRole("group")
      .filter({ has: page.getByLabel("Points", { exact: true }) });
    await expect(
      pointsField.getByRole("alert").filter({
        hasText: "Points must be at most 999999.99.",
      }),
    ).toBeVisible();
    await expect(points).toHaveAttribute("aria-invalid", "true");
    await expect(points).toHaveValue("9999999");
    const pointsId = await points.getAttribute("id");
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.id))
      .toBe(pointsId);
    await page.screenshot({
      path: testInfo.outputPath("points-entry-field-error.png"),
      fullPage: true,
    });
  });

  test("a settings autosave refused on the server shows under Slack URL and keeps the value", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.goto("/admin/settings");
    const form = page.getByRole("form", { name: "War Week settings" });
    const slackUrl = form.getByLabel("Slack URL");
    // No Save: the field saves itself once typing stops (r9 59).
    await slackUrl.fill("http://slack.example.com/x");

    const slackField = form
      .getByRole("group")
      .filter({ has: page.getByLabel("Slack URL") });
    await expect(
      slackField.getByRole("alert").filter({
        hasText: "Slack URL must be an https URL.",
      }),
    ).toBeVisible();
    await expect(slackUrl).toHaveAttribute("aria-invalid", "true");
    await expect(slackUrl).toHaveValue("http://slack.example.com/x");
    await page.screenshot({
      path: testInfo.outputPath("settings-field-error.png"),
      fullPage: true,
    });
  });
});
