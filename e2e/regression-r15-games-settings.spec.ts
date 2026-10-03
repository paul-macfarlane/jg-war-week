import { expect, test } from "@playwright/test";

import { asOrganizer } from "./session";

// Epic R15, ticket 89 (.scratch/regression-2026-10/issues/89-games-settings-show-what-was-saved.md):
// a Games Competition's settings show what was saved after
// leaving and coming back. A new ranked Games Competition is created, so
// the seeded Competitions stay as they were.
test("r15 89 Games settings and Placement Points show what was saved after leaving and returning", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const name = `R15 Games Settings ${Date.now()}`;
  await asOrganizer(context);
  await page.setViewportSize({ width: 1440, height: 900 });

  // Add a ranked Games Competition; it opens its Games setup page.
  await page.goto("/admin/competitions");
  await page.getByRole("button", { name: "Add Competition" }).click();
  const addForm = page
    .getByRole("dialog", { name: "Add Competition" })
    .getByRole("form", { name: "New Competition" });
  await addForm.getByRole("textbox", { name: "Name" }).fill(name);
  await addForm.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Games" }).click();
  await addForm.getByRole("combobox", { name: "Game Type" }).click();
  await page.getByRole("option", { name: "Ranked" }).click();
  await addForm.getByRole("button", { name: "Add Competition" }).click();
  await expect(page.getByText("Competition saved")).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/competitions\/[0-9a-f-]+\/games$/);
  const gamesUrl = page.url();

  // Finish Points, with a trailing comma that must not become a 0.
  await page.getByLabel("Finish Points").fill("5, 3, 1,");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Games settings saved")).toBeVisible();
  await expect(page.getByLabel("Finish Points")).toHaveValue("5, 3, 1");

  // Placement Points, in the Competition's Edit sheet.
  await page.goto("/admin/competitions");
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const sheet = page.getByRole("dialog", { name: `Edit ${name}` });
  await sheet.getByRole("button", { name: "Add place" }).click();
  await sheet.getByRole("button", { name: "Add place" }).click();
  await sheet.getByLabel("1st place Placement Points").fill("9");
  await sheet.getByLabel("2nd place Placement Points").fill("4");
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText("Competition saved")).toBeVisible();
  await expect(sheet).toBeHidden();

  // Leave and come back: both show what was saved.
  await page.goto(gamesUrl);
  await expect(page.getByLabel("Finish Points")).toHaveValue("5, 3, 1");
  await page.goto("/admin/competitions");
  await page.getByRole("button", { name: `Edit ${name}`, exact: true }).click();
  const reopened = page.getByRole("dialog", { name: `Edit ${name}` });
  await expect(reopened.getByLabel("1st place Placement Points")).toHaveValue(
    "9",
  );
  await expect(reopened.getByLabel("2nd place Placement Points")).toHaveValue(
    "4",
  );
});
