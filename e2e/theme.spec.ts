import {
  type Browser,
  type BrowserContext,
  type Page,
  expect,
  test,
} from "@playwright/test";

import { DISPLAY_STORAGE_KEY, type Display } from "@/lib/display";
import { type ColorScheme, themePalettes } from "@/lib/theme";

import { runQuery } from "./db";
import { E2E_BASE_URL } from "./env";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

/** `#rrggbb` as Chrome reports a computed color. */
function rgb(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}

// The unthemed `:root` backgrounds (`oklch(1 0 0)` and `oklch(0.145 0 0)`
// in globals.css), as Chrome reports them once the build has compiled them.
const ROOT_BACKGROUND: Record<ColorScheme, string> = {
  light: "lab(100 0 0)",
  dark: "lab(2.75381 0 0)",
};

/** A War Week's two palettes from its row, as the themed pages derive them. */
async function palettesOf(edition: string) {
  const [row] = await runQuery<Record<string, string | null>>(
    `select primary_color, primary_foreground_color, accent_color,
       background_color, foreground_color, override_primary_color,
       override_primary_foreground_color, override_accent_color,
       override_background_color, override_foreground_color
     from war_week where edition = $1`,
    [edition],
  );
  return themePalettes({
    primaryColor: row.primary_color!,
    primaryForegroundColor: row.primary_foreground_color!,
    accentColor: row.accent_color!,
    backgroundColor: row.background_color!,
    foregroundColor: row.foreground_color!,
    overridePrimaryColor: row.override_primary_color,
    overridePrimaryForegroundColor: row.override_primary_foreground_color,
    overrideAccentColor: row.override_accent_color,
    overrideBackgroundColor: row.override_background_color,
    overrideForegroundColor: row.override_foreground_color,
    fontPreset: "sans",
  });
}

function backgroundOf(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((el) => getComputedStyle(el).backgroundColor);
}

const rootBackground = (page: Page) => backgroundOf(page, "[data-theme-root]");

/**
 * Waits out running finite animations and CSS transitions (nav pills fade
 * between schemes); a cancelled one counts as done.
 */
function settled(page: Page) {
  return page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
}

function htmlColorScheme(page: Page) {
  return page.evaluate(
    () => getComputedStyle(document.documentElement).colorScheme,
  );
}

function storedDisplay(page: Page) {
  return page.evaluate(
    (key) => window.localStorage.getItem(key),
    DISPLAY_STORAGE_KEY,
  );
}

/** A fresh context whose stored Display is `display` before the first page. */
async function contextWithDisplay(browser: Browser, display: Display) {
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    [DISPLAY_STORAGE_KEY, display] as const,
  );
  return context;
}

async function chooseDisplay(page: Page, label: "Light" | "Dark" | "System") {
  const control = page.getByRole("group", { name: "Display" }).first();
  await control.getByRole("button", { name: label, exact: true }).click();
  await expect(
    control.getByRole("button", { name: label, exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
}

test.describe("Display: Light, Dark and System", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
  });

  test("XI (dark base) follows the header's Display control, across reloads and the system setting", async ({
    page,
  }, testInfo) => {
    // XI's base background, and its derived light one (its base text color).
    const xiBase = rgb("#000000");
    const xiDerived = rgb("#d1ffd6");
    const palettes = await palettesOf("xi");
    expect(rgb(palettes.dark.background)).toBe(xiBase);
    expect(rgb(palettes.light.background)).toBe(xiDerived);

    // Decision 4: React must not warn about the inline <head> script.
    const scriptWarnings: string[] = [];
    page.on("console", (message) => {
      if (/script/i.test(message.text())) scriptWarnings.push(message.text());
    });
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/xi");

    await chooseDisplay(page, "Dark");
    await expect.poll(() => rootBackground(page)).toBe(xiBase);
    expect(await htmlColorScheme(page)).toBe("dark");
    expect(await storedDisplay(page)).toBe("dark");
    await settled(page);
    await page.screenshot({ path: testInfo.outputPath("xi-dark.png") });

    await page.reload();
    await expect.poll(() => rootBackground(page)).toBe(xiBase);
    expect(await htmlColorScheme(page)).toBe("dark");

    await chooseDisplay(page, "Light");
    await expect.poll(() => rootBackground(page)).toBe(xiDerived);
    expect(await htmlColorScheme(page)).toBe("light");
    expect(await storedDisplay(page)).toBe("light");
    await settled(page);
    await page.screenshot({ path: testInfo.outputPath("xi-light.png") });

    await page.reload();
    await expect.poll(() => rootBackground(page)).toBe(xiDerived);

    await chooseDisplay(page, "System");
    expect(await storedDisplay(page)).toBe("system");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => rootBackground(page)).toBe(xiBase);
    expect(await htmlColorScheme(page)).toBe("dark");
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => rootBackground(page)).toBe(xiDerived);
    expect(await htmlColorScheme(page)).toBe("light");
    expect(scriptWarnings).toEqual([]);
  });

  test("X (light base) follows it in reverse", async ({ page }) => {
    const palettes = await palettesOf("x");
    expect(palettes.scheme).toBe("light");
    const base = rgb("#fdf6e3");
    const derived = rgb(palettes.dark.background);
    // X's derived dark background is its base text color.
    expect(derived).toBe(rgb("#1c1917"));

    await page.emulateMedia({ colorScheme: "light" });
    await page.goto("/x");
    await expect.poll(() => rootBackground(page)).toBe(base);

    await chooseDisplay(page, "Dark");
    await expect.poll(() => rootBackground(page)).toBe(derived);
    expect(await htmlColorScheme(page)).toBe("dark");
    await page.reload();
    await expect.poll(() => rootBackground(page)).toBe(derived);

    await chooseDisplay(page, "Light");
    await expect.poll(() => rootBackground(page)).toBe(base);
    expect(await htmlColorScheme(page)).toBe("light");

    await chooseDisplay(page, "System");
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => rootBackground(page)).toBe(derived);
    await page.emulateMedia({ colorScheme: "light" });
    await expect.poll(() => rootBackground(page)).toBe(base);
  });
});

