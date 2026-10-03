import { type Page, expect, test } from "@playwright/test";
import path from "node:path";

import { deleteE2eUsers, withParticipantEmail } from "./db";
import { E2E_TEST_SIGN_IN_SECRET } from "./env";

// Epic R10, ticket 62: Test sign-in as a + alias linked to a roster email.

const LINKED_EMAIL = "e2e+linked@jahnelgroup.com";
// XII has no roster in the local seeds; XI's live demo does.
const PARTICIPANT = "Anthony Conway";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

const banner = (page: Page) =>
  page.getByRole("status").filter({ hasText: `Test sign-in: ${LINKED_EMAIL}` });

async function testSignIn(page: Page, email: string, secret: string) {
  await page.goto("/sign-in/test?callbackURL=%2Fxi%2Fteams");
  await expect(
    page.getByRole("heading", { name: "Test sign-in" }),
  ).toBeVisible();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Secret").fill(secret);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test.afterAll(async () => {
  await deleteE2eUsers();
});

test.describe("62 Test sign-in", () => {
  for (const viewport of VIEWPORTS) {
    test(`signs in as a linked + alias: You on the roster, the banner on every page, at ${viewport.width}`, async ({
      page,
    }) => {
      const shot = (name: string) =>
        page.screenshot({
          path: path.resolve(
            "test-results/r10-accounts",
            `test-sign-in-${viewport.width}`,
            `${name}.png`,
          ),
          animations: "disabled",
        });
      await page.setViewportSize(viewport);

      await withParticipantEmail("xi", PARTICIPANT, LINKED_EMAIL, async () => {
        await testSignIn(page, LINKED_EMAIL, E2E_TEST_SIGN_IN_SECRET);

        await expect(page).toHaveURL(/\/xi\/teams$/);
        const row = page.getByRole("listitem").filter({ hasText: PARTICIPANT });
        await expect(row.locator("[data-you]")).toHaveText("You");
        await expect(page.locator("[data-you]")).toHaveCount(1);
        await expect(banner(page)).toBeVisible();
        // The proof shows the You row; the banner shots follow.
        await row.locator("[data-you]").scrollIntoViewIfNeeded();
        await shot("xi-teams");

        for (const [pathname, name] of [
          ["/xii", "xii"],
          ["/history", "history"],
        ] as const) {
          await page.goto(pathname);
          await expect(page).toHaveURL(new RegExp(`${pathname}$`));
          await expect(banner(page)).toBeVisible();
          await shot(name);
        }
      });
    });
  }

  test("refuses a wrong secret and stays signed out", async ({ page }) => {
    await testSignIn(page, LINKED_EMAIL, "not-the-secret");

    await expect(page.getByText("That secret doesn't match.")).toBeVisible();
    await page.goto("/xi");
    await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fxi$/);
  });
});
