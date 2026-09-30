import type { Page } from "@playwright/test";

/**
 * A Standings row's visible text: its breakdown trigger also carries
 * screen-reader text, which the Finale's rows don't.
 */
export function visibleRowText(innerText: string): string {
  return innerText.replace(/\s*, show points breakdown\s*$/, "").trim();
}

/** A Team's total in the "Team standings" list on the page. */
export async function teamTotal(page: Page, team: string): Promise<number> {
  const row = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Team standings", exact: true }),
    })
    .getByRole("listitem")
    // The Team's name exactly, so "Blue" never matches "Blue Steel".
    .filter({ has: page.getByText(team, { exact: true }) });
  // The row's last number: its trigger ends in screen-reader text
  // (", show points breakdown") after the total.
  const numbers = (await row.innerText())
    .split(/\s+/)
    .map((word) => word.replace(/,/g, ""))
    .filter((word) => /^-?\d+(\.\d+)?$/.test(word));
  return Number(numbers[numbers.length - 1]);
}
