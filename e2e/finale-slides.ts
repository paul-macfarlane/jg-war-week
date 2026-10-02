import { type Page, expect } from "@playwright/test";

/**
 * The slideshow's stage: the slide on screen. Only the hydrated stage, so
 * the copy React streams into a hidden `<div hidden id="S:0">` before
 * swapping it in never makes this match two elements.
 */
export const finaleStage = (page: Page) =>
  page.locator("[data-finale-hydrated]");

/** Opens `/xi/finale` and waits until the slideshow takes keys. */
export async function openFinale(page: Page, path = "/xi/finale") {
  await page.goto(path);
  await expect(page.locator("[data-finale-hydrated]")).toBeAttached();
}

/** Where the presenter is: "<slide index>:<step>". */
async function position(page: Page): Promise<string> {
  const stage = finaleStage(page);
  return `${await stage.getAttribute("data-finale-slide-index")}:${await stage.getAttribute("data-finale-step")}`;
}

/**
 * Presses → until the next slide is on screen, finishing the current
 * slide's steps (an Award at a time, the countdown) on the way. Fails on
 * the last slide, where Next does nothing.
 */
export async function nextSlide(page: Page) {
  const stage = finaleStage(page);
  const index = await stage.getAttribute("data-finale-slide-index");
  for (let i = 0; i < 50; i++) {
    const at = await position(page);
    await page.keyboard.press("ArrowRight");
    await expect.poll(() => position(page)).not.toBe(at);
    if ((await stage.getAttribute("data-finale-slide-index")) !== index) {
      return;
    }
  }
  throw new Error(`Slide ${index} never moved on`);
}

/**
 * Presses → until the slide of `kind` is on screen, and returns the kinds
 * of the slides passed on the way (the first slide included).
 */
export async function nextUntil(page: Page, kind: string): Promise<string[]> {
  const stage = finaleStage(page);
  const seen: string[] = [];
  for (let i = 0; i < 20; i++) {
    const current = await stage.getAttribute("data-finale-slide");
    if (current === kind) return seen;
    seen.push(current ?? "");
    await nextSlide(page);
  }
  throw new Error(`No ${kind} slide after ${seen.join(", ")}`);
}

/**
 * Presses → until the Standings countdown slide is on screen, and returns
 * the kinds of the slides passed on the way (the first slide included).
 */
export function nextUntilStandings(page: Page): Promise<string[]> {
  return nextUntil(page, "standings");
}
