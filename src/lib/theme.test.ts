import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import type { WarWeek } from "@/db/schema";
import {
  contrastRatio,
  themeContrastWarnings,
  themeSwatches,
  warWeekThemeStyle,
} from "@/lib/theme";

const fixture: WarWeek = {
  id: "11111111-1111-1111-1111-111111111111",
  edition: "xi",
  editionNumber: 11,
  year: 2026,
  startDate: "2026-02-22",
  endDate: "2026-02-27",
  storyTheme: "The Matrix",
  status: "live",
  mode: "teams",
  teamLabel: "Team",
  leaderTitle: "Captain",
  slackChannelUrl: "https://jahnelgroup.slack.com/archives/war-week-xi",
  primaryColor: "#00ff41",
  primaryForegroundColor: "#000000",
  accentColor: "#008f11",
  backgroundColor: "#000000",
  foregroundColor: "#d1ffd6",
  logoUrl: "/themes/xi/logo.svg",
  bannerUrl: "/themes/xi/banner.svg",
  fontPreset: "mono",
  wikiUrl: null,
  organizerEmails: ["pmacfarlane@jahnelgroup.com"],
  winner: null,
  highlights: [],
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

describe("warWeekThemeStyle", () => {
  it("maps a War Week's Appearance Theme onto shadcn CSS custom properties", () => {
    expect(warWeekThemeStyle(fixture)).toEqual({
      "--primary": "#00ff41",
      "--primary-foreground": "#000000",
      "--primary-text": "#00ff41",
      "--accent": "#008f11",
      "--accent-foreground": "#000000",
      "--background": "#000000",
      "--foreground": "#d1ffd6",
      "--card": "#000000",
      "--card-foreground": "#d1ffd6",
      "--border": "#008f11",
      "--ring": "#00ff41",
      "--muted": "color-mix(in oklch, #000000, #d1ffd6 12%)",
      "--muted-foreground": "color-mix(in oklch, #d1ffd6, #000000 35%)",
      "--secondary": "color-mix(in oklch, #000000, #d1ffd6 12%)",
      "--secondary-foreground": "color-mix(in oklch, #d1ffd6, #000000 35%)",
      "--popover": "#000000",
      "--popover-foreground": "#d1ffd6",
      "--input": "color-mix(in oklch, #000000, #d1ffd6 20%)",
      "--font-sans": "var(--font-preset-mono)",
      "--ww-primary": "#00ff41",
    });
  });

  // Every color token the Button variants draw (destructive stays the fixed
  // app red), so no hover or open state falls back to the light defaults.
  const BUTTON_TOKENS = [
    "--primary",
    "--primary-foreground",
    "--background",
    "--foreground",
    "--border",
    "--ring",
    "--muted",
    "--secondary",
    "--secondary-foreground",
    "--input",
  ];

  it.each([
    ["a dark theme", fixture],
    [
      "a light theme",
      {
        ...fixture,
        backgroundColor: "#f5ecd7",
        foregroundColor: "#2b1d0e",
        primaryColor: "#7f0909",
        primaryForegroundColor: "#ffffff",
        accentColor: "#d3a625",
      },
    ],
  ])("sets every token the Button variants reference for %s", (_, theme) => {
    const style = warWeekThemeStyle(theme) as Record<string, string>;
    for (const token of BUTTON_TOKENS) {
      expect(style[token], token).toBeTruthy();
    }
    expect(style["--muted"]).toBe(
      `color-mix(in oklch, ${theme.backgroundColor}, ${theme.foregroundColor} 12%)`,
    );
    expect(style["--muted-foreground"]).toBe(
      `color-mix(in oklch, ${theme.foregroundColor}, ${theme.backgroundColor} 35%)`,
    );
  });

  it("resolves each font preset to its own CSS variable", () => {
    const sansStyle = warWeekThemeStyle({
      ...fixture,
      fontPreset: "sans",
    }) as CSSProperties & Record<string, string>;
    const serifStyle = warWeekThemeStyle({
      ...fixture,
      fontPreset: "serif",
    }) as CSSProperties & Record<string, string>;

    expect(sansStyle["--font-sans"]).toBe("var(--font-preset-sans)");
    expect(serifStyle["--font-sans"]).toBe("var(--font-preset-serif)");
  });
});

describe("contrastRatio", () => {
  it("is 21:1 for black on white and 1:1 for a color on itself", () => {
    expect(contrastRatio("#000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#00ff41", "#00FF41")).toBeCloseTo(1, 5);
  });

  it("is null when a color isn't hex", () => {
    expect(contrastRatio("green", "#fff")).toBeNull();
  });
});

describe("themeContrastWarnings", () => {
  it("has no warnings for a readable theme", () => {
    expect(themeContrastWarnings(fixture)).toEqual([]);
  });

  it("warns about each unreadable text-on-color pair", () => {
    expect(
      themeContrastWarnings({
        ...fixture,
        foregroundColor: "#111111",
        accentColor: "#000000",
      }),
    ).toEqual([
      "Text on background is 1.1:1, below 4.5:1 and may be hard to read.",
      "Primary text on accent is 1.0:1, below 4.5:1 and may be hard to read.",
    ]);
  });

  it("skips pairs with an invalid color", () => {
    expect(
      themeContrastWarnings({ ...fixture, backgroundColor: "nope" }),
    ).toEqual([]);
  });
});

describe("themeSwatches", () => {
  it("offers each Appearance Theme color as a labelled swatch", () => {
    expect(themeSwatches(fixture)).toEqual([
      { color: "#00ff41", label: "Primary" },
      { color: "#000000", label: "Primary text" },
      { color: "#008f11", label: "Accent" },
      { color: "#000000", label: "Background" },
      { color: "#d1ffd6", label: "Text" },
    ]);
  });

  it("expands shorthand hex and skips colors that aren't hex", () => {
    expect(
      themeSwatches({
        ...fixture,
        primaryColor: "#ABC",
        primaryForegroundColor: "",
        accentColor: "nope",
      }),
    ).toEqual([
      { color: "#aabbcc", label: "Primary" },
      { color: "#000000", label: "Background" },
      { color: "#d1ffd6", label: "Text" },
    ]);
  });
});
