import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

const cursorOf = (locator: Locator) =>
  locator.evaluate((el) => window.getComputedStyle(el).cursor);

test.describe("85 Pointer cursor on interactive elements", () => {
  test("buttons, links, combobox options and tabs show a pointer", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);

    // Button, link and tab on the Competitions page.
    await page.goto("/xi/competitions");
    const tab = page.getByRole("tab").first();
    await expect(tab).toBeVisible();
    expect(await cursorOf(tab)).toBe("pointer");
    const link = page.getByRole("link").first();
    await expect(link).toBeVisible();
    expect(await cursorOf(link)).toBe("pointer");

    // Button and combobox option on an admin form.
    await page.goto("/admin/points");
    const button = page.getByRole("button", { name: /^Delete/ }).first();
    await expect(button).toBeVisible();
    expect(await cursorOf(button)).toBe("pointer");

    await page.getByRole("combobox", { name: "Competition" }).click();
    const option = page.getByRole("option").first();
    await expect(option).toBeVisible();
    expect(await cursorOf(option)).toBe("pointer");
  });

  test("a disabled button shows not-allowed", async ({ context, page }) => {
    await asOrganizer(context);
    // The target combobox's trigger is disabled until a Competition is chosen.
    await page.goto("/admin/points");
    const disabled = page.locator("button:disabled").first();
    await expect(disabled).toBeVisible();
    expect(await cursorOf(disabled)).toBe("not-allowed");
  });
});
