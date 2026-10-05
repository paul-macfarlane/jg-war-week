import { type Page, type TestInfo, expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";

import { localSeedFiles } from "@/seed/local-files";

import { addCompetition, openCompetitionPage } from "./competition-page";
import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R24, ticket 110 (.scratch/regression-2026-10/issues/110-bracket-admin-at-sixty-four.md):
// Ping Pong Bracket's admin page at 64 Entrants has no Round 1 Preview, and
// once a result exists the Entrants and Seed Positions fold into one closed
// trigger. The scale demo is loaded in beforeAll and put back to
// `localSeedFiles()` in afterAll, which also drops the Bracket created here.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
/** The issue's measurement of this page at 1440 before this change. */
const BEFORE_HEIGHT_1440 = 12_000;

function pnpm(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

async function pingPongId(): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xii' and c.name = 'Ping Pong Bracket'`,
  );
  if (!row) throw new Error('No xii Competition named "Ping Pong Bracket"');
  return row.id;
}

async function pageHeight(page: Page) {
  return page.evaluate(() => document.documentElement.scrollHeight);
}

/** The Entrants and Seed Positions lock line (Settings has its own lines). */
function lockReason(page: Page) {
  return page
    .getByRole("region", { name: "Entrants and Bracket" })
    .locator('[data-slot="lock-reason"]')
    .filter({ hasText: "Entrants and Seed Positions:" });
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Bracket admin at 64 Entrants in the XII scale demo", () => {
  test.beforeAll(() => {
    pnpm(["seed:demo:scale"]);
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back (this drops the result too).
    pnpm(["seed:load", "--reset", ...localSeedFiles()]);
  });

  test("r24 110 on an unlocked Bracket, Entrants and Seed Positions are expanded and there is no Preview", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(90_000);
    const context = await browser.newContext();
    await asOrganizer(context);
    const page = await context.newPage();
    try {
      // The scale demo's Ping Pong Bracket already has results; build a
      // fresh one in XII (afterAll's reload drops it).
      await page.setViewportSize(DESKTOP);
      const id = await addCompetition(page, {
        name: "R24 Unlocked Bracket",
        format: "Bracket",
      });
      const find = page.locator("#bracket-entrants");
      for (const name of [
        "Abe Acorn",
        "Ada Anvil",
        "Ari Abacus",
        "Bea Bellows",
      ]) {
        await find.fill(name);
        await page
          .getByRole("option", { name: new RegExp(`^${name}`) })
          .click();
      }
      await expect(page.getByText("(4 chosen)")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Save Entrants" }).click();
      await expect(
        page.getByText("Entrants saved", { exact: true }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Generate" }).click();
      await expect(page.getByText("Bracket generated")).toBeVisible();

      for (const [width, size] of [
        ["1440", DESKTOP],
        ["390", PHONE],
      ] as const) {
        await page.setViewportSize(size);
        await openCompetitionPage(page, id);
        await expect(page.getByText("(4 chosen)")).toBeVisible();
        await expect(lockReason(page)).toHaveCount(0);
        await expect(
          page.getByRole("button", { name: /^Entrants and Seed Positions/ }),
        ).toHaveCount(0);
        await expect(
          page.getByRole("region", { name: "Seed Positions" }),
        ).toBeVisible();
        await expect(
          page.getByRole("button", { name: "Re-roll" }),
        ).toBeVisible();
        await expect(page.getByRole("region", { name: "Preview" })).toHaveCount(
          0,
        );
        await expect(page.getByText(/^Preview/)).toHaveCount(0);
        await shoot(page, testInfo, `unlocked-${width}.png`);
      }
    } finally {
      await context.close();
    }
  });

  test("r24 110 with Round 1 results (seeded), the sections fold under one trigger and the page is shorter", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext();
    await asOrganizer(context);
    const page = await context.newPage();
    try {
      const url = `/admin/competitions/${await pingPongId()}`;
      const trigger = page.getByRole("button", {
        name: "Entrants and Seed Positions (64)",
      });
      const reason = lockReason(page);
      const seeds = page.getByRole("region", { name: "Seed Positions" });
      const entrantsCount = page.getByText("(64 chosen)");

      for (const [width, size] of [
        ["1440", DESKTOP],
        ["390", PHONE],
      ] as const) {
        await page.setViewportSize(size);
        await page.goto(url);
        await expect(trigger).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByRole("region", { name: "Preview" })).toHaveCount(
          0,
        );
        await expect(page.getByText(/^Preview/)).toHaveCount(0);
        // Collapsed: neither section is on the page, but the reason is.
        await expect(seeds).toHaveCount(0);
        await expect(entrantsCount).toHaveCount(0);
        await expect(reason).toBeVisible();
        await expect(reason).toContainText("Entrants and Seed Positions:");

        if (width === "390") {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(PHONE.width);
        } else {
          const lockedHeight = await pageHeight(page);
          console.log(
            `r24 110 page height at 1440: before ~${BEFORE_HEIGHT_1440} px (issue), now, locked and collapsed, ${lockedHeight} px`,
          );
        }
        await shoot(page, testInfo, `collapsed-${width}.png`);
      }

      // Keyboard: focus the trigger and press Enter; both sections open.
      await page.setViewportSize(DESKTOP);
      await page.goto(url);
      await trigger.focus();
      await page.keyboard.press("Enter");
      await expect(trigger).toHaveAttribute("aria-expanded", "true");
      await expect(seeds).toBeVisible();
      await expect(entrantsCount).toBeVisible();
      await expect(reason).toBeVisible();
      await shoot(page, testInfo, "expanded-1440.png");
      await page.keyboard.press("Space");
      await expect(trigger).toHaveAttribute("aria-expanded", "false");
      await expect(seeds).toHaveCount(0);
    } finally {
      await context.close();
    }
  });
});
