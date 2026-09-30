import { expect, test } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

import { localSeedFiles } from "@/seed/local-files";

import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

/** Every past edition the e2e database loads: the ones not `live` or `upcoming`. */
const PAST_EDITIONS = localSeedFiles()
  .map(
    (f) =>
      JSON.parse(readFileSync(path.resolve(process.cwd(), f), "utf-8")) as {
        edition: string;
        status: string;
      },
  )
  .filter((seed) => seed.status === "complete")
  .map((seed) => seed.edition);

test.beforeEach(async ({ context }) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
});

test("the Archive lists every past War Week", async ({ page }, testInfo) => {
  expect(PAST_EDITIONS).toHaveLength(10);
  await page.goto("/history");

  await expect(
    page.getByRole("heading", { level: 1, name: "War Week history" }),
  ).toBeVisible();
  for (const edition of PAST_EDITIONS) {
    await expect(
      page.getByRole("link", {
        name: new RegExp(`^War Week ${edition.toUpperCase()} · \\d{4}`),
      }),
    ).toBeVisible();
  }
  await page.screenshot({
    path: testInfo.outputPath("history.png"),
    fullPage: true,
  });
});

for (const edition of PAST_EDITIONS) {
  test(`past edition /${edition} renders`, async ({ page }, testInfo) => {
    await page.goto(`/${edition}`);

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: new RegExp(`^War Week ${edition.toUpperCase()} \\d{4}$`),
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "All past War Weeks" }),
    ).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath(`${edition}.png`),
      fullPage: true,
    });
  });
}
