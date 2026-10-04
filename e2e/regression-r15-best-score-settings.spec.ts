import { expect, test } from "@playwright/test";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { deleteXiCompetition } from "./db";
import { asOrganizer } from "./session";

// Epic R15, ticket 89 (.scratch/regression-2026-10/issues/89-*.md): a
// Best score Competition's settings show what was saved after
// leaving and coming back. Since ticket 101 both live on the Competition's
// one page and autosave. A new Best score Competition is created, so the
// seeded Competitions stay as they were, and deleted at the end.
test("r15 89 Best score settings and Placement Points show what was saved after leaving and returning", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const name = `R15 Best Score Settings ${Date.now()}`;
  await asOrganizer(context);
  await page.setViewportSize({ width: 1440, height: 900 });

  try {
    // Add a Best score Competition; it opens its page.
    const id = await addCompetition(page, { name, format: "Best score" });

    // The unit, a setting of the Format.
    await page.getByLabel("Unit").fill("trips");
    await expectSaved(page);
    await expect(page.getByLabel("Unit")).toHaveValue("trips");

    // Placement Points, on the same page.
    const settings = page.getByRole("form", { name: "Competition settings" });
    await settings.getByRole("button", { name: "Add place" }).click();
    await settings.getByRole("button", { name: "Add place" }).click();
    await settings.getByLabel("1st place Placement Points").fill("9");
    await settings.getByLabel("2nd place Placement Points").fill("4");
    await expectSaved(page);

    // Leave and come back: both show what was saved.
    await page.goto("/admin/competitions");
    await openCompetitionPage(page, id);
    await expect(page.getByLabel("Unit")).toHaveValue("trips");
    await expect(page.getByLabel("1st place Placement Points")).toHaveValue(
      "9",
    );
    await expect(page.getByLabel("2nd place Placement Points")).toHaveValue(
      "4",
    );
  } finally {
    await deleteXiCompetition(name);
  }
});
