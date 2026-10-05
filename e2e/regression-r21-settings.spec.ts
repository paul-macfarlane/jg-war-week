import { type Page, expect, test } from "@playwright/test";

import {
  type FormatName,
  RUN_AREA_TITLE,
  addCompetition,
  expectSaved,
} from "./competition-page";
import { deleteXiCompetition } from "./db";
import { asOrganizer } from "./session";

// Epic R21, AC 2 (.scratch/competition-setup/spec.md, decision 2): no
// Format's settings have a "closes at" time. Each of the six Formats'
// settings form is opened on a Competition this spec adds to demo XI (and
// deletes in `finally`), with the switches that used to reveal a close
// time turned on, and screenshotted at 1440×900 and 390×844.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const FORMATS: FormatName[] = [
  "Placement",
  "Bracket",
  "Head-to-head",
  "Best score",
  "Participation",
  "League",
];

/** The Settings form, and nothing else on the page. */
function settingsForm(page: Page) {
  return page.getByRole("form", { name: "Competition settings" });
}

/** Turns a switch on and waits for the save. */
async function turnOn(page: Page, name: string) {
  const toggle = settingsForm(page).getByRole("switch", { name });
  await expect(toggle).not.toBeChecked();
  await toggle.click();
  await expectSaved(page);
  await expect(toggle).toBeChecked();
}

for (const format of FORMATS) {
  test(`r21 AC2 a ${format} Competition's settings have no "closes at" time`, async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const name = `E2E R21 Settings ${format} ${Date.now()}`;
    try {
      await asOrganizer(context);
      await page.setViewportSize(DESKTOP);
      await addCompetition(page, { name, format, scoring: "Individual" });
      await expect(
        page.getByRole("heading", {
          level: 2,
          name: RUN_AREA_TITLE[format],
          exact: true,
        }),
      ).toBeVisible();
      const form = settingsForm(page);
      await expect(form).toBeVisible();

      // The switches that used to reveal a close time beside them.
      if (format === "Bracket" || format === "League") {
        await turnOn(page, "Participants can enroll");
      }
      if (format === "Participation") {
        await turnOn(page, "Participants can check in");
      }

      // Enrollment is a Bracket's and a League's alone (spec R21, decision 5;
      // R23, decision 11).
      await expect(
        form.getByRole("switch", { name: "Participants can enroll" }),
      ).toHaveCount(format === "Bracket" || format === "League" ? 1 : 0);

      for (const [label, viewport] of [
        ["1440", DESKTOP],
        ["390", PHONE],
      ] as const) {
        await page.setViewportSize(viewport);
        await expect(form.getByText(/closes/i)).toHaveCount(0);
        await expect(form.getByLabel("Time (ET)")).toHaveCount(0);
        await expect(
          form.getByText("close time", { exact: false }),
        ).toHaveCount(0);
        await page.screenshot({
          path: testInfo.outputPath(
            `settings-${format.toLowerCase().replace(/ /g, "-")}-${label}.png`,
          ),
          fullPage: true,
          animations: "disabled",
        });
      }
    } finally {
      await deleteXiCompetition(name);
    }
  });
}
