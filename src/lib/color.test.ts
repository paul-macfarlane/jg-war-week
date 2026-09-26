import { describe, expect, it } from "vitest";

import {
  contrastRatio,
  mixOklch,
  normalizeHex,
  readableOn,
  readableText,
  resolveCssColor,
  toOklch,
} from "@/lib/color";

describe("normalizeHex", () => {
  it.each([
    ["#abc", "#aabbcc"],
    ["abc", "#aabbcc"],
    ["#AABBCC", "#aabbcc"],
    [" aabbcc ", "#aabbcc"],
    ["#1a2b3c", "#1a2b3c"],
    ["1A2B3C", "#1a2b3c"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeHex(input)).toBe(expected);
  });

  it.each([
    ["not-a-color"],
    ["#12345"],
    ["#1234567"],
    ["#gggggg"],
    [""],
    ["   "],
    ["#12g"],
  ])("rejects %s", (input) => {
    expect(normalizeHex(input)).toBeNull();
  });
});

describe("contrastRatio", () => {
  it("matches the WCAG reference ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    // #767676 is the lightest gray that passes AA on white.
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
    expect(contrastRatio("#777777", "#ffffff")).toBeLessThan(4.5);
  });

  it("is null when a color isn't hex", () => {
    expect(contrastRatio("red", "#ffffff")).toBeNull();
  });
});

describe("toOklch", () => {
  it("converts sRGB red to its published OKLCH value", () => {
    const { l, c, h } = toOklch("#ff0000")!;
    expect(l).toBeCloseTo(0.628, 3);
    expect(c).toBeCloseTo(0.2577, 3);
    expect(h).toBeCloseTo(29.23, 1);
  });
});

describe("mixOklch", () => {
  it("mixes black and white halfway to oklch(0.5 0 0)", () => {
    expect(mixOklch("#000000", "#ffffff", 50)).toBe("#636363");
  });

  it("returns the first color at 0% and the second at 100%", () => {
    expect(mixOklch("#b91c1c", "#f3f4f6", 0)).toBe("#b91c1c");
    expect(mixOklch("#b91c1c", "#f3f4f6", 100)).toBe("#f3f4f6");
  });
});

describe("resolveCssColor", () => {
  it("resolves hex colors and oklch color-mix() to #rrggbb", () => {
    expect(resolveCssColor("#ABC")).toBe("#aabbcc");
    expect(resolveCssColor("color-mix(in oklch, #000000, #ffffff 50%)")).toBe(
      "#636363",
    );
  });

  it("is null for anything else", () => {
    expect(resolveCssColor("red")).toBeNull();
    expect(resolveCssColor("color-mix(in srgb, #000, #fff 50%)")).toBeNull();
  });
});

describe("readableText", () => {
  it("keeps a color that already reads at 4.5:1", () => {
    expect(readableText("#767676", "#ffffff", "#000000")).toBe("#767676");
  });

  it("moves a too-light color toward the text color only as far as needed", () => {
    const readable = readableText("#aaaaaa", "#ffffff", "#000000");
    expect(contrastRatio(readable, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(readable, "#ffffff")).toBeLessThan(6);
  });

  it("lifts a dark red on a dark background", () => {
    const readable = readableText("#b91c1c", "#111827", "#f3f4f6");
    expect(contrastRatio(readable, "#111827")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("readableOn", () => {
  it("keeps the preferred text color when it reads on the surface", () => {
    expect(readableOn("#0f766e", "#ffffff")).toBe("#ffffff");
  });

  it("falls back to black or white, whichever reads better", () => {
    // White on amber is about 2.1:1.
    expect(readableOn("#f59e0b", "#ffffff")).toBe("#000000");
    expect(readableOn("#ffe81f", "#ffff00")).toBe("#000000");
    expect(readableOn("#1e3a8a", "#1d4ed8")).toBe("#ffffff");
  });
});
