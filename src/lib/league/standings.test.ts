import { describe, expect, it } from "vitest";

import type { LeagueResult } from "@/lib/enums";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import {
  formatMatchPoints,
  leaguePlacings,
  leagueStandings,
} from "@/lib/league/standings";

/** "A–B a" style rows: round, A, B (null for a bye), result. */
const m = (
  round: number,
  a: string,
  b: string | null,
  result: LeagueResult | null = null,
): LeagueMatchFacts => ({ round, a, b, result });

describe("a round robin of 5 (the A–E fixture)", () => {
  // A beat B, A–C draw, A beat D, E beat A, B beat C, B–D draw, B beat E,
  // C beat D, C–E draw, D–E draw; one sits out each round.
  const matches = [
    m(1, "A", "B", "a"),
    m(1, "C", "D", "a"),
    m(1, "E", null),
    m(2, "A", "C", "draw"),
    m(2, "B", "E", "a"),
    m(2, "D", null),
    m(3, "A", "D", "a"),
    m(3, "C", "E", "draw"),
    m(3, "B", null),
    m(4, "A", "E", "b"),
    m(4, "B", "D", "draw"),
    m(4, "C", null),
    m(5, "B", "C", "a"),
    m(5, "D", "E", "draw"),
    m(5, "A", null),
  ];
  const rows = leagueStandings(
    "round-robin",
    ["A", "B", "C", "D", "E"],
    matches,
  );
  const row = (id: string) => rows.find((r) => r.entrantId === id)!;

  it("ranks A, B, E, C, D: A over B on head-to-head, E over C on Sonneborn-Berger", () => {
    expect(rows.map((r) => [r.entrantId, r.rank])).toEqual([
      ["A", 1],
      ["B", 2],
      ["E", 3],
      ["C", 4],
      ["D", 5],
    ]);
  });

  it("gives match points 2½, 2½, 2, 2, 1, a sit-out worth 0", () => {
    expect(rows.map((r) => r.matchPoints)).toEqual([2.5, 2.5, 2, 2, 1]);
    expect(rows.map((r) => r.byes)).toEqual([1, 1, 1, 1, 1]);
  });

  it("counts W / D / L over played Matches only", () => {
    expect(row("A")).toMatchObject({ played: 4, wins: 2, draws: 1, losses: 1 });
    expect(row("D")).toMatchObject({ played: 4, wins: 0, draws: 2, losses: 2 });
  });

  it("shows head-to-head only on rows tied on match points", () => {
    expect(rows.map((r) => [r.entrantId, r.headToHead])).toEqual([
      ["A", 1],
      ["B", 0],
      ["E", 0.5],
      ["C", 0.5],
      ["D", null],
    ]);
  });

  it("works out Sonneborn-Berger as hand-worked: C 3.25, E 4", () => {
    // A: B 2½ + D 1 + ½·C 2 = 4.5; B: C 2 + E 2 + ½·D 1 = 4.5;
    // C: D 1 + ½·A 2½ + ½·E 2 = 3.25; E: A 2½ + ½·C 2 + ½·D 1 = 4;
    // D: ½·B 2½ + ½·E 2 = 2.25.
    expect(rows.map((r) => [r.entrantId, r.sonnebornBerger])).toEqual([
      ["A", 4.5],
      ["B", 4.5],
      ["E", 4],
      ["C", 3.25],
      ["D", 2.25],
    ]);
    expect(rows.every((r) => r.buchholz === null)).toBe(true);
  });
});

