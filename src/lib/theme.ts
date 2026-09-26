import type { CSSProperties } from "react";

import type { WarWeek } from "@/db/schema";
import {
  contrastRatio,
  normalizeHex,
  readableOn,
  readableText,
} from "@/lib/color";

const FONT_PRESET_VAR: Record<WarWeek["fontPreset"], string> = {
  sans: "var(--font-preset-sans)",
  serif: "var(--font-preset-serif)",
  mono: "var(--font-preset-mono)",
};

/** The Appearance Theme fields the themed wrapper is styled from. */
export type ThemeColors = Pick<
  WarWeek,
  | "primaryColor"
  | "primaryForegroundColor"
  | "accentColor"
  | "backgroundColor"
  | "foregroundColor"
  | "fontPreset"
>;

/**
 * Maps a War Week's Appearance Theme onto the shadcn CSS custom properties
 * so the themed wrapper can be styled purely from `style`. Pure function:
 * no DOM, no I/O.
 */
export function warWeekThemeStyle(warWeek: ThemeColors): CSSProperties {
  const bg = warWeek.backgroundColor;
  const fg = warWeek.foregroundColor;
  // Muted surfaces lean from the background toward the text, and muted text
  // leans back toward the background: symmetric, so light and dark themes
  // both keep hover, popover and input states readable.
  const mutedSurface = `color-mix(in oklch, ${bg}, ${fg} 12%)`;
  const mutedText = `color-mix(in oklch, ${fg}, ${bg} 35%)`;
  // Primary-colored text (Story Themes, small links) and text on the accent
  // (the bannerless hero) must still read when an Organizer's primary or
  // accent sits too close to the background or the primary text color.
  const primaryText = readableText(warWeek.primaryColor, bg, fg);
  const accentText = readableOn(
    warWeek.accentColor,
    warWeek.primaryForegroundColor,
  );
  return {
    "--primary": warWeek.primaryColor,
    "--primary-foreground": warWeek.primaryForegroundColor,
    "--primary-text": primaryText,
    "--accent": warWeek.accentColor,
    "--accent-foreground": accentText,
    "--background": warWeek.backgroundColor,
    "--foreground": warWeek.foregroundColor,
    "--card": warWeek.backgroundColor,
    "--card-foreground": warWeek.foregroundColor,
    "--border": warWeek.accentColor,
    "--ring": warWeek.primaryColor,
    "--muted": mutedSurface,
    "--muted-foreground": mutedText,
    "--secondary": mutedSurface,
    "--secondary-foreground": mutedText,
    "--popover": bg,
    "--popover-foreground": fg,
    "--input": `color-mix(in oklch, ${bg}, ${fg} 20%)`,
    "--font-sans": FONT_PRESET_VAR[warWeek.fontPreset],
    "--ww-primary": warWeek.primaryColor,
  } as CSSProperties;
}

/** WCAG AA contrast for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

export { contrastRatio };

/**
 * The text-on-color pairs the themed pages draw, each below WCAG AA, as
 * warnings for the setup form. Not a refusal: an Organizer may keep them.
 */
export function themeContrastWarnings(theme: ThemeColors): string[] {
  const pairs = [
    ["Text", theme.foregroundColor, "background", theme.backgroundColor],
    [
      "Primary text",
      theme.primaryForegroundColor,
      "primary",
      theme.primaryColor,
    ],
    ["Primary text", theme.primaryForegroundColor, "accent", theme.accentColor],
  ] as const;
  return pairs.flatMap(([text, fg, surface, bg]) => {
    const ratio = contrastRatio(fg, bg);
    return ratio != null && ratio < MIN_TEXT_CONTRAST
      ? [
          `${text} on ${surface} is ${ratio.toFixed(1)}:1, below ${MIN_TEXT_CONTRAST}:1 and may be hard to read.`,
        ]
      : [];
  });
}

const SWATCH_FIELDS = [
  ["primaryColor", "Primary"],
  ["primaryForegroundColor", "Primary text"],
  ["accentColor", "Accent"],
  ["backgroundColor", "Background"],
  ["foregroundColor", "Text"],
] as const;

/**
 * The Appearance Theme's colors as color-field swatches (`#rrggbb`),
 * skipping any that aren't hex yet.
 */
export function themeSwatches(
  theme: Omit<ThemeColors, "fontPreset">,
): { color: string; label: string }[] {
  return SWATCH_FIELDS.flatMap(([field, label]) => {
    const color = normalizeHex(theme[field]);
    return color ? [{ color, label }] : [];
  });
}
