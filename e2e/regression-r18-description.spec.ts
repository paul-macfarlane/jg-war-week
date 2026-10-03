import { expect, test } from "@playwright/test";

import { addCompetition, expectSaved } from "./competition-page";
import { deleteXiCompetition } from "./db";
import { asOrganizer } from "./session";

// Epic R18, ticket 103 (.scratch/regression-2026-10/issues/103-rich-text-competition-description.md):
// a Competition's description is rich text in the Announcement editor, and
// the Participant Competition page shows it in full. The Competition is the
// test's own `E2E R18 …` one in demo XI, deleted in `finally`.

const LINK_URL = "https://example.com/darts-rules";

test("r18 103 an Organizer writes a heading, a list and a link in a Competition's description; the Participant page renders them", async ({
  context,
  page,
}) => {
  test.setTimeout(120_000);
  const name = `E2E R18 Description ${Date.now()}`;
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await addCompetition(page, { name });

    const settings = page.getByRole("form", { name: "Competition settings" });
    const editor = settings.locator(".ProseMirror");
    const toolbar = settings.getByRole("toolbar", { name: "Formatting" });
    await editor.click();

    // A heading, then a bullet list of two items, then a link.
    await toolbar.getByRole("button", { name: "Heading 2" }).click();
    await page.keyboard.type("Rules of the pub");
    await page.keyboard.press("Enter");
    await toolbar.getByRole("button", { name: "Bullet list" }).click();
    await page.keyboard.type("Three darts each");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Closest to the bull wins");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    await page.keyboard.type("Full rules");
    await page.keyboard.press("Shift+Home");
    await toolbar.getByRole("button", { name: "Link" }).click();
    const dialog = page.getByRole("dialog", { name: "Add link" });
    await dialog.getByLabel("Link URL").fill(LINK_URL);
    await dialog.getByRole("button", { name: "Apply link" }).click();
    await expect(dialog).toBeHidden();
    await expectSaved(page);

    // The Participant page shows the heading, a list item and the link.
    await page.goto(`/xi/competitions/${id}`);
    await expect(
      page.getByRole("heading", { name: "Rules of the pub" }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("listitem")
        .filter({ hasText: "Closest to the bull wins" }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Full rules" }),
    ).toHaveAttribute("href", LINK_URL);
  } finally {
    await deleteXiCompetition(name);
  }
});
