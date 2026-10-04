import {
  type Browser,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { spawnSync } from "node:child_process";

import { localSeedFiles } from "@/seed/local-files";

import { runQuery } from "./db";
import { finaleStage, nextUntil, openFinale } from "./finale-slides";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

// Epic R19, ticket 106 (.scratch/regression-2026-10/issues/106-hundred-participants.md):
// every page that lists or picks people, screenshotted at 1440 and 390 with
// 100 Participants: the free-for-all XII scale demo (`pnpm seed:demo:scale`,
// loaded in beforeAll and put back to `localSeedFiles()` in afterAll) and,
// for Teams, the live XI demo's 101 Participants that global setup loads.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

const LONG_NAME = "Maximiliana Featherstonehaugh-Quicksilver";

function pnpm(args: string[]) {
  const result = spawnSync("pnpm", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`pnpm ${args.join(" ")} exited with ${result.status}`);
  }
}

/** The page never scrolls sideways at 390; wide content scrolls inside itself. */
async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
}

/**
 * Opens the page at 1440 then at 390 (`open` navigates and waits for it),
 * checks the 390 page has no sideways scroll, and saves a full-page shot of
 * each as `<name>-<width>.png`.
 */
async function shootBoth(
  page: Page,
  testInfo: TestInfo,
  name: string,
  open: () => Promise<void>,
) {
  for (const [width, size] of VIEWPORTS) {
    await page.setViewportSize(size);
    await open();
    if (size === PHONE) await expectNoSidewaysScroll(page);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${width}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
}

async function competitionId(edition: string, name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = $1 and c.name = $2`,
    [edition, name],
  );
  if (!row) throw new Error(`No ${edition} Competition named "${name}"`);
  return row.id;
}

async function organizerPage(browser: Browser) {
  const context = await browser.newContext();
  await asOrganizer(context);
  return { context, page: await context.newPage() };
}

test("r19 106 the live XI demo's roster and leaderboard with 101 Participants in Teams at 1440 and 390", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  const [{ n }] = await runQuery<{ n: number }>(
    `select count(*)::int as n from participant p join war_week w
     on w.id = p.war_week_id where w.edition = 'xi' and w.status = 'live'`,
  );
  expect(n).toBe(101);
  await shootBoth(page, testInfo, "xi-leaderboard", async () => {
    await page.goto("/xi/leaderboard");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });

  const admin = await organizerPage(browser);
  try {
    await shootBoth(admin.page, testInfo, "xi-roster", async () => {
      await admin.page.goto("/admin/roster");
      await expect(
        admin.page.getByRole("heading", { name: "Roster", exact: true }),
      ).toBeVisible();
    });
  } finally {
    await admin.context.close();
  }
});

test.describe("100 Participants in the XII scale demo", () => {
  test.beforeAll(() => {
    pnpm(["seed:demo:scale"]);
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    pnpm(["seed:load", "--reset", ...localSeedFiles()]);
  });

  test("r19 106 the roster lists all 100 at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      await shootBoth(page, testInfo, "roster", async () => {
        await page.goto("/admin/roster");
        await expect(page.getByText(LONG_NAME).first()).toBeVisible();
      });
    } finally {
      await context.close();
    }
  });

  test("r19 106 the Standings and leaderboard at 1440 and 390", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    await shootBoth(page, testInfo, "home", async () => {
      await page.goto("/xii");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    });
    await shootBoth(page, testInfo, "leaderboard", async () => {
      await page.goto("/xii/leaderboard");
      // The Step Challenge winner (seeds/demo/xii-scale.json), 1st.
      await expect(page.getByText("Ada Anvil").first()).toBeVisible();
    });
    await shootBoth(page, testInfo, "competitions-list", async () => {
      await page.goto("/xii/competitions");
      await expect(
        page.getByRole("listitem").filter({ hasText: "Ping Pong Bracket" }),
      ).toContainText("Underway · Round 1 of 6");
    });
  });

  test("r19 106 the Placement sheet, Entrants and Participation ticks at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(120_000);
    const { context, page } = await organizerPage(browser);
    try {
      const steps = await competitionId("xii", "Step Challenge");
      await shootBoth(page, testInfo, "placement-sheet", async () => {
        await page.goto(`/admin/competitions/${steps}`);
        await expect(
          page.getByRole("heading", { name: "Record placements" }),
        ).toBeVisible();
        await expect(page.getByText(LONG_NAME).first()).toBeVisible();
      });

      const bracket = await competitionId("xii", "Ping Pong Bracket");
      await shootBoth(page, testInfo, "entrants", async () => {
        await page.goto(`/admin/competitions/${bracket}`);
        await expect(
          page.getByRole("heading", { name: "Entrants and Bracket" }),
        ).toBeVisible();
      });

      const stretch = await competitionId("xii", "Morning Stretch");
      await shootBoth(page, testInfo, "participation-ticks", async () => {
        await page.goto(`/admin/competitions/${stretch}`);
        await expect(
          page.getByRole("heading", { name: "Who took part" }),
        ).toBeVisible();
      });
    } finally {
      await context.close();
    }
  });

  test("r19 106 a picker finds a Participant by name and by email, all 100 with no cap", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      for (const [width, size] of VIEWPORTS) {
        await page.setViewportSize(size);
        await page.goto("/admin/discretionary-points");
        await page
          .getByRole("button", { name: "Give Discretionary points" })
          .click();
        const picker = page.getByRole("combobox", { name: "Participant" });
        await picker.click();
        // Every Participant's email has an "@": no result cap at 100.
        await picker.fill("@");
        await expect(page.getByRole("option")).toHaveCount(100);
        // By email: nothing in the name says "pim.ocelot".
        await picker.fill("pim.ocelot@jahnel");
        await expect(page.getByRole("option")).toHaveText(["Pim Ocelot"]);
        // By name.
        await picker.fill("feather");
        await expect(page.getByRole("option")).toHaveText([LONG_NAME]);
        await picker.fill("an");
        if (size === PHONE) await expectNoSidewaysScroll(page);
        await page.screenshot({
          path: testInfo.outputPath(`picker-${width}.png`),
          animations: "disabled",
        });
      }
    } finally {
      await context.close();
    }
  });

  test("r19 106 the 64-Entrant Bracket tree at 1440 and 390, scrolling inside its own region", async ({
    context,
    page,
  }, testInfo) => {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    const bracket = await competitionId("xii", "Ping Pong Bracket");
    const tree = page
      .getByRole("region", { name: "Bracket" })
      .locator("[data-bracket-tree]");
    await shootBoth(page, testInfo, "bracket-tree", async () => {
      await page.goto(`/xii/competitions/${bracket}`);
      await expect(tree).toBeVisible();
    });
    // At 390 (the last width shot) the Rounds scroll sideways in their region.
    const scroller = tree.getByRole("region", { name: "Rounds" });
    const widths = await scroller.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    expect(widths.scroll).toBeGreaterThan(widths.client);
  });

  test("r19 106 the Finale's Standings slide at 1440 and 390", async ({
    browser,
  }, testInfo) => {
    const { context, page } = await organizerPage(browser);
    try {
      await shootBoth(page, testInfo, "finale-standings", async () => {
        await openFinale(page, "/xii/finale");
        await nextUntil(page, "standings");
        await expect(finaleStage(page)).toHaveAttribute(
          "data-finale-slide",
          "standings",
        );
        // The countdown has revealed every row once Replay shows.
        await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
          timeout: 30_000,
        });
      });
    } finally {
      await context.close();
    }
  });
});
