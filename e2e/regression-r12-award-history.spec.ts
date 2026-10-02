import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("r12 71 History lists Awards through the years and a Category lists its War Weeks newest first", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);

  for (const [viewport, name] of [
    [DESKTOP, "1440"],
    [PHONE, "390"],
  ] as const) {
    await page.setViewportSize(viewport);
    await page.goto("/history");
    const list = page.getByRole("region", { name: "Awards through the years" });
    await expect(list).toBeVisible();
    await list.getByRole("link", { name: "War Week MVP" }).click();

    await expect(page).toHaveURL(/\/history\/awards\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "War Week MVP" }),
    ).toBeVisible();
    // Seeded MVP Awards: War Week V (2020) before War Week IV (2019).
    const editions = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    const v = editions.findIndex((t) => t.startsWith("War Week V "));
    const iv = editions.findIndex((t) => t.startsWith("War Week IV "));
    expect(v).toBeGreaterThanOrEqual(0);
    expect(iv).toBeGreaterThan(v);
    await expect(page.getByText("MVP 1st Place").first()).toBeVisible();
    await expect(page.getByText("Anthony Conway")).toBeVisible();
    await shoot(page, testInfo, `category-${name}`);
  }

  // An unknown id is a 404.
  const missing = await page.goto(
    "/history/awards/00000000-0000-4000-8000-000000000000",
  );
  expect(missing?.status()).toBe(404);
});
