import type { Page } from "@playwright/test";

/** A Team's total in the "Team standings" list on the page. */
export async function teamTotal(page: Page, team: string): Promise<number> {
  const row = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Team standings", exact: true }),
    })
    .getByRole("listitem")
    .filter({ hasText: team });
  const words = (await row.innerText()).trim().split(/\s+/);
  return Number(words[words.length - 1].replace(/,/g, ""));
}
