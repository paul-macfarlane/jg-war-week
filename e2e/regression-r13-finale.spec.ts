import { expect, test } from "@playwright/test";

import { resetXiFinaleSlides } from "./db";
import {
  finaleStage,
  listed,
  nextSlide,
  openFinale,
  slideList,
} from "./finale-slides";
import { asOrganizer } from "./session";

/**
 * Ticket 72 (72-AC2): an Organizer reorders the Finale's slides (drag, and
 * the arrows) and hides one in admin → Finale; the Finale then plays them in
 * that order, without the hidden one.
 */

test.beforeAll(resetXiFinaleSlides);
test.afterAll(resetXiFinaleSlides);

test("72-AC2: an Organizer moves the Standings slide and hides one, and the Finale plays in that order", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/admin/finale");

  await expect
    .poll(() => listed(page))
    .toEqual([
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      "Standings countdown",
      "Winner",
    ]);

  // Drag the Standings countdown onto the Title row: it goes first.
  const row = (name: string) =>
    slideList(page).getByRole("listitem").filter({ hasText: name });
  await row("Standings countdown").dragTo(row("Title"));
  await expect
    .poll(() => listed(page))
    .toEqual([
      "Standings countdown",
      "Title",
      "By the numbers",
      "Awards",
      "Champions",
      "Winner",
    ]);

  // The keyboard way: Winner up one place.
  await page.getByRole("button", { name: 'Move "Winner" up' }).click();
  await expect
    .poll(() => listed(page))
    .toEqual([
      "Standings countdown",
      "Title",
      "By the numbers",
      "Awards",
      "Winner",
      "Champions",
    ]);

  await page.getByRole("button", { name: 'Hide "By the numbers"' }).click();
  await expect
    .poll(() => listed(page))
    .toEqual([
      "Standings countdown",
      "Title",
      "By the numbers (hidden)",
      "Awards",
      "Winner",
      "Champions",
    ]);
  await expect(
    page.getByRole("button", { name: 'Show "By the numbers"' }),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("admin-finale-1440x900.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: testInfo.outputPath("admin-finale-390x844.png"),
    fullPage: true,
  });

  // The Finale plays that order: the Standings countdown first, playing
  // on arrival; Next finishes it, then each Next is the next slide.
  await page.setViewportSize({ width: 1440, height: 900 });
  await openFinale(page);
  const stage = finaleStage(page);
  await expect(stage).toHaveAttribute("data-finale-slide", "standings");
  await expect(page.locator("[data-finale]")).not.toHaveAttribute(
    "data-finale",
    "ready",
  );
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
    timeout: 20_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("finale-standings-1440x900.png"),
  });

  // Champions (last in this order) shows only once something on XI is
  // finalized (another spec may have finalized a Bracket); otherwise the
  // Finale skips it (ticket 73).
  const played: string[] = ["standings"];
  while ((await stage.getAttribute("data-finale-slide")) !== "winner") {
    const index = Number(await stage.getAttribute("data-finale-slide-index"));
    await nextSlide(page);
    await expect(stage).toHaveAttribute(
      "data-finale-slide-index",
      String(index + 1),
    );
    played.push((await stage.getAttribute("data-finale-slide")) ?? "");
  }
  expect(played).toEqual(["standings", "title", "awards", "winner"]);
  const winnerIndex = played.length - 1;
  await page.keyboard.press("ArrowRight");
  const champions =
    (await stage.getAttribute("data-finale-slide-index")) !==
    String(winnerIndex);
  if (champions) {
    await expect(stage).toHaveAttribute("data-finale-slide", "champions");
  }
  const last = String(champions ? winnerIndex + 1 : winnerIndex);

  // Next on the last slide does nothing; ← goes back; Escape to the first.
  await page.keyboard.press("ArrowRight");
  await expect(stage).toHaveAttribute("data-finale-slide-index", last);
  await page.keyboard.press("ArrowLeft");
  await expect(stage).toHaveAttribute(
    "data-finale-slide",
    champions ? "winner" : "awards",
  );
  await page.keyboard.press("Escape");
  await expect(stage).toHaveAttribute("data-finale-slide", "standings");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
    timeout: 20_000,
  });
  await page.screenshot({
    path: testInfo.outputPath("finale-standings-390x844.png"),
  });
});
