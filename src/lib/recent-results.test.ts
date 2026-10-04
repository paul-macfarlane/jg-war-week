import { describe, expect, it } from "vitest";

import {
  RECENT_RESULTS_LIMIT,
  type RecentResult,
  type ResultCompetition,
  type ResultEntry,
  type ResultTarget,
  shapeRecentResults,
} from "./recent-results";

const red: ResultTarget = {
  id: "t-red",
  name: "Red",
  color: "#f00",
  kind: "team",
};
const blue: ResultTarget = {
  id: "t-blue",
  name: "Blue",
  color: "#00f",
  kind: "team",
};
const at = (minute: number) => new Date(Date.UTC(2027, 1, 22, 12, minute));

const trivia: ResultCompetition = {
  id: "trivia",
  name: "Trivia",
  format: "placement",
  finalizedAt: null,
};

/** A row's Competition name; a Discretionary row has none. */
const competitionOf = (row: RecentResult) =>
  "competition" in row ? row.competition : null;

let n = 0;
function entry(
  competitionId: string,
  target: ResultTarget,
  points: number,
  enteredAt: Date,
  generatedByBracket = false,
): ResultEntry {
  return {
    id: `e${n++}`,
    competitionId,
    points,
    enteredAt,
    generatedByBracket,
    target,
  };
}

describe("shapeRecentResults", () => {
  it("shows nothing when nothing has been scored", () => {
    expect(shapeRecentResults([trivia], [])).toEqual([]);
  });

  it("lists a tie for first between same-named Participants as two winners", () => {
    const sam: ResultTarget = {
      id: "p-sam",
      name: "Sam",
      color: null,
      kind: "participant",
    };
    const otherSam: ResultTarget = { ...sam, id: "p-sam-2" };
    const games: ResultCompetition = {
      id: "g",
      name: "Darts",
      format: "head-to-head",
      finalizedAt: at(5),
    };
    const [row] = shapeRecentResults(
      [games],
      [entry("g", sam, 10, at(5), true), entry("g", otherSam, 10, at(5), true)],
    );
    expect(row).toMatchObject({ winners: [sam, otherSam] });
  });

  it("shows a closed Bracket's Winner instead of its generated entries", () => {
    const bracket: ResultCompetition = {
      id: "b",
      name: "Foosball",
      format: "bracket",
      finalizedAt: at(20),
    };
    const rows = shapeRecentResults(
      [bracket, trivia],
      [entry("b", blue, 5, at(20), true), entry("b", red, 10, at(20), true)],
    );
    expect(rows.map((r) => r.kind)).toEqual(["bracket-finalized"]);
    expect(rows[0]).toMatchObject({ winners: [red], competition: "Foosball" });
  });

  it("shows a closed Head-to-head Competition's winner, listing a tie for first", () => {
    const games: ResultCompetition = {
      id: "g",
      name: "Darts",
      format: "head-to-head",
      finalizedAt: at(5),
    };
    const [row] = shapeRecentResults(
      [games],
      [entry("g", red, 10, at(5), true), entry("g", blue, 10, at(5), true)],
    );
    expect(row).toMatchObject({ kind: "games-closed", winners: [red, blue] });
  });

  it("shows a Closed Placement's winner instead of its generated entries, listing a tie for first", () => {
    const darts: ResultCompetition = {
      id: "darts",
      name: "Darts",
      format: "placement",
      finalizedAt: at(30),
    };
    const rows = shapeRecentResults(
      [darts, trivia],
      [
        entry("darts", red, 10, at(30), true),
        entry("darts", blue, 10, at(30), true),
        entry(
          "darts",
          { ...red, id: "t-green", name: "Green" },
          3,
          at(30),
          true,
        ),
      ],
    );
    expect(rows.map((r) => r.kind)).toEqual(["placement-finalized"]);
    expect(rows[0]).toMatchObject({
      competition: "Darts",
      when: at(30),
      winners: [red, blue],
    });
  });

  it("shows a closed team participation Competition's top Team, listing a tie", () => {
    const workout: ResultCompetition = {
      id: "p",
      name: "Workout",
      format: "participation",
      finalizedAt: at(7),
    };
    const green: ResultTarget = { ...red, id: "t-green", name: "Green" };
    const [row] = shapeRecentResults(
      [workout],
      [
        entry("p", red, 5, at(7), true),
        entry("p", blue, 5, at(7), true),
        entry("p", green, 1, at(7), true),
      ],
    );
    expect(row).toEqual({
      kind: "participation-closed",
      key: "final-p",
      competitionId: "p",
      competition: "Workout",
      when: at(7),
      winners: [red, blue],
      tookPart: null,
    });
  });

  it("shows how many took part in a closed individual participation Competition", () => {
    const spirit: ResultCompetition = {
      id: "s",
      name: "Spirit",
      format: "participation",
      finalizedAt: at(9),
    };
    const person = (id: string): ResultTarget => ({
      id,
      name: id,
      color: null,
      kind: "participant",
    });
    const [row] = shapeRecentResults(
      [spirit],
      ["neo", "trinity", "tank"].map((id) =>
        entry("s", person(id), 1, at(9), true),
      ),
    );
    expect(row).toMatchObject({
      kind: "participation-closed",
      winners: [],
      tookPart: 3,
    });
  });

  it("orders newest first and keeps at most the limit", () => {
    const comps = Array.from({ length: RECENT_RESULTS_LIMIT + 2 }, (_, i) => ({
      ...trivia,
      id: `c${i}`,
      name: `C${i}`,
    }));
    const rows = shapeRecentResults(
      comps.map((c, i) => ({ ...c, finalizedAt: at(i * 30) })),
      comps.map((c, i) => entry(c.id, red, 1, at(i * 30), true)),
    );
    expect(rows).toHaveLength(RECENT_RESULTS_LIMIT);
    expect(competitionOf(rows[0])).toBe(`C${RECENT_RESULTS_LIMIT + 1}`);
    expect(competitionOf(rows.at(-1)!)).toBe("C2");
  });
});

describe("shapeRecentResults with Discretionary points", () => {
  const discretionary = (
    target: ResultTarget,
    points: number,
    reason: string,
    enteredAt: Date,
  ): ResultEntry => ({
    id: `d${n++}`,
    competitionId: null,
    points,
    note: reason,
    enteredAt,
    generatedByBracket: false,
    target,
  });

  it("makes each entry a row of its own, with its reason, among the Competition rows", () => {
    const rows = shapeRecentResults(
      [{ ...trivia, id: "darts", name: "Darts", finalizedAt: at(0) }],
      [
        entry("darts", red, 3, at(0), true),
        discretionary(blue, 4, "Spirit", at(30)),
        discretionary(blue, 1, "Cleanup", at(31)),
      ],
    );
    expect(rows.map((r) => r.kind)).toEqual([
      "discretionary",
      "discretionary",
      "placement-finalized",
    ]);
    expect(rows[0]).toMatchObject({
      target: blue,
      points: 1,
      reason: "Cleanup",
    });
    expect(rows[1]).toMatchObject({ points: 4, reason: "Spirit" });
  });
});
