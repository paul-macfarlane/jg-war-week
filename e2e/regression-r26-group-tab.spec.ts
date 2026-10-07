import { expect, test } from "@playwright/test";

import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

// Epic R26, Decision 10: the Participant Competitions list's Group tab is in
// the URL as ?group=<slug>, written with history replace. Read-only: this
// spec changes no seeded data. XI has two Groups plus "Other Competitions".

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

for (const [width, size] of [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const) {
  test(`r26 10 the Competition group tab is in the URL at ${width}`, async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    await page.setViewportSize(size);

    // No param and an unknown param both open the first tab.
    for (const url of ["/xi/competitions", "/xi/competitions?group=nope"]) {
      await page.goto(url);
      await expect(page.getByRole("tab").first()).toHaveAttribute(
        "aria-selected",
        "true",
      );
    }

    await page.goto("/xi/competitions");
    const lengthBefore = await page.evaluate(() => window.history.length);
    const other = page.getByRole("tab", { name: "Other Competitions" });
    const first = page.getByRole("tab").first();
    await other.click();
    await expect(page).toHaveURL(
      /\/xi\/competitions\?group=other-competitions$/,
    );
    await expect(other).toHaveAttribute("aria-selected", "true");
    await first.click();
    await other.click();
    await expect(page).toHaveURL(/\?group=other-competitions$/);
    // Choosing tabs added no history entries.
    expect(await page.evaluate(() => window.history.length)).toBe(lengthBefore);

    // Open a Competition and go Back: the same tab is selected.
    const panel = page.getByRole("tabpanel", { name: "Other Competitions" });
    await panel.getByRole("link").first().click();
    await expect(page).not.toHaveURL(/\/xi\/competitions\?group=/);
    await page.goBack();
    await expect(page).toHaveURL(/\?group=other-competitions$/);
    await expect(
      page.getByRole("tab", { name: "Other Competitions" }),
    ).toHaveAttribute("aria-selected", "true");

    // A shared link opens that tab straight away.
    await page.goto("/xi/competitions?group=other-competitions");
    await expect(
      page.getByRole("tab", { name: "Other Competitions" }),
    ).toHaveAttribute("aria-selected", "true");
    await page.screenshot({
      path: testInfo.outputPath("group-tab.png"),
      fullPage: true,
      animations: "disabled",
    });
  });
}
