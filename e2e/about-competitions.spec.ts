import { expect, test } from "@playwright/test";
import path from "node:path";

const EVIDENCE = path.resolve(
  process.cwd(),
  "test-results/e2e/regression-r3-about/about-competitions.png",
);

/**
 * R3 17-7/15-5, R7 42: `/about`'s Competitions (Placements, Brackets, Head-to-head, Best score
 * and Participation)
 * feature card (ticket 03's public page, `src/lib/about.ts`'s
 * `ABOUT_FEATURES`). `/about` is anonymous-accessible
 * (`PUBLIC_PATHS`), so this needs no sign-in.
 */
test("about the Competitions feature card shows and screenshots on /about", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/about");

  const card = page.locator('[data-feature="competitions"]');
  await card.scrollIntoViewIfNeeded();
  await expect(
    card.getByRole("heading", {
      name: /Competitions: Placements, Brackets, Head-to-head, Best score and Participation/,
    }),
  ).toBeVisible();

  await card.screenshot({ path: EVIDENCE });
});
