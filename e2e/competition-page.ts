import { type Page, expect } from "@playwright/test";

/**
 * Driving a Competition's one admin page (`/admin/competitions/<id>`,
 * ticket 101): Settings on top, each field autosaving, and the Format's run
 * area below.
 */

/** The Format names the page's Format select offers. */
export type FormatName =
  "Placement" | "Bracket" | "Head-to-head" | "Best score" | "Participation";

/** The run area's heading for each Format (`runAreaTitle`). */
export const RUN_AREA_TITLE: Record<FormatName, string> = {
  Placement: "Record placements",
  Bracket: "Entrants and Bracket",
  "Head-to-head": "Entrants and Matches",
  "Best score": "Entrants and Attempts",
  Participation: "Who took part",
};

/** Opens the Competition's page and waits for its Settings. */
export async function openCompetitionPage(page: Page, id: string) {
  await page.goto(`/admin/competitions/${id}`);
  await expect(
    page.getByRole("heading", { name: "Settings", exact: true }),
  ).toBeVisible();
}

/** The Settings' "Saving…" / "Saved" line. */
export function autosaveStatus(page: Page) {
  return page.locator('[data-slot="autosave-status"]');
}

/**
 * Waits for every waiting change to save. A change shows "Saving…" at once,
 * so this can't pass on an earlier save's "Saved".
 */
export async function expectSaved(page: Page) {
  await expect(autosaveStatus(page)).toHaveText("Saved");
}

/** Picks `option` in the select labelled `label`. */
export async function chooseOption(page: Page, label: string, option: string) {
  await page.getByRole("combobox", { name: label, exact: true }).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

/**
 * Changes the Format and waits until it saved and the new Format's run
 * area is on the page.
 */
export async function setFormat(page: Page, format: FormatName) {
  await chooseOption(page, "Format", format);
  await expectSaved(page);
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: RUN_AREA_TITLE[format],
      exact: true,
    }),
  ).toBeVisible();
}

/**
 * Adds a War Week Competition from the Competitions list's Add sheet (name,
 * Format, scoring) and waits for its page to open. Returns its id.
 */
export async function addCompetition(
  page: Page,
  {
    name,
    format = "Placement",
    scoring,
  }: { name: string; format?: FormatName; scoring?: string },
): Promise<string> {
  await page.goto("/admin/competitions");
  await page.getByRole("button", { name: "Add Competition" }).click();
  const sheet = page.getByRole("dialog", { name: "Add Competition" });
  const form = sheet.getByRole("form", { name: "New Competition" });
  await form.getByRole("textbox", { name: "Name" }).fill(name);
  if (format !== "Placement") {
    await form.getByRole("combobox", { name: "Format", exact: true }).click();
    await page.getByRole("option", { name: format, exact: true }).click();
  }
  if (scoring) {
    await form.getByRole("combobox", { name: "Scoring", exact: true }).click();
    await page.getByRole("option", { name: scoring, exact: true }).click();
  }
  await form.getByRole("button", { name: "Add Competition" }).click();
  await page.waitForURL(/\/admin\/competitions\/[0-9a-f-]{36}$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return new URL(page.url()).pathname.split("/").at(-1)!;
}
