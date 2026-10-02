import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";

import { resetXiFinaleSlides } from "./db";
import { E2E_BASE_URL } from "./env";
import { openFinale } from "./finale-slides";
import { asOrganizer } from "./session";

/**
 * Ticket 74 (74-AC1, 74-AC2): an Organizer adds a Custom Finale slide (a
 * heading, an image with a caption, a background color), the Finale shows
 * it between Awards and Standings with text that reads on its background,
 * and the Organizer edits and deletes it.
 */

test.beforeAll(resetXiFinaleSlides);
test.afterAll(resetXiFinaleSlides);

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
// A file the app itself serves, so the flow needs no outside network.
const IMAGE_URL = `${E2E_BASE_URL}/about/announcements.png`;
const HEADING = "R13 Custom slide";
const BACKGROUND = "#1e3a5f";

// The one live stage (the hydrated one).
const finaleStage = (page: Page) => page.locator("[data-finale-hydrated]");

const slideList = (page: Page) =>
  page.getByRole("list", { name: "Finale slides" });

/** The admin list's slide names, in order. */
async function listed(page: Page): Promise<string[]> {
  const rows = await slideList(page).getByRole("listitem").all();
  return Promise.all(
    rows.map(async (row) =>
      (await row.locator("span.font-medium").first().innerText())
        .replace(/\s*Hidden$/, "")
        .trim(),
    ),
  );
}

/** Presses → through the Finale, noting each slide kind's place. */
async function slideIndexes(page: Page): Promise<Record<string, number>> {
  const stage = finaleStage(page);
  const indexes: Record<string, number> = {};
  for (let i = 0; i < 12; i++) {
    const kind = (await stage.getAttribute("data-finale-slide")) ?? "";
    indexes[kind] = Number(await stage.getAttribute("data-finale-slide-index"));
    if (kind === "winner") break;
    // The Standings countdown takes a first Next to finish, a second to leave.
    const here = String(indexes[kind]);
    for (let press = 0; press < 3; press++) {
      await page.keyboard.press("ArrowRight");
      if (
        (await stage.getAttribute("data-finale-slide-index", {
          timeout: 1000,
        })) !== here
      ) {
        break;
      }
    }
    await expect(stage).not.toHaveAttribute("data-finale-slide-index", here);
  }
  return indexes;
}

async function fillForm(
  page: Page,
  { heading, text }: { heading: string; text: string },
) {
  const dialog = page.getByRole("dialog", { name: "Add custom slide" });
  await dialog
    .getByRole("textbox", { name: "Heading", exact: true })
    .fill(heading);
  await dialog.locator(".ProseMirror").click();
  await page.keyboard.type(text);
  return dialog;
}

test("74-AC1 74-AC2: an Organizer adds a Custom slide with an image between Awards and Standings, the Finale shows it with readable text, and the Organizer edits and deletes it", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/finale");

  // Add: heading, text, a captioned image, a background color.
  await page.getByRole("button", { name: "Add custom slide" }).click();
  const dialog = await fillForm(page, {
    heading: HEADING,
    text: "Thanks for playing",
  });
  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Image", exact: true })
    .click();
  const imageDialog = page.getByRole("dialog", { name: "Add image" });
  await imageDialog.getByLabel("Image URL").fill(IMAGE_URL);
  await imageDialog.getByLabel("Alt text").fill("The Announcements page");
  await imageDialog.getByLabel("Caption (optional)").fill("Photo: the page");
  await imageDialog.getByRole("button", { name: "Insert image" }).click();
  await expect(imageDialog).toBeHidden();

  await dialog
    .getByRole("button", { name: "Choose a background color" })
    .click();
  await dialog.getByRole("button", { name: "Background color" }).click();
  await page.getByLabel("Hex color").fill(BACKGROUND);
  await page.getByLabel("Hex color").press("Enter");
  await page.keyboard.press("Escape");
  await expect(
    dialog.getByRole("button", { name: "Background color" }),
  ).toContainText(BACKGROUND);

  await dialog.getByRole("button", { name: "Add custom slide" }).click();
  await expect(dialog).toBeHidden();
  await expect
    .poll(() => listed(page))
    .toEqual([
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      HEADING,
      "Standings countdown",
      "Winner",
    ]);

  // The same heading again is refused, in the form.
  await page.getByRole("button", { name: "Add custom slide" }).click();
  const again = await fillForm(page, { heading: HEADING, text: "Twice" });
  await again.getByRole("button", { name: "Add custom slide" }).click();
  await expect(
    again
      .getByText(`There's already a Custom slide called ${HEADING}.`)
      .first(),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(again).toBeHidden();

  // The Finale shows it after Awards and before Standings.
  await openFinale(page);
  const indexes = await slideIndexes(page);
  expect(indexes.awards).toBeLessThan(indexes.custom);
  expect(indexes.custom).toBeLessThan(indexes.standings);

  const stage = finaleStage(page);
  await page.keyboard.press("Escape");
  await expect(stage).toHaveAttribute("data-finale-slide-index", "0");
  for (let i = 0; i < indexes.custom; i++)
    await page.keyboard.press("ArrowRight");
  await expect(stage).toHaveAttribute("data-finale-slide", "custom");
  await expect(
    page.getByRole("heading", { name: HEADING, level: 1 }),
  ).toBeVisible();
  const image = page.getByRole("img", { name: "The Announcements page" });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  await expect(page.getByText("Photo: the page")).toBeVisible();
  await expect(stage).toHaveCSS("background-color", "rgb(30, 58, 95)");

  // A click on the image never advances the slideshow; one on the stage does.
  await image.click();
  await expect(stage).toHaveAttribute(
    "data-finale-slide-index",
    String(indexes.custom),
  );

  // Every text on the slide reads on its background.
  const contrast = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  expect(contrast.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("custom-slide-1440x900.png"),
  });
  await page.setViewportSize(PHONE);
  await expect(page.getByRole("heading", { name: HEADING })).toBeVisible();
  const phoneContrast = await new AxeBuilder({ page })
    .withRules(["color-contrast"])
    .analyze();
  expect(phoneContrast.violations).toEqual([]);
  await page.screenshot({
    path: testInfo.outputPath("custom-slide-390x844.png"),
  });

  // Edit: rename it; the list and the Finale follow.
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/finale");
  await page.getByRole("button", { name: `Edit ${HEADING}` }).click();
  const edit = page.getByRole("dialog", { name: `Edit ${HEADING}` });
  await edit
    .getByRole("textbox", { name: "Heading", exact: true })
    .fill(`${HEADING} edited`);
  await edit.getByRole("button", { name: "Save" }).click();
  await expect(edit).toBeHidden();
  await expect.poll(() => listed(page)).toContain(`${HEADING} edited`);

  // Delete: confirmed, gone from the list and the Finale.
  await page.getByRole("button", { name: `Delete ${HEADING} edited` }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
  await expect
    .poll(() => listed(page))
    .toEqual([
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      "Standings countdown",
      "Winner",
    ]);
  await openFinale(page);
  expect(Object.keys(await slideIndexes(page))).not.toContain("custom");
});
