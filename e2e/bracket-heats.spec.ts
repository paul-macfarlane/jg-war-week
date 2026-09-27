import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Settlers of Catan is an individual War Week XI Competition with Placement
// Points 5 / 3 / 1. None of these eight has a hand-entered Catan Points
// Entry (Anthony Conway does; he's excluded).
const COMPETITION = "Settlers of Catan";
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

/** Checks no horizontal overflow at 375/768/1280, screenshotting 375/1280. */
async function checkViewports(page: Page, testInfo: TestInfo, name: string) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoHorizontalOverflow(page);
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
  await page.getByRole("button", { name: `Record ${heat}` }).click();
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

test("a Heats Bracket is built, run and finalized into Points Entries", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);

  await page.goto(`/admin/setup/competitions/${id}/bracket`);
  await page.getByRole("combobox", { name: "Format" }).click();
  await page.getByRole("option", { name: "Heats" }).click();
  await expect(page.getByText("Format set to Heats")).toBeVisible();

  await page.getByRole("combobox", { name: "Entrants per Heat" }).click();
  await page.getByRole("option", { name: "4 per Heat" }).click();
  await page.getByRole("combobox", { name: "How many advance" }).click();
  await page.getByRole("option", { name: "Top 2 advance" }).click();
  await page.getByRole("button", { name: "Save Heat settings" }).click();
  await expect(page.getByText("Heat settings saved")).toBeVisible();

  const find = page.locator("#bracket-entrants");
  for (const entrant of ENTRANTS) {
    await find.fill(entrant);
    await page.getByRole("option", { name: new RegExp(`^${entrant}`) }).click();
  }
  await expect(page.getByText("(8 chosen)")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Save Entrants" }).click();
  await expect(page.getByText("Entrants saved")).toBeVisible();
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();

  const preview = page.getByRole("region", { name: "Preview" });
  await expect(preview.getByText("Round 1 Heat 1")).toBeVisible();
  await expect(preview.getByText("Round 1 Heat 2")).toBeVisible();

  await checkViewports(page, testInfo, "builder");

  await page.getByRole("link", { name: "Run results" }).click();
  await expect(
    page.getByRole("heading", { name: `${COMPETITION} · Results` }),
  ).toBeVisible();

  // Screenshots and the overflow check happen with the Sheet open, on a
  // four-Entrant Heat, before any tap.
  await recordHeat(page, "Round 1 Heat 1", async () => {
    await checkViewports(page, testInfo, "results-sheet");
  });
  await recordHeat(page, "Round 1 Heat 2");
  const finalOrder = await recordHeat(page, "Final");
  const champion = finalOrder[0];
  await expect(page.getByLabel("Champion", { exact: true })).toContainText(
    champion,
  );

  await checkViewports(page, testInfo, "results-final");

  // Before finalizing: End War Week must warn (never refuse), naming this
  // Bracket, then Cancel without ever confirming it (XI stays live).
  await page.goto("/admin/setup");
  await page.getByRole("button", { name: "End War Week" }).click();
  const endDialog = page.getByRole("alertdialog");
  await expect(endDialog).toContainText("Not finalized:");
  await expect(endDialog).toContainText(COMPETITION);
  await endDialog.getByRole("button", { name: "Cancel" }).click();
  await expect(endDialog).toBeHidden();

  await page.goto(`/admin/brackets/${id}`);
  await page.getByRole("button", { name: "Finalize" }).click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Finalize" })
    .click();
  await expect(page.getByText("Bracket finalized")).toBeVisible();

  await page.goto(`/xi/competitions/${id}`);
  const entries = page
    .locator("section")
    .filter({ has: page.getByRole("heading", { name: "Points Entries" }) })
    .getByRole("listitem")
    .filter({ hasText: "From bracket" });
  // Placement Points 5 / 3 / 1: the champion, the runner-up and the Final's
  // third place. The Final's fourth place and the four Round 1
  // non-advancers (tied 5th) get nothing.
  await expect(entries).toHaveCount(3);
  await expect(entries.filter({ hasText: champion })).toHaveText(
    /From bracket\s*5$/,
  );

  await checkViewports(page, testInfo, "participant");
});
