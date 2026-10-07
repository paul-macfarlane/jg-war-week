import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { addCompetition, expectEntrantsSaved } from "./competition-page";
import { loadScaleDemo, restoreLocalSeed } from "./scale-demo";
import { asOrganizer } from "./session";

// Epic R26, spec Decisions 8 (Locked Bracket Matches), AC 8: a 4-Entrant
// Bracket (this spec owns it: created in XII, dropped by afterAll) with both
// Semifinals and the Final recorded, so the Semifinals are locked. Each shows a lock icon; the old line under every one
// ("A later Match already used this result.") is gone; the reason is the
// tooltip of the disabled Edit and Clear result controls, reached by
// keyboard focus at 1440 and by a tap at 390. The scale demo is loaded in beforeAll and put back to
// `localSeedFiles()` in afterAll.

const REASON =
  "A later Match already used this result. Change that Match first.";
const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(name),
    fullPage: true,
    animations: "disabled",
  });
}

test.describe.configure({ mode: "serial" });

/** Builds a 4-Entrant Bracket in XII and records both Semifinals and the Final. */
async function decidedBracket(page: Page): Promise<string> {
  await page.setViewportSize(DESKTOP);
  const id = await addCompetition(page, {
    name: "R26 Locked Bracket",
    format: "Bracket",
  });
  const find = page.locator("#bracket-entrants");
  for (const name of ["Abe Acorn", "Ada Anvil", "Ari Abacus", "Bea Bellows"]) {
    await find.fill(name);
    await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  }
  await expect(page.getByText("(4 chosen)")).toBeVisible();
  await page.keyboard.press("Escape");
  await expectEntrantsSaved(page);
  await page.getByRole("button", { name: "Generate" }).click();
  await expect(page.getByText("Bracket generated")).toBeVisible();
  const tree = page.locator("[data-bracket-tree]");
  for (const match of [/^Semifinal/, /^Semifinal/, /^Final$/]) {
    const record = tree
      .getByRole("button", {
        name: new RegExp(`^Record result for ${match.source.replace("^", "")}`),
      })
      .first();
    await expect(record).toBeVisible();
    const matchName = (await record.getAttribute("aria-label"))!.replace(
      "Record result for ",
      "",
    );
    await record.click();
    const sheet = page.getByRole("dialog", { name: match });
    await sheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button")
      .first()
      .click();
    await sheet.getByRole("button", { name: "Save Match Result" }).click();
    await expect(sheet).toBeHidden();
    // The tree refreshes: that Match now offers Edit.
    await expect(
      tree.getByRole("button", { name: `Edit ${matchName}` }),
    ).toBeVisible();
  }
  return id;
}

let bracketId = "";

test.describe("Locked Bracket Matches in the XII scale demo", () => {
  test.beforeAll(() => {
    loadScaleDemo();
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back.
    restoreLocalSeed();
  });

  for (const [width, size, touch] of [
    ["1440", DESKTOP, false],
    ["390", PHONE, true],
  ] as const) {
    test(`r26 8 at ${width} locked Matches show a lock icon, no repeated message, and the reason as a tooltip`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ hasTouch: touch });
      await asOrganizer(context);
      const page = await context.newPage();
      try {
        bracketId ||= await decidedBracket(page);
        const id = bracketId;
        await page.setViewportSize(size);
        await page.goto(`/admin/competitions/${id}`);
        const rounds = page.getByRole("region", { name: "Rounds" });
        await expect(rounds).toBeVisible();

        const icons = rounds.locator('[data-slot="match-lock-icon"]');
        expect(await icons.count()).toBeGreaterThan(0);
        await expect(icons.first()).toHaveAttribute(
          "aria-label",
          "Result locked",
        );
        // Two disabled controls per lock icon, none of them a repeated line.
        const controls = rounds.locator('[data-slot="locked-control"]');
        await expect(icons).toHaveCount(2);
        await expect(controls).toHaveCount(4);
        await expect(
          rounds.locator('[data-slot="match-lock-reason"]'),
        ).toHaveCount(0);
        await expect(page.locator("body")).not.toContainText(
          "A later Match already used this result",
        );
        await expect(page.locator('[data-slot="tooltip-content"]')).toHaveCount(
          0,
        );

        const first = controls.first();
        await first.scrollIntoViewIfNeeded();
        await expect(
          first.getByRole("button", { disabled: true }),
        ).toBeDisabled();
        if (touch) {
          await first.tap();
        } else {
          await first.focus();
          await expect(first).toBeFocused();
        }
        const tip = page.locator('[data-slot="tooltip-content"]');
        await expect(tip).toBeVisible();
        await expect(tip).toHaveText(REASON);
        await shoot(page, testInfo, `locked-${width}.png`);
      } finally {
        await context.close();
      }
    });
  }
});
