import AxeBuilder from "@axe-core/playwright";
import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";
import type { ColorScheme } from "@/lib/theme";

import {
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import { openForBracket, runQuery, xiCompetitionId } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_PARTICIPANT_EMAIL,
  asOrganizer,
  participantPageAs,
  signIn,
} from "./session";

// Speed Chess and Super Smash Bros are individual War Week XI Competitions
// with no Placement Points. None of these Participants has a Points Entry
// in either, and no other flow runs them as a Bracket.
const KNOCKOUT = "Speed Chess";
const KNOCKOUT_ENTRANTS = [
  "Abby Rivera",
  "Adam Wilson-Hwang",
  "Alvaro Gil",
  "Anthony Crisafulli",
  "Bich Dudla",
];
const MATCHES = "Super Smash Bros";

// The seeded Competitions are Closed Placement sheets; open each for a
// Bracket and put the sheet back afterwards (its Format, Bracket settings
// and self-report too).
let restoreCompetition: (() => Promise<void>) | null = null;
test.beforeEach(async ({}, testInfo) => {
  restoreCompetition = await openForBracket(
    await xiCompetitionId(
      testInfo.title.includes("4 per Match") ? MATCHES : KNOCKOUT,
    ),
  );
});
test.afterEach(async () => {
  await restoreCompetition?.();
  restoreCompetition = null;
});
const MATCHES_ENTRANTS = [
  "Bob Strubel",
  "Brandon Thivierge",
  "Cameron Lynch",
  "Casey Snow",
  "Chara Meidani",
  "Charles Clarke",
  "Chelsea Merrill",
  "Chris Pence",
];

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const SCHEMES: ColorScheme[] = ["light", "dark"];

/** Picks `entrants` in the builder, saves them and Generates. */
async function enterAndGenerate(page: Page, entrants: string[]) {
  const find = page.locator("#bracket-entrants");
  for (const entrant of entrants) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await expect(page.getByText(`(${entrants.length} chosen)`)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();
}

/** The Entrant named in a button's text (it also shows Avatar initials). */
function entrantIn(text: string, entrants: string[]): string {
  const name = entrants.find((entrant) => text.includes(entrant));
  if (!name) throw new Error(`No Entrant named in "${text}"`);
  return name;
}

/** The admin Bracket's tree (admin has no "Bracket" region around it). */
function adminTreeOf(page: Page): Locator {
  return page.locator("[data-bracket-tree]").first();
}

/**
 * The Competition page's tree. Scoped by role, so a streamed page's hidden
 * copy (before React swaps it in) never counts.
 */
function treeOf(page: Page): Locator {
  return page
    .getByRole("region", { name: "Bracket" })
    .locator("[data-bracket-tree]");
}

/** The box of the Match named `match` (the last: the Final's Round is "Final" too). */
function matchBox(tree: Locator, match: string): Locator {
  return tree.getByRole("group", { name: match, exact: true }).last();
}

/** Records a two-Entrant Match from the admin tree, its first-listed winning. */
async function recordWinner(page: Page, match: string, entrants: string[]) {
  await adminTreeOf(page)
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const form = page.getByRole("dialog", { name: match });
  const winner = form
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  const name = entrantIn(await winner.innerText(), entrants);
  await winner.click();
  await form.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${name} wins ${match}`)).toBeVisible();
  await expect(form).toBeHidden();
}

/** Records a Match of more than two from the admin tree, in listed order. */
async function recordOrder(page: Page, match: string, entrants: string[]) {
  await adminTreeOf(page)
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const form = page.getByRole("dialog", { name: match });
  const buttons = form
    .getByRole("group", { name: "Finishing order" })
    .getByRole("button");
  const first = entrantIn(await buttons.first().innerText(), entrants);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) await buttons.nth(i).click();
  await form.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${first} wins ${match}`)).toBeVisible();
  await expect(form).toBeHidden();
}

async function close(page: Page, action: "Close" | "Reopen") {
  // Scoped to the Bracket: a closing Sheet has its own "Close" button.
  await page
    .getByRole("region", { name: "Bracket", exact: true })
    .getByRole("button", { name: action, exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: action, exact: true })
    .click();
  await expect(
    page.getByText(action === "Close" ? "Bracket closed" : "Bracket reopened"),
  ).toBeVisible();
}

/**
 * 07: at 1440 the Match Result opens as a centered Dialog; at 390 as the
 * bottom Sheet. Opened from the admin tree; closed each time unsaved.
 */
