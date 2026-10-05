import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { runQuery, setParticipantEmail } from "./db";
import {
  competitionId,
  expectNoSidewaysScroll,
  loadScaleDemo,
  restoreLocalSeed,
} from "./scale-demo";
import { signIn } from "./session";

// Epic R24, ticket 111 (.scratch/regression-2026-10/issues/111-bracket-tree-at-sixty-four.md):
// Ping Pong Bracket (64 Entrants, XII scale demo) on the Participant page:
// from md up the tree breaks out of the text column and shows at least five
// Rounds at 1440, and "Jump to your Match" scrolls the Rounds region to the
// viewer's Match and highlights it, only for an Entrant. The scale demo is
// loaded in beforeAll and put back to `localSeedFiles()` in afterAll.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/**
 * An Entrant whose Participant is in the furthest unplayed Match, so Jump
 * must scroll the Rounds region sideways as well as the page.
 */
async function entrantParticipant(): Promise<{ id: string; match: string }> {
  const [row] = await runQuery<{ id: string; match: string }>(
    `select e.participant_id as id, m.id as match
     from bracket_match m
     join bracket_match_entrant me on me.bracket_match_id = m.id
     join entrant e on e.id = me.entrant_id
     where m.competition_id = $1 and m.status <> 'played'
       and e.participant_id is not null
     order by m.round desc, m.position desc, me.slot limit 1`,
    [await competitionId("xii", "Ping Pong Bracket")],
  );
  if (!row) throw new Error("No Entrant Participant in an unplayed Match");
  return { id: row.id, match: row.match };
}

async function nonEntrantParticipantId(): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select p.id from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xii'
       and not exists (select 1 from entrant e where e.participant_id = p.id
                       and e.competition_id = $1)
     limit 1`,
    [await competitionId("xii", "Ping Pong Bracket")],
  );
  if (!row) throw new Error("No non-Entrant XII Participant");
  return row.id;
}

async function signInAs(page: Page, participantId: string): Promise<void> {
  const email = `e2e-r24-${participantId}@jahnelgroup.com`;
  await setParticipantEmail(participantId, email);
  await signIn(page.context(), email);
}

const jump = (page: Page) =>
  page.getByRole("button", { name: "Jump to your Match" });
const rounds = (page: Page) => page.getByRole("region", { name: "Rounds" });

async function open(page: Page, size: { width: number; height: number }) {
  await page.setViewportSize(size);
  await page.goto(
    `/xii/competitions/${await competitionId("xii", "Ping Pong Bracket")}`,
  );
  await expect(rounds(page)).toBeVisible();
}

/** `match` is fully inside the viewport and inside the Rounds region's box. */
async function expectInRegionView(page: Page, match: Locator) {
  await expect(match).toBeInViewport({ ratio: 1 });
  await expect
    .poll(async () => {
      const m = await match.boundingBox();
      const r = await rounds(page).boundingBox();
      if (!m || !r) return false;
      return (
        m.x >= r.x - 1 &&
        m.x + m.width <= r.x + r.width + 1 &&
        m.y >= r.y - 1 &&
        m.y + m.height <= r.y + r.height + 1
      );
    })
    .toBe(true);
}

async function jumpAndCheck(page: Page, matchId: string) {
  const match = rounds(page).locator(`[data-match-id="${matchId}"]`);
  await expect(match).not.toHaveAttribute("data-highlighted", "");
  await jump(page).click();
  await expect(match).toHaveAttribute("data-highlighted", "");
  await expect(match).toHaveAttribute("aria-current", "true");
  await expectInRegionView(page, match);
  return match;
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Bracket tree at 64 Entrants in the XII scale demo", () => {
  test.beforeAll(() => {
    loadScaleDemo();
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    restoreLocalSeed();
  });

  test("r24 111 at 1440 the tree is wider than the text column, shows five Rounds, and Jump finds an Entrant's Match", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const entrant = await entrantParticipant();
    await signInAs(page, entrant.id);
    await open(page, DESKTOP);

    const tree = page.locator("[data-bracket-tree]");
    const column = await page.locator("main > div").first().boundingBox();
    const treeBox = await tree.boundingBox();
    expect(column).not.toBeNull();
    expect(treeBox).not.toBeNull();
    expect(treeBox!.width).toBeGreaterThan(column!.width + 200);

    // With the Rounds region at scrollLeft 0, count the Round groups whose
    // right edge is within the region's own box.
    expect(await rounds(page).evaluate((el) => el.scrollLeft)).toBe(0);
    const region = await rounds(page).boundingBox();
    expect(region).not.toBeNull();
    const groups = await rounds(page).locator('[role="group"]:has(h3)').all();
    let visibleRounds = 0;
    for (const group of groups) {
      const box = await group.boundingBox();
      if (box && box.x + box.width <= region!.x + region!.width + 1) {
        visibleRounds++;
      }
    }
    expect(visibleRounds).toBeGreaterThanOrEqual(5);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "bracket-tree-1440.png");

    await jumpAndCheck(page, entrant.match);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "bracket-tree-jump-1440.png");
  });

  test("r24 111 at 390 the page never scrolls sideways and Jump works the same way", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const entrant = await entrantParticipant();
    await signInAs(page, entrant.id);
    await open(page, PHONE);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "bracket-tree-390.png");

    const match = await jumpAndCheck(page, entrant.match);
    // The furthest Match is past the first screenful of Rounds.
    expect(await rounds(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(
      0,
    );
    await expect(match).toBeVisible();
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "bracket-tree-jump-390.png");
  });

  test("r24 111 a Participant who isn't an Entrant has no Jump button", async ({
    page,
  }) => {
    await signInAs(page, await nonEntrantParticipantId());
    for (const size of [DESKTOP, PHONE]) {
      await open(page, size);
      await expect(jump(page)).toHaveCount(0);
    }
  });
});
