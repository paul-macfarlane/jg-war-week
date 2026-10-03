import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

// Epic R15, ticket 86 (.scratch/regression-2026-10/issues/86-centre-the-top-nav.md):
// the top nav sits in the header's centre from lg up; below lg the brand is
// left and the account menu right.
for (const width of [1280, 1024]) {
  test(`r15 86 the top nav is centred at ${width} wide on XI and XII`, async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize({ width, height: 900 });

    for (const edition of ["xi", "xii"]) {
      await page.goto(`/${edition}`);
      const header = page.locator("header").first();
      const nav = header.getByRole("navigation", { name: "Primary" });
      await expect(nav).toBeVisible();

      const headerBox = await header.boundingBox();
      const navBox = await nav.boundingBox();
      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      const headerCentreX = headerBox!.x + headerBox!.width / 2;
      const navCentreX = navBox!.x + navBox!.width / 2;
      expect(Math.abs(navCentreX - headerCentreX)).toBeLessThanOrEqual(4);

      await page.screenshot({
        path: testInfo.outputPath(`86-nav-centre-${edition}-${width}.png`),
        animations: "disabled",
      });
    }
  });
}

test("r15 86 at 390 wide the header keeps the brand left and the account menu right", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/xi");

  const header = page.locator("header").first();
  const brand = header.getByRole("link", { name: /^War Week XI/ });
  const account = header.getByRole("button", { name: /account/i }).first();
  await expect(brand).toBeVisible();
  await expect(account).toBeVisible();
  const brandBox = await brand.boundingBox();
  const accountBox = await account.boundingBox();
  expect(brandBox).not.toBeNull();
  expect(accountBox).not.toBeNull();
  expect(brandBox!.x).toBeLessThanOrEqual(24);
  expect(390 - (accountBox!.x + accountBox!.width)).toBeLessThanOrEqual(24);

  await page.screenshot({
    path: testInfo.outputPath("86-header-xi-390.png"),
    animations: "disabled",
  });
});
