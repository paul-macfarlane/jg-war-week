import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { loadScaleDemo, restoreLocalSeed } from "./scale-demo";
import { asOrganizer } from "./session";

// Epic R24, finding 112 (.scratch/regression-2026-10/issues/112-admin-bottom-bar-wide-font.md):
// at 390 an Organizer's five bottom-bar tabs fit the viewport in XI (monospace
// preset, loaded by global setup) and XII (sans preset, the scale demo that
// beforeAll loads and afterAll puts back), reading Competitions, Points,
// Schedule, News, More. The side column at 1440 keeps the full labels.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function checkBar(page: Page, testInfo: TestInfo, edition: string) {
  await page.setViewportSize(PHONE);
  await page.goto("/admin/roster");
  await expect(
    page.getByText(`War Week ${edition} admin`, { exact: true }),
  ).toBeVisible();
  const bar = page.locator('nav[aria-label="Admin sections"]:visible');
  const tabs = bar.locator("li > a, li > button");
  await expect(tabs).toHaveCount(5);
  await expect(tabs).toHaveText([
    "Competitions",
    /^Points \(Discretionary points\)$/,
    "Schedule",
    /^News \(Announcements\)$/,
    "More",
  ]);
  for (let i = 0; i < 5; i++) {
    const box = await tabs.nth(i).boundingBox();
    if (!box) throw new Error(`Tab ${i} has no box`);
    expect(box.x, `tab ${i} left edge`).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, `tab ${i} right edge`).toBeLessThanOrEqual(
      PHONE.width,
    );
  }
  await expect(
    bar.getByRole("link", { name: /Discretionary points/ }),
  ).toHaveText(/^Points \(/);
  await expect(bar.getByRole("link", { name: /Announcements/ })).toHaveText(
    /^News \(/,
  );
  for (let i = 0; i < 5; i++) {
    expect(
      await tabs.nth(i).evaluate((el) => getComputedStyle(el).fontFamily),
      `tab ${i} font`,
    ).toMatch(/Inter/);
  }
  // The page's own font (the admin root sets it): the monospace preset in XI,
  // so the tabs' Inter is deliberate there.
  const bodyFont = await page
    .getByText(`War Week ${edition} admin`, { exact: true })
    .evaluate((el) => getComputedStyle(el).fontFamily);
  if (edition === "XI") expect(bodyFont).toMatch(/JetBrains/);
  await page.screenshot({
    path: testInfo.outputPath(`bar-${edition.toLowerCase()}-390.png`),
    animations: "disabled",
  });

  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/roster");
  const side = page.locator('nav[aria-label="Admin sections"]:visible');
  await expect(
    side.getByRole("link", { name: "Discretionary points", exact: true }),
  ).toHaveText("Discretionary points");
  await expect(
    side.getByRole("link", { name: "Announcements", exact: true }),
  ).toHaveText("Announcements");
  await page.screenshot({
    path: testInfo.outputPath(`side-${edition.toLowerCase()}-1440.png`),
    animations: "disabled",
  });
}

test("r24 112 XI (monospace): five bottom-bar tabs fit 390 with short labels", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await checkBar(page, testInfo, "XI");
});

test.describe("XII (sans)", () => {
  test.beforeAll(() => {
    loadScaleDemo();
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    restoreLocalSeed();
  });

  test("r24 112 XII (sans): five bottom-bar tabs fit 390 with short labels", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await asOrganizer(context);
    await checkBar(page, testInfo, "XII");
  });
});
