import { type Page, type TestInfo, expect, test } from "@playwright/test";

import {
  addCompetition,
  chooseOption,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { deleteXiCompetition } from "./db";
import { asOrganizer } from "./session";

// Epic R21, AC 4 and AC 14 (.scratch/competition-setup/spec.md, decisions 6,
// 7 and 9): an individual Placement Competition this spec adds to demo XI
// (and deletes in `finally`) is set to "lower is better" with the unit
// "sec". Places fill from the Scores, the Score column reads "Score (sec)",
// a tie settled by hand shows "set by hand", and the sheet has neither the
// 5 · 3 · 1 quick fill nor Add everyone.

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** Lower wins: Graham and Sam tie at 1st, Ashley is 3rd. */
const ROWS = [
  { name: "Ashley Schuliger", score: "12.5", place: "3" },
  { name: "Graham Macbeth", score: "9", place: "1" },
  { name: "Sam Schantz", score: "9", place: "1" },
] as const;

/** Screenshots `page` at both viewports as `<step>-<width>.png`. */
async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const { name, width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: testInfo.outputPath(`${step}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const placeOf = (page: Page, who: string) =>
  page.getByRole("textbox", { name: `Place for ${who}` });
const scoreOf = (page: Page, who: string) =>
  page.getByRole("textbox", { name: `Score for ${who}` });

test("r21 AC4 AC14 a lower-is-better Placement in sec fills Places from Scores, shows Score (sec), a tie settled by hand shows set by hand, and has no 5 · 3 · 1 or Add everyone", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const name = `E2E R21 Scoring ${Date.now()}`;
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await addCompetition(page, {
      name,
      format: "Placement",
      scoring: "Individual",
    });

    // Lower is better, in seconds.
    await chooseOption(page, "Score direction", "Lower is better");
    await expectSaved(page);
    await page.getByLabel("Unit").fill("sec");
    await expectSaved(page);

    // The Host adds three by search.
    const search = page.getByRole("combobox", { name: "Add a Participant" });
    for (const row of ROWS) {
      await search.focus();
      await search.fill(row.name);
      await page.getByRole("option", { name: new RegExp(row.name) }).click();
      await expect(page.getByText(`${row.name} added`)).toBeVisible();
      await expect(scoreOf(page, row.name)).toBeVisible();
    }

    const sheet = page.getByRole("region", { name: /^Placements \(\d+\)$/ });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText("Score (sec)", { exact: true })).toBeVisible();

    // Neither the quick fill nor Add everyone exists, on the located sheet
    // and its Settings.
    await expect(
      page.getByRole("button", { name: "Add everyone" }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Fill 5, 3, 1" }),
    ).toHaveCount(0);
    await expect(page.getByRole("button", { name: "5 · 3 · 1" })).toHaveCount(
      0,
    );
    await expect(sheet.getByRole("button", { name: /everyone/i })).toHaveCount(
      0,
    );

    // Places fill from the Scores, lower wins, the tie shared.
    for (const row of ROWS) await scoreOf(page, row.name).fill(row.score);
    for (const row of ROWS) {
      await expect(placeOf(page, row.name)).toHaveValue(row.place);
    }
    // Following the Scores exactly, nothing is set by hand.
    await expect(page.locator('[data-slot="set-by-hand"]')).toHaveCount(0);
    await shoot(page, testInfo, "scores-filled");

    // The Host settles the tie by hand: Sam is 2nd.
    await placeOf(page, "Sam Schantz").fill("2");
    const byHand = page.locator('[data-slot="set-by-hand"]');
    await expect(byHand).toBeVisible();
    await expect(byHand).toContainText("set by hand");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Placements saved")).toBeVisible();
    await shoot(page, testInfo, "tie-set-by-hand");

    // It persists (derived from the saved rows), and so do the settings.
    await openCompetitionPage(page, id);
    await expect(placeOf(page, "Sam Schantz")).toHaveValue("2");
    await expect(page.locator('[data-slot="set-by-hand"]')).toContainText(
      "set by hand",
    );
    await expect(page.getByLabel("Unit")).toHaveValue("sec");
    await expect(
      page.getByRole("combobox", { name: "Score direction", exact: true }),
    ).toContainText("Lower is better");

    // Participants see the same header on the results.
    await page.goto(`/xi/competitions/${id}`);
    await expect(
      page.getByRole("columnheader", { name: /Score \(sec\)/ }),
    ).toBeVisible();
    await shoot(page, testInfo, "participant-results");
  } finally {
    await deleteXiCompetition(name);
  }
});
