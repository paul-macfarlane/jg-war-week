import { describe, expect, it } from "vitest";

import {
  BEST_OF_OPTIONS,
  bestOfLabel,
  defaultGamesConfig,
  finishPointsFor,
  gameTypeLabel,
  gamesConfigOf,
  gamesConfigSchema,
} from "@/lib/games/config";

function messages(
  gameType: Parameters<typeof gamesConfigSchema>[0],
  input: unknown,
) {
  const result = gamesConfigSchema(gameType).safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("gameTypeLabel", () => {
  it("names each Game Type for people", () => {
    expect(gameTypeLabel("head-to-head")).toBe("Head-to-head");
    expect(gameTypeLabel("best-score")).toBe("Best score");
    expect(gameTypeLabel("ranked")).toBe("Ranked");
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

  it("ranked: an empty Finish Points table (one per player beaten)", () => {
    expect(defaultGamesConfig("ranked")).toEqual({ finishPoints: [] });
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

  it("ranked takes Finish Points of zero or more", () => {
    expect(messages("ranked", { finishPoints: [5, 3, 1] })).toEqual([]);
    expect(messages("ranked", { finishPoints: [] })).toEqual([]);
    expect(messages("ranked", { finishPoints: [3, -1] })).toEqual([
      "Finish Points can't be negative.",
    ]);
  });

  it("refuses another Game Type's settings", () => {
    expect(
      messages("ranked", { drawsAllowed: true, bestOf: null }),
    ).not.toEqual([]);
  });
});

describe("gamesConfigOf", () => {
  it("reads a saved config valid for the Game Type", () => {
    expect(
      gamesConfigOf({
        gameType: "best-score",
        gameConfig: { count: "total", betterIs: "higher", unit: "trips" },
      }),
    ).toEqual({ count: "total", betterIs: "higher", unit: "trips" });
  });

  it("falls back to the Game Type's default when nothing valid is saved", () => {
    expect(
      gamesConfigOf({ gameType: "head-to-head", gameConfig: null }),
    ).toEqual({ drawsAllowed: false, bestOf: null });
    expect(
      gamesConfigOf({ gameType: "ranked", gameConfig: { bestOf: 3 } }),
    ).toEqual({ finishPoints: [] });
  });
});

describe("finishPointsFor", () => {
  it("by default gives one point per player beaten", () => {
    expect(finishPointsFor({ finishPoints: [] }, [1, 2, 3, 4])).toEqual([
      3, 2, 1, 0,
    ]);
  });

  it("by default, tied players beat only the players behind them", () => {
    // Places 1, 1, 3: each winner beats one player, the last beats none.
    expect(finishPointsFor({ finishPoints: [] }, [1, 1, 3])).toEqual([1, 1, 0]);
  });

  it("uses the Host's table, and zero past its end", () => {
    expect(finishPointsFor({ finishPoints: [10, 6] }, [2, 1, 3])).toEqual([
      6, 10, 0,
    ]);
  });
});
