import { describe, expect, it } from "vitest";

import { formatPoints, formatPointsLabel } from "@/lib/points";

describe("formatPoints", () => {
  it.each([
    [0, "0"],
    [3, "3"],
    [1.5, "1.5"],
    [1.75, "1.75"],
    [1.8, "1.8"],
    [1234.5, "1,234.5"],
  ])("formats %d as %s", (points, expected) => {
    expect(formatPoints(points)).toBe(expected);
  });
});

describe("formatPointsLabel", () => {
  it.each([
    [1, "1 point"],
    [0, "0 points"],
    [2.5, "2.5 points"],
    [1000, "1,000 points"],
    // Shown as "1", so it reads as one point.
    [1.001, "1 point"],
  ])("labels %d as %s", (points, expected) => {
    expect(formatPointsLabel(points)).toBe(expected);
  });
});
