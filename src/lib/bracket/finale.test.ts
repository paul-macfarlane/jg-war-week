import { describe, expect, it } from "vitest";

import { bracketFinaleRanks, bracketFinaleRows } from "@/lib/bracket/finale";

const entrants = [
  { id: "red", seedPosition: 1, label: "Red", color: "#f00" },
  { id: "blue", seedPosition: 2, label: "Blue", color: "#00f" },
  { id: "gold", seedPosition: 3, label: "Gold", color: null },
  { id: "green", seedPosition: 4, label: "Green", color: "#0f0" },
];

// A four-Entrant single elimination: Gold beat Red in the final; Blue and
// Green lost their semifinals, so they share 3rd.
const placings = [
  { entrantId: "green", place: 3 },
  { entrantId: "red", place: 2 },
  { entrantId: "blue", place: 3 },
  { entrantId: "gold", place: 1 },
];

describe("bracketFinaleRows", () => {
  it("lists each Entrant with its label, color and place, by place then Seed Position", () => {
    expect(bracketFinaleRows(placings, entrants)).toEqual([
      { entrantId: "gold", label: "Gold", color: null, place: 1 },
      { entrantId: "red", label: "Red", color: "#f00", place: 2 },
      { entrantId: "blue", label: "Blue", color: "#00f", place: 3 },
      { entrantId: "green", label: "Green", color: "#0f0", place: 3 },
    ]);
  });

  it("is empty with no placings", () => {
    expect(bracketFinaleRows([], entrants)).toEqual([]);
  });
});

describe("bracketFinaleRanks", () => {
  it("is each row's place, so tied 3rds share a step and the Winner comes last", () => {
    expect(bracketFinaleRanks(bracketFinaleRows(placings, entrants))).toEqual([
      1, 2, 3, 3,
    ]);
  });
});
