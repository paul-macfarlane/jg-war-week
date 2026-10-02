import { type Page, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R11, ticket 68: Unstart sends a live War Week back to Upcoming
// (.scratch/regression-2026-09/issues/68-unstart-a-war-week.md). Fixture: the
// seeded, never-started XII (seeds/xii.json, upcoming, nothing scored).

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** Screenshots `page` at both viewports as `<test name>/<width>.png`. */
async function shoot(page: Page, testName: string) {
  for (const { name, width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: `test-results/e2e/${testName}/${name}.png`,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const statusOf = async (edition: string) =>
  (
    await runQuery<{ status: string }>(
      "select status from war_week where edition = $1",
      [edition],
    )
  )[0]?.status;

test("r11 68 Start then Unstart a fresh edition; it shows Upcoming again", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  await page.setViewportSize({ width: 1440, height: 900 });
  expect(await statusOf("xii")).toBe("upcoming");
  const [remembered] = await runQuery<{ edition: string }>(
    "select edition from war_week where status = 'live'",
  );
  try {
    await runQuery(
      "update war_week set status = 'complete' where status = 'live'",
    );

    await page.goto("/admin/settings");
    await page
      .getByRole("combobox", { name: "War Week to administer" })
      .click();
    await page.getByRole("option", { name: /War Week XII / }).click();
    await expect(
      page.getByRole("combobox", { name: "War Week to administer" }),
    ).toContainText("War Week XII");

    const lifecycle = page.getByRole("region", { name: "Lifecycle" });
    await expect(
      lifecycle.getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(
      lifecycle.getByText(
        "Live makes this the War Week everyone lands on. Nothing is hidden before then.",
      ),
    ).toBeVisible();

    await lifecycle.getByRole("button", { name: "Start War Week" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Start War Week" })
      .click();
    await expect(lifecycle.getByText("Live", { exact: true })).toBeVisible();
    expect(await statusOf("xii")).toBe("live");
    await shoot(page, "r11-68-live");

    await lifecycle.getByRole("button", { name: "Unstart" }).click();
    const confirm = page.getByRole("alertdialog");
    await expect(
      confirm.getByText(
        "It goes back to Upcoming. Only possible while nothing has been scored.",
      ),
    ).toBeVisible();
    await confirm.getByRole("button", { name: "Unstart" }).click();

    await expect(
      lifecycle.getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(
      lifecycle.getByRole("button", { name: "Start War Week" }),
    ).toBeVisible();
    expect(await statusOf("xii")).toBe("upcoming");
    await shoot(page, "r11-68-unstarted");
  } finally {
    if ((await statusOf("xii")) === "live") {
      await runQuery(
        "update war_week set status = 'upcoming' where edition = 'xii'",
      );
    }
    if (remembered) {
      await runQuery("update war_week set status = 'live' where edition = $1", [
        remembered.edition,
      ]);
    }
  }
});
