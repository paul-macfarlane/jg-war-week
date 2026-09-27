import { type Page, expect, test } from "@playwright/test";

import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

/** The computed `color-scheme` of `<html>`, which the viewport's scrollbar uses. */
function htmlColorScheme(page: Page) {
  return page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
}

test.beforeEach(async ({ context }) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
});

test("a dark Appearance Theme makes the whole page dark, scrollbar included", async ({
  page,
}, testInfo) => {
  // War Week XI's background is #000000.
  await page.goto("/xi");
  await expect.poll(() => htmlColorScheme(page)).toBe("dark");
  await page.screenshot({ path: testInfo.outputPath("xi-dark-scheme.png") });
});

test("a light Appearance Theme keeps the page light", async ({ page }) => {
  // War Week X's background is #fdf6e3.
  await page.goto("/x");
  await expect.poll(() => htmlColorScheme(page)).toBe("light");
});

test("the Archive stays light though its cards wear dark themes", async ({
  page,
}) => {
  await page.goto("/history");
  await expect(
    page.getByRole("heading", { level: 1, name: "War Week history" }),
  ).toBeVisible();
  await expect.poll(() => htmlColorScheme(page)).toBe("light");
});
