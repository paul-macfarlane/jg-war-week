import type { Locator, Page } from "@playwright/test";

/**
 * A results-table row on the page, by the table's accessible name (e.g.
 * "Team standings", "Individual leaderboard") and the row's exact name, so
 * "Blue" never matches "Blue Steel".
 */
export function resultsRow(page: Page, table: string, name: string): Locator {
  return page
    .getByRole("table", { name: table, exact: true })
    .locator('tr[data-slot="results-row"]')
    .filter({
      has: page
        .locator('[data-slot="results-name"]')
        .getByText(name, { exact: true }),
    });
}

/** A results-table row's War Week points, from its points cell (wide viewports). */
export async function rowPoints(row: Locator): Promise<number> {
  const text = await row.locator('[data-slot="results-points"]').innerText();
  return Number(text.replace(/,/g, ""));
}

/** A Team's total in the "Team standings" table on the page. */
export async function teamTotal(page: Page, team: string): Promise<number> {
  return rowPoints(resultsRow(page, "Team standings", team));
}
