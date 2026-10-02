import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { contrastRatio, mixOklch, resolveCssColor } from "@/lib/color";
import {
  MIN_TEXT_CONTRAST,
  type ThemeColors,
  warWeekThemeStyle,
} from "@/lib/theme";
import { warWeekSeedSchema } from "@/seed/schema";

/**
 * Every past War Week renders in its own Appearance Theme (Archive cards on
 * /history, the edition pages), in the viewer's light or dark Display. Each
 * text-on-surface pair those pages draw at normal size must reach WCAG AA
 * against every seed's theme in both color schemes (the base palette and
 * the derived one), resolved from the same CSS custom properties
 * `warWeekThemeStyle` sets.
 */

const SEEDS_DIR = path.resolve(__dirname, "../../seeds");

// The committed seeds, then the local demos (`seeds/demo/`, labeled
// `demo/<edition>`), whose themes the app wears just the same.
const themes = [
  ...readdirSync(SEEDS_DIR).map((file) => ["", file] as const),
  ...readdirSync(path.join(SEEDS_DIR, "demo")).map(
    (file) => ["demo/", file] as const,
  ),
]
  .filter(([, file]) => file.endsWith(".json"))
  .map(([dir, file]) => {
    const seed = warWeekSeedSchema.parse(
      JSON.parse(readFileSync(path.join(SEEDS_DIR, dir, file), "utf-8")),
    );
    // The seed loader's mapping onto the War Week's theme columns.
    const theme: ThemeColors = {
      primaryColor: seed.primary,
      primaryForegroundColor: seed.primaryForeground,
      accentColor: seed.accent,
      backgroundColor: seed.background,
      foregroundColor: seed.foreground,
      fontPreset: seed.fontPreset,
      overridePrimaryColor: seed.overridePrimary ?? null,
      overridePrimaryForegroundColor: seed.overridePrimaryForeground ?? null,
      overrideAccentColor: seed.overrideAccent ?? null,
      overrideBackgroundColor: seed.overrideBackground ?? null,
      overrideForegroundColor: seed.overrideForeground ?? null,
    };
    return [`${dir}${seed.edition}`, theme] as const;
  });

// [text utility, text token, surface token]
const PAIRS = [
  ["text-foreground", "--foreground", "--card"],
  ["text-foreground", "--foreground", "--background"],
  ["text-muted-foreground", "--muted-foreground", "--card"],
  ["text-muted-foreground", "--muted-foreground", "--background"],
  ["text-primary-text", "--primary-text", "--card"],
  ["text-primary-text", "--primary-text", "--background"],
  ["text-primary-foreground", "--primary-foreground", "--primary"],
  ["text-accent-foreground", "--accent-foreground", "--accent"],
  // A disabled Button's text on its muted surface.
  ["text-foreground", "--foreground", "--muted"],
  // Setup's contrast warnings and the form warnings.
  ["text-warning", "--warning", "--background"],
  // The card footer's "Original wiki page" link sits on `bg-muted/50`.
  ["text-foreground", "--foreground", "card footer"],
] as const;

const SCHEMES = ["light", "dark"] as const;

/** One scheme's token value, e.g. `--dark-primary` for `--primary`. */
function token(
  style: Record<string, string>,
  scheme: (typeof SCHEMES)[number],
  name: string,
) {
  return style[name.replace("--", `--${scheme}-`)];
}

/** A surface's resolved hex; "card footer" is `bg-muted/50` over the card. */
function surfaceColor(
  style: Record<string, string>,
  scheme: (typeof SCHEMES)[number],
  surface: string,
) {
  if (surface !== "card footer") {
    return resolveCssColor(token(style, scheme, surface));
  }
  const muted = resolveCssColor(token(style, scheme, "--muted"));
  const card = resolveCssColor(token(style, scheme, "--card"));
  return muted && card ? mixOklch(card, muted, 50) : null;
}

describe("archive text contrast", () => {
  it("covers every seed and both demos", () => {
    expect(themes.length).toBeGreaterThanOrEqual(11);
    expect(themes.map(([edition]) => edition)).toEqual(
      expect.arrayContaining(["demo/xi", "demo/xii"]),
    );
  });

  it("carries War Week XI's seeded override into its light scheme", () => {
    const [, xi] = themes.find(([edition]) => edition === "xi")!;
    const style = warWeekThemeStyle(xi) as unknown as Record<string, string>;
    expect(style["--light-primary"]).toBe("#0a7a1f");
    expect(style["--dark-primary"]).toBe("#00ff41");
  });

  describe.each(themes)("War Week %s", (_, theme) => {
    const style = warWeekThemeStyle(theme) as unknown as Record<string, string>;

    describe.each(SCHEMES)("%s scheme", (scheme) => {
      it.each(PAIRS)("%s (%s on %s) reads at 4.5:1", (_, text, surface) => {
        const fg = resolveCssColor(token(style, scheme, text));
        const bg = surfaceColor(style, scheme, surface);
        expect(fg, text).not.toBeNull();
        expect(bg, surface).not.toBeNull();
        expect(contrastRatio(fg!, bg!)).toBeGreaterThanOrEqual(
          MIN_TEXT_CONTRAST,
        );
      });
    });
  });
});
