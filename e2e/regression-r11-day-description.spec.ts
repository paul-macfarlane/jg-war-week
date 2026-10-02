import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

// XI's "Red vs. Blue" Day; Home's Today header shows it at this instant.
const DAY = "2026-02-24";
const DAY_THEME = "Red vs. Blue";
const HOME_AT = "2026-02-24T12:00:00-05:00";
const DESCRIPTION = "R11 66: wear your Team color, lunch at noon.";

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test("r11 66 a Day saved with a description shows on the Schedule and in Home's Today header", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const reset = () =>
    runQuery(
      `update day set description = null from war_week w
       where w.id = day.war_week_id and w.edition = 'xi' and day.date = $1`,
      [DAY],
    );
  await reset();
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);
    await page.goto("/admin/schedule");
    await page.getByRole("button", { name: `Edit Day ${DAY}` }).click();
    const form = page.getByRole("form", { name: `Day ${DAY}` });
    const field = form.getByLabel("Description (optional)");
    await expect(field).toHaveAttribute("maxlength", "280");
    await expect(form.getByText("0/280")).toBeVisible();
    await field.fill(DESCRIPTION);
    await expect(form.getByText(`${DESCRIPTION.length}/280`)).toBeVisible();
    await form.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Day saved")).toBeVisible();

    const [saved] = await runQuery<{ description: string | null }>(
      `select d.description from day d join war_week w on w.id = d.war_week_id
       where w.edition = 'xi' and d.date = $1`,
      [DAY],
    );
    expect(saved.description).toBe(DESCRIPTION);

    for (const [viewport, name] of [
      [DESKTOP, "1440"],
      [PHONE, "390"],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto("/xi/schedule");
      const section = page.locator(`section:has(h2:has-text("Feb 24"))`);
      await expect(section.getByText(DAY_THEME)).toBeVisible();
      await expect(section.getByText(DESCRIPTION)).toBeVisible();
      // Days without one show no extra line.
      await expect(page.getByText(DESCRIPTION)).toHaveCount(1);
      await shoot(page, testInfo, name);

      await page.goto(`/xi?at=${encodeURIComponent(HOME_AT)}`);
      await expect(page.getByText(DAY_THEME).first()).toBeVisible();
      await expect(page.getByText(DESCRIPTION)).toBeVisible();
      await shoot(page, testInfo, `home-${name}`);
    }
  } finally {
    await reset();
  }
});
