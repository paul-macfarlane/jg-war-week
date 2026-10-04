import { expect, test } from "@playwright/test";

import { resetXiFinaleSlides } from "./db";
import { nextUntil, openFinale } from "./finale-slides";
import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

test.beforeAll(resetXiFinaleSlides);
test.afterAll(resetXiFinaleSlides);

test("the Finale's Standings countdown ends on first place", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await page.goto("/xi/leaderboard");
  const leader = page
    .getByRole("table", { name: "Team standings", exact: true })
    .locator('tr[data-slot="results-row"]')
    .first();
  // Rank, name and total, word by word, as the Finale's row shows them.
  const leaderWords = [
    (await leader.getByRole("cell").first().innerText()).trim(),
    ...(await leader.locator('[data-slot="results-name"]').innerText())
      .trim()
      .split(/\s+/),
    (await leader.locator('[data-slot="results-points"]').innerText()).trim(),
  ];

  // The slideshow: → through the slides before it; arriving on the
  // Standings countdown starts it.
  await openFinale(page);
  await nextUntil(page, "standings");

  // The countdown runs for at most 8 seconds, then offers Replay.
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
    timeout: 20_000,
  });
  const first = page.getByRole("main").getByRole("listitem").first();
  await expect(first).toBeVisible();
  expect((await first.innerText()).trim().split(/\s+/)).toEqual(leaderWords);
  await page.screenshot({
    path: testInfo.outputPath("finale-first-place.png"),
    fullPage: true,
  });
});
