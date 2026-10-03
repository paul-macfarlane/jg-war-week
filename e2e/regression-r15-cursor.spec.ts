import { expect, test } from "@playwright/test";

import { xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

test.describe("85 Pointer cursor on interactive elements", () => {
  test("buttons, links, combobox options, tabs show pointer cursor", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);
    await page.goto("/xi/competitions");

    // Test button (e.g., a Create button if present, or use the tab button)
    const createButton = page.getByRole("button", { name: /create/i }).first();
    if ((await createButton.count()) > 0) {
      const cursor = await createButton.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );
      expect(cursor).toBe("pointer");
    }

    // Test link (e.g., a competition link)
    const link = page.getByRole("link").first();
    if ((await link.count()) > 0) {
      const cursor = await link.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );
      expect(cursor).toBe("pointer");
    }

    // Test tab (e.g., the Group tabs on Competitions page)
    const tab = page.getByRole("tab").first();
    if ((await tab.count()) > 0) {
      const cursor = await tab.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );
      expect(cursor).toBe("pointer");
    }

    // Test combobox option by navigating to an admin form that has a combobox
    await page.goto("/xi/competitions/new");
    const groupSelect = page.locator("[data-slot=combobox-item]").first();

    if ((await groupSelect.count()) > 0) {
      // Open the combobox if it's not already open
      const comboboxTrigger = page
        .locator("[data-slot=combobox-trigger]")
        .first();
      if ((await comboboxTrigger.count()) > 0) {
        await comboboxTrigger.click();
      }

      // Wait for the combobox item to be visible
      await groupSelect.waitFor({ state: "visible" });
      const cursor = await groupSelect.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );
      expect(cursor).toBe("pointer");
    }
  });

  test("disabled button shows not-allowed cursor", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);

    // Navigate to a page that has a disabled button or create a scenario where
    // a button gets disabled (e.g., during form validation)
    await page.goto("/xi/competitions/new");

    // Look for a disabled button (e.g., submit button before form is valid)
    const disabledButton = page.locator("button:disabled").first();

    if ((await disabledButton.count()) > 0) {
      const cursor = await disabledButton.evaluate(
        (el) => window.getComputedStyle(el).cursor,
      );
      expect(cursor).toBe("not-allowed");
    }
  });
});
