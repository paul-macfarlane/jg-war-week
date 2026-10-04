import { describe, expect, it } from "vitest";

import {
  BEST_OF_OPTIONS,
  bestOfLabel,
  defaultGamesConfig,
  gameFormatLabel,
  gamesConfigOf,
  gamesConfigSchema,
} from "@/lib/games/config";

function messages(
  gameFormat: Parameters<typeof gamesConfigSchema>[0],
  input: unknown,
) {
  const result = gamesConfigSchema(gameFormat).safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("gameFormatLabel", () => {
  it("names each Format for people", () => {
    expect(gameFormatLabel("head-to-head")).toBe("Head-to-head");
    expect(gameFormatLabel("best-score")).toBe("Best score");
  });
});

describe("bestOfLabel", () => {
  it("reads Off, or Best of N", () => {
    expect(bestOfLabel(null)).toBe("Off");
    expect(bestOfLabel(5)).toBe("Best of 5");
  });

  it("offers 3, 5 and 7", () => {
    expect(BEST_OF_OPTIONS).toEqual([3, 5, 7]);
  });
});

describe("defaultGamesConfig", () => {
  it("head-to-head: no draws, no Best of", () => {
    expect(defaultGamesConfig("head-to-head")).toEqual({
      drawsAllowed: false,
      bestOf: null,
    });
  });

  it("best-score: the best score counts, higher is better, no unit", () => {
    expect(defaultGamesConfig("best-score")).toEqual({
      count: "best",
      betterIs: "higher",
      unit: "",
    });
  });
});

describe("gamesConfigSchema", () => {
  it("head-to-head accepts Best of off, 3, 5 or 7", () => {
    expect(
      messages("head-to-head", { drawsAllowed: true, bestOf: null }),
    ).toEqual([]);
    expect(
      messages("head-to-head", { drawsAllowed: false, bestOf: 7 }),
    ).toEqual([]);
    expect(
      messages("head-to-head", { drawsAllowed: false, bestOf: 4 }),
    ).toEqual(["Best of is off, 3, 5 or 7."]);
  });

  it("best-score takes best or total, higher or lower, and a short unit", () => {
    expect(
      messages("best-score", {
        count: "total",
        betterIs: "lower",
        unit: "trips",
      }),
    ).toEqual([]);
    expect(
      messages("best-score", { count: "most", betterIs: "higher", unit: "" }),
    ).not.toEqual([]);
    expect(
      messages("best-score", {
        count: "best",
        betterIs: "higher",
        unit: "x".repeat(21),
      }),
    ).toEqual(["A unit is at most 20 characters."]);
  });

  it("refuses another Format's settings", () => {
    expect(
      messages("best-score", { drawsAllowed: true, bestOf: null }),
    ).not.toEqual([]);
  });
});

describe("gamesConfigOf", () => {
  it("reads a saved config valid for the Format", () => {
    expect(
      gamesConfigOf({
        format: "best-score",
        gameConfig: { count: "total", betterIs: "higher", unit: "trips" },
      }),
    ).toEqual({ count: "total", betterIs: "higher", unit: "trips" });
  });

  it("falls back to the Format's default when nothing valid is saved", () => {
    expect(gamesConfigOf({ format: "head-to-head", gameConfig: null })).toEqual(
      { drawsAllowed: false, bestOf: null },
    );
    expect(
      gamesConfigOf({ format: "best-score", gameConfig: { bestOf: 3 } }),
    ).toEqual({ count: "best", betterIs: "higher", unit: "" });
  });
});
