import { describe, expect, it } from "vitest";

import {
  DEFAULT_RESULTS_SORT,
  ariaSortFor,
  entryPointsFor,
  nextResultsSort,
  sharedRanks,
  showsScore,
  sortResults,
  winnerKeys,
} from "@/lib/results-table";

/** A Placement sheet worked by hand: a tie at 2nd, one unplaced row. */
const ROWS = [
  { key: "ada", rank: 1, name: "Ada", score: 50, points: 10 },
  { key: "cy", rank: 2, name: "Cy", score: 40, points: 6 },
  { key: "bo", rank: 2, name: "Bo", score: 40, points: 6 },
  { key: "dee", rank: 4, name: "Dee", score: 30, points: null },
  { key: "eve", rank: null, name: "Eve", score: null, points: null },
];

const keys = (rows: { key: string }[]) => rows.map((row) => row.key);

describe("sortResults", () => {
  it("defaults to Rank, best first, ties by name, unranked last", () => {
    expect(DEFAULT_RESULTS_SORT).toEqual({
      column: "rank",
      direction: "ascending",
    });
    expect(keys(sortResults(ROWS, DEFAULT_RESULTS_SORT))).toEqual([
      "ada",
      "bo",
      "cy",
      "dee",
      "eve",
    ]);
  });

  it("sorts Rank descending with the unranked row still last", () => {
    expect(
      keys(sortResults(ROWS, { column: "rank", direction: "descending" })),
    ).toEqual(["dee", "bo", "cy", "ada", "eve"]);
  });

  it("sorts by name either way", () => {
    expect(
      keys(sortResults(ROWS, { column: "name", direction: "ascending" })),
    ).toEqual(["ada", "bo", "cy", "dee", "eve"]);
    expect(
      keys(sortResults(ROWS, { column: "name", direction: "descending" })),
    ).toEqual(["eve", "dee", "cy", "bo", "ada"]);
  });

  it("sorts by Score, rows with no Score last either way, ties by Rank then name", () => {
    expect(
      keys(sortResults(ROWS, { column: "score", direction: "ascending" })),
    ).toEqual(["dee", "bo", "cy", "ada", "eve"]);
    expect(
      keys(sortResults(ROWS, { column: "score", direction: "descending" })),
    ).toEqual(["ada", "bo", "cy", "dee", "eve"]);
  });

  it("sorts by points, rows with no points last either way", () => {
    expect(
      keys(sortResults(ROWS, { column: "points", direction: "ascending" })),
    ).toEqual(["bo", "cy", "ada", "dee", "eve"]);
    expect(
      keys(sortResults(ROWS, { column: "points", direction: "descending" })),
    ).toEqual(["ada", "bo", "cy", "dee", "eve"]);
  });

  it("leaves the input in place", () => {
    const before = keys(ROWS);
    sortResults(ROWS, { column: "name", direction: "descending" });
    expect(keys(ROWS)).toEqual(before);
  });
});

describe("ariaSortFor and nextResultsSort", () => {
  it("names the sorted column's direction and none for the others", () => {
    const sort = { column: "points", direction: "descending" } as const;
    expect(ariaSortFor(sort, "points")).toBe("descending");
    expect(ariaSortFor(sort, "rank")).toBe("none");
    expect(ariaSortFor(DEFAULT_RESULTS_SORT, "rank")).toBe("ascending");
  });

  it("flips the sorted column and starts a new one at its natural direction", () => {
    expect(nextResultsSort(DEFAULT_RESULTS_SORT, "rank")).toEqual({
      column: "rank",
      direction: "descending",
    });
    expect(
      nextResultsSort({ column: "rank", direction: "descending" }, "rank"),
    ).toEqual({ column: "rank", direction: "ascending" });
    expect(nextResultsSort(DEFAULT_RESULTS_SORT, "name")).toEqual({
      column: "name",
      direction: "ascending",
    });
    expect(nextResultsSort(DEFAULT_RESULTS_SORT, "score")).toEqual({
      column: "score",
      direction: "descending",
    });
    expect(nextResultsSort(DEFAULT_RESULTS_SORT, "points")).toEqual({
      column: "points",
      direction: "descending",
    });
  });
});

describe("sharedRanks", () => {
  it("gives tied values a shared place and skips the next (1, 1, 3)", () => {
    expect(
      sharedRanks(
        [
          { key: "a", value: 9 },
          { key: "b", value: 7 },
          { key: "c", value: 9 },
          { key: "d", value: null },
        ],
        "higher",
      ),
    ).toEqual(
      new Map([
        ["a", 1],
        ["c", 1],
        ["b", 3],
      ]),
    );
  });

  it("ranks lower values first when lower wins", () => {
    expect(
      sharedRanks(
        [
          { key: "a", value: 12.5 },
          { key: "b", value: 10 },
          { key: "c", value: 12.5 },
        ],
        "lower",
      ),
    ).toEqual(
      new Map([
        ["b", 1],
        ["a", 2],
        ["c", 2],
      ]),
    );
  });
});

describe("winnerKeys", () => {
  it("is every row in first place", () => {
    expect(
      winnerKeys([
        { key: "a", rank: 1 },
        { key: "b", rank: 1 },
        { key: "c", rank: 3 },
      ]),
    ).toEqual(new Set(["a", "b"]));
  });

  it("is nobody when no row is first", () => {
    expect(
      winnerKeys([
        { key: "a", rank: 2 },
        { key: "b", rank: null },
      ]),
    ).toEqual(new Set());
  });
});

describe("showsScore", () => {
  it("is true only when some row has a Score", () => {
    expect(showsScore(ROWS)).toBe(true);
    expect(showsScore([{ score: null }, {}])).toBe(false);
  });
});

describe("entryPointsFor", () => {
  const entries = [
    { teamId: "red", participantId: null, points: 5 },
    { teamId: "red", participantId: null, points: 2.5 },
    { teamId: null, participantId: "ada", points: 10 },
  ];

  it("sums the Points Entries to a Team or a Participant", () => {
    expect(entryPointsFor(entries, { teamId: "red" })).toBe(7.5);
    expect(entryPointsFor(entries, { participantId: "ada" })).toBe(10);
  });

  it("is null for a target with no Points Entry", () => {
    expect(entryPointsFor(entries, { teamId: "blue" })).toBeNull();
    expect(entryPointsFor(entries, { participantId: "bo" })).toBeNull();
    expect(entryPointsFor(entries, {})).toBeNull();
  });
});
