import { expect, test } from "@playwright/test";

import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

test("the Finale plays from Start and ends on first place", async ({
  context,
  page,
}, testInfo) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
  await page.goto("/xi/leaderboard");
  const leader = page
    .locator("section")
    .filter({
      has: page.getByRole("heading", { name: "Team standings", exact: true }),
    })
    .getByRole("listitem")
    .first();
  const leaderText = (await leader.innerText()).trim();

  await page.goto("/xi/finale");
  await page.getByRole("button", { name: "Start" }).click();

  // The countdown runs for at most 8 seconds, then offers Replay.
  await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
    timeout: 20_000,
  });
  const first = page.getByRole("main").getByRole("listitem").first();
  await expect(first).toBeVisible();
  expect((await first.innerText()).trim()).toBe(leaderText);
  await page.screenshot({
    path: testInfo.outputPath("finale-first-place.png"),
    fullPage: true,
  });
});