describe("a round robin still tied after head-to-head and Sonneborn-Berger", () => {
  // A–B draw; A and B each beat C and D; C beat D. A and B: 2½ each, ½
  // each head-to-head, SB 2.25 each.
  const rows = leagueStandings(
    "round-robin",
    ["A", "B", "C", "D"],
    [
      m(1, "A", "B", "draw"),
      m(1, "C", "D", "a"),
      m(2, "A", "C", "a"),
      m(2, "B", "D", "a"),
      m(3, "A", "D", "a"),
      m(3, "B", "C", "a"),
    ],
  );

  it("shares the place: 1, 1, 3, 4", () => {
    expect(rows.map((r) => [r.entrantId, r.rank])).toEqual([
      ["A", 1],
      ["B", 1],
      ["C", 3],
      ["D", 4],
    ]);
    expect(rows[0]).toMatchObject({ headToHead: 0.5, sonnebornBerger: 2.25 });
    expect(rows[1]).toMatchObject({ headToHead: 0.5, sonnebornBerger: 2.25 });
  });

  it("gives Placings by those places", () => {
    expect(leaguePlacings(rows)).toEqual([
      { entrantId: "A", place: 1 },
      { entrantId: "B", place: 1 },
      { entrantId: "C", place: 3 },
      { entrantId: "D", place: 4 },
    ]);
  });
});

describe("a Swiss League of 9 over 4 rounds (the 1–9 fixture)", () => {
  const matches = [
    m(1, "1", "5", "a"),
    m(1, "2", "6", "draw"),
    m(1, "3", "7", "a"),
    m(1, "4", "8", "b"),
    m(1, "9", null),
    m(2, "1", "3", "a"),
    m(2, "8", "9", "draw"),
    m(2, "2", "5", "a"),
    m(2, "6", "7", "b"),
    m(2, "4", null),
    m(3, "1", "8", "draw"),
    m(3, "2", "9", "b"),
    m(3, "3", "6", "a"),
    m(3, "7", "4", "a"),
    m(3, "5", null),
    m(4, "1", "9", "a"),
    m(4, "8", "3", "b"),
    m(4, "7", "2", "draw"),
    m(4, "4", "5", "draw"),
    m(4, "6", null),
  ];
  const rows = leagueStandings(
    "swiss",
    ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
    matches,
  );

  it("matches the hand-worked match points and Buchholz", () => {
    expect(
      rows.map((r) => [r.entrantId, r.matchPoints, r.buchholz, r.rank]),
    ).toEqual([
      ["1", 3.5, 9, 1],
      ["3", 3, 9.5, 2],
      ["7", 2.5, 8, 3],
      ["9", 2.5, 7.5, 4],
      ["8", 2, 10.5, 5],
      ["2", 2, 8, 6],
      ["6", 1.5, 7.5, 7],
      ["5", 1.5, 7, 8],
      ["4", 1.5, 6, 9],
    ]);
  });

  it("counts a bye as 1 match point but not as a Match played", () => {
    const nine = rows.find((r) => r.entrantId === "9")!;
    expect(nine).toMatchObject({
      byes: 1,
      played: 3,
      wins: 1,
      draws: 1,
      losses: 1,
    });
    expect(rows.every((r) => r.headToHead === null)).toBe(true);
    expect(rows.every((r) => r.sonnebornBerger === null)).toBe(true);
  });
});

describe("Matches not yet played", () => {
  it("count for nothing, in match points or in Buchholz", () => {
    const rows = leagueStandings(
      "swiss",
      ["A", "B", "C", "D"],
      [m(1, "A", "B", "a"), m(1, "C", "D")],
    );
    expect(rows.map((r) => [r.entrantId, r.matchPoints, r.buchholz])).toEqual([
      ["A", 1, 0],
      ["B", 0, 1],
      ["C", 0, 0],
      ["D", 0, 0],
    ]);
    expect(rows.map((r) => r.rank)).toEqual([1, 2, 3, 3]);
  });
});

describe("formatMatchPoints", () => {
  it.each([
    [0, "0"],
    [0.5, "½"],
    [1, "1"],
    [2.5, "2½"],
    [10, "10"],
  ])("writes %d as %s", (points, text) => {
    expect(formatMatchPoints(points)).toBe(text);
  });
});
