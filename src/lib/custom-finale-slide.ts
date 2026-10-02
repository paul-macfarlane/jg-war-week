/**
 * Custom Finale slides (CONTEXT.md, "Custom slide"): where a new one goes,
 * the one-heading-per-War-Week rule and the colors that keep its text
 * readable on the Organizer's background. Pure.
 */
import {
  contrastRatio,
  mixOklch,
  normalizeHex,
  readableOn,
  readableText,
} from "@/lib/color";
import type { FinaleSlideKind } from "@/lib/enums";
import type { Palette } from "@/lib/theme";

/** WCAG AA for normal-size text. */
const AA = 4.5;

/** The refusal for a heading another Custom slide already has. */
export function duplicateCustomSlideError(heading: string): string {
  return `There's already a Custom slide called ${heading}.`;
}

/** Refuses a heading the War Week's other Custom slides already use. */
export function customSlideHeadingError(
  heading: string,
  otherHeadings: string[],
): string | null {
  return otherHeadings.includes(heading)
    ? duplicateCustomSlideError(heading)
    : null;
}

/**
 * The place a new Custom slide takes in a list of slide kinds: just before
 * the Standings slide (even when it's hidden), else last.
 */
export function customSlidePlacement(kinds: FinaleSlideKind[]): number {
  const standings = kinds.indexOf("standings");
  return standings === -1 ? kinds.length : standings;
}

/** The CSS custom properties a Custom slide with a background overrides. */
export type CustomSlideColors = {
  "--foreground": string;
  "--muted-foreground": string;
  "--primary-text": string;
  "--link": string;
};

/**
 * The text colors for a Custom slide on `background` (`#rrggbb`), every one
 * at least WCAG AA against it: the theme's text color when it reads, else
 * black or white; muted text a step toward the background, only while it
 * still reads; primary-colored text and links the theme's primary lifted
 * only as far as it takes. `palette` is the theme's palette; its colors
 * are only starting points.
 */
export function customSlideColors(
  background: string,
  palette: Pick<Palette, "foreground" | "primary">,
): CustomSlideColors {
  const bg = normalizeHex(background);
  if (!bg) throw new Error(`Not a hex color: ${background}`);
  // A theme color that isn't hex yet is no starting point at all.
  const foreground = readableOn(bg, normalizeHex(palette.foreground) ?? "#000");
  const muted = mixOklch(foreground, bg, 35);
  const primaryText = readableText(
    normalizeHex(palette.primary) ?? foreground,
    bg,
    foreground,
  );
  return {
    "--foreground": foreground,
    "--muted-foreground":
      (contrastRatio(muted, bg) ?? 0) >= AA ? muted : foreground,
    "--primary-text": primaryText,
    "--link": primaryText,
  };
}
