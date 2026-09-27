import { describe, expect, it } from "vitest";

import { heats } from "@/lib/bracket/heats";
import { pointsFor } from "@/lib/bracket/points";

// 8 Entrants: 1st, 2nd, tied 3rd, tied 5th.
const placings = [
  { entrantId: "a", place: 1 },
  { entrantId: "b", place: 2 },
  { entrantId: "c", place: 3 },
  { entrantId: "d", place: 3 },
  { entrantId: "e", place: 5 },
  { entrantId: "f", place: 5 },
  { entrantId: "g", place: 5 },
  { entrantId: "h", place: 5 },
];

describe("pointsFor", () => {
  it("gives each tied place that place's Placement Points", () => {
    expect(pointsFor(placings, { placementPoints: [10, 6, 3] })).toEqual([
      { entrantId: "a", points: 10 },
      { entrantId: "b", points: 6 },
      { entrantId: "c", points: 3 },
      { entrantId: "d", points: 3 },
    ]);
  });

  it("covers places up to 5th", () => {
    expect(
      pointsFor(placings, { placementPoints: [5, 4, 3, 2, 1] }).map(
        (p) => p.points,
      ),
    ).toEqual([5, 4, 3, 3, 1, 1, 1, 1]);
  });

  it("awards nothing without Placement Points", () => {
    expect(pointsFor(placings, { placementPoints: null })).toEqual([]);
  });

  it("a Heats Bracket's placings", () => {
    // 8 Entrants, 4 per Heat, 2 advancing: the final finishes e1 e2 e5 e6
    // and the four Round-1 losers tie 5th.
    const entrants = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i + 1}`,
      seedPosition: i + 1,
      label: `E${i + 1}`,
    }));
    let bracket = heats.generate(
      { entrantsPerHeat: 4, advancePerHeat: 2 },
      entrants,
      (r, p) => `r${r}h${p}`,
    );
    bracket = heats.applyResult(bracket, "r1h1", {
      order: ["e1", "e5", "e4", "e8"],
    });
    bracket = heats.applyResult(bracket, "r1h2", {
      order: ["e2", "e6", "e3", "e7"],
    });
    bracket = heats.applyResult(bracket, "r2h1", {
      order: ["e1", "e2", "e5", "e6"],
    });
    expect(
      pointsFor(heats.finalPlacings(bracket, entrants), {
        placementPoints: [5, 3, 1],
      }),
    ).toEqual([
      { entrantId: "e1", points: 5 },
      { entrantId: "e2", points: 3 },
      { entrantId: "e5", points: 1 },
    ]);
  });
});
