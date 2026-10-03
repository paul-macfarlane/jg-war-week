import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { fillDiscretionary, openGiveForm } from "./discretionary";
import { asOrganizer } from "./session";

// Epic R6: follow-ups from R5 (.scratch/regression-2026-09/epics/R6-*).

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812 };

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    animations: "disabled",
  });
}

/**
 * Refuses Discretionary points (Points over the maximum) and returns its toast.
 * The War Week settings form, which had the sticky Save row, autosaves
 * and has no toast (r9 59).
 */
async function refuseDiscretionaryPoints(page: Page) {
  const form = await openGiveForm(page);
  await fillDiscretionary(page, form, {
    target: "Blue",
    points: "9999999",
    reason: "e2e refused",
  });
  const points = form.getByLabel("Points", { exact: true });
  await points.press("Enter");
  await expect(points).toHaveAttribute("aria-invalid", "true");
  const toast = page
    .getByRole("region", { name: /^Notifications/ })
    .getByRole("listitem")
    .last();
  await expect(toast).toBeVisible();
  // Settled: Sonner animates the toast in from below.
  let last = Number.NaN;
  await expect
    .poll(async () => {
      const y = (await toast.boundingBox())?.y ?? Number.NaN;
      const settled = y === last;
      last = y;
      return settled;
    })
    .toBe(true);
  return toast;
}

test("r6 39 a refusal toast clears the section bar, and keeps Sonner's offset from md", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);

  // Below `md`: the toast sits above the admin section bar.
  await page.setViewportSize(PHONE);
  await page.goto("/admin/discretionary-points");
  const toast = await refuseDiscretionaryPoints(page);
  const toastBox = await toast.boundingBox();
  // By CSS, not role: the open Give form is a modal, which hides the bar
  // from the accessibility tree, and the hidden side column shares its name.
  const barBox = await page
    .locator('nav[aria-label="Admin sections"]:visible')
    .boundingBox();
  if (!toastBox || !barBox) throw new Error("Toast or section bar missing");
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(barBox.y);
  await shoot(page, testInfo, "points-refused-375");

  // From `md`: Sonner's default offset, as before.
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/discretionary-points");
  const wide = await refuseDiscretionaryPoints(page);
  const wideBox = await wide.boundingBox();
  if (!wideBox) throw new Error("Toast missing");
  expect(DESKTOP.height - (wideBox.y + wideBox.height)).toBeCloseTo(24, 0);
  await shoot(page, testInfo, "points-refused-1280");
});
