import { type Page, expect, test } from "@playwright/test";
import path from "node:path";

import { runQuery, xiParticipantId } from "./db";
import { participantPageAs } from "./session";

// Epic R10, ticket 60 (wave 2): the Profile page and the account menu's
// own name and picture. The surfaces (roster, Standings…) are wave 3's.

// XII has no roster in the local seeds; XI's live demo does.
const PARTICIPANT = "Anthony Conway";
const PROFILE_NAME = "Tony Profile";
const PICTURE_URL = "https://images.example.test/me.png";
// A 1×1 PNG, served for the picture URL so no request leaves the machine.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const accountButton = (page: Page) =>
  page.getByRole("button", { name: "Account menu" });

for (const viewport of VIEWPORTS) {
  test(`60 a Participant sets a Profile name and picture URL; the menu and both previews show them, at ${viewport.width}`, async ({
    browser,
  }) => {
    // The same email `participantPageAs` links the Participant with.
    const email = `e2e-p-${await xiParticipantId(PARTICIPANT)}@jahnelgroup.com`;
    const { page, close } = await participantPageAs(browser, PARTICIPANT);
    const shot = (name: string) =>
      page.screenshot({
        path: path.resolve(
          "test-results/r10-accounts",
          `profile-core-${viewport.width}`,
          `${name}.png`,
        ),
        animations: "disabled",
      });
    try {
      await page.route("https://images.example.test/**", (route) =>
        route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
      );
      await page.setViewportSize(viewport);
      await page.goto("/xi");

      await accountButton(page).click();
      await page.getByRole("menuitem", { name: "Profile" }).click();
      await expect(page).toHaveURL(/\/xi\/profile$/);
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByText(`Shown as ${PARTICIPANT} until you set one.`),
      ).toBeVisible();

      await page.getByLabel("Profile name").fill(PROFILE_NAME);
      await page.getByLabel("Picture URL").fill(PICTURE_URL);
      for (const scheme of ["Light", "Dark"]) {
        const preview = page.getByRole("figure", {
          name: `${scheme} preview`,
        });
        await expect(preview.locator("img")).toHaveAttribute(
          "src",
          PICTURE_URL,
        );
        await expect(preview).toContainText(PROFILE_NAME);
      }
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Profile saved")).toBeVisible();
      await shot("profile");

      await accountButton(page).click();
      const menu = page.getByRole("menu");
      await expect(menu).toContainText(PROFILE_NAME);
      await expect(accountButton(page).locator("img")).toHaveAttribute(
        "src",
        PICTURE_URL,
      );
      await shot("account-menu");
      await page.keyboard.press("Escape");

      // A bad URL is refused at its field, and nothing changes.
      await page.getByLabel("Picture URL").fill("http://images.example.test/x");
      await page.getByRole("button", { name: "Save" }).click();
      await expect(
        page.getByText("Picture URL must be an https:// link to an image."),
      ).toBeVisible();

      // Use Google photo clears the field; this stub user has no Google
      // photo, so the previews show initials.
      await page.getByRole("button", { name: "Use Google photo" }).click();
      await expect(page.getByLabel("Picture URL")).toHaveValue("");
      await expect(
        page.getByRole("figure", { name: "Light preview" }).locator("img"),
      ).toHaveCount(0);
    } finally {
      await close();
      await runQuery(`delete from profile where email = $1`, [email]);
    }
  });
}
