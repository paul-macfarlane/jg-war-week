const HEX_PATTERN = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * Parses a hex color typed into `ColorField`. Accepts an optional leading
 * `#`, 3- or 6-digit hex digits, and surrounding whitespace; always returns
 * a lowercase `#rrggbb` string (3-digit shorthand is expanded), or `null`
 * when the input isn't a hex color.
 */
export function normalizeHex(input: string): string | null {
  const trimmed = input.trim();
  const parts = HEX_PATTERN.exec(trimmed);
  if (!parts) return null;

  const hex = parts[1].toLowerCase();
  const expanded =
    hex.length === 3
      ? hex
          .split("")
          .map((digit) => digit + digit)
          .join("")
      : hex;

  return `#${expanded}`;
}

/** WCAG AA contrast for normal-size text. */
const AA_TEXT = 4.5;

type Rgb = [number, number, number];

/** `#rrggbb` (or shorthand) as sRGB channels in 0–1, or null. */
function toRgb(hex: string): Rgb | null {
  const normalized = hex.trim().startsWith("#") ? normalizeHex(hex) : null;
  if (!normalized) return null;
  return [1, 3, 5].map(
    (i) => parseInt(normalized.slice(i, i + 2), 16) / 255,
  ) as Rgb;
}

function toHex(rgb: Rgb): string {
  return `#${rgb
    .map((c) =>
      Math.round(Math.min(1, Math.max(0, c)) * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

const toLinear = (c: number) =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const fromLinear = (c: number) =>
  c <= 0.0031308
    ? c * 12.92
    : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055;

/** A hex color's WCAG relative luminance, or null when it isn't a hex color. */
function luminance(hex: string): number | null {
  const rgb = toRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** The WCAG contrast ratio of two hex colors (1–21), or null if either isn't one. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la == null || lb == null) return null;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export type Oklch = { l: number; c: number; h: number };

/** A hex color in OKLCH (Björn Ottosson's OKLab), or null when it isn't hex. */
export function toOklch(hex: string): Oklch | null {
  const rgb = toRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map(toLinear);
  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const h = (Math.atan2(B, A) * 180) / Math.PI;
  return { l: L, c: Math.hypot(A, B), h: h < 0 ? h + 360 : h };
}

/** An OKLCH color as `#rrggbb`, clipped into sRGB. */
function fromOklch({ l, c, h }: Oklch): string {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m_ = (l - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s_ = (l - 0.0894841775 * A - 1.291485548 * B) ** 3;
  return toHex(
    [
      4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
      -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
      -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ].map(fromLinear) as Rgb,
  );
}

// Below this chroma a color is gray and its hue is meaningless ("powerless"
// in CSS Color 4), so a mix takes the other color's hue.
const ACHROMATIC = 1e-4;

/**
 * `color-mix(in oklch, a, b percent%)`: `percent` of `b` into `a`, hue by
 * the shorter arc. Both must be hex; returns `#rrggbb`.
 */
export function mixOklch(a: string, b: string, percent: number): string {
  const from = toOklch(a);
  const to = toOklch(b);
  if (!from || !to) throw new Error(`Not hex colors: ${a}, ${b}`);
  const t = percent / 100;
  if (t <= 0) return normalizeHex(a)!;
  if (t >= 1) return normalizeHex(b)!;
  const hueFrom = from.c < ACHROMATIC ? to.h : from.h;
  const hueTo = to.c < ACHROMATIC ? from.h : to.h;
  let delta = hueTo - hueFrom;
  if (delta > 180) delta -= 360;
  if (delta < -180) delta += 360;
  return fromOklch({
    l: from.l + (to.l - from.l) * t,
    c: from.c + (to.c - from.c) * t,
    h: hueFrom + delta * t,
  });
}

const COLOR_MIX =
  /^color-mix\(\s*in oklch\s*,\s*(#[0-9a-f]{3,6})\s*,\s*(#[0-9a-f]{3,6})\s+(\d+(?:\.\d+)?)%\s*\)$/i;

/**
 * Resolves a theme token's CSS value, a hex color or an oklch `color-mix()`
 * of two hex colors (what `warWeekThemeStyle` emits), to `#rrggbb`; null
 * for anything else.
 */
export function resolveCssColor(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed.startsWith("#")) return normalizeHex(trimmed);
  const mix = COLOR_MIX.exec(trimmed);
  if (!mix || !toRgb(mix[1]) || !toRgb(mix[2])) return null;
  return mixOklch(mix[1], mix[2], Number(mix[3]));
}

/**
 * `color` as text on `background`, its oklch lightness and chroma moved
 * toward `toward` (the theme's text color) only as far as it takes to reach
 * WCAG AA. Its hue is kept, so a dark red lifts to a lighter red rather than
 * drifting toward the text color's hue. `toward` itself when even that
 * doesn't read.
 */
export function readableText(
  color: string,
  background: string,
  toward: string,
): string {
  const from = toOklch(color);
  const to = toOklch(toward);
  if (!from || !to) throw new Error(`Not hex colors: ${color}, ${toward}`);
  for (let percent = 0; percent < 100; percent += 5) {
    const t = percent / 100;
    const candidate =
      t === 0
        ? normalizeHex(color)!
        : fromOklch({
            l: from.l + (to.l - from.l) * t,
            c: from.c + (to.c - from.c) * t,
            h: from.h,
          });
    if ((contrastRatio(candidate, background) ?? 0) >= AA_TEXT) {
      return candidate;
    }
  }
  return normalizeHex(toward)!;
}

/**
 * The text color for a `surface`: `preferred` when it reaches WCAG AA,
 * otherwise black or white, whichever reads better.
 */
export function readableOn(surface: string, preferred: string): string {
  if ((contrastRatio(preferred, surface) ?? 0) >= AA_TEXT) {
    return normalizeHex(preferred) ?? preferred;
  }
  const onBlack = contrastRatio("#000000", surface) ?? 0;
  const onWhite = contrastRatio("#ffffff", surface) ?? 0;
  return onBlack >= onWhite ? "#000000" : "#ffffff";
}
