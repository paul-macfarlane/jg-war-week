import type { CSSProperties } from "react";

import type { Team, WarWeek } from "@/db/schema";
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
> &
  Partial<
    Pick<
      WarWeek,
      | "overridePrimaryColor"
      | "overridePrimaryForegroundColor"
      | "overrideAccentColor"
      | "overrideBackgroundColor"
      | "overrideForegroundColor"
    >
  >;

export type ColorScheme = "dark" | "light";

/** Five theme colors: the base palette, or the derived one for the other scheme. */
export type Palette = {
  primary: string;
  primaryForeground: string;
  accent: string;
  background: string;
  foreground: string;
};

/** Each palette color and the War Week column that holds its override. */
export const OVERRIDE_FIELDS = [
  ["primary", "overridePrimaryColor"],
  ["primaryForeground", "overridePrimaryForegroundColor"],
  ["accent", "overrideAccentColor"],
  ["background", "overrideBackgroundColor"],
  ["foreground", "overrideForegroundColor"],
] as const satisfies readonly (readonly [keyof Palette, keyof ThemeColors])[];

/**
 * Whether a background reads as a dark surface: white text contrasts more
 * against it than black does. Ties (and non-hex input, where `contrastRatio`
 * returns null) default to light, the safer native-control fallback.
 */
export function backgroundColorScheme(background: string): ColorScheme {
  const onWhite = contrastRatio("#ffffff", background);
  const onBlack = contrastRatio("#000000", background);
  if (onWhite == null || onBlack == null) return "light";
  return onWhite > onBlack ? "dark" : "light";
}

/** The scheme a base palette isn't: the one its derived palette dresses. */
export function otherScheme(scheme: ColorScheme): ColorScheme {
  return scheme === "dark" ? "light" : "dark";
}

/** The Organizer's five colors: the base palette. */
export function basePalette(theme: ThemeColors): Palette {
  return {
    primary: theme.primaryColor,
    primaryForeground: theme.primaryForegroundColor,
    accent: theme.accentColor,
    background: theme.backgroundColor,
    foreground: theme.foregroundColor,
  };
}

/** The Organizer's overrides of the derived palette, skipping unset ones. */
export function paletteOverrides(theme: ThemeColors): Partial<Palette> {
  const overrides: Partial<Palette> = {};
  for (const [color, field] of OVERRIDE_FIELDS) {
    const value = theme[field];
    if (value) overrides[color] = value;
  }
  return overrides;
}

/**
 * The palette for the other color scheme. Background and text swap; the
 * primary and accent keep their hue and move toward the new text color only
 * as far as WCAG AA needs; the primary's text color is kept when it still
 * reads, else black or white. Staged so an override replaces exactly its
 * color and the colors derived from it re-derive against it. Pure.
 */
export function derivePalette(
  base: Palette,
  overrides: Partial<Palette> = {},
): Palette {
  const background = overrides.background ?? base.foreground;
  const foreground = overrides.foreground ?? base.background;
  const primary =
    overrides.primary ?? readableText(base.primary, background, foreground);
  const primaryForeground =
    overrides.primaryForeground ?? readableOn(primary, base.primaryForeground);
  const accent =
    overrides.accent ?? readableText(base.accent, background, foreground);
  return { primary, primaryForeground, accent, background, foreground };
}

/** Whether every color of a palette is hex, so it can be derived from. */
function isHexPalette(palette: Palette): boolean {
  return Object.values(palette).every((color) => normalizeHex(color) !== null);
}

/**
 * A War Week's base and derived palettes, keyed by the scheme each dresses
 * (`scheme` is the base palette's). Pure.
 */
export function themePalettes(
  theme: ThemeColors,
): Record<ColorScheme, Palette> & { scheme: ColorScheme } {
  const base = basePalette(theme);
  const scheme = backgroundColorScheme(base.background);
  const derived = derivePalette(base, paletteOverrides(theme));
  return scheme === "dark"
    ? { scheme, dark: base, light: derived }
    : { scheme, light: base, dark: derived };
}

// The warning text color each scheme starts from (Tailwind amber-700 and
// amber-400), lifted to AA against the palette's background when needed.
const WARNING_AMBER: Record<ColorScheme, string> = {
  light: "#b45309",
  dark: "#fbbf24",
};

