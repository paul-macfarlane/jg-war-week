import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery } from "./db";
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

  // The Profile branch: a seeded MVP recipient (War Week IV's "Ian Ballard")
  // linked by email to a Profile with a distinct name shows that name.
  const PROFILE_EMAIL = "e2e-r12-ian@jahnelgroup.com";
  const PROFILE_NAME = "Ian Profile-Named";
  await runQuery(
    `update participant p set email = $1 from war_week w
     where p.war_week_id = w.id and w.edition = 'iv' and p.display_name = 'Ian Ballard'`,
    [PROFILE_EMAIL],
  );
  await runQuery(
    `insert into profile (email, name) values ($1, $2)
     on conflict (email) do update set name = excluded.name`,
    [PROFILE_EMAIL, PROFILE_NAME],
  );
  try {
    await runR12AwardHistory(page, testInfo, PROFILE_NAME);
  } finally {
    await runQuery(`delete from profile where email = $1`, [PROFILE_EMAIL]);
    await runQuery(
      `update participant p set email = null from war_week w
       where p.war_week_id = w.id and w.edition = 'iv' and p.email = $1`,
      [PROFILE_EMAIL],
    );
  }
});

async function runR12AwardHistory(
  page: Page,
  testInfo: TestInfo,
  profileName: string,
) {
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
    // A roster name where there's no Profile; the Profile's name where there is.
    await expect(page.getByText("Anthony Conway")).toBeVisible();
    await expect(page.getByText(profileName)).toBeVisible();
    await expect(page.getByText("Ian Ballard")).toHaveCount(0);
    await shoot(page, testInfo, `category-${name}`);
  }

  // An unknown id is a 404.
  const missing = await page.goto(
    "/history/awards/00000000-0000-4000-8000-000000000000",
  );
  expect(missing?.status()).toBe(404);
}
