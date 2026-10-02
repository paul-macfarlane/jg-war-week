import {
  type Browser,
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { xiCompetitionId } from "./db";
import { E2E_BASE_URL } from "./env";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

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
const HEATS = "Super Smash Bros";
const HEATS_ENTRANTS = [
  "Bob Strubel",
  "Brandon Thivierge",
  "Cameron Lynch",
  "Casey Snow",
  "Chara Meidani",
  "Charles Clarke",
  "Chelsea Merrill",
  "Chris Pence",
];

const DESKTOP = { width: 1280, height: 900 };
const PHONE = { width: 375, height: 800 };

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

/** Records a two-Entrant Heat on the results screen, its first-listed winning. */
async function recordWinner(page: Page, heat: string, entrants: string[]) {
  await page.getByRole("button", { name: `Record ${heat}` }).click();
  const form = page.getByRole("dialog", { name: heat });
  const winner = form
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  const name = entrantIn(await winner.innerText(), entrants);
  await winner.click();
  await form.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
  await expect(form).toBeHidden();
}

/** Records a Heat of more than two by tapping its Entrants in listed order. */
async function recordOrder(page: Page, heat: string, entrants: string[]) {
  await page.getByRole("button", { name: `Record ${heat}` }).click();
  const form = page.getByRole("dialog", { name: heat });
  const buttons = form
    .getByRole("group", { name: "Finishing order" })
    .getByRole("button");
  const first = entrantIn(await buttons.first().innerText(), entrants);
  const count = await buttons.count();
  for (let i = 0; i < count; i++) await buttons.nth(i).click();
  await form.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${first} wins ${heat}`)).toBeVisible();
  await expect(form).toBeHidden();
}

async function finalize(page: Page, action: "Finalize" | "Un-finalize") {
  await page.getByRole("button", { name: action }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: action })
    .click();
  await expect(
    page.getByText(
      action === "Finalize" ? "Bracket finalized" : "Bracket un-finalized",
    ),
  ).toBeVisible();
}

/**
 * 07: at 1280 the Heat Result opens as a centered Dialog; at 375 as the
 * bottom Sheet. Closes it each time without saving.
 */
async function checkResultPopup(page: Page, testInfo: TestInfo, heat: string) {
  await page.setViewportSize(DESKTOP);
  await page.getByRole("button", { name: `Record ${heat}` }).click();
  const dialog = page.getByRole("dialog", { name: heat });
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
    path: testInfo.outputPath("result-dialog-1280.png"),
    animations: "disabled",
  });
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await page.setViewportSize(PHONE);
  await page.getByRole("button", { name: `Record ${heat}` }).click();
  const sheet = page.getByRole("dialog", { name: heat });
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
    path: testInfo.outputPath("result-sheet-375.png"),
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
 * The Bracket's tree. Scoped by role, so a streamed page's hidden copy
 * (before React swaps it in) never counts.
 */
function treeOf(page: Page): Locator {
  return page
    .getByRole("region", { name: "Bracket" })
    .locator("[data-bracket-tree]");
}

function roundColumn(page: Page, name: string): Locator {
  return treeOf(page).getByRole("group", { name, exact: true }).first();
}

/**
 * The tree at 1280 (every Round column) and at 375 (one Round, behind
 * Round tabs, `phoneRound` first; no horizontal page scroll), screenshotted
 * as `<name>-1280.png` and `<name>-375.png`.
 */
async function checkTree(
  page: Page,
  testInfo: TestInfo,
  name: string,
  rounds: string[],
  phoneRound: string,
) {
  await page.setViewportSize(DESKTOP);
  await expect(treeOf(page)).toBeVisible();
  for (const round of rounds) {
    await expect(roundColumn(page, round)).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath(`${name}-1280.png`),
    fullPage: true,
    animations: "disabled",
  });

  await page.setViewportSize(PHONE);
  const tabs = page.getByRole("tablist", { name: "Rounds" });
  await expect(tabs).toBeVisible();
  await expect(
    tabs.getByRole("tab", { name: phoneRound, exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  for (const round of rounds) {
    if (round === phoneRound) {
      await expect(roundColumn(page, round)).toBeVisible();
    } else {
      await expect(roundColumn(page, round)).toBeHidden();
    }
  }
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
  await page.screenshot({
    path: testInfo.outputPath(`${name}-375.png`),
    fullPage: true,
    animations: "disabled",
  });

  // Another Round's tab shows that Round instead.
  const other = rounds.find((round) => round !== phoneRound)!;
  await tabs.getByRole("tab", { name: other, exact: true }).click();
  await expect(roundColumn(page, other)).toBeVisible();
  await expect(roundColumn(page, phoneRound)).toBeHidden();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
  await page.setViewportSize(DESKTOP);
}

/** The List toggle swaps the tree for today's list of Heats by Round. */
async function checkListToggle(page: Page, rounds: string[]) {
  const bracket = page.getByRole("region", { name: "Bracket" });
  await bracket.getByRole("tab", { name: "List" }).click();
  await expect(treeOf(page)).toHaveCount(0);
  for (const round of rounds) {
    await expect(
      bracket.getByRole("region", { name: round, exact: true }),
    ).toBeVisible();
  }
  await bracket.getByRole("tab", { name: "Tree" }).click();
  await expect(treeOf(page)).toBeVisible();
}

test("a single-elimination Bracket shows as a tree, and a result records in a Dialog on large screens", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(KNOCKOUT);
  const rounds = ["Round 1", "Semifinal", "Final"];

  await page.goto(`/admin/competitions/${id}/bracket`);
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Single elimination" }).click();
  await expect(
    page.getByText("Format set to Single elimination"),
  ).toBeVisible();
  // Five Entrants: three first-Round byes.
  await enterAndGenerate(page, KNOCKOUT_ENTRANTS);

  await page.goto(`/admin/brackets/${id}`);
  await checkResultPopup(page, testInfo, "Round 1 Heat 2");

  // Mid-way: Round 1 and Semifinal 2 decided, Semifinal 1 and the Final not.
  await recordWinner(page, "Round 1 Heat 2", KNOCKOUT_ENTRANTS);
  await recordWinner(page, "Semifinal 2", KNOCKOUT_ENTRANTS);

  const viewer = await participantPage(browser, id);
  await checkTree(
    viewer.page,
    testInfo,
    "knockout-midway",
    rounds,
    "Semifinal",
  );
  await checkListToggle(viewer.page, rounds);

  await recordWinner(page, "Semifinal 1", KNOCKOUT_ENTRANTS);
  await recordWinner(page, "Final", KNOCKOUT_ENTRANTS);
  await finalize(page, "Finalize");

  await viewer.page.reload();
  await checkTree(viewer.page, testInfo, "knockout-finalized", rounds, "Final");
  await viewer.context.close();

  // Leave the Standings the later flows read as they were.
  await finalize(page, "Un-finalize");
});

test("a Heats Bracket shows as a tree of Heat boxes, advancers highlighted", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(HEATS);
  const rounds = ["Round 1", "Final"];

  await page.goto(`/admin/competitions/${id}/bracket`);
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Heats" }).click();
  await expect(page.getByText("Format set to Heats")).toBeVisible();
  await page.getByRole("combobox", { name: "Entrants per Heat" }).click();
  await page.getByRole("option", { name: "4 per Heat" }).click();
  await page.getByRole("combobox", { name: "How many advance" }).click();
  await page.getByRole("option", { name: "Top 2 advance" }).click();
  await page.getByRole("button", { name: "Save Heat settings" }).click();
  await expect(page.getByText("Heat settings saved")).toBeVisible();
  await enterAndGenerate(page, HEATS_ENTRANTS);

  await page.goto(`/admin/brackets/${id}`);
  await checkResultPopup(page, testInfo, "Round 1 Heat 1");

  // Mid-way: Heat 1 decided, its top two highlighted; Heat 2 to play.
  await recordOrder(page, "Round 1 Heat 1", HEATS_ENTRANTS);

  const viewer = await participantPage(browser, id);
  const heat1 = treeOf(viewer.page).getByRole("group", {
    name: "Round 1 Heat 1",
  });
  await expect(heat1.locator("[data-advances]")).toHaveCount(2);
  await checkTree(viewer.page, testInfo, "heats-midway", rounds, "Round 1");
  await checkListToggle(viewer.page, rounds);

  await recordOrder(page, "Round 1 Heat 2", HEATS_ENTRANTS);
  await recordOrder(page, "Final", HEATS_ENTRANTS);
  await finalize(page, "Finalize");

  await viewer.page.reload();
  const final = treeOf(viewer.page)
    .getByRole("group", { name: "Final", exact: true })
    .last();
  // In the Final only the winner is highlighted.
  await expect(final.locator("[data-advances]")).toHaveCount(1);
  await checkTree(viewer.page, testInfo, "heats-finalized", rounds, "Final");
  await viewer.context.close();

  await finalize(page, "Un-finalize");
});
