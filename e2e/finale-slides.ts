import { type Page, expect } from "@playwright/test";

/** The slideshow's stage: the slide on screen. */
export const finaleStage = (page: Page) =>
  page.locator("[data-finale-slide-index]");

/** Opens `/xi/finale` and waits until the slideshow takes keys. */
export async function openFinale(page: Page, path = "/xi/finale") {
  await page.goto(path);
  await expect(page.locator("[data-finale-hydrated]")).toBeAttached();
}

/**
 * Presses → until the Standings countdown slide is on screen, and returns
 * the kinds of the slides passed on the way (the first slide included).
 */
export async function nextUntilStandings(page: Page): Promise<string[]> {
  const stage = finaleStage(page);
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const kind = await stage.getAttribute("data-finale-slide");
    if (kind === "standings") return seen;
    seen.push(kind ?? "");
    const index = Number(await stage.getAttribute("data-finale-slide-index"));
    await page.keyboard.press("ArrowRight");
    await expect(stage).toHaveAttribute(
      "data-finale-slide-index",
      String(index + 1),
    );
  }
  throw new Error(`No Standings countdown slide after ${seen.join(", ")}`);
}
