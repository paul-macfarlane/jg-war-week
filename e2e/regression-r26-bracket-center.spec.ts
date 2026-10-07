import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { addCompetition, expectEntrantsSaved } from "./competition-page";
import { competitionId, loadScaleDemo, restoreLocalSeed } from "./scale-demo";
import { asOrganizer } from "./session";

// Epic R26, spec Decision 9 (Center small Brackets), AC 9: a 4-Entrant
// Bracket's tree is centered in its Rounds region, on the Participant page
// and in admin; the 64-Entrant scale Bracket (Ping Pong Bracket) starts at
// the left edge and scrolls sideways inside the region. The scale demo is
// loaded in beforeAll and put back to `localSeedFiles()` in afterAll, which
// also drops the 4-Entrant Bracket created here (this spec owns it).

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
    animations: "disabled",
  });
}

const rounds = (page: Page) => page.getByRole("region", { name: "Rounds" });

/** The first and last Round columns' boxes against the Rounds region's. */
async function boxes(page: Page) {
  const region = await rounds(page).boundingBox();
  const groups = rounds(page).getByRole("group");
  const first = await groups.first().boundingBox();
  const last = await groups.last().boundingBox();
  if (!region || !first || !last) throw new Error("The tree has no boxes");
  return { region, first, last };
}

async function expectCentered(page: Page) {
  await expect
    .poll(async () => {
      const { region, first, last } = await boxes(page);
      const left = first.x - region.x;
      const right = region.x + region.width - (last.x + last.width);
      return Math.abs(left - right) <= 2 && left > 8;
    })
    .toBe(true);
  expect(
    await rounds(page).evaluate((el) => el.scrollWidth <= el.clientWidth),
  ).toBe(true);
}

test.describe.configure({ mode: "serial" });

test.describe("Bracket tree centering in the XII scale demo", () => {
  let smallId = "";

  test.beforeAll(() => {
    loadScaleDemo();
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back (drops the 4-Entrant Bracket).
    restoreLocalSeed();
  });

  test("r26 9 a 4-Entrant Bracket is centered at 1440 (and starts left at 390, where it is wider), in admin and on the Participant page", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const context = await browser.newContext();
    await asOrganizer(context);
    const page = await context.newPage();
    try {
      await page.setViewportSize(DESKTOP);
      smallId = await addCompetition(page, {
        name: "R26 Small Bracket",
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
      await expectEntrantsSaved(page);
      await page.getByRole("button", { name: "Generate" }).click();
      await expect(page.getByText("Bracket generated")).toBeVisible();

      for (const [width, size] of VIEWPORTS) {
        await page.setViewportSize(size);
        for (const [where, url] of [
          ["admin", `/admin/competitions/${smallId}`],
          ["participant", `/xii/competitions/${smallId}`],
        ] as const) {
          await page.goto(url);
          await expect(rounds(page)).toBeVisible();
          if (size === DESKTOP) {
            await expectCentered(page);
          } else {
            // The 2-Round tree (about 480 px) is wider than the phone's
            // region (about 358 px), so it is the wider case: it starts
            // at the left edge and scrolls, never clipped on the left.
            const { region, first } = await boxes(page);
            expect(Math.abs(first.x - region.x)).toBeLessThanOrEqual(2);
            expect(
              await rounds(page).evaluate(
                (el) => el.scrollWidth > el.clientWidth,
              ),
            ).toBe(true);
          }
          await shoot(page, testInfo, `small-${where}-${width}.png`);
        }
      }
    } finally {
      await context.close();
    }
  });

  test("r26 9 the 64-Entrant Bracket starts at the left edge and scrolls at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const context = await browser.newContext();
    await asOrganizer(context);
    const page = await context.newPage();
    try {
      const id = await competitionId("xii", "Ping Pong Bracket");
      for (const [width, size] of VIEWPORTS) {
        await page.setViewportSize(size);
        for (const [where, url] of [
          ["admin", `/admin/competitions/${id}`],
          ["participant", `/xii/competitions/${id}`],
        ] as const) {
          await page.goto(url);
          await expect(rounds(page)).toBeVisible();
          const overflow = await rounds(page).evaluate((el) => ({
            scrollWidth: el.scrollWidth,
            clientWidth: el.clientWidth,
            scrollLeft: el.scrollLeft,
          }));
          expect(overflow.scrollWidth).toBeGreaterThan(overflow.clientWidth);
          expect(overflow.scrollLeft).toBe(0);
          const { region, first } = await boxes(page);
          // The first Round starts at the region's left edge, not clipped.
          expect(Math.abs(first.x - region.x)).toBeLessThanOrEqual(2);
          await shoot(page, testInfo, `large-${where}-${width}.png`);
        }
      }
    } finally {
      await context.close();
    }
  });
});
