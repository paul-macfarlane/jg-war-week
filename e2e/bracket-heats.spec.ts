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
import { asOrganizer, participantPageAs } from "./session";

// Settlers of Catan is an individual War Week XI Competition with Placement
// Points 5 / 3 / 1. None of these eight is on the seeded Catan sheet (it
// places only a Team).
const COMPETITION = "Settlers of Catan";

// The seeded Competitions are Finalized Placement sheets; open each for a
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
 * Records the Heat named `heat` by tapping every Entrant in the order the
 * Sheet lists them (a finishing-order Heat of more than two Entrants), and
 * returns the names in tap order. `onOpen` runs with the Sheet open, before
 * any tap.
 */
async function recordHeat(
  page: Page,
  heat: string,
  onOpen?: (sheet: Locator) => Promise<void>,
): Promise<string[]> {
  // From the admin Bracket's tree, the one Participants see.
  await page
    .locator("[data-bracket-tree]")
    .getByRole("button", { name: `Record result for ${heat}` })
    .click();
  const sheet = page.getByRole("dialog", { name: heat });
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
  await sheet.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${order[0]} wins ${heat}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return order;
}

test("a Bracket of 4 per Heat is built, run and finalized into Points Entries", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);

  await openCompetitionPage(page, id);
  await setFormat(page, "Bracket");

  await page.getByRole("combobox", { name: "Entrants per Heat" }).click();
  await page.getByRole("option", { name: "4 per Heat" }).click();
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
  await expect(preview.getByText("Round 1 Heat 1")).toBeVisible();
  await expect(preview.getByText("Round 1 Heat 2")).toBeVisible();

  await checkViewports(page, testInfo, "builder");

  // The Bracket tree is on the same page, below the Entrants.
  await expect(page.locator("[data-bracket-tree]")).toBeVisible();

  // Screenshots and the overflow check happen with the Sheet open, on a
  // four-Entrant Heat, before any tap.
  const heat1 = await recordHeat(page, "Round 1 Heat 1", async (sheet) => {
    await checkViewports(page, testInfo, "results-sheet", sheet);
  });

  // Heat 1's winner, as "You", has advanced while Heat 2 is still to play.
  const advancer = heat1[0];
  const you = await participantPageAs(browser, advancer);
  await you.page.goto(`/xi/competitions/${id}`);
  // Visible only: while a reload streams, React holds the new page in a
  // hidden container before swapping it in, and getByLabel counts it.
  const nextHeat = you.page
    .getByLabel("Your next Heat")
    .filter({ visible: true });
  await expect(nextHeat).toContainText(
    "Advanced to Round 2 · waiting for Round 1 to finish",
  );
  await checkViewports(you.page, testInfo, "participant-advanced");

  const heat2 = await recordHeat(page, "Round 1 Heat 2");

  // The Final is filled: their next Heat lists the three others in it.
  await you.page.reload();
  await expect(nextHeat).toContainText("Your next Heat · Final");
  for (const opponent of [heat1[1], heat2[0], heat2[1]]) {
    await expect(nextHeat).toContainText(opponent);
  }
  await you.close();

  const finalOrder = await recordHeat(page, "Final");
  const champion = finalOrder[0];
  await expect(page.getByLabel("Champion", { exact: true })).toContainText(
    champion,
  );
  // Every played Heat says when it was recorded.
  await expect(page.getByText(/^Recorded .+ ET$/)).toHaveCount(3);

  await checkViewports(page, testInfo, "results-final");

  // Before finalizing: End War Week must warn (never refuse), naming this
  // Bracket, then Cancel without ever confirming it (XI stays live).
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "End War Week" }).click();
  const endDialog = page.getByRole("alertdialog");
  await expect(endDialog).toContainText("Not finalized:");
  await expect(endDialog).toContainText(COMPETITION);
  await endDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(endDialog).toBeHidden();

  await openCompetitionPage(page, id);
  await page.getByRole("button", { name: "Finalize" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Finalize" })
    .click();
  await expect(page.getByText("Bracket finalized")).toBeVisible();

  await page.goto(`/xi/competitions/${id}`);
  await expect(
    page.getByRole("heading", { name: "Points Entries" }),
  ).toHaveCount(0);
  const entries = (await xiCompetitionEntries(COMPETITION)).filter(
    (entry) => entry.generated,
  );
  // Placement Points 5 / 3 / 1: the champion, the runner-up and the Final's
  // third place. The Final's fourth place gets nothing, and nobody outside
  // the Final is placed.
  expect(entries).toHaveLength(3);
  expect(entries.find((entry) => entry.target === champion)?.points).toBe(5);

  await checkViewports(page, testInfo, "participant");
});
