import { describe, expect, it } from "vitest";

import {
  firstPlaceOverMax,
  parsePlacementPointsText,
} from "@/lib/placement-points";

describe("parsePlacementPointsText", () => {
  it("reads comma or space separated points, highest first", () => {
    expect(parsePlacementPointsText("5, 3 1")).toEqual({
      ok: true,
      value: [5, 3, 1],
    });
  });

  it("treats blank or absent as none", () => {
    expect(parsePlacementPointsText("  ")).toEqual({ ok: true, value: null });
    expect(parsePlacementPointsText(undefined)).toEqual({
      ok: true,
      value: null,
    });
  });

  it("refuses non-numbers, a rise, negatives and too many places", () => {
    const error = (text: string) => {
      const parsed = parsePlacementPointsText(text);
      return parsed.ok ? null : parsed.error;
    };
    expect(error("5, x")).toBe(
      "Placement Points must be numbers separated by commas, 1st place first.",
    );
    expect(error("3, 5")).toBe(
      "Each place's Placement Points must be no more than the place above it.",
    );
    expect(error("3, -1")).toBe("Placement Points must be at least 0.");
    expect(error("1.234")).toBe(
      "Placement Points must have at most two decimal places.",
    );
    expect(error("6, 5, 4, 3, 2, 1, 0")).toMatch(/cover at most/);
  });
});

describe("firstPlaceOverMax", () => {
  it("is true only when 1st place beats Max points", () => {
    expect(firstPlaceOverMax([5, 3], 4)).toBe(true);
    expect(firstPlaceOverMax([4, 3], 4)).toBe(false);
    expect(firstPlaceOverMax([5], null)).toBe(false);
    expect(firstPlaceOverMax(null, 4)).toBe(false);
  });
});
