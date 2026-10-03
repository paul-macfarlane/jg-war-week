import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

test.describe("86 Centre the top nav", () => {
  test("nav centre aligns with header centre at 1280 wide on XI and XII", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1280, height: 900 });

    for (const edition of ["xi", "xii"]) {
      await page.goto(`/${edition}`);

      const header = page.locator("header").first();
      const nav = header.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();

      // Get bounding boxes to check centering
      const headerBox = await header.boundingBox();
      const navBox = await nav.boundingBox();

      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      const headerCentreX = headerBox!.x + headerBox!.width / 2;
      const navCentreX = navBox!.x + navBox!.width / 2;
      expect(Math.abs(navCentreX - headerCentreX)).toBeLessThanOrEqual(4);

      await page.screenshot({
        path: testInfo.outputPath(`86-nav-centre-${edition}-1280.png`),
        animations: "disabled",
      });
    }
  });

  test("nav centre aligns with header centre at 1024 wide on XI and XII", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1024, height: 900 });

    for (const edition of ["xi", "xii"]) {
      await page.goto(`/${edition}`);

      const header = page.locator("header").first();
      const nav = header.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();

      // Get bounding boxes to check centering
      const headerBox = await header.boundingBox();
      const navBox = await nav.boundingBox();

      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      const headerCentreX = headerBox!.x + headerBox!.width / 2;
      const navCentreX = navBox!.x + navBox!.width / 2;
      expect(Math.abs(navCentreX - headerCentreX)).toBeLessThanOrEqual(4);

      await page.screenshot({
        path: testInfo.outputPath(`86-nav-centre-${edition}-1024.png`),
        animations: "disabled",
      });
    }
  });
});
