import { describe, expect, it } from "vitest";

import {
  SCORE_WITHOUT_PLACE,
  finalizePlacementError,
  placementPointsByRow,
  placesFromScores,
} from "@/lib/placement/score";

describe("placesFromScores", () => {
  const rows = [
    { id: "neo", score: 12 },
    { id: "trinity", score: 30 },
    { id: "morpheus", score: 12 },
    { id: "tank", score: null },
    { id: "dozer", score: 7.5 },
  ];

  it("higher wins: the highest Score is 1st, ties share a place and skip the next", () => {
    expect(placesFromScores(rows, "higher")).toEqual(
      new Map([
        ["trinity", 1],
        ["neo", 2],
        ["morpheus", 2],
        ["dozer", 4],
      ]),
    );
  });

  it("lower wins: the lowest Score is 1st, ties share a place and skip the next", () => {
    expect(placesFromScores(rows, "lower")).toEqual(
      new Map([
        ["dozer", 1],
        ["neo", 2],
        ["morpheus", 2],
        ["trinity", 4],
      ]),
    );
  });

  it("leaves a row without a Score out, so its Place stays as typed", () => {
    expect(placesFromScores(rows, "higher").has("tank")).toBe(false);
    expect(placesFromScores([{ id: "a", score: null }], "lower").size).toBe(0);
  });
});

describe("placementPointsByRow", () => {
  const competition = { placementPoints: [10, 6, 3] };

  it("gives each Place its Placement Points; tied rows each get the full points", () => {
    expect(
      placementPointsByRow(
        [
          { id: "a", place: 1 },
          { id: "b", place: 1 },
          { id: "c", place: 3 },
        ],
        competition,
      ),
    ).toEqual([
      { id: "a", points: 10 },
      { id: "b", points: 10 },
      { id: "c", points: 3 },
    ]);
  });

  it("an unplaced row and a Place beyond the list earn nothing", () => {
    expect(
      placementPointsByRow(
        [
          { id: "a", place: null },
          { id: "b", place: 4 },
          { id: "c", place: 2 },
        ],
        competition,
      ),
    ).toEqual([{ id: "c", points: 6 }]);
  });

  it("no Placement Points earns nothing", () => {
    expect(
      placementPointsByRow([{ id: "a", place: 1 }], { placementPoints: null }),
    ).toEqual([]);
  });
});

describe("finalizePlacementError", () => {
  it("refuses a row with a Score and no Place, naming every such row", () => {
    expect(
      finalizePlacementError([
        { name: "Neo", place: 1, score: 3 },
        { name: "Trinity", place: null, score: 2 },
        { name: "Tank", place: null, score: null },
        { name: "Dozer", place: null, score: 0 },
      ]),
    ).toBe(
      "Give every row with a Score a Place, or clear its Score. No Place: Trinity, Dozer.",
    );
    expect(SCORE_WITHOUT_PLACE).toBe(
      "Give every row with a Score a Place, or clear its Score.",
    );
  });

  it("refuses a sheet with nobody placed", () => {
    expect(finalizePlacementError([])).toBe("Give someone a Place first.");
    expect(
      finalizePlacementError([{ name: "Tank", place: null, score: null }]),
    ).toBe("Give someone a Place first.");
  });

  it("allows unplaced rows without a Score beside placed ones", () => {
    expect(
      finalizePlacementError([
        { name: "Neo", place: 1, score: null },
        { name: "Tank", place: null, score: null },
      ]),
    ).toBeNull();
  });
});
