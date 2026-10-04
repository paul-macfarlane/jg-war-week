import { describe, expect, it } from "vitest";

import { contrastRatio } from "@/lib/color";

import {
  customSlideColors,
  customSlideHeadingError,
  customSlidePlacement,
} from "./custom-finale-slide";

const PALETTE = {
  primary: "#2563eb",
  primaryForeground: "#ffffff",
  accent: "#7c3aed",
  background: "#ffffff",
  foreground: "#111111",
};

describe("customSlideColors", () => {
  // Backgrounds: a light, a dark and the two worst mid-greys (where black and
  // white read about equally).
  for (const [name, background] of [
    ["light", "#f5f5f5"],
    ["dark", "#101827"],
    ["mid", "#777777"],
    ["mid blue", "#3b82f6"],
    ["theme primary", "#2563eb"],
  ] as const) {
    it(`gives every text token at least 4.5:1 on a ${name} background`, () => {
      const colors = customSlideColors(background, PALETTE);
      expect(Object.keys(colors).sort()).toEqual([
        "--foreground",
        "--link",
        "--muted-foreground",
        "--primary-text",
      ]);
      for (const color of Object.values(colors)) {
        expect(contrastRatio(color, background)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }

  it("keeps the theme's text color when it already reads on the background", () => {
    expect(customSlideColors("#ffffff", PALETTE)["--foreground"]).toBe(
      "#111111",
    );
  });

  it("starts from black or white when the theme's colors aren't hex", () => {
    const colors = customSlideColors("#336699", {
      foreground: "rgb(0 0 0)",
      primary: "not a color",
    });
    for (const color of Object.values(colors)) {
      expect(contrastRatio(color, "#336699")).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("swaps the theme's text for black or white when it doesn't read", () => {
    expect(customSlideColors("#111111", PALETTE)["--foreground"]).toBe(
      "#ffffff",
    );
  });
});

describe("customSlidePlacement", () => {
  it("places a new Custom slide just before the Standings slide", () => {
    expect(
      customSlidePlacement([
        "title",
        "numbers",
        "awards",
        "winners",
        "standings",
        "winner",
      ]),
    ).toBe(4);
  });

  it("still goes before the Standings slide when other slides moved", () => {
    expect(customSlidePlacement(["standings", "title", "custom"])).toBe(0);
    expect(customSlidePlacement(["title", "custom", "standings"])).toBe(2);
  });

  it("goes last when there is no Standings slide", () => {
    expect(customSlidePlacement(["title", "winner"])).toBe(2);
  });
});

describe("customSlideHeadingError", () => {
  it("refuses a heading another Custom slide has", () => {
    expect(customSlideHeadingError("Thank you", ["Thank you", "Hi"])).toBe(
      "There's already a Custom slide called Thank you.",
    );
  });

  it("accepts a new heading", () => {
    expect(customSlideHeadingError("Bye", ["Thank you"])).toBeNull();
  });
});
