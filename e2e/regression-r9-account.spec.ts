import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { asOrganizer, participantPageAs } from "./session";

// Epic R9, ticket 55: the avatar account menu.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const accountButton = (page: Page) =>
  page.getByRole("button", { name: "Account menu" });

/** The header's right edge holds the avatar button and nothing else but, in admin on desktop, the way back. */
async function expectOnlyAvatarOnTheRight(page: Page, admin: boolean) {
  const header = page.locator("header").first();
  await expect(header.getByRole("button")).toHaveCount(1);
  await expect(header.getByRole("button")).toHaveAccessibleName("Account menu");
  // The old header text and buttons are gone at every width.
  await expect(header.getByText("@jahnelgroup.com")).toHaveCount(0);
  await expect(header.getByRole("button", { name: "Sign out" })).toHaveCount(0);
  await expect(header.getByRole("group", { name: "Display" })).toHaveCount(0);
  if (!admin) {
    await expect(header.getByRole("link", { name: "Admin" })).toHaveCount(0);
  }
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

test.describe("55 account menu", () => {
  for (const [label, viewport] of [
    ["390", PHONE],
    ["1440", DESKTOP],
  ] as const) {
    test(`Organizer: participant and admin headers show only the avatar, menu has every item at ${label}`, async ({
      context,
      page,
    }, testInfo) => {
      await asOrganizer(context);
      await page.setViewportSize(viewport);

      await page.goto("/xii");
      await expectOnlyAvatarOnTheRight(page, false);
      await accountButton(page).click();
      const menu = page.getByRole("menu");
      await expect(menu).toContainText("e2e-organizer@jahnelgroup.com");
      await expect(menu.getByText("Display", { exact: true })).toBeVisible();
      for (const display of ["Light", "Dark", "System"]) {
        await expect(
          menu.getByRole("menuitemradio", { name: display }),
        ).toBeVisible();
      }
      await expect(
        menu.getByRole("menuitem", { name: "Admin" }),
      ).toHaveAttribute("href", "/admin/points");
      await expect(
        menu.getByRole("menuitem", { name: "Join the Slack channel" }),
      ).toHaveAttribute("target", "_blank");
      await expect(
        menu.getByRole("menuitem", { name: "Sign out" }),
      ).toBeVisible();
      await expect(menu.getByRole("menuitem", { name: "Profile" })).toHaveCount(
        0,
      );
      await shoot(page, testInfo, `55-participant-menu-${label}`);
      await page.keyboard.press("Escape");

      await page.goto("/admin");
      await expect(
        page.locator("header").first().getByRole("button"),
      ).toHaveCount(1);
      await accountButton(page).click();
      await expect(
        page.getByRole("menuitem", { name: "Back to War Week" }),
      ).toHaveAttribute("href", /^\/[a-z]+$/);
      await expect(page.getByRole("menuitem", { name: "Admin" })).toHaveCount(
        0,
      );
      await shoot(page, testInfo, `55-admin-menu-${label}`);
      await page.keyboard.press("Escape");
      if (viewport === DESKTOP) {
        await expect(
          page
            .locator("header")
            .first()
            .getByRole("link", { name: /^Back to War Week/ }),
        ).toBeVisible();
      }
    });

    test(`a plain Participant has no Admin item at ${label}`, async ({
      browser,
    }, testInfo) => {
      const { page, close } = await participantPageAs(
        browser,
        "Anthony Conway",
      );
      try {
        await page.setViewportSize(viewport);
        await page.goto("/xi");
        await expectOnlyAvatarOnTheRight(page, false);
        await accountButton(page).click();
        const menu = page.getByRole("menu");
        await expect(menu).toContainText("Anthony Conway");
        await expect(menu.getByRole("menuitem", { name: "Admin" })).toHaveCount(
          0,
        );
        await expect(
          menu.getByRole("menuitem", { name: "Sign out" }),
        ).toBeVisible();
        await shoot(page, testInfo, `55-participant-only-menu-${label}`);
      } finally {
        await close();
      }
    });
  }

  test("Home no longer has a Slack button, and More has no Admin, Display or account rows", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);
    await page.goto("/xii");
    await expect(
      page.getByRole("main").getByText("Join the Slack channel"),
    ).toHaveCount(0);
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("button", { name: "More" })
      .click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("link", { name: "Admin" })).toHaveCount(0);
    await expect(sheet.getByText("Signed in as")).toHaveCount(0);
    await expect(sheet.getByRole("group", { name: "Display" })).toHaveCount(0);
  });

  test("keyboard: Enter opens, arrows move, Escape closes and returns focus", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);
    await page.goto("/xii");
    await accountButton(page).focus();
    await page.keyboard.press("Enter");
    const menu = page.getByRole("menu");
    await expect(menu).toBeVisible();

    // The focused menu item, read through auto-retrying assertions.
    const focused = menu.locator('[role^="menuitem"]:focus');
    await page.keyboard.press("ArrowDown");
    await expect(focused).toHaveCount(1);
    const first = (await focused.textContent()) ?? "";
    expect(first).toBeTruthy();
    await page.keyboard.press("ArrowDown");
    await expect(focused).toHaveCount(1);
    await expect(focused).not.toHaveText(first);

    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(accountButton(page)).toBeFocused();
  });
});
