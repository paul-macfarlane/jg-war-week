import { type Page, expect, test } from "@playwright/test";

import { addCompetition, expectSaved } from "./competition-page";
import { deleteXiCompetition } from "./db";
import { E2E_BASE_URL } from "./env";
import { asOrganizer } from "./session";

// Epic R18, ticket 103 (.scratch/regression-2026-10/issues/103-rich-text-competition-description.md):
// a Competition's description is rich text in the Announcement editor, and
// the Participant Competition page shows it in full. The Competition is the
// test's own `E2E R18 …` one in demo XI, deleted in `finally`.

const LINK_URL = "https://example.com/darts-rules";
/** An image by URL (no upload), one the app itself serves. */
const IMAGE_URL = `${E2E_BASE_URL}/about/competitions.png`;

/** Presses `key` `times` times. */
async function pressTimes(page: Page, key: string, times: number) {
  for (let i = 0; i < times; i++) await page.keyboard.press(key);
}

test("r18 103 an Organizer writes a heading, a list, a link and an image by URL in a Competition's description; the Participant page renders them", async ({
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
    // Select just those words: Home is the document's start on macOS.
    await pressTimes(page, "Shift+ArrowLeft", "Full rules".length);
    await toolbar.getByRole("button", { name: "Link" }).click();
    const dialog = page.getByRole("dialog", { name: "Add link" });
    await dialog.getByLabel("Link URL").fill(LINK_URL);
    await dialog.getByRole("button", { name: "Apply link" }).click();
    await expect(dialog).toBeHidden();

    // An image by URL, on a line of its own after the link: the caret goes
    // to the end of the last line (arrows, not End, which differs by OS).
    await editor.getByText("Full rules").click();
    // More presses than the line has characters (a link's edge takes one
    // too); at the end of the document the rest do nothing.
    await pressTimes(page, "ArrowRight", 20);
    await page.keyboard.press("Enter");
    await toolbar.getByRole("button", { name: "Image", exact: true }).click();
    const imageDialog = page.getByRole("dialog", { name: "Add image" });
    await imageDialog.getByLabel("Image URL").fill(IMAGE_URL);
    await imageDialog.getByLabel("Alt text").fill("The darts board");
    await imageDialog.getByRole("button", { name: "Insert image" }).click();
    await expect(imageDialog).toBeHidden();
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
      page.getByRole("link", { name: "Full rules", exact: true }),
    ).toHaveAttribute("href", LINK_URL);
    await expect(
      page.getByRole("img", { name: "The darts board" }),
    ).toHaveAttribute("src", IMAGE_URL);
  } finally {
    await deleteXiCompetition(name);
  }
});