test("a stored Dark applies before any client JavaScript loads: no flash", async ({
  browser,
}) => {
  const context = await contextWithDisplay(browser, "dark");
  try {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    const page = await context.newPage();
    await page.emulateMedia({ colorScheme: "light" });
    const scripts: string[] = [];
    // Only the inline <head> script can run; the CSS still loads.
    await page.route("**/_next/static/**", (route) => {
      if (route.request().resourceType() === "script") {
        scripts.push(route.request().url());
        return route.abort();
      }
      return route.continue();
    });
    await page.goto("/xi");

    expect(scripts.length).toBeGreaterThan(0);
    expect(
      await page.evaluate(() => document.documentElement.dataset.display),
    ).toBe("dark");
    expect(await rootBackground(page)).toBe(rgb("#000000"));
  } finally {
    await context.close();
  }
});

test("every themed surface follows the Display: the Finale, the Archive, /about, /privacy, /terms, sign-in and /admin", async ({
  browser,
}, testInfo) => {
  const xi = await palettesOf("xi");
  const x = await palettesOf("x");

  for (const scheme of ["dark", "light"] as const) {
    const participant = await contextWithDisplay(browser, scheme);
    const anonymous = await contextWithDisplay(browser, scheme);
    const organizer = await contextWithDisplay(browser, scheme);
    try {
      await signIn(participant, E2E_PARTICIPANT_EMAIL);
      await asOrganizer(organizer);
      const page = await participant.newPage();

      await page.goto("/xi/finale");
      expect(await rootBackground(page), `/xi/finale ${scheme}`).toBe(
        rgb(xi[scheme].background),
      );

      await page.goto("/history");
      await expect(
        page.getByRole("heading", { level: 1, name: "War Week history" }),
      ).toBeVisible();
      expect(await backgroundOf(page, "body"), `/history ${scheme}`).toBe(
        ROOT_BACKGROUND[scheme],
      );
      expect(
        await backgroundOf(
          page,
          'li[data-theme-root]:has(a[href="/x"]) [data-slot="card"]',
        ),
        `/history X's card ${scheme}`,
      ).toBe(rgb(x[scheme].background));
      if (scheme === "dark") {
        await settled(page);
        await page.screenshot({
          path: testInfo.outputPath("history-dark.png"),
          fullPage: true,
        });
      }

      const anon = await anonymous.newPage();
      await anon.goto("/about");
      expect(await rootBackground(anon), `/about ${scheme}`).toBe(
        rgb(xi[scheme].background),
      );
      for (const path of ["/privacy", "/terms"]) {
        await anon.goto(path);
        expect(await rootBackground(anon), `${path} ${scheme}`).toBe(
          rgb(xi[scheme].background),
        );
      }
      await anon.goto("/sign-in");
      expect(await rootBackground(anon), `/sign-in ${scheme}`).toBe(
        rgb(xi[scheme].background),
      );

      const admin = await organizer.newPage();
      await admin.goto("/admin/setup");
      expect(await rootBackground(admin), `/admin/setup ${scheme}`).toBe(
        rgb(xi[scheme].background),
      );
    } finally {
      await participant.close();
      await anonymous.close();
      await organizer.close();
    }
  }
});

