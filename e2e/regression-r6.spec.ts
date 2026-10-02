import { type Page, type TestInfo, expect, test } from "@playwright/test";

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

/** Refuses a settings save (a Slack URL that isn't https) and returns its toast. */
async function refuseSettingsSave(page: Page) {
  const form = page.getByRole("form", { name: "War Week settings" });
  await form.getByLabel("Slack URL").fill("http://slack.example.com/x");
  await form.getByRole("button", { name: "Save settings" }).click();
  await expect(form.getByLabel("Slack URL")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
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

test("r6 39 a refusal toast sits above the sticky Save, not over it", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);

  // Below `md`: the toast clears the sticky Save row and the error under it.
  await page.setViewportSize(PHONE);
  await page.goto("/admin/settings");
  const sticky = page.locator('[data-slot="sticky-form-actions"]');
  const toast = await refuseSettingsSave(page);
  const toastBox = await toast.boundingBox();
  const stickyBox = await sticky.boundingBox();
  if (!toastBox || !stickyBox) throw new Error("Toast or Save row missing");
  expect(toastBox.y + toastBox.height).toBeLessThanOrEqual(stickyBox.y);
  await shoot(page, testInfo, "settings-refused-375");

  // A page with no sticky row keeps the toast just above the bar: r5 30.

  // From `md`: Sonner's default offset, as before.
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/settings");
  const wide = await refuseSettingsSave(page);
  const wideBox = await wide.boundingBox();
  if (!wideBox) throw new Error("Toast missing");
  expect(DESKTOP.height - (wideBox.y + wideBox.height)).toBeCloseTo(24, 0);
  await shoot(page, testInfo, "settings-refused-1280");
});
