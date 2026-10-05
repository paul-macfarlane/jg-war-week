import { expect, test } from "@playwright/test";

import { resetXiFinaleSlides } from "./db";
import {
  finaleStage,
  nextUntil,
  openFinale,
  playedSlides,
} from "./finale-slides";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

/**
 * Ticket 73: the built-in Finale slides on the XI demo. The Awards slide
 * reveals one Award per step, always (R22: no Award Categories, no layout
 * setting); the Winner slide shows the leaderboard's first place.
 */

test.beforeAll(resetXiFinaleSlides);
test.afterAll(resetXiFinaleSlides);

test("73: the Awards slide reveals one Award per step", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFinale(page);
  await nextUntil(page, "awards");

  const slide = page.getByRole("region", { name: "Awards", exact: true });
  const awards = slide.getByRole("heading", { level: 3 });
  // Arriving shows none: each Next reveals the next Award, by name.
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
  // No Category headings: only the Awards themselves.
  await expect(slide.getByRole("heading", { level: 2 })).toHaveCount(0);
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
    .getByRole("table", { name: "Team standings", exact: true })
    .locator('tr[data-slot="results-row"]')
    .first()
    .locator('[data-slot="results-name"]')
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

test("73: /admin/finale has no Awards layout control and the Finale plays one Awards slide", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.goto("/admin/finale");
  await expect(
    page.getByRole("heading", { name: "Finale", level: 1 }),
  ).toBeVisible();
  await expect(page.getByRole("group", { name: "Awards layout" })).toHaveCount(
    0,
  );
  await expect(page.getByText("One slide per Category")).toHaveCount(0);
  await expect(page.getByText("All on one slide")).toHaveCount(0);
  await page.screenshot({
    path: testInfo.outputPath("admin-finale-1440x900.png"),
    fullPage: true,
  });

  await page.setViewportSize({ width: 1920, height: 1080 });
  await openFinale(page);
  const played = await playedSlides(page);
  expect(played.filter((name) => name === "Awards")).toHaveLength(1);
  expect(played.some((name) => name.startsWith("Awards:"))).toBe(false);
  expect(played).not.toContain("Other Awards");
});
