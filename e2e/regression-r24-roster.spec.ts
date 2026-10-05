import { type Page, expect, test } from "@playwright/test";
import { spawnSync } from "node:child_process";

import { localSeedFiles } from "@/seed/local-files";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R24, ticket 109: /admin/roster with 100 Participants (the XII scale
// demo) has Add Participant and Import above the list and a search by name
// or email. Screenshotted at 1440 and 390.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

function pnpm(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

async function expectInViewport(page: Page, name: string) {
  const box = await page.getByRole("button", { name }).first().boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error(`No box for ${name}`);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
}

test.describe("Roster at 100 Participants", () => {
  test.beforeAll(() => {
    pnpm(["seed:demo:scale"]);
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    pnpm(["seed:load", "--reset", ...localSeedFiles()]);
  });

  for (const [width, size] of [
    ["1440", DESKTOP],
    ["390", PHONE],
  ] as const) {
    test(`r24 109 the roster's actions and search at ${width}`, async ({
      browser,
    }, testInfo) => {
      const context = await browser.newContext();
      await asOrganizer(context);
      const page = await context.newPage();
      try {
        // The alphabetically last Participant is past the 50th row.
        const [last] = await runQuery<{ name: string; email: string }>(
          `select p.display_name as name, p.email from participant p
           join war_week w on w.id = p.war_week_id
           where w.edition = 'xii' and p.email is not null
           order by p.display_name desc limit 1`,
        );
        if (!last) throw new Error("The scale demo has no emailed Participant");

        await page.setViewportSize(size);
        await page.goto("/admin/roster");
        const rows = page.getByRole("list", { name: "Roster" }).locator("> li");
        const count = page.getByTestId("roster-count");
        await expect(rows).toHaveCount(100);
        await expect(count).toHaveText("100 of 100");

        await expectInViewport(page, "Add Participant");
        await expectInViewport(page, "Import");
        if (size === PHONE) {
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(PHONE.width);
        }

        const search = page.getByRole("searchbox", {
          name: "Search the roster",
        });

        // A name past the 50th row, typed in the wrong case.
        const names = await rows.allTextContents();
        expect(names.findIndex((t) => t.includes(last.name))).toBeGreaterThan(
          49,
        );
        await search.fill(last.name.toUpperCase());
        await expect(rows.filter({ hasText: last.name })).toHaveCount(1);
        await expect(count).toHaveText(/^\d+ of 100$/);
        await expect(count).not.toHaveText("100 of 100");

        // An email finds exactly its Participant.
        await search.fill(last.email.slice(0, -4));
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toContainText(last.name);
        await expect(count).toHaveText("1 of 100");

        // No one.
        await search.fill("zzzz-nobody");
        await expect(rows).toHaveCount(0);
        await expect(count).toHaveText("No one matches 'zzzz-nobody'");
        expect(new URL(page.url()).search).toBe("");
        await page.screenshot({
          path: testInfo.outputPath(`roster-search-empty-${width}.png`),
          animations: "disabled",
        });

        await search.fill(last.name.slice(0, 5));
        await expect(rows.filter({ hasText: last.name })).toHaveCount(1);
        await page.screenshot({
          path: testInfo.outputPath(`roster-search-${width}.png`),
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });
  }
});
