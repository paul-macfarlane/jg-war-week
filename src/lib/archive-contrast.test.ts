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
 * /history, the edition pages). Each text-on-surface pair those pages draw
 * at normal size must reach WCAG AA against every seed's theme, resolved
 * from the same CSS custom properties `warWeekThemeStyle` sets.
 */

const SEEDS_DIR = path.resolve(__dirname, "../../seeds");

const themes = readdirSync(SEEDS_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => {
    const seed = warWeekSeedSchema.parse(
      JSON.parse(readFileSync(path.join(SEEDS_DIR, file), "utf-8")),
    );
    // The seed loader's mapping onto the War Week's theme columns.
    const theme: ThemeColors = {
      primaryColor: seed.primary,
      primaryForegroundColor: seed.primaryForeground,
      accentColor: seed.accent,
      backgroundColor: seed.background,
      foregroundColor: seed.foreground,
      fontPreset: seed.fontPreset,
    };
    return [seed.edition, theme] as const;
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
  // The card footer's "Original wiki page" link sits on `bg-muted/50`.
  ["text-foreground", "--foreground", "card footer"],
] as const;

/** A surface's resolved hex; "card footer" is `bg-muted/50` over the card. */
function surfaceColor(style: Record<string, string>, surface: string) {
  if (surface !== "card footer") return resolveCssColor(style[surface]);
  const muted = resolveCssColor(style["--muted"]);
  const card = resolveCssColor(style["--card"]);
  return muted && card ? mixOklch(card, muted, 50) : null;
}

describe("archive text contrast", () => {
  it("covers every seed", () => {
    expect(themes.length).toBeGreaterThanOrEqual(11);
  });

  describe.each(themes)("War Week %s", (_, theme) => {
    const style = warWeekThemeStyle(theme) as Record<string, string>;

    it.each(PAIRS)("%s (%s on %s) reads at 4.5:1", (_, text, surface) => {
      const fg = resolveCssColor(style[text]);
      const bg = surfaceColor(style, surface);
      expect(fg, text).not.toBeNull();
      expect(bg, surface).not.toBeNull();
      expect(contrastRatio(fg!, bg!)).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
    });
  });
});
