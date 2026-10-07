import { type Page, expect, test } from "@playwright/test";

import { DISPLAY_STORAGE_KEY } from "../src/lib/display";

// R26 Decision 11: /about's "What it does" is one feature per row (the still
// beside its caption at 1440, the caption below it at 390, each with its own
// phone or desktop capture), and the
// three-phone Standings demo is gone. Anonymous and read-only: it changes no
// data. Screenshots at 1440 and 390 in light and dark.

const VIEWPORTS = [
  { label: "1440", size: { width: 1440, height: 900 } },
  { label: "390", size: { width: 390, height: 844 } },
] as const;

async function openAbout(
  page: Page,
  size: { width: number; height: number },
  display: "light" | "dark",
) {
  await page.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [DISPLAY_STORAGE_KEY, display] as const,
  );
  await page.setViewportSize(size);
  await page.goto("/about");
  await expect(
    page.getByRole("heading", { name: "What it does" }),
  ).toBeVisible();
}

for (const display of ["light", "dark"] as const) {
  for (const { label, size } of VIEWPORTS) {
    test(`r26 about: one feature per row, no Standings demo, at ${label} in ${display}`, async ({
      page,
    }, testInfo) => {
      await openAbout(page, size, display);

      // The three-phone demo is gone, hero and stills alike.
      await expect(page.locator("[data-standings-step]")).toHaveCount(0);
      expect(
        await page.evaluate(() =>
          Array.from(document.images).some((img) =>
            decodeURIComponent(img.src).includes("/about/standings-"),
          ),
        ),
      ).toBe(false);

      const features = page.locator("[data-feature]");
      const count = await features.count();
      expect(count).toBeGreaterThan(0);

      for (let i = 0; i < count; i++) {
        const feature = features.nth(i);
        await feature.scrollIntoViewIfNeeded();
        const still = feature.locator("img:visible");
        const caption = feature.getByRole("heading", { level: 3 });
        const copy = feature.locator("p");
        // Exactly the Display's own still shows (the other is display:none).
        await expect(still).toHaveCount(1);
        // The phone capture at 390, the desktop one at 1440.
        const src = decodeURIComponent((await still.getAttribute("src")) ?? "");
        if (label === "390") expect(src).toContain("-phone");
        else expect(src).not.toContain("-phone");
        // Loaded, not just in the markup. The first request of a still makes
        // next/image resize the 2560px capture, which can take seconds.
        await expect
          .poll(
            () => still.evaluate((img: HTMLImageElement) => img.naturalWidth),
            { timeout: 20_000 },
          )
          .toBeGreaterThan(0);

        const imgBox = await still.boundingBox();
        const headingBox = await caption.boundingBox();
        const copyBox = await copy.boundingBox();
        const rowBox = await feature.boundingBox();
        if (!imgBox || !headingBox || !copyBox || !rowBox) {
          throw new Error(`Feature ${i} has no measurable box`);
        }

        if (label === "1440") {
          // Same row: the caption starts to the right of the still, level
          // with its top, and overlaps it vertically.
          expect(headingBox.x).toBeGreaterThanOrEqual(imgBox.x + imgBox.width);
          expect(headingBox.y).toBeGreaterThanOrEqual(imgBox.y - 1);
          expect(headingBox.y).toBeLessThan(imgBox.y + imgBox.height);
          expect(copyBox.y).toBeLessThan(imgBox.y + imgBox.height);
          // Big enough to read, and one row each: the still is wider than
          // half the feature's row.
          expect(imgBox.width).toBeGreaterThan(rowBox.width / 2);
        } else {
          // Below: the caption starts under the still.
          expect(headingBox.y).toBeGreaterThanOrEqual(imgBox.y + imgBox.height);
          expect(imgBox.width).toBeGreaterThan(size.width * 0.8);
        }
        // Rows stack: the next feature starts below this one.
        if (i + 1 < count) {
          const next = await features.nth(i + 1).boundingBox();
          if (!next) throw new Error(`Feature ${i + 1} has no box`);
          expect(next.y).toBeGreaterThanOrEqual(rowBox.y + rowBox.height);
        }
      }

      await expect
        .poll(() =>
          page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
        )
        .toBe(true);

      // Every visible image loaded (the Finale poster included).
      await page.locator("section#features").scrollIntoViewIfNeeded();
      for (const img of await page.locator("img:visible").all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
          .toBeGreaterThan(0);
      }

      await page.locator("#features").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: testInfo.outputPath(`about-${label}-${display}.png`),
        fullPage: true,
      });
    });
  }
}
