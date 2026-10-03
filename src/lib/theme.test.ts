import type { CSSProperties } from "react";
import { describe, expect, it } from "vitest";

import type { WarWeek } from "@/db/schema";
import {
  type Palette,
  backgroundColorScheme,
  contrastRatio,
  derivePalette,
  teamSwatches,
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
  overridePrimaryColor: null,
  overridePrimaryForegroundColor: null,
  overrideAccentColor: null,
  overrideBackgroundColor: null,
  overrideForegroundColor: null,
  logoUrl: "/themes/xi/logo.svg",
  bannerUrl: "/themes/xi/banner.svg",
  fontPreset: "mono",
  wikiUrl: null,
  winner: null,
  highlights: [],
  finaleAwardsLayout: "one-slide",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// War Week XI's seeded base palette: a dark scheme.
const xi: Palette = {
  primary: "#00ff41",
  primaryForeground: "#000000",
  accent: "#008f11",
  background: "#000000",
  foreground: "#d1ffd6",
};

describe("derivePalette", () => {
  it("swaps background and text for the other scheme and lifts primary to read on it", () => {
    const derived = derivePalette(xi);
    expect(derived.background).toBe("#d1ffd6");
    expect(derived.foreground).toBe("#000000");
    expect(derived.primary).toBe("#00801c");
  });

  it("re-derives only the primary text color when the primary is overridden", () => {
    const plain = derivePalette(xi);
    const overridden = derivePalette(xi, { primary: "#0a7a1f" });
    expect(overridden.primary).toBe("#0a7a1f");
    // #0a7a1f reads 5.50:1 under white and 3.82:1 under black.
    expect(overridden.primaryForeground).toBe("#ffffff");
    expect(overridden.background).toBe(plain.background);
    expect(overridden.foreground).toBe(plain.foreground);
    expect(overridden.accent).toBe(plain.accent);
  });

  it("re-derives primary, primary text and accent against an overridden background", () => {
    // The plain derived primary, #00801c, reads only 3.6:1 on #90ee90.
    expect(contrastRatio("#00801c", "#90ee90")).toBeLessThan(4.5);
    const overridden = derivePalette(xi, { background: "#90ee90" });
    expect(overridden.background).toBe("#90ee90");
    expect(overridden.foreground).toBe("#000000");
    expect(overridden.primary).not.toBe("#00801c");
    for (const color of [overridden.primary, overridden.accent]) {
      expect(contrastRatio(color, "#90ee90")).toBeGreaterThanOrEqual(4.5);
    }
    expect(
      contrastRatio(overridden.primaryForeground, overridden.primary),
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps every override exactly as given", () => {
    const overrides: Palette = {
      primary: "#111111",
      primaryForeground: "#222222",
      accent: "#333333",
      background: "#444444",
      foreground: "#555555",
    };
    expect(derivePalette(xi, overrides)).toEqual(overrides);
  });

  it("leaves the base palette untouched", () => {
    const base = { ...xi };
    derivePalette(base, { primary: "#0a7a1f", background: "#ffffff" });
    expect(base).toEqual(xi);
  });
});

describe("warWeekThemeStyle", () => {
  it("maps a War Week's Appearance Theme onto shadcn CSS custom properties", () => {
    expect(warWeekThemeStyle(fixture)).toEqual({
      // XI's base palette is dark, so the derived palette dresses light.
      "--light-primary": "#00801c",
      "--light-primary-foreground": "#ffffff",
      "--light-primary-text": "#00801c",
      "--light-accent": "#007c0d",
      "--light-accent-foreground": "#ffffff",
      "--light-background": "#d1ffd6",
      "--light-foreground": "#000000",
      "--light-card": "#d1ffd6",
      "--light-card-foreground": "#000000",
      "--light-border": "#007c0d",
      "--light-ring": "#00801c",
      "--light-muted": "color-mix(in oklch, #d1ffd6, #000000 12%)",
      "--light-muted-foreground": "color-mix(in oklch, #000000, #d1ffd6 35%)",
      "--light-secondary": "color-mix(in oklch, #d1ffd6, #000000 12%)",
      "--light-secondary-foreground":
        "color-mix(in oklch, #000000, #d1ffd6 35%)",
      "--light-popover": "#d1ffd6",
      "--light-popover-foreground": "#000000",
      "--light-input": "color-mix(in oklch, #d1ffd6, #000000 20%)",
      "--light-warning": "#b45309",
      "--dark-primary": "#00ff41",
      "--dark-primary-foreground": "#000000",
      "--dark-primary-text": "#00ff41",
      "--dark-accent": "#008f11",
      "--dark-accent-foreground": "#000000",
      "--dark-background": "#000000",
      "--dark-foreground": "#d1ffd6",
      "--dark-card": "#000000",
      "--dark-card-foreground": "#d1ffd6",
      "--dark-border": "#008f11",
      "--dark-ring": "#00ff41",
      "--dark-muted": "color-mix(in oklch, #000000, #d1ffd6 12%)",
      "--dark-muted-foreground": "color-mix(in oklch, #d1ffd6, #000000 35%)",
      "--dark-secondary": "color-mix(in oklch, #000000, #d1ffd6 12%)",
      "--dark-secondary-foreground":
        "color-mix(in oklch, #d1ffd6, #000000 35%)",
      "--dark-popover": "#000000",
      "--dark-popover-foreground": "#d1ffd6",
      "--dark-input": "color-mix(in oklch, #000000, #d1ffd6 20%)",
      "--dark-warning": "#fbbf24",
      "--font-sans": "var(--font-preset-mono)",
    });
  });

  it("puts an Organizer's override in the derived scheme's set only", () => {
    const style = warWeekThemeStyle({
      ...fixture,
      overridePrimaryColor: "#0a7a1f",
    }) as unknown as Record<string, string>;
    expect(style["--light-primary"]).toBe("#0a7a1f");
    expect(style["--light-primary-foreground"]).toBe("#ffffff");
    expect(style["--dark-primary"]).toBe("#00ff41");
  });

  it("lifts the warning amber to read on a background it doesn't", () => {
    // amber-700 (#b45309) reads 4.27:1 on #f5ecd7.
    const style = warWeekThemeStyle({
      ...fixture,
      backgroundColor: "#f5ecd7",
      foregroundColor: "#2b1d0e",
    }) as unknown as Record<string, string>;
    expect(style["--light-warning"]).not.toBe("#b45309");
    expect(
      contrastRatio(style["--light-warning"], "#f5ecd7"),
    ).toBeGreaterThanOrEqual(4.5);
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
    const style = warWeekThemeStyle(theme) as unknown as Record<string, string>;
    for (const scheme of ["light", "dark"]) {
      for (const token of BUTTON_TOKENS) {
        const name = token.replace("--", `--${scheme}-`);
        expect(style[name], name).toBeTruthy();
      }
    }
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

describe("backgroundColorScheme", () => {
  it("is dark for a black background", () => {
    expect(backgroundColorScheme("#000000")).toBe("dark");
  });

  it("is light for a white background", () => {
    expect(backgroundColorScheme("#ffffff")).toBe("light");
  });

  it("is dark when white text contrasts more than black", () => {
    // A dark navy: white reads far better on it than black does.
    expect(backgroundColorScheme("#0a0a2a")).toBe("dark");
  });

  it("is light when black text contrasts more than white", () => {
    // A pale yellow: black reads far better on it than white does.
    expect(backgroundColorScheme("#fff8dc")).toBe("light");
  });

  it("falls back to light for a background that isn't hex", () => {
    expect(backgroundColorScheme("not-a-color")).toBe("light");
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
      "Light mode: Text on background is 1.1:1, below 4.5:1 and may be hard to read.",
      "Light mode: Primary text on accent is 1.0:1, below 4.5:1 and may be hard to read.",
    ]);
  });

  it("warns about the derived palette under its scheme's name", () => {
    // A light base; the Organizer's dark scheme primary text is unreadable.
    expect(
      themeContrastWarnings({
        ...fixture,
        backgroundColor: "#ffffff",
        foregroundColor: "#000000",
        primaryColor: "#1d4ed8",
        primaryForegroundColor: "#ffffff",
        accentColor: "#1d4ed8",
        overridePrimaryForegroundColor: "#eeeeee",
        overridePrimaryColor: "#ffffff",
        overrideAccentColor: "#000000",
      }),
    ).toEqual([
      "Dark mode: Primary text on primary is 1.2:1, below 4.5:1 and may be hard to read.",
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

describe("teamSwatches", () => {
  const teams = [
    { id: "red", name: "Red", color: "#F00" },
    { id: "blue", name: "Blue", color: "#0000ff" },
    { id: "odd", name: "Odd", color: "not a color" },
  ];

  it("offers each Team's hex color, labelled with its name", () => {
    expect(teamSwatches(teams)).toEqual([
      { color: "#ff0000", label: "Red" },
      { color: "#0000ff", label: "Blue" },
    ]);
  });

  it("leaves out the Team being edited", () => {
    expect(teamSwatches(teams, "red")).toEqual([
      { color: "#0000ff", label: "Blue" },
    ]);
  });
});
