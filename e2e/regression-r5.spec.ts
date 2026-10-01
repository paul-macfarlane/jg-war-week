import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery, xiCompetitionId } from "./db";
import { E2E_BASE_URL } from "./env";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812 };
const TOLERANCE = 1;

async function shoot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  // Finishes the Sheet's open animation, so it isn't caught mid-fade.
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage,
    animations: "disabled",
  });
}

/** The phone's admin bottom bar (the side column is hidden below `md`). */
function adminBar(page: Page) {
  return page.getByRole("navigation", { name: "Admin sections" });
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} isn't visible`);
  return rect;
}

test("r5 30 admin header and section bar on a phone", async ({
  page,
  context,
}, testInfo) => {
  const toastEmail = "e2e-r5-toast@jahnelgroup.com";
  const competitionId = await xiCompetitionId("Pool");
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);

    // 30-1: a one-row header, at most 56px.
    await page.goto("/admin");
    expect((await box(page, "header")).height).toBeLessThanOrEqual(56);
    await expect(adminBar(page)).toHaveCount(1);
    await shoot(page, testInfo, "organizer-overview-375");

    // 30-2: the bar is fixed to the viewport's bottom, Setup current on Setup.
    await page.goto("/admin/setup");
    const bar = adminBar(page);
    await expect(bar.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.getByRole("button", { name: "More" })).not.toHaveAttribute(
      "aria-current",
    );
    const barBox = await bar.boundingBox();
    expect(barBox!.y + barBox!.height).toBeCloseTo(PHONE.height, 0);
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
      "fixed",
    );
    await shoot(page, testInfo, "organizer-setup-375");

    // 30-4: More → Awards navigates and the Sheet closes.
    await bar.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Organizers" })).toBeVisible();
    await shoot(page, testInfo, "organizer-more-375");
    await sheet.getByRole("link", { name: "Awards" }).click();
    await expect(page).toHaveURL(/\/admin\/awards$/);
    await expect(sheet).toBeHidden();
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await shoot(page, testInfo, "organizer-awards-375");

    // 30-2: an in-More section highlights More and its row in the Sheet.
    await page.goto("/admin/guide");
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await bar.getByRole("button", { name: "More" }).click();
    await expect(sheet.getByRole("link", { name: "Guide" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await shoot(page, testInfo, "organizer-guide-more-375");
    await sheet.getByRole("link", { name: "Organizers" }).click();
    await expect(page).toHaveURL(/\/admin\/organizers$/);
    await expect(sheet).toBeHidden();

    // 30-5: the footer clears the bar at the bottom of the page...
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const barTop = (await bar.boundingBox())!.y;
    const footer = await box(page, "footer");
    expect(footer.y + footer.height).toBeLessThanOrEqual(barTop + TOLERANCE);
    // ...and a toast shows above the bar.
    await page
      .getByRole("textbox", { name: "Add an Organizer" })
      .fill(toastEmail);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Organizer added");
    // Sonner animates the toast in; wait for it to settle.
    await expect
      .poll(async () => {
        const t = await toast.boundingBox();
        return t ? t.y + t.height : Infinity;
      })
      .toBeLessThanOrEqual(barTop);
    await shoot(page, testInfo, "organizer-toast-375");

    // 30-1: with the "Editing …" banner, header + banner at most 96px.
    await context.addCookies([
      { name: "admin_edition", value: "xii", url: E2E_BASE_URL },
    ]);
    await page.goto("/admin");
    const banner = page.getByRole("status").filter({ hasText: "Editing" });
    await expect(banner).toBeVisible();
    const bannerBox = (await banner.boundingBox())!;
    const headerTop = (await box(page, "header")).y;
    expect(bannerBox.y + bannerBox.height - headerTop).toBeLessThanOrEqual(96);
    await shoot(page, testInfo, "organizer-banner-375");
    await context.clearCookies({ name: "admin_edition" });

    // 30-7: from `md` the header and side column are as before.
    await page.setViewportSize(DESKTOP);
    for (const [url, name] of [
      ["/admin", "admin"],
      ["/admin/setup", "setup"],
    ] as const) {
      await page.goto(url);
      await expect(adminBar(page)).toHaveCount(1);
      await expect(
        adminBar(page).getByRole("link", { name: "Points Entries" }),
      ).toBeVisible();
      await shoot(page, testInfo, `after-1280-${name}`, true);
    }

    // 30-3: a Host sees no Awards or Organizers in the bar or the Sheet.
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, E2E_HOST_EMAIL],
    );
    await context.clearCookies();
    await asHost(context);
    await page.setViewportSize(PHONE);
    await page.goto("/admin");
    await expect(bar.getByRole("link", { name: "Points" })).toBeVisible();
    await bar.getByRole("button", { name: "More" }).click();
    await expect(sheet.getByRole("link", { name: "Guide" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Finale" })).toBeVisible();
    for (const name of ["Awards", "Organizers"]) {
      await expect(page.getByRole("link", { name })).toHaveCount(0);
    }
    await shoot(page, testInfo, "host-more-375");
  } finally {
    await runQuery(`delete from organizer where email = $1`, [toastEmail]);
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [competitionId, E2E_HOST_EMAIL],
    );
  }
});
