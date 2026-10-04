import { expect, test } from "@playwright/test";
import path from "node:path";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { deleteXiCompetition } from "./db";
import { asOrganizer } from "./session";

// Epic R16, ticket 95 (.scratch/regression-2026-10/issues/95-placement-points-without-a-limit.md):
// a Placement Competition takes any number of places, and the list editor
// stays usable on a phone at 20 places. The places are set on the
// Competition's page (ticket 101), where they autosave. The spec adds its
// own Competition and deletes it.
test("r16 95 twenty Placement Points places are all reachable at 390 wide without horizontal scroll", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `R16 Placement Points ${Date.now()}`;
  const places = 20;
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 390, height: 844 });
    const id = await addCompetition(page, { name });
    const settings = page.getByRole("form", { name: "Competition settings" });

    const add = settings.getByRole("button", { name: "Add place" });
    for (let place = 1; place <= places; place++) {
      await add.click();
      await settings
        .getByRole("spinbutton", {
          name: new RegExp(`^${place}(st|nd|rd|th) place Placement Points$`),
        })
        .fill(String(places + 1 - place));
    }

    const inputs = settings.getByRole("spinbutton", {
      name: /place Placement Points$/,
    });
    await expect(inputs).toHaveCount(places);
    // Every input is reachable: inside the 390px viewport, no sideways scroll.
    for (let i = 0; i < places; i++) {
      const input = inputs.nth(i);
      await input.scrollIntoViewIfNeeded();
      const box = (await input.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(390);
    }
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(
        testInfo.project.outputDir,
        "placement-points-20-places",
        "390.png",
      ),
      fullPage: true,
      animations: "disabled",
    });

    await expectSaved(page);

    // All 20 places were saved: they're there after leaving and returning.
    await page.goto("/admin/competitions");
    await openCompetitionPage(page, id);
    const saved = page
      .getByRole("form", { name: "Competition settings" })
      .getByRole("spinbutton", { name: /place Placement Points$/ });
    await expect(saved).toHaveCount(places);
    await expect(page.getByLabel("1st place Placement Points")).toHaveValue(
      "20",
    );
    await expect(page.getByLabel("20th place Placement Points")).toHaveValue(
      "1",
    );
  } finally {
    await deleteXiCompetition(name);
  }
});
