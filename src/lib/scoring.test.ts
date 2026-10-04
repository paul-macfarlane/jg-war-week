import { describe, expect, it } from "vitest";

import {
  finishingOrder,
  isSetByHand,
  orderByScore,
  scoreLabel,
  scoringOf,
} from "@/lib/scoring";

describe("scoreLabel", () => {
  it("adds the unit in brackets, and is plain without one", () => {
    expect(scoreLabel({ direction: "lower", unit: "sec" })).toBe("Score (sec)");
    expect(scoreLabel({ direction: "higher", unit: null })).toBe("Score");
    expect(scoreLabel({ direction: "none", unit: "  " })).toBe("Score");
  });
});

describe("scoringOf", () => {
  it("reads a Competition's direction and unit, an empty unit being none", () => {
    expect(scoringOf({ scoreDirection: "lower", scoreUnit: "sec" })).toEqual({
      direction: "lower",
      unit: "sec",
    });
    expect(scoringOf({ scoreDirection: "none", scoreUnit: "" })).toEqual({
      direction: "none",
      unit: null,
    });
  });
});

describe("orderByScore", () => {
  const rows = [
    { id: "a", score: 10 },
    { id: "b", score: 12.5 },
    { id: "c", score: 10 },
    { id: "d", score: null },
  ];

  it("ranks higher-is-better highest first, ties sharing a place and skipping the next", () => {
    expect(Object.fromEntries(orderByScore(rows, "higher"))).toEqual({
      b: 1,
      a: 2,
      c: 2,
    });
  });

  it("ranks lower-is-better lowest first", () => {
    expect(Object.fromEntries(orderByScore(rows, "lower"))).toEqual({
      a: 1,
      c: 1,
      b: 3,
    });
  });

  it("leaves a row without a Score out", () => {
    expect(orderByScore(rows, "higher").has("d")).toBe(false);
  });
});

describe("isSetByHand", () => {
  const scored = [
    { id: "a", score: 5, place: 1 },
    { id: "b", score: 7, place: 2 },
  ];

  it("is false when the order follows the Scores", () => {
    expect(isSetByHand(scored, "lower")).toBe(false);
  });

  it("is true when the order differs from the Scores", () => {
    expect(isSetByHand(scored, "higher")).toBe(true);
  });

  it("is true when a Score tie was settled by hand", () => {
    expect(
      isSetByHand(
        [
          { id: "a", score: 5, place: 1 },
          { id: "b", score: 5, place: 2 },
        ],
        "higher",
      ),
    ).toBe(true);
  });

  it("is false for a shared place on equal Scores", () => {
    expect(
      isSetByHand(
        [
          { id: "a", score: 5, place: 1 },
          { id: "b", score: 5, place: 1 },
        ],
        "higher",
      ),
    ).toBe(false);
  });

  it("is false with no direction, or while a Score is still missing", () => {
    expect(isSetByHand(scored, "none")).toBe(false);
    expect(
      isSetByHand([...scored, { id: "c", score: null, place: 3 }], "higher"),
    ).toBe(false);
  });
});

describe("finishingOrder", () => {
  const entries = (a: number | null, b: number | null, c: number | null) => [
    { id: "a", score: a },
    { id: "b", score: b },
    { id: "c", score: c },
  ];

  it("orders a Match's Entrants by their Scores once every Score is in (AC 5)", () => {
    expect(finishingOrder(entries(3, 9, 5), "higher")).toEqual({
      order: ["b", "c", "a"],
      tied: false,
    });
    expect(finishingOrder(entries(3, 9, 5), "lower")).toEqual({
      order: ["a", "c", "b"],
      tied: false,
    });
  });

  it("flags equal Scores as a tie to settle by hand, keeping their given order", () => {
    expect(finishingOrder(entries(5, 9, 5), "higher")).toEqual({
      order: ["b", "a", "c"],
      tied: true,
    });
  });

  it("works nothing out with direction none or a Score missing", () => {
    expect(finishingOrder(entries(3, 9, 5), "none")).toBeNull();
    expect(finishingOrder(entries(3, null, 5), "higher")).toBeNull();
  });
});
