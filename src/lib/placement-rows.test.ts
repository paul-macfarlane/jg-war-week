import { describe, expect, it } from "vitest";

import {
  placementPointsFromRows,
  placementRowErrors,
  rowsFromPlacementPoints,
} from "@/lib/placement-rows";

describe("rowsFromPlacementPoints", () => {
  it("splits the saved Placement Points text into one row per place", () => {
    expect(rowsFromPlacementPoints("5, 3, 1")).toEqual(["5", "3", "1"]);
  });

  it("gives no rows for empty Placement Points", () => {
    expect(rowsFromPlacementPoints("")).toEqual([]);
    expect(rowsFromPlacementPoints("   ")).toEqual([]);
  });
});

describe("placementPointsFromRows", () => {
  it("joins rows into the comma-separated text the Competition form submits", () => {
    expect(placementPointsFromRows(["5", "3", "1"])).toBe("5, 3, 1");
  });

  it("gives empty text for no rows and skips blank rows", () => {
    expect(placementPointsFromRows([])).toBe("");
    expect(placementPointsFromRows(["10", " ", ""])).toBe("10");
  });

  it("round-trips with rowsFromPlacementPoints", () => {
    for (const text of ["5, 3, 1", "", "10, 7.5, 5, 2, 1"]) {
      expect(placementPointsFromRows(rowsFromPlacementPoints(text))).toBe(text);
    }
  });
});

describe("placementRowErrors", () => {
  it("has no errors for a valid set", () => {
    expect(placementRowErrors(["5", "3", "1"])).toEqual([]);
    expect(placementRowErrors(["5", "5", "0"])).toEqual([]);
    expect(placementRowErrors([])).toEqual([]);
  });

  it("flags a place worth more than the place above it", () => {
    expect(placementRowErrors(["3", "5"])).toEqual([
      "Each place's Placement Points must be no more than the place above it.",
    ]);
  });

  it("flags a negative value", () => {
    expect(placementRowErrors(["5", "-1"])).toEqual([
      "Placement Points can't be negative.",
    ]);
  });

  it("flags a value that isn't a number", () => {
    expect(placementRowErrors(["5", "abc"])).toEqual([
      "Each place's Placement Points must be a number.",
    ]);
  });

  it("caps the rows at the Format's limit, and at none without one", () => {
    const six = ["6", "5", "4", "3", "2", "1"];
    expect(placementRowErrors(six, 5)).toEqual([
      "Placement Points cover at most 5 places for this Format.",
    ]);
    expect(placementRowErrors(six)).toEqual([]);
    expect(placementRowErrors(six, null)).toEqual([]);
  });

  it("flags a blank row sitting above a filled one", () => {
    expect(placementRowErrors(["5", "", "1"])).toEqual([
      "Fill in every place above the last one, or remove it.",
    ]);
  });

  it("ignores a blank trailing row", () => {
    expect(placementRowErrors(["5", "3", ""])).toEqual([]);
  });
});
