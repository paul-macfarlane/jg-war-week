import AxeBuilder from "@axe-core/playwright";
import { type Page, expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";

import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

type ColorScheme = "light" | "dark";

const PAGES: { slug: string; path: string; signIn: boolean }[] = [
  { slug: "xi", path: "/xi", signIn: true },
  { slug: "history", path: "/history", signIn: false },
  { slug: "about", path: "/about", signIn: false },
];

const SCHEMES: ColorScheme[] = ["light", "dark"];

async function analyze(page: Page, path: string) {
  await page.goto(path);
  await expect(page.locator("h1").first()).toBeVisible();
  // Let entrance fades and color transitions finish: mid-fade text is
  // measured against a half-transparent surface.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  return new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
}

for (const { slug, path, signIn: needsSignIn } of PAGES) {
  for (const scheme of SCHEMES) {
    test(`${slug} has no color-contrast violations (${scheme})`, async ({
      page,
      context,
    }, testInfo) => {
      if (needsSignIn) {
        await signIn(context, E2E_PARTICIPANT_EMAIL);
      }
      // The scheme is chosen through the Display, as a viewer would; the
      // system setting is the opposite one so it can't be what applies.
      await context.addInitScript(
        (value) => window.localStorage.setItem("ww:display", value),
        scheme,
      );
      await page.emulateMedia({
        colorScheme: scheme === "dark" ? "light" : "dark",
      });

      const results = await analyze(page, path);
      expect(
        await page.evaluate(() => document.documentElement.dataset.display),
      ).toBe(scheme);

      await writeFile(
        testInfo.outputPath(`${slug}-${scheme}.json`),
        JSON.stringify(
          {
            violations: results.violations,
            incomplete: results.incomplete,
          },
          null,
          2,
        ),
      );

      const contrastViolations = results.violations.filter(
        (violation) => violation.id === "color-contrast",
      );
      expect(contrastViolations).toEqual([]);
    });
  }
}
