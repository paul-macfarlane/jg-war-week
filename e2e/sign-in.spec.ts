import { expect, test } from "@playwright/test";

import { E2E_OUTSIDER_EMAIL, E2E_PARTICIPANT_EMAIL, signIn } from "./session";

test("an anonymous visit to /xi lands on /sign-in", async ({
  page,
}, testInfo) => {
  await page.goto("/xi");

  await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fxi$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to JG War Week" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("anonymous-sign-in.png"),
    fullPage: true,
  });
});

test("a session with a non-JG email is refused /xi", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_OUTSIDER_EMAIL);

  await page.goto("/xi");

  await expect(page).toHaveURL(/\/sign-in\?callbackURL=%2Fxi$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to JG War Week" }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("outsider-refused.png"),
    fullPage: true,
  });
});

test("a JG session opens /xi", async ({ context, page }) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);

  await page.goto("/xi");

  await expect(page).toHaveURL(/\/xi$/);
  await expect(
    page.getByRole("heading", { level: 1, name: /^War Week XI/ }),
  ).toBeVisible();
});
