import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import {
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import { openForBracket, xiCompetitionEntries, xiCompetitionId } from "./db";
import { axePodium, expectPodium, shootPodium } from "./podium";
import { asOrganizer, participantPageAs } from "./session";

// Settlers of Catan is an individual War Week XI Competition with Placement
// Points 5 / 3 / 1. None of these eight is on the seeded Catan sheet (it
// places only a Team).
const COMPETITION = "Settlers of Catan";

// The seeded Competitions are Closed Placement sheets; open each for a
// Bracket and put the sheet back afterwards.
let restoreCompetition: (() => Promise<void>) | null = null;
test.beforeEach(async () => {
  restoreCompetition = await openForBracket(await xiCompetitionId(COMPETITION));
});
test.afterEach(async () => {
  await restoreCompetition?.();
  restoreCompetition = null;
});
const ENTRANTS = [
  "Albert Hernandez",
  "Alex Nikolis",
  "Andrew Bushey",
  "Austin Gage",
  "Awad Khawaja",
  "Ben Sadick",
  "Brian France",
  "Bryan Sambrook",
];

const VIEWPORT_WIDTHS = [375, 768, 1280] as const;
/** Only these widths get a screenshot; 768 is checked for overflow only. */
const SCREENSHOT_WIDTHS: readonly number[] = [375, 1280];

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

/**
 * Checks no horizontal overflow at 375/768/1280 (of the page, and of
 * `dialog` when one is open), screenshotting 375/1280.
 */
async function checkViewports(
  page: Page,
  testInfo: TestInfo,
  name: string,
  dialog?: Locator,
) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoHorizontalOverflow(page);
    if (dialog) {
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    if (SCREENSHOT_WIDTHS.includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/**
 * Records the Match named `match` by tapping every Entrant in the order the
 * Sheet lists them (a finishing-order Match of more than two Entrants), and
 * returns the names in tap order. `onOpen` runs with the Sheet open, before
 * any tap.
 */
async function recordMatch(
  page: Page,
  match: string,
  onOpen?: (sheet: Locator) => Promise<void>,
): Promise<string[]> {
  // From the admin Bracket's tree, the one Participants see.
  await page
    .locator("[data-bracket-tree]")
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const sheet = page.getByRole("dialog", { name: match });
  await expect(sheet).toBeVisible();
  if (onOpen) await onOpen(sheet);
  const buttons = sheet
    .getByRole("group", { name: "Finishing order" })
    .getByRole("button");
  const count = await buttons.count();
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    // The button also shows the Avatar's initials; keep the Entrant's name.
    const text = await button.innerText();
    const name = ENTRANTS.find((entrant) => text.includes(entrant));
    if (!name) throw new Error(`No Entrant named in "${text}"`);
    order.push(name);
    await button.click();
  }
  await sheet.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${order[0]} wins ${match}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return order;
}

test("a Bracket of 4 per Match is built, run and Closed into Points Entries, its podium the final Match's order", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);

  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");

  // A Group (spec R21, decision 10) shows its Match size fields.
  await page.getByRole("button", { name: "Group", exact: true }).click();
  await expectSaved(page);
  await page.getByRole("combobox", { name: "Entrants per Match" }).click();
  await page.getByRole("option", { name: "4 per Match" }).click();
  await page.getByRole("combobox", { name: "How many advance" }).click();
  await page.getByRole("option", { name: "Top 2 advance" }).click();
  await expectSaved(page);

  const find = page.locator("#bracket-entrants");
  for (const entrant of ENTRANTS) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await expect(page.getByText("(8 chosen)")).toBeVisible();
  await page.keyboard.press("Escape");
  // A list still open would widen the page in the overflow checks below.
  await expect(page.getByRole("listbox")).toBeHidden();
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();

  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByText("Round 1 Match 1")).toBeVisible();
  await expect(preview.getByText("Round 1 Match 2")).toBeVisible();

  await checkViewports(page, testInfo, "builder");

  // The Bracket tree is on the same page, below the Entrants.
  await expect(page.locator("[data-bracket-tree]")).toBeVisible();

  // Screenshots and the overflow check happen with the Sheet open, on a
  // four-Entrant Match, before any tap.
  const match1 = await recordMatch(page, "Round 1 Match 1", async (sheet) => {
    await checkViewports(page, testInfo, "results-sheet", sheet);
  });

  // Match 1's winner, as "You", has advanced while Match 2 is still to play.
  const advancer = match1[0];
  const you = await participantPageAs(browser, advancer);
  await you.page.goto(`/xi/competitions/${id}`);
  // Visible only: while a reload streams, React holds the new page in a
  // hidden container before swapping it in, and getByLabel counts it.
  const nextMatch = you.page
    .getByLabel("Your next Match")
    .filter({ visible: true });
  await expect(nextMatch).toContainText(
    "Advanced to Round 2 · waiting for Round 1 to finish",
  );
  await checkViewports(you.page, testInfo, "participant-advanced");

  const match2 = await recordMatch(page, "Round 1 Match 2");

  // The Final is filled: their next Match lists the three others in it.
  await you.page.reload();
  await expect(nextMatch).toContainText("Your next Match · Final");
  for (const opponent of [match1[1], match2[0], match2[1]]) {
    await expect(nextMatch).toContainText(opponent);
  }
  await you.close();

  const finalOrder = await recordMatch(page, "Final");
  const winner = finalOrder[0];
  // A Group final: Top finishers is the final Match's order, each place
  // with its Provisional points (5 / 3 / 1; 4th earns none).
  const podium = finalOrder.map((name, i) => ({
    place: ["1st", "2nd", "3rd", "4th"][i],
    name,
    points: ["5 points", "3 points", "1 point", "No points"][i],
  }));
  expect(podium).toHaveLength(4);
  await expectPodium(page, podium);
  // Every played Match says when it was recorded.
  await expect(page.getByText(/^Recorded .+ ET$/)).toHaveCount(3);

  await checkViewports(page, testInfo, "results-final");

  // Before closing: End War Week must warn (never refuse), naming this
  // Bracket, then Cancel without ever confirming it (XI stays live).
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "End War Week" }).click();
  const endDialog = page.getByRole("alertdialog");
  await expect(endDialog).toContainText("Not closed:");
  await expect(endDialog).toContainText(COMPETITION);
  await endDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(endDialog).toBeHidden();

  await openCompetitionPage(page, id);
  await page
    .getByRole("region", { name: "Bracket", exact: true })
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Close", exact: true })
    .click();
  await expect(page.getByText("Bracket closed")).toBeVisible();

  await page.goto(`/xi/competitions/${id}`);
  await expect(
    page.getByRole("heading", { name: "Points Entries" }),
  ).toHaveCount(0);
  const entries = (await xiCompetitionEntries(COMPETITION)).filter(
    (entry) => entry.generated,
  );
  // Placement Points 5 / 3 / 1: the Winner, the runner-up and the Final's
  // third place. The Final's fourth place gets nothing, and nobody outside
  // the Final is placed.
  expect(entries).toHaveLength(3);
  expect(entries.find((entry) => entry.target === winner)?.points).toBe(5);
  // Closed: the same order, its points now the Points Entries Close wrote.
  await expectPodium(page, podium);
  await expect(
    page
      .getByRole("region", { name: "Top finishers" })
      .getByRole("button", { name: "Provisional" }),
  ).toHaveCount(0);
  await shootPodium(page, testInfo, "podium-group-final");
  await axePodium(page, testInfo, "podium-group-final-axe");

  await checkViewports(page, testInfo, "participant");
});
