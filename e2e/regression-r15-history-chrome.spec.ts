import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 390, height: 844 };

const lightPrimary = (page: Page) =>
  page
    .locator("[data-theme-root]")
    .first()
    .evaluate((el) =>
      (el as HTMLElement).style.getPropertyValue("--light-primary").trim(),
    );

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("r15 88 History and a Category page wear the current War Week's nav, tab bar and theme", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);

  // "/" redirects to the current War Week; its theme is the reference.
  await page.goto("/");
  await expect(page).toHaveURL(/\/[a-z]+$/);
  const currentTheme = await lightPrimary(page);
  expect(currentTheme).not.toBe("");

  await page.goto("/history");
  const categoryHref = await page
    .getByRole("region", { name: "Awards through the years" })
    .getByRole("link")
    .first()
    .getAttribute("href");
  expect(categoryHref).toMatch(/^\/history\/awards\/[0-9a-f-]{36}$/);

  for (const [path, label] of [
    ["/history", "history"],
    [categoryHref as string, "category"],
  ] as const) {
    await page.setViewportSize(DESKTOP);
    await page.goto(path);
    await expect(
      page.locator('nav[aria-label="Primary"]:visible'),
    ).toBeVisible();
    expect(await lightPrimary(page)).toBe(currentTheme);
    await shoot(page, testInfo, `${label}-1280`);

    await page.setViewportSize(PHONE);
    await page.goto(path);
    await expect(
      page.locator('nav[aria-label="Primary"]:visible'),
    ).toBeVisible();
    expect(await lightPrimary(page)).toBe(currentTheme);
    await shoot(page, testInfo, `${label}-390`);
  }
});
