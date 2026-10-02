import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { runQuery, withParticipantEmail } from "./db";
import { asOrganizer } from "./session";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

/** A test-only roster email; never a real employee's. */
const IMPORT_EMAIL = "e2e-r11-import@jahnelgroup.com";
const EXISTING = "Ian Ballard";

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe("67 import the roster from a spreadsheet", () => {
  test("paste three rows, preview 2 Add and 1 Update, import, and the roster shows them", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const run = Date.now().toString(36);
    const added = [`R11 Import ${run} A`, `R11 Import ${run} B`];
    const [before] = await runQuery<{ company_tag: string | null }>(
      `select p.company_tag from participant p join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name = $1`,
      [EXISTING],
    );
    expect(before, `XI has a Participant named ${EXISTING}`).toBeTruthy();

    try {
      await withParticipantEmail("xi", EXISTING, IMPORT_EMAIL, async () => {
        await asOrganizer(context);
        await page.setViewportSize(DESKTOP);
        await page.goto("/admin/roster");

        await page.getByRole("button", { name: "Import", exact: true }).click();
        const sheet = page.getByRole("dialog", { name: "Import Participants" });
        // Cells as copied from Google Sheets: tab-separated, no header.
        await sheet
          .getByLabel("Paste from Google Sheets")
          .fill(
            [
              `${added[0]}\t\tRed\t`,
              `${added[1]}\t\tBlue\t`,
              `${EXISTING}\t${IMPORT_EMAIL.toUpperCase()}\tBlue\tR11`,
            ].join("\n"),
          );
        await sheet.getByRole("button", { name: "Preview" }).click();
        await expect(sheet.getByRole("status")).toHaveText(
          "2 to add, 1 to update, 0 errors",
        );
        const table = sheet.getByRole("table", { name: "Import preview" });
        await expect(table).toBeVisible();
        await expect(
          table.getByRole("row").filter({ hasText: EXISTING }),
        ).toContainText("Company Tag: none → R11");
        await shoot(page, testInfo, "1440");

        await page.setViewportSize(PHONE);
        const cards = sheet.getByRole("list", { name: "Import preview" });
        await expect(cards).toBeVisible();
        // One card per row (an Update's changes are a list of their own).
        await expect(cards.locator(":scope > li")).toHaveCount(3);
        await shoot(page, testInfo, "390");

        await sheet
          .getByRole("button", { name: "Import", exact: true })
          .click();
        await expect(
          page.getByText("Imported 2 new, updated 1."),
        ).toBeVisible();
        await expect(sheet).toBeHidden();

        const roster = page.getByRole("list", { name: "Roster" });
        for (const name of added) {
          await expect(
            roster.getByRole("listitem").filter({ hasText: name }),
          ).toBeVisible();
        }
        await expect(
          roster.getByRole("listitem").filter({ hasText: EXISTING }),
        ).toContainText("R11");
      });
    } finally {
      await runQuery(
        `delete from participant p using war_week w
         where w.id = p.war_week_id and w.edition = 'xi'
           and p.display_name = any($1)`,
        [added],
      );
      await runQuery(
        `update participant p set company_tag = $1 from war_week w
         where w.id = p.war_week_id and w.edition = 'xi' and p.display_name = $2`,
        [before?.company_tag ?? null, EXISTING],
      );
    }
  });
});
