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

async function analyze(page: Page, path: string, colorScheme: ColorScheme) {
  await page.emulateMedia({ colorScheme });
  await page.goto(path);
  await expect(page.locator("h1").first()).toBeVisible();
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

      const results = await analyze(page, path, scheme);

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
      // Baseline run on the unchanged app: soft so all six analyses run and
      // record even when contrast fails. A later deliverable hardens this.
      expect.soft(contrastViolations).toHaveLength(0);
    });
  }
}
