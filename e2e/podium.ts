import AxeBuilder from "@axe-core/playwright";
import { type Page, type TestInfo, expect } from "@playwright/test";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";
import type { ColorScheme } from "@/lib/theme";

/** One place the Bracket's podium should show, in order. */
export type ExpectedPlace = {
  /** "1st", "2nd", … */
  place: string;
  name: string;
  /** "10 points", "1 point" or "No points". */
  points: string;
};

/**
 * The Bracket podium (spec R20, decision 5) on a Bracket page: exactly the
 * expected places in order, each with its points, 1st marked Winner, and
 * nowhere on the page "Champion" or "Play the finale".
 */
export async function expectPodium(page: Page, expected: ExpectedPlace[]) {
  // Visible only: while a reload streams, React holds the new page in a
  // hidden container before swapping it in.
  const podium = page
    .getByRole("region", { name: "Top finishers" })
    .filter({ visible: true });
  await expect(podium).toBeVisible();
  const places = podium.getByRole("listitem");
  await expect(places).toHaveCount(expected.length);
  for (const [i, place] of expected.entries()) {
    const item = places.nth(i);
    await expect(item).toContainText(place.place);
    await expect(item).toContainText(place.name);
    await expect(item).toContainText(place.points);
    if (i === 0) await expect(item).toContainText("Winner");
    else await expect(item).not.toContainText("Winner");
  }
  await expectNoOldWords(page);
}

/** Neither "Champion" nor "Play the finale" anywhere on the page. */
export async function expectNoOldWords(page: Page) {
  const text = await page.locator("body").innerText();
  expect(text).not.toMatch(/champion/i);
  expect(text).not.toMatch(/play the finale/i);
}

/**
 * Screenshots the page at 1440 and 390 as `<name>-<width>.png`, checking
 * the podium is visible and nothing scrolls sideways at either width.
 */
export async function shootPodium(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport);
    const podium = page
      .getByRole("region", { name: "Top finishers" })
      .filter({ visible: true });
    await expect(podium).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await podium.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${viewport.width}.png`),
      fullPage: true,
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/**
 * axe (WCAG 2 A and AA) on the podium in the app's light and dark Display,
 * the system preference set the other way so the app's setting is what
 * shows. Leaves the Display setting cleared.
 */
export async function axePodium(page: Page, testInfo: TestInfo, name: string) {
  const schemes: ColorScheme[] = ["light", "dark"];
  for (const scheme of schemes) {
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [DISPLAY_STORAGE_KEY, scheme] as const,
    );
    await page.emulateMedia({
      colorScheme: scheme === "dark" ? "light" : "dark",
    });
    await page.reload();
    await expect(
      page.getByRole("region", { name: "Top finishers" }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.dataset.display),
    ).toBe(scheme);
    await page.evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const results = await new AxeBuilder({ page })
      .include('[aria-label="Top finishers"]')
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${scheme}.png`),
      fullPage: true,
    });
  }
  await page.evaluate(
    (key) => window.localStorage.removeItem(key),
    DISPLAY_STORAGE_KEY,
  );
  await page.emulateMedia({ colorScheme: null });
  await page.reload();
  await page.setViewportSize({ width: 1280, height: 900 });
}
