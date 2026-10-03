import { describe, expect, it } from "vitest";

import { parsePlacementPointsText } from "@/lib/placement-points";

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

  it("refuses non-numbers, a rise and negatives", () => {
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
  });

  it("takes any number of places, as long as each is no more than the one above", () => {
    const twelve = [24, 22, 20, 18, 16, 14, 12, 10, 8, 6, 4, 2];
    expect(parsePlacementPointsText(twelve.join(", "))).toEqual({
      ok: true,
      value: twelve,
    });
    const twenty = Array.from({ length: 20 }, (_, i) => 20 - i);
    expect(parsePlacementPointsText(twenty.join(" "))).toEqual({
      ok: true,
      value: twenty,
    });
  });
});
