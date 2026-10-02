import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

test.describe("54 Competitions in the main nav", () => {
  test("phone tab bar order, highlighting and Announcements in More", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);
    const bar = page.getByRole("navigation", { name: "Primary" });

    await page.goto("/xii/competitions");
    await expect(bar.locator("li")).toHaveText([
      "Home",
      "Schedule",
      "Competitions",
      "Leaderboard",
      "More",
    ]);
    await expect(
      bar.getByRole("link", { name: "Competitions" }),
    ).toHaveAttribute("aria-current", "page");
    await shoot(page, testInfo, "54-competitions-390");

    const competitionId = await xiCompetitionId("Pool");
    await page.goto(`/xi/competitions/${competitionId}`);
    await expect(
      bar.getByRole("link", { name: "Competitions" }),
    ).toHaveAttribute("aria-current", "page");
    await shoot(page, testInfo, "54-competition-390");

    await page.goto("/xii/announcements");
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await bar.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet.getByRole("link").first()).toHaveText("Announcements");
    await expect(sheet.getByRole("link", { name: "Competitions" })).toHaveCount(
      0,
    );
    await shoot(page, testInfo, "54-more-390");
  });

  test("desktop top nav order and highlighting", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    const nav = page.locator("header").getByRole("navigation", {
      name: "Primary",
    });

    await page.goto("/xii/competitions");
    await expect(nav.locator("li")).toHaveText([
      "Home",
      "Schedule",
      "Competitions",
      "Leaderboard",
      "Announcements",
      "More",
    ]);
    await expect(
      nav.getByRole("link", { name: "Competitions" }),
    ).toHaveAttribute("aria-current", "page");
    await shoot(page, testInfo, "54-competitions-1440");
  });
});