const OVERRIDE_COLUMNS = [
  "override_primary_color",
  "override_primary_foreground_color",
  "override_accent_color",
  "override_background_color",
  "override_foreground_color",
] as const;
type Overrides = Record<(typeof OVERRIDE_COLUMNS)[number], string | null>;

function readXiOverrides() {
  return runQuery<Overrides>(
    `select ${OVERRIDE_COLUMNS.join(", ")} from war_week where edition = 'xi'`,
  ).then(([row]) => row);
}

/** Saves the form and waits for the server action's response. */
async function saveSettings(page: Page) {
  const form = page.getByRole("form", { name: "War Week settings" });
  await Promise.all([
    page.waitForResponse(
      (response) =>
        response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/admin/setup/war-week",
    ),
    form.getByRole("button", { name: "Save settings" }).click(),
  ]);
  await expect(page.getByText("War Week settings saved").first()).toBeVisible();
}

async function openSetup(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto("/admin/setup/war-week");
  const form = page.getByRole("form", { name: "War Week settings" });
  await expect(form).toBeVisible();
  return { page, form };
}

test("Setup: the other scheme's colors are derived, overridable and reset; an untouched save stores no override", async ({
  browser,
}, testInfo) => {
  const before = await readXiOverrides();
  const context = await browser.newContext({ baseURL: E2E_BASE_URL });
  const override = "#1b4d2c";
  try {
    await asOrganizer(context);
    // XI's seeded override; the rest derived.
    expect(before).toEqual({
      override_primary_color: "#0a7a1f",
      override_primary_foreground_color: null,
      override_accent_color: null,
      override_background_color: null,
      override_foreground_color: null,
    });

    // Untouched save: every override as it was.
    let { page, form } = await openSetup(context);
    await saveSettings(page);
    expect(await readXiOverrides()).toEqual(before);

    // A background typed through a light 3-digit prefix (#1a1 is #11aa11)
    // to a dark one, then back to the saved one: the overrides survive.
    // One open picker throughout: Chromium can drop the color grid's
    // layout boxes when the contrast warnings appear mid-edit.
    const background = form.getByLabel("Background color", { exact: true });
    let hex = page.getByRole("textbox", { name: "Hex color" });
    await background.click();
    await hex.fill("");
    await hex.pressSequentially("#1a1a1a");
    await expect(background).toContainText("#1a1a1a");
    await hex.fill("#000000");
    await page.keyboard.press("Escape");
    await expect(background).toContainText("#000000");
    await saveSettings(page);
    expect(await readXiOverrides()).toEqual(before);
    await page.close();

    // Open and dismiss a derived color's picker (the Light accent), save:
    // it isn't frozen into an override, and every override is unchanged.
    ({ page, form } = await openSetup(context));
    hex = page.getByRole("textbox", { name: "Hex color" });
    await form.getByLabel("Light accent color", { exact: true }).click();
    await expect(hex).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(hex).toBeHidden();
    await saveSettings(page);
    expect(await readXiOverrides()).toEqual(before);

    const lightPrimary = form.getByLabel("Light primary color", {
      exact: true,
    });

    // Set it through the form: the row and /xi carry it in the light set.
    await lightPrimary.click();
    await page.getByRole("textbox", { name: "Hex color" }).fill(override);
    await page.keyboard.press("Escape");
    await expect(lightPrimary).toContainText(override);
    // Earlier saves' toasts would cover the previews.
    await expect(page.getByText("War Week settings saved")).toHaveCount(0, {
      timeout: 15_000,
    });
    await settled(page);
    await page.screenshot({
      path: testInfo.outputPath("setup-overrides.png"),
      fullPage: true,
    });
    await saveSettings(page);
    expect(await readXiOverrides()).toEqual({
      ...before,
      override_primary_color: override,
    });
    const xi = await context.newPage();
    await xi.goto("/xi");
    expect(
      await xi
        .locator("[data-theme-root]")
        .first()
        .evaluate((el) =>
          (el as HTMLElement).style.getPropertyValue("--light-primary").trim(),
        ),
    ).toBe(override);
    await xi.close();
    await page.close();

    // Reset to derived: the column goes back to null.
    ({ page, form } = await openSetup(context));
    await form.getByRole("button", { name: "Reset to derived" }).click();
    await expect(
      form.getByRole("button", { name: "Reset to derived" }),
    ).toHaveCount(0);
    await saveSettings(page);
    expect(await readXiOverrides()).toEqual({
      ...before,
      override_primary_color: null,
    });
  } finally {
    await runQuery(
      `update war_week set ${OVERRIDE_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(", ")}
       where edition = 'xi'`,
      OVERRIDE_COLUMNS.map((column) => before[column]),
    );
    await context.close();
  }
});