/** The shadcn color tokens one palette sets, unprefixed (`primary`, …). */
function paletteTokens(
  palette: Palette,
  scheme: ColorScheme,
): Record<string, string> {
  const bg = palette.background;
  const fg = palette.foreground;
  // Muted surfaces lean from the background toward the text, and muted text
  // leans back toward the background: symmetric, so light and dark themes
  // both keep hover, popover and input states readable.
  const mutedSurface = `color-mix(in oklch, ${bg}, ${fg} 12%)`;
  const mutedText = `color-mix(in oklch, ${fg}, ${bg} 35%)`;
  return {
    primary: palette.primary,
    "primary-foreground": palette.primaryForeground,
    // Primary-colored text (Story Themes, small links) and text on the
    // accent (the bannerless hero) must still read when an Organizer's
    // primary or accent sits too close to the background or the primary
    // text color.
    "primary-text": readableText(palette.primary, bg, fg),
    accent: palette.accent,
    "accent-foreground": readableOn(palette.accent, palette.primaryForeground),
    background: bg,
    foreground: fg,
    card: bg,
    "card-foreground": fg,
    border: palette.accent,
    ring: palette.primary,
    muted: mutedSurface,
    "muted-foreground": mutedText,
    secondary: mutedSurface,
    "secondary-foreground": mutedText,
    popover: bg,
    "popover-foreground": fg,
    input: `color-mix(in oklch, ${bg}, ${fg} 20%)`,
    warning: readableText(WARNING_AMBER[scheme], bg, fg),
  };
}

/**
 * Maps a War Week's Appearance Theme onto the shadcn CSS custom properties,
 * twice: `--light-*` and `--dark-*`, the base palette under its own scheme
 * and the derived palette under the other, so CSS picks one per the
 * viewer's Display. Plus `--font-sans`. Pure function: no DOM, no I/O.
 */
export function warWeekThemeStyle(warWeek: ThemeColors): CSSProperties {
  const palettes = themePalettes(warWeek);
  const style: Record<string, string> = {};
  for (const scheme of ["light", "dark"] as const) {
    const tokens = paletteTokens(palettes[scheme], scheme);
    for (const [token, value] of Object.entries(tokens)) {
      style[`--${scheme}-${token}`] = value;
    }
  }
  style["--font-sans"] = FONT_PRESET_VAR[warWeek.fontPreset];
  return style as CSSProperties;
}

/** WCAG AA contrast for body text. */
export const MIN_TEXT_CONTRAST = 4.5;

export { contrastRatio };

const SCHEME_NAME: Record<ColorScheme, string> = {
  light: "Light mode",
  dark: "Dark mode",
};

/** One palette's text-on-color pairs below WCAG AA, worded for the form. */
function paletteContrastWarnings(palette: Palette): string[] {
  const pairs = [
    ["Text", palette.foreground, "background", palette.background],
    ["Primary text", palette.primaryForeground, "primary", palette.primary],
    ["Primary text", palette.primaryForeground, "accent", palette.accent],
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

/**
 * The text-on-color pairs the themed pages draw, each below WCAG AA, as
 * warnings for the setup form: the base palette's, then the derived
 * palette's prefixed with its scheme ("Dark mode: …"). Not a refusal: an
 * Organizer may keep them. The derived palette is skipped while a base
 * color isn't hex.
 */
export function themeContrastWarnings(theme: ThemeColors): string[] {
  const base = basePalette(theme);
  const warnings = paletteContrastWarnings(base);
  if (!isHexPalette(base)) return warnings;
  const palettes = themePalettes(theme);
  const other = otherScheme(palettes.scheme);
  return [
    ...warnings,
    ...paletteContrastWarnings(palettes[other]).map(
      (warning) => `${SCHEME_NAME[other]}: ${warning}`,
    ),
  ];
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

/**
 * Team colors as color-field swatches (`#rrggbb`, labelled with the Team's
 * name), leaving out the Team `exceptTeamId` and any color that isn't hex.
 */
export function teamSwatches(
  teams: readonly (Pick<Team, "name" | "color"> & { id?: string })[],
  exceptTeamId?: string,
): { color: string; label: string }[] {
  return teams.flatMap((team) => {
    const color = normalizeHex(team.color);
    return color && team.id !== exceptTeamId
      ? [{ color, label: team.name }]
      : [];
  });
}
