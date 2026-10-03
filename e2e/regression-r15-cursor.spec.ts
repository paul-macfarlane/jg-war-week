import type { Locator } from "@playwright/test";
import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

const cursorOf = (locator: Locator) =>
  locator.evaluate((el) => window.getComputedStyle(el).cursor);

// Epic R15, ticket 85 (.scratch/regression-2026-10/issues/85-pointer-cursor.md):
// clickable controls show the pointer cursor and a disabled button not-allowed.
test.describe("cursors", () => {
  test("r15 85 buttons, links, combobox options and tabs show a pointer", async ({
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

  test("r15 85 a disabled button shows not-allowed and is what the pointer is over", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);
    // The target combobox's trigger is disabled until a Competition is chosen.
    await page.goto("/admin/points");
    const disabled = page.locator("button:disabled").first();
    await expect(disabled).toBeVisible();
    expect(await cursorOf(disabled)).toBe("not-allowed");
    // The pointer must reach the button, or the cursor is never seen.
    const hit = await disabled.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + box.height / 2,
      );
      return top !== null && el.contains(top);
    });
    expect(hit).toBe(true);
  });
});