async function checkResultPopup(page: Page, testInfo: TestInfo, match: string) {
  const record = adminTreeOf(page).getByRole("button", {
    name: `Record result for ${match}`,
  });
  await page.setViewportSize(DESKTOP);
  await record.click();
  const dialog = page.getByRole("dialog", { name: match });
  await expect(dialog).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await dialog.boundingBox())!;
      return [
        Math.round(box.x + box.width / 2),
        Math.round(box.y + box.height / 2),
        box.width < DESKTOP.width / 2,
      ];
    })
    .toEqual([DESKTOP.width / 2, DESKTOP.height / 2, true]);
  await page.screenshot({
    path: testInfo.outputPath("result-dialog-1440.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.setViewportSize(PHONE);
  await record.scrollIntoViewIfNeeded();
  await record.click();
  const sheet = page.getByRole("dialog", { name: match });
  await expect(sheet).toBeVisible();
  await expect
    .poll(async () => {
      const box = (await sheet.boundingBox())!;
      return [
        Math.round(box.x),
        Math.round(box.width),
        Math.round(box.y + box.height),
      ];
    })
    .toEqual([0, PHONE.width, PHONE.height]);
  await page.screenshot({
    path: testInfo.outputPath("result-sheet-390.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await page.setViewportSize(DESKTOP);
}

/** A signed-in Participant's view of the Competition page (no "You"). */
async function participantPage(browser: Browser, id: string) {
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  const page = await context.newPage();
  await page.goto(`/xi/competitions/${id}`);
  return { context, page };
}

/**
 * The tree at 1440 (every Round column) and at 390 (every Round column
 * too, scrolling sideways inside the tree's own Rounds region while the
 * page never does), screenshotted as `<name>-1440.png` and `<name>-390.png`.
 */
async function checkTree(
  page: Page,
  tree: Locator,
  testInfo: TestInfo,
  name: string,
  rounds: string[],
) {
  await page.setViewportSize(DESKTOP);
  await expect(tree).toBeVisible();
  for (const round of rounds) {
    await expect(
      tree.getByRole("group", { name: round, exact: true }).first(),
    ).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath(`${name}-1440.png`),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize(PHONE);
  // One tree, no Round tabs.
  await expect(tree.getByRole("tablist")).toHaveCount(0);
  const scroller = tree.getByRole("region", { name: "Rounds" });
  await expect(scroller).toBeVisible();
  await expect(
    tree.getByRole("group", { name: rounds[0], exact: true }).first(),
  ).toBeVisible();
  // Every Round is there (not hidden behind a tab), to scroll to.
  for (const round of rounds) {
    await expect(
      tree.getByRole("group", { name: round, exact: true }).first(),
    ).toBeAttached();
  }
  const widths = await scroller.evaluate((el) => ({
    scroll: el.scrollWidth,
    client: el.clientWidth,
  }));
  expect(widths.scroll).toBeGreaterThan(widths.client);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
  await page.screenshot({
    path: testInfo.outputPath(`${name}-390.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize(DESKTOP);
}

/** The Competition page's Bracket is the tree alone: no List toggle. */
async function checkNoListToggle(page: Page) {
  const bracket = page.getByRole("region", { name: "Bracket" });
  await expect(bracket.locator("[data-bracket-tree]")).toBeVisible();
  await expect(bracket.getByRole("tab")).toHaveCount(0);
  await expect(bracket.getByRole("tab", { name: "List" })).toHaveCount(0);
  await expect(bracket.getByText("List", { exact: true })).toHaveCount(0);
}

/**
 * axe (WCAG 2 A and AA) on the tree in each scheme, chosen through the
 * Display as a viewer would, with the system setting the opposite one.
 * Each scheme's results go to `<name>-axe-<scheme>.json`.
 */
async function checkTreeAxe(page: Page, testInfo: TestInfo, name: string) {
  for (const scheme of SCHEMES) {
    await page.evaluate(
      ([key, value]) => window.localStorage.setItem(key, value),
      [DISPLAY_STORAGE_KEY, scheme] as const,
    );
    await page.emulateMedia({
      colorScheme: scheme === "dark" ? "light" : "dark",
    });
    await page.reload();
    await expect(page.locator("[data-bracket-tree]").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.dataset.display),
    ).toBe(scheme);
    // Let fades and color transitions finish before measuring contrast.
    await page.evaluate(() =>
      Promise.allSettled(
        document
          .getAnimations()
          .filter((a) => a.effect?.getTiming().iterations !== Infinity)
          .map((a) => a.finished),
      ),
    );
    const results = await new AxeBuilder({ page })
      .include("[data-bracket-tree]")
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    await writeFile(
      testInfo.outputPath(`${name}-axe-${scheme}.json`),
      JSON.stringify(
        { violations: results.violations, incomplete: results.incomplete },
        null,
        2,
      ),
    );
    expect(
      results.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target.join(" ")),
      })),
      `axe on the tree (${scheme})`,
    ).toEqual([]);
  }
}

test("a head-to-head Bracket is one tree: the Organizer records from it in admin, Participants see it without a List toggle", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(KNOCKOUT);
  const rounds = ["Round 1", "Semifinal", "Final"];

  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");
  // Five Entrants: three first-Round byes.
  await enterAndGenerate(page, KNOCKOUT_ENTRANTS);

  // The tree is on the Competition's own page, below the Entrants: no
  // separate results page, and the old "Run …" wording is gone.
  await expect(page).toHaveURL(new RegExp(`/admin/competitions/${id}$`));
  await expect(page.getByText(/Run\s+results/i)).toHaveCount(0);
  const admin = adminTreeOf(page);
  await expect(admin).toBeVisible();
  // The Matches ready to play have a solid Record result: Round 1 Match 2, and
  // Semifinal 2, whose two Entrants both came through byes. Byes and Matches
  // still waiting have none.
  await expect(admin.getByRole("button")).toHaveCount(2);
  for (const match of ["Round 1 Match 2", "Semifinal 2"]) {
    await expect(
      admin.getByRole("button", { name: `Record result for ${match}` }),
    ).toHaveClass(/\bbg-primary\b/);
  }
  await checkResultPopup(page, testInfo, "Round 1 Match 2");

  // Mid-way: Round 1 and Semifinal 2 decided, Semifinal 1 and the Final not.
  await recordWinner(page, "Round 1 Match 2", KNOCKOUT_ENTRANTS);
  await expect(
    matchBox(admin, "Round 1 Match 2").getByText(/^Recorded .+ ET$/),
  ).toBeVisible();
  await expect(
    admin.getByRole("button", { name: "Edit Round 1 Match 2" }),
  ).toBeVisible();
  await recordWinner(page, "Semifinal 2", KNOCKOUT_ENTRANTS);
  await checkTree(page, admin, testInfo, "admin-knockout-midway", rounds);
  await checkTreeAxe(page, testInfo, "admin-knockout");

  // A signed-in Participant in no Match sees the same tree, no List toggle
  // and no Record result anywhere.
  const viewer = await participantPage(browser, id);
  await checkNoListToggle(viewer.page);
  await expect(treeOf(viewer.page).getByRole("button")).toHaveCount(0);
  await checkTree(
    viewer.page,
    treeOf(viewer.page),
    testInfo,
    "knockout-midway",
    rounds,
  );
  await checkTreeAxe(viewer.page, testInfo, "participant-knockout");

  await recordWinner(page, "Semifinal 1", KNOCKOUT_ENTRANTS);
  await recordWinner(page, "Final", KNOCKOUT_ENTRANTS);
  await close(page, "Close");
  // Closed: nothing to record until Reopen.
  await expect(admin.getByRole("button")).toHaveCount(0);

  await viewer.page.reload();
  await checkTree(
    viewer.page,
    treeOf(viewer.page),
    testInfo,
    "knockout-closed",
    rounds,
  );
  await viewer.context.close();

  // Leave the Standings the later flows read as they were.
  await close(page, "Reopen");
});

test("a Bracket of 4 per Match is the same tree of Match boxes, advancers highlighted", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(MATCHES);
  const rounds = ["Round 1", "Final"];

  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");
  await page.getByRole("combobox", { name: "Entrants per Match" }).click();
  await page.getByRole("option", { name: "4 per Match" }).click();
  await page.getByRole("combobox", { name: "How many advance" }).click();
  await page.getByRole("option", { name: "Top 2 advance" }).click();
  await expectSaved(page);
  await enterAndGenerate(page, MATCHES_ENTRANTS);

  await checkResultPopup(page, testInfo, "Round 1 Match 1");

  // Mid-way: Match 1 decided, its top two highlighted in both trees.
  await recordOrder(page, "Round 1 Match 1", MATCHES_ENTRANTS);
  await expect(
    matchBox(adminTreeOf(page), "Round 1 Match 1").locator("[data-advances]"),
  ).toHaveCount(2);

  const viewer = await participantPage(browser, id);
  await checkNoListToggle(viewer.page);
  await expect(
    matchBox(treeOf(viewer.page), "Round 1 Match 1").locator("[data-advances]"),
  ).toHaveCount(2);
  await checkTree(
    viewer.page,
    treeOf(viewer.page),
    testInfo,
    "matches-midway",
    rounds,
  );

  await recordOrder(page, "Round 1 Match 2", MATCHES_ENTRANTS);
  await recordOrder(page, "Final", MATCHES_ENTRANTS);
  await close(page, "Close");

  await viewer.page.reload();
  // In the Final only the winner is highlighted.
  await expect(
    matchBox(treeOf(viewer.page), "Final").locator("[data-advances]"),
  ).toHaveCount(1);
  await checkTree(
    viewer.page,
    treeOf(viewer.page),
    testInfo,
    "matches-closed",
    rounds,
  );
  await viewer.context.close();

  await close(page, "Reopen");
});

/** The Semifinal `displayName` plays in (the draw is random). */
async function semifinalOf(
  competitionId: string,
  displayName: string,
): Promise<string> {
  const [row] = await runQuery<{ position: number }>(
    `select h.position from bracket_match h
     join bracket_match_entrant he on he.bracket_match_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1 and h.round = 1 and p.display_name = $2`,
    [competitionId, displayName],
  );
  if (!row) throw new Error(`No Semifinal holds "${displayName}"`);
  return `Semifinal ${row.position}`;
}

async function setSelfReport(competitionId: string, on: boolean) {
  await runQuery(`update competition set self_report = $2 where id = $1`, [
    competitionId,
    on,
  ]);
}

test("a self-reporting Participant records their own Match from the public tree, and may still edit it; nobody else sees Record result on it", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(KNOCKOUT);
  // Four Entrants: two Semifinals, then the Final.
  const entrants = KNOCKOUT_ENTRANTS.slice(0, 4);

  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");
  await enterAndGenerate(page, entrants);

  const reporter = entrants[0];
  const ownMatch = await semifinalOf(id, reporter);
  const otherMatch = ownMatch === "Semifinal 1" ? "Semifinal 2" : "Semifinal 1";
  const rival = (
    await Promise.all(
      entrants.map(async (name) => ({
        name,
        match: await semifinalOf(id, name),
      })),
    )
  ).find((e) => e.match === otherMatch)!.name;

  const you = await participantPageAs(browser, reporter);
  const other = await participantPageAs(browser, rival);
  try {
    // Self-report off: a Participant in the Match sees no Record result.
    await setSelfReport(id, false);
    await you.page.goto(`/xi/competitions/${id}`);
    await checkNoListToggle(you.page);
    await expect(treeOf(you.page).getByRole("button")).toHaveCount(0);
    await expect(
      you.page.getByRole("button", { name: "Report result" }),
    ).toHaveCount(0);

    // Self-report on: their own Match, and only it, carries Record result.
    await setSelfReport(id, true);
    await you.page.reload();
    const tree = treeOf(you.page);
    const record = matchBox(tree, ownMatch).getByRole("button", {
      name: `Record result for ${ownMatch}`,
    });
    await expect(record).toBeVisible();
    await expect(record).toHaveClass(/\bbg-primary\b/);
    await expect(tree.getByRole("button")).toHaveCount(1);
    await expect(matchBox(tree, otherMatch).getByRole("button")).toHaveCount(0);

    // A Participant not in that Match sees no Record result on it (only on
    // their own).
    await other.page.goto(`/xi/competitions/${id}`);
    const otherTree = treeOf(other.page);
    await expect(matchBox(otherTree, ownMatch).getByRole("button")).toHaveCount(
      0,
    );
    await expect(
      matchBox(otherTree, otherMatch).getByRole("button", {
        name: `Record result for ${otherMatch}`,
      }),
    ).toBeVisible();

    // They record it from the tree; it counts at once.
    await record.click();
    const sheet = you.page.getByRole("dialog", { name: ownMatch });
    const winner = sheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button")
      .first();
    const name = entrantIn(await winner.innerText(), entrants);
    await winner.click();
    await sheet.getByRole("button", { name: "Save Match Result" }).click();
    await expect(you.page.getByText("Result reported.")).toBeVisible();
    await expect(sheet).toBeHidden();
    const own = matchBox(tree, ownMatch);
    await expect(own.locator("[data-advances]")).toContainText(name);
    await expect(own.getByText(/^Recorded .+ ET$/)).toBeVisible();
    // Decided, and no later Match used it yet: they can still change it
    // (spec R21, D1d), so it carries Edit.
    await expect(own.getByRole("button")).toHaveCount(1);
    await expect(
      own.getByRole("button", { name: `Edit ${ownMatch}` }),
    ).toBeVisible();
    await checkTree(you.page, tree, testInfo, "participant-reported", [
      "Semifinal",
      "Final",
    ]);

    // The Organizer sees who reported it, in the admin tree.
    await openCompetitionPage(page, id);
    await expect(matchBox(adminTreeOf(page), ownMatch)).toContainText(
      `Reported by ${reporter}`,
    );
  } finally {
    await you.close();
    await other.close();
  }
});
