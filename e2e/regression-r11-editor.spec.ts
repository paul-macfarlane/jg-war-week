import { type Page, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { E2E_BASE_URL } from "./env";
import { asOrganizer } from "./session";

// Epic R11, ticket 64: the Announcement editor matches journeys
// (.scratch/regression-2026-09/issues/64-editor-matches-journeys.md).
// Images by URL only (the ticket's 2026-10-02 scope change): the image is a
// file the app itself serves, so the flow needs no outside network.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const IMAGE_URL = `${E2E_BASE_URL}/about/announcements.png`;
const SECOND_IMAGE_URL = `${E2E_BASE_URL}/about/competitions.png`;
const VIDEO_URL = "https://youtu.be/dQw4w9WgXcQ";

async function shoot(page: Page, path: string) {
  await page.screenshot({ path, animations: "disabled", fullPage: true });
}

/** Opens the editor's image dialog and inserts an image by URL. */
async function insertImage(
  page: Page,
  { url, alt, caption }: { url: string; alt: string; caption: string },
) {
  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Image", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Add image" });
  await dialog.getByLabel("Image URL").fill(url);
  await dialog.getByLabel("Alt text").fill(alt);
  await dialog.getByLabel("Caption (optional)").fill(caption);
  await dialog.getByRole("button", { name: "Insert image" }).click();
  await expect(dialog).toBeHidden();
}

test("r11 64 an Organizer posts a heading, a quote, a captioned image and a video; the participant page shows all four", async ({
  context,
  page,
}, testInfo) => {
  const title = `R11 64 editor ${Date.now()}`;
  const caption = "Photo: the Announcements page";
  const editedCaption = "Edited: the Announcements page";
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/announcements/new");

    // The empty editor shows its placeholder, named to assistive technology.
    const surface = page.locator(".ProseMirror");
    await expect(surface).toHaveAttribute(
      "aria-placeholder",
      "Write the Announcement…",
    );
    await expect(surface.locator("p.is-empty")).toHaveAttribute(
      "data-placeholder",
      "Write the Announcement…",
    );

    await page.getByLabel("Title").fill(title);
    const toolbar = page.getByRole("toolbar", { name: "Formatting" });

    // A toolbar tooltip names the button and its shortcut.
    await toolbar.getByRole("button", { name: "Bold" }).hover();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
      /Bold\s*(⌘B|Ctrl\+B)/,
    );
    await page.mouse.move(0, 0);

    // Heading, then a quote, then a line after it, all from the toolbar.
    await surface.click();
    await toolbar.getByRole("button", { name: "Heading 2" }).click();
    await page.keyboard.type("Closing Ceremonies");
    await page.keyboard.press("Enter");
    await toolbar.getByRole("button", { name: "Quote" }).click();
    await page.keyboard.type("There is no spoon.");
    await page.keyboard.press("Enter");
    await toolbar.getByRole("button", { name: "Quote" }).click();
    await page.keyboard.type("Doors open at nine.");

    await insertImage(page, {
      url: IMAGE_URL,
      alt: "The Announcements page",
      caption,
    });

    await toolbar.getByRole("button", { name: "Video", exact: true }).click();
    const videoDialog = page.getByRole("dialog", { name: "Add video" });
    await videoDialog.getByLabel("Video URL").fill(VIDEO_URL);
    await videoDialog.getByRole("button", { name: "Insert video" }).click();
    await expect(videoDialog).toBeHidden();

    await insertImage(page, {
      url: SECOND_IMAGE_URL,
      alt: "The Competitions page",
      caption: "To be removed",
    });

    // Selecting an image shows its tools; Edit changes the caption.
    const imageTools = page.getByRole("toolbar", { name: "Image tools" });
    await surface.getByRole("img", { name: "The Announcements page" }).click();
    await expect(imageTools).toBeVisible();
    await shoot(page, testInfo.outputPath("image-tools.png"));
    await imageTools.getByRole("button", { name: "Edit image" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit image" });
    await expect(editDialog.getByLabel("Caption (optional)")).toHaveValue(
      caption,
    );
    await editDialog.getByLabel("Caption (optional)").fill(editedCaption);
    await editDialog.getByRole("button", { name: "Save image" }).click();
    await expect(editDialog).toBeHidden();
    await expect(surface.locator("figcaption").first()).toHaveText(
      editedCaption,
    );

    // Remove takes the second image out.
    await surface.getByRole("img", { name: "The Competitions page" }).click();
    await imageTools.getByRole("button", { name: "Remove" }).click();
    await expect(
      surface.getByRole("img", { name: "The Competitions page" }),
    ).toHaveCount(0);
    await expect(surface.locator("img")).toHaveCount(1);

    await page.getByRole("button", { name: "Post Announcement" }).click();
    await expect(page).toHaveURL(/\/admin\/announcements$/);

    const [stored] = await runQuery<{ body: unknown }>(
      `select body from announcement where title = $1`,
      [title],
    );
    console.log(`r11 64 stored body: ${JSON.stringify(stored.body)}`);

    // The participant page renders all four.
    for (const [viewport, name] of [
      [DESKTOP, "1440.png"],
      [PHONE, "390.png"],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto("/xi/announcements");
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: title }) });
      await expect(card).toBeVisible();
      // The card title is an h2, so the body's first heading renders as h3.
      await expect(
        card.getByRole("heading", { level: 3, name: "Closing Ceremonies" }),
      ).toBeVisible();
      await expect(card.locator("blockquote")).toHaveText("There is no spoon.");
      const figure = card.locator("figure");
      await expect(figure).toHaveCount(1);
      await expect(figure.locator("img")).toHaveAttribute("src", IMAGE_URL);
      await expect(figure.locator("img")).toHaveAttribute(
        "alt",
        "The Announcements page",
      );
      await expect(figure.locator("figcaption")).toHaveText(editedCaption);
      await expect(card.locator('iframe[src*="youtube"]')).toHaveCount(1);
      await card.scrollIntoViewIfNeeded();
      await shoot(page, testInfo.outputPath(name));
    }
  } finally {
    await runQuery(`delete from announcement where title = $1`, [title]);
  }
});
