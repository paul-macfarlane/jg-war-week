import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery, xiTeamId } from "./db";
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

// Epic R22, AC 10 (.scratch/people-and-admin/spec.md): adding an Award offers
// presets; there is no Category UI.
test("r22 awards: adding an Award offers presets, picking one fills name and description, a new name saves, and there is no Category UI", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const suffix = Date.now().toString(36);
  const fromPreset = `E2E Terrordome ${suffix}`;
  const brandNew = `E2E Brand New ${suffix}`;
  try {
    await asOrganizer(context);
    for (const viewport of [DESKTOP, PHONE]) {
      await page.setViewportSize(viewport);
      await page.goto("/admin/awards");
      await expect(
        page.getByRole("heading", { level: 1, name: "Awards" }),
      ).toBeVisible();
      // No Category admin, no Category field anywhere.
      await expect(
        page.getByRole("button", { name: "Add Category" }),
      ).toHaveCount(0);
      await expect(
        page.getByRole("heading", { name: "Categories" }),
      ).toHaveCount(0);
      await expect(page.getByText("Category", { exact: false })).toHaveCount(0);
    }

    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/awards");
    await page.getByRole("button", { name: "Add Award" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Category")).toHaveCount(0);

    // Presets: a past Award name and a former Category name that no seed uses.
    const preset = dialog.getByRole("combobox", { name: "Preset" });
    await preset.click();
    await expect(
      page.getByRole("option", { name: "Terrordome Champion", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", {
        name: "Chess Tournament Champion",
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("option", { name: "Inspire", exact: true }),
    ).toBeVisible();
    await shoot(page, testInfo, "presets-1440");

    // Picking a preset copies its name and its most recent description.
    await page
      .getByRole("option", { name: "Terrordome Champion", exact: true })
      .click();
    const name = dialog.getByLabel("Name", { exact: true });
    const description = dialog.getByLabel("Description");
    await expect(name).toHaveValue("Terrordome Champion");
    await expect(description).toHaveValue(
      "Last Beyblade spinning in the Terrordome.",
    );

    // Both stay editable.
    await name.fill(fromPreset);
    await description.fill("Edited after picking a preset.");
    await dialog.locator("#award-team").click();
    await page.getByRole("option", { name: "Red", exact: true }).click();
    await dialog.getByRole("button", { name: "Add Award" }).click();
    await expect(page.getByText("Award saved")).toBeVisible();
    const saved = await runQuery<{ name: string; description: string }>(
      `select name, description from award where name = $1`,
      [fromPreset],
    );
    expect(saved).toEqual([
      { name: fromPreset, description: "Edited after picking a preset." },
    ]);

    // A brand-new name, picked from no preset, saves too.
    await page.getByRole("button", { name: "Add Award" }).click();
    await dialog.getByLabel("Name", { exact: true }).fill(brandNew);
    await dialog.locator("#award-team").click();
    await page.getByRole("option", { name: "Red", exact: true }).click();
    await dialog.getByRole("button", { name: "Add Award" }).click();
    await expect(page.getByText("Award saved").first()).toBeVisible();
    const created = await runQuery<{ n: number }>(
      `select count(*)::int as n from award where name = $1`,
      [brandNew],
    );
    expect(created[0].n).toBe(1);

    // The new name now shows on the Awards page, linked to its history, and
    // is itself offered as a preset next time.
    await page.goto("/xi/awards");
    await expect(
      page.getByRole("link", { name: brandNew, exact: true }),
    ).toHaveAttribute("href", `/history/awards/e2e-brand-new-${suffix}`);
    await page.goto("/admin/awards");
    await page.getByRole("button", { name: "Add Award" }).click();
    await dialog.getByRole("combobox", { name: "Preset" }).click();
    await expect(
      page.getByRole("option", { name: brandNew, exact: true }),
    ).toBeVisible();
    await page.setViewportSize(PHONE);
    await shoot(page, testInfo, "presets-390");
  } finally {
    await runQuery(`delete from award where name = any($1::text[])`, [
      [fromPreset, brandNew],
    ]);
  }
});

// Epic R22, AC 11: /history/awards groups by name, case-insensitively.
test("r22 awards: /history/awards groups by name, Billable Hours Champ shows VIII, V and IV, and an unknown slug is a 404", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  // A War Week XI Award spelled differently joins the same page.
  const respelled = "billable HOURS champ";
  const teamId = await xiTeamId("Red");
  await runQuery(
    `insert into award (war_week_id, name, team_id)
     select id, $1, $2 from war_week where edition = 'xi'`,
    [respelled, teamId],
  );
  try {
    for (const [viewport, label] of [
      [DESKTOP, "1440"],
      [PHONE, "390"],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto("/history/awards");
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Awards through the years",
        }),
      ).toBeVisible();
      // One entry per name: the two spellings share one.
      const names = page.getByRole("list", { name: "Award names" });
      await expect(
        names.getByRole("link", { name: /^billable hours champ$/i }),
      ).toHaveCount(1);
      await shoot(page, testInfo, `names-${label}`);

      await names
        .getByRole("link", { name: /^billable hours champ$/i })
        .click();
      await expect(page).toHaveURL(/\/history\/awards\/billable-hours-champ$/);
      await expect(
        page.getByRole("heading", {
          level: 1,
          name: /^billable hours champ$/i,
        }),
      ).toBeVisible();
      // XI (this run's respelled Award) first, then VIII, V and IV.
      const editions = await page
        .getByRole("heading", { level: 2 })
        .allTextContents();
      const at = (prefix: string) =>
        editions.findIndex((t) => t.startsWith(prefix));
      expect(at("War Week XI ")).toBe(0);
      expect(at("War Week VIII ")).toBe(1);
      expect(at("War Week V ")).toBe(2);
      expect(at("War Week IV ")).toBe(3);
      // Recipients: VIII's Team, V's and IV's Participants.
      await expect(page.getByText("Ravenclaw")).toBeVisible();
      await expect(page.getByText("Akshay Palekar")).toBeVisible();
      await expect(page.getByText("Kelly Byrnes")).toBeVisible();
      await shoot(page, testInfo, `billable-hours-champ-${label}`);
    }

    // An unknown slug is a 404.
    const missing = await page.goto("/history/awards/no-such-award-name");
    expect(missing?.status()).toBe(404);
  } finally {
    await runQuery(`delete from award where name = $1`, [respelled]);
  }
});
