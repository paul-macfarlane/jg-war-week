import { expect, test } from "@playwright/test";

import { openCompetitionPage, setFormat } from "./competition-page";
import { openForBracket, xiCompetitionId } from "./db";
import { asOrganizer } from "./session";

// Epic R15, ticket 87 (.scratch/regression-2026-10/issues/87-solid-primary-buttons.md):
// an unrecorded Match's Record result is a solid primary button, and a tap
// anywhere on the Match card opens its result. Winning the Day Challenge is
// an individual War Week XI Competition no other spec runs as a Bracket; its
// Bracket is built here and removed in `finally`.
const COMPETITION = "Winning the Day Challenge";
const ENTRANTS = [
  "Albert Hernandez",
  "Alex Nikolis",
  "Andrew Bushey",
  "Austin Gage",
];

test("r15 87 the admin Bracket's unrecorded Match has a solid Record result button, and the whole card is one tap target", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);
  const restore = await openForBracket(id);

  try {
    await openCompetitionPage(page, id);
    await setFormat(page, "Bracket");

    const find = page.locator("#bracket-entrants");
    for (const entrant of ENTRANTS) {
      await find.fill(entrant);
      await page
        .getByRole("option", { name: new RegExp(`^${entrant}`) })
        .click();
    }
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    await openCompetitionPage(page, id);
    // In the admin Bracket's tree (100), the one Participants see.
    const record = page
      .locator("[data-bracket-tree]")
      .getByRole("button", { name: /^Record result/ })
      .first();
    await expect(record).toBeVisible();
    await expect(record).toHaveClass(/\bbg-primary\b/);
    const background = await record.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(background).not.toBe("rgba(0, 0, 0, 0)");
    expect(background).not.toBe("transparent");

    await page.screenshot({
      path: testInfo.outputPath("admin-bracket-record-result.png"),
      fullPage: true,
    });

    // A click on the Match box's content, away from its button, opens the
    // Match result: the button's ::after stretches over the whole box. The
    // box is the innermost group named for the Match (inside its Round's).
    const match = (await record.getAttribute("aria-label"))!.replace(
      /^Record result for /,
      "",
    );
    const card = page
      .locator("[data-bracket-tree]")
      .getByRole("group", { name: match, exact: true })
      .last();
    await card.click({ position: { x: 12, y: 40 } });
    await expect(page.getByRole("dialog", { name: match })).toBeVisible();
  } finally {
    await restore();
  }
});
