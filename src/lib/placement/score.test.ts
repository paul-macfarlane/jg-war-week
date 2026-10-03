import { describe, expect, it } from "vitest";

import {
  SCORE_WITHOUT_PLACE,
  finalizePlacementError,
  orderPlacementRows,
  placementEntryValues,
  placementPointsByRow,
  placesFromScores,
  refilledPlaces,
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

describe("refilledPlaces", () => {
  // Neo and Trinity tie on 40 (both 2nd by the Scores); the Host broke the
  // tie by hand, which these Places don't see: they only say what to fill.
  const before = [
    { id: "ashley", score: 50 },
    { id: "neo", score: 40 },
    { id: "trinity", score: 40 },
    { id: "tank", score: 10 },
  ];

  it("fills only the edited row when no other row's computed place moves, so a manual tie-break survives", () => {
    const after = before.map((row) =>
      row.id === "tank" ? { ...row, score: 20 } : row,
    );
    expect(refilledPlaces(before, after, "higher")).toEqual(
      new Map([["tank", 4]]),
    );
  });

  it("a new top Score shifts every row whose computed place moved", () => {
    const after = before.map((row) =>
      row.id === "tank" ? { ...row, score: 60 } : row,
    );
    expect(refilledPlaces(before, after, "higher")).toEqual(
      new Map([
        ["tank", 1],
        ["ashley", 2],
        ["neo", 3],
        ["trinity", 3],
      ]),
    );
  });

  it("fills a row given its first Score and any row it moves, and leaves a row whose Score is cleared as typed", () => {
    expect(
      refilledPlaces(
        [
          { id: "a", score: 5 },
          { id: "b", score: null },
          { id: "c", score: 3 },
        ],
        [
          { id: "a", score: 5 },
          { id: "b", score: 6 },
          { id: "c", score: null },
        ],
        "lower",
      ),
    ).toEqual(
      new Map([
        ["a", 1],
        ["b", 2],
      ]),
    );
  });
});

describe("orderPlacementRows", () => {
  it("orders placed rows by Place, ties by name, then unplaced rows by name", () => {
    const rows = [
      { id: "1", name: "Tank", place: null },
      { id: "2", name: "Trinity", place: 2 },
      { id: "3", name: "Cypher", place: null },
      { id: "4", name: "Neo", place: 2 },
      { id: "5", name: "Morpheus", place: 1 },
      { id: "6", name: "Dozer", place: 4 },
    ];
    expect(orderPlacementRows(rows).map((row) => row.name)).toEqual([
      "Morpheus",
      "Neo",
      "Trinity",
      "Dozer",
      "Cypher",
      "Tank",
    ]);
  });

  it("breaks a same name and Place tie by id, and leaves its input alone", () => {
    const rows = [
      { id: "b", name: "Neo", place: 1 },
      { id: "a", name: "Neo", place: 1 },
    ];
    expect(orderPlacementRows(rows).map((row) => row.id)).toEqual(["a", "b"]);
    expect(rows.map((row) => row.id)).toEqual(["b", "a"]);
  });
});

describe("placementEntryValues", () => {
  it("writes each placed row's Placement Points to its Participant or Team, noted From placement", () => {
    const found = { id: "darts", warWeekId: "xi", placementPoints: [10, 6] };
    expect(
      placementEntryValues(
        [
          { id: "r1", teamId: null, participantId: "neo", place: 1 },
          { id: "r2", teamId: "red", participantId: null, place: 2 },
          { id: "r3", teamId: null, participantId: "tank", place: null },
        ],
        found,
        {
          actorEmail: "host@jahnelgroup.com",
          seedKeyOf: (rowId) => (rowId === "r1" ? "darts-neo" : null),
        },
      ),
    ).toEqual([
      {
        warWeekId: "xi",
        competitionId: "darts",
        teamId: null,
        participantId: "neo",
        points: 10,
        note: "From placement",
        enteredByEmail: "host@jahnelgroup.com",
        seedKey: "darts-neo",
        generatedByBracket: true,
      },
      {
        warWeekId: "xi",
        competitionId: "darts",
        teamId: "red",
        participantId: null,
        points: 6,
        note: "From placement",
        enteredByEmail: "host@jahnelgroup.com",
        seedKey: null,
        generatedByBracket: true,
      },
    ]);
  });
});
