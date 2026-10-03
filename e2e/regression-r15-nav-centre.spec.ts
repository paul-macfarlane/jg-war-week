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

  test("at 390 wide the header keeps the name left and the account menu right", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/xi");

    const header = page.locator("header").first();
    const account = header.getByRole("button", { name: /account/i }).first();
    await expect(account).toBeVisible();
    const box = await account.boundingBox();
    expect(box).not.toBeNull();
    expect(390 - (box!.x + box!.width)).toBeLessThanOrEqual(24);

    await page.screenshot({
      path: testInfo.outputPath("86-header-xi-390.png"),
      animations: "disabled",
    });
  });
});
