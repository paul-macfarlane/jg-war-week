import { expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

test("r12 70 an Organizer adds a Category, gives an Award in it, and the Awards page groups it", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  // Unique per run: Categories are global and unique ignoring case.
  const suffix = Date.now().toString(36);
  const category = `E2E Category ${suffix}`;
  const renamed = `E2E Renamed ${suffix}`;
  const awardName = `E2E Award ${suffix}`;
  try {
    await asOrganizer(context);

    // The seven seeded Categories are there.
    const seeded = await runQuery<{ key: string }>(
      "select key from award_category where key is not null order by key",
    );
    expect(seeded.map((r) => r.key)).toEqual([
      "billable-hours-champ",
      "black-midnight",
      "grind",
      "grow",
      "inspire",
      "serve",
      "war-week-mvp",
    ]);

    await page.goto("/admin/awards");
    await page.getByRole("button", { name: "Add Category" }).click();
    // The Sheet's own fields: the Awards list's rows have Names too.
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(category);
    await dialog.getByRole("button", { name: "Add Category" }).click();
    await expect(page.getByText("Category added")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Award Categories" }),
    ).toContainText(category);

    // A rename to an existing name is refused, ignoring case.
    await page.getByRole("button", { name: `Rename ${category}` }).click();
    await dialog.getByLabel("Name").fill("war week mvp");
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(
      page.getByText("There's already a Category named war week mvp.").first(),
    ).toBeVisible();
    await dialog.getByLabel("Name").fill(renamed);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Category renamed")).toBeVisible();

    // Archive, then restore.
    await page.getByRole("button", { name: `Archive ${renamed}` }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Archive" })
      .click();
    await expect(page.getByText("Category archived")).toBeVisible();
    const archived = page.getByRole("list", {
      name: "Archived Award Categories",
    });
    await expect(archived).toContainText(renamed);
    await page.getByRole("button", { name: `Restore ${renamed}` }).click();
    await expect(page.getByText("Category restored")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Award Categories" }),
    ).toContainText(renamed);

    // Give an Award in it.
    await page.getByRole("button", { name: "Add Award" }).click();
    await dialog.getByLabel("Name").fill(awardName);
    await page.locator("#award-team").click();
    await page.getByRole("option", { name: "Red" }).click();
    await page.locator("#award-category").click();
    await page.getByRole("option", { name: renamed }).click();
    await dialog.getByRole("button", { name: "Add Award" }).click();
    await expect(page.getByText("Award saved")).toBeVisible();

    // The Awards page groups it under its Category, linked to its history.
    await page.goto("/xi/awards");
    const heading = page.getByRole("heading", { level: 2, name: renamed });
    await expect(heading).toBeVisible();
    await expect(heading.getByRole("link")).toHaveAttribute(
      "href",
      /\/history\/awards\/[0-9a-f-]{36}$/,
    );
    await expect(
      page.getByRole("heading", { level: 3, name: awardName }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { level: 2, name: "Other Awards" }),
    ).toBeVisible();
  } finally {
    await runQuery(`delete from award where name = $1`, [awardName]);
    await runQuery(`delete from award_category where name in ($1, $2)`, [
      category,
      renamed,
    ]);
  }
});
