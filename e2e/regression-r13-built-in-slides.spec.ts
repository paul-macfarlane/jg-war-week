import { type Page, expect, test } from "@playwright/test";

import { resetXiFinaleSlides, runQuery, xiCompetitionId } from "./db";
import { finaleStage, nextSlide, nextUntil, openFinale } from "./finale-slides";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  asOrganizer,
  signIn,
} from "./session";

/**
 * Ticket 73: the built-in Finale slides on the XI demo. The Awards slide
 * reveals one Award per step, grouped by Award Category; the per-Category
 * layout, set in admin → Finale, plays one Awards slide per Category; the
 * Winner slide shows the leaderboard's first place.
 */

test.beforeAll(resetXiFinaleSlides);
test.afterAll(resetXiFinaleSlides);

/** The slide on screen: its `<section aria-label>`. */
const currentSlide = (page: Page) =>
  finaleStage(page).locator(":scope > section");

/**
 * Every slide's name the Finale plays, in order: → until the end, where
 * Next does nothing.
 */
async function playedSlides(page: Page): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < 20; i++) {
    names.push((await currentSlide(page).getAttribute("aria-label")) ?? "");
    const moved = await nextSlide(page).then(
      () => true,
      () => false,
    );
    if (!moved) return names;
  }
  return names;
}

test("73: the Awards slide reveals one Award per step, grouped by Category", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFinale(page);
  await nextUntil(page, "awards");

  const slide = page.getByRole("region", { name: "Awards", exact: true });
  const awards = slide.getByRole("heading", { level: 3 });
  // Arriving shows none: each Next reveals the next Award, by Category
  // (Categories by name, the uncategorized last), by name within one.
  await expect(awards).toHaveCount(0);
  const expected = ["Black Midnight", "Catan Champion", "Terrordome Champion"];
  for (const [i, name] of expected.entries()) {
    await page.keyboard.press("ArrowRight");
    await expect(awards).toHaveCount(i + 1);
    await expect(awards.nth(i)).toHaveText(name);
    await expect(finaleStage(page)).toHaveAttribute(
      "data-finale-slide",
      "awards",
    );
  }
  await expect(
    slide.getByRole("heading", { level: 2, name: "Black Midnight" }),
  ).toBeVisible();
  await expect(
    slide.getByRole("heading", { level: 2, name: "Other Awards" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("awards-1920x1080.png") });

  // Every Award shown: Next moves on; Back returns with every Award shown.
  await page.keyboard.press("ArrowRight");
  await expect(finaleStage(page)).not.toHaveAttribute(
    "data-finale-slide",
    "awards",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(awards).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("awards-390x844.png") });
});

test("73: the Winner slide shows the leaderboard's first place", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await page.goto("/xi/leaderboard");
  const leader = await page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Team standings", exact: true }),
    })
    .getByRole("listitem")
    .first()
    .locator("span.flex-1")
    .innerText();
  expect(leader.trim()).not.toBe("");

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFinale(page);
  await nextUntil(page, "winner");
  const winner = page.getByRole("region", { name: "Winner" });
  await expect(winner.getByRole("heading", { level: 1 })).toContainText(
    leader.trim(),
  );
  await page.screenshot({ path: testInfo.outputPath("winner-1920x1080.png") });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: testInfo.outputPath("winner-390x844.png") });
});

test("73: the per-Category Awards layout, set in admin → Finale, plays one Awards slide per Category", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.goto("/admin/finale");
  const layout = page.getByRole("group", { name: "Awards layout" });
  const oneSlide = layout.getByRole("button", { name: "All on one slide" });
  const perCategory = layout.getByRole("button", {
    name: "One slide per Category",
  });
  await expect(oneSlide).toHaveAttribute("aria-pressed", "true");
  // The choice saves through a server action (a POST); wait for it.
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === "/admin/finale",
  );
  await perCategory.click();
  await expect(perCategory).toHaveAttribute("aria-pressed", "true");
  await saved;
  // Saved: it's still the choice after a reload.
  await page.reload();
  await expect(perCategory).toHaveAttribute("aria-pressed", "true");
  await page.screenshot({
    path: testInfo.outputPath("admin-awards-layout-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFinale(page);
  const played = await playedSlides(page);
  const at = played.indexOf("Awards: Black Midnight");
  expect(at, played.join(", ")).toBeGreaterThan(-1);
  expect(played.slice(at, at + 2)).toEqual([
    "Awards: Black Midnight",
    "Other Awards",
  ]);
  expect(played).not.toContain("Awards");

  // The Category's slide reveals its Awards one at a time too.
  await page.keyboard.press("Escape");
  await nextUntil(page, "awards");
  const slide = page.getByRole("region", { name: "Awards: Black Midnight" });
  await expect(slide.getByRole("heading", { level: 1 })).toHaveText(
    "Black Midnight",
  );
  await expect(slide.getByRole("heading", { level: 3 })).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(slide.getByRole("heading", { level: 3 })).toHaveText([
    "Black Midnight",
  ]);
  await page.screenshot({
    path: testInfo.outputPath("awards-per-category-1920x1080.png"),
  });

  // A Host sees the choice but can't change it.
  const pool = await xiCompetitionId("Pool");
  await runQuery(
    `insert into competition_host (competition_id, email) values ($1, $2)
     on conflict do nothing`,
    [pool, E2E_HOST_EMAIL],
  );
  try {
    await context.clearCookies();
    await asHost(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/finale");
    const hostLayout = page.getByRole("group", { name: "Awards layout" });
    await expect(
      hostLayout.getByRole("button", { name: "One slide per Category" }),
    ).toBeDisabled();
    await expect(
      hostLayout.getByRole("button", { name: "All on one slide" }),
    ).toBeDisabled();
  } finally {
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [pool, E2E_HOST_EMAIL],
    );
  }
});
