import { describe, expect, it } from "vitest";

import {
  type ResultCompetition,
  type ResultEntry,
  type ResultTarget,
  shapeRecentResults,
} from "./recent-results";

const red: ResultTarget = { name: "Red", color: "#f00", kind: "team" };
const blue: ResultTarget = { name: "Blue", color: "#00f", kind: "team" };
const at = (minute: number) => new Date(Date.UTC(2027, 1, 22, 12, minute));

const trivia: ResultCompetition = {
  id: "trivia",
  name: "Trivia",
  format: "points",
  finalizedAt: null,
};

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

  it("collapses Points Entries of one Competition added together into one row", () => {
    const rows = shapeRecentResults(
      [trivia],
      [entry("trivia", blue, 5, at(1)), entry("trivia", red, 10, at(3))],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "points",
      competition: "Trivia",
      when: at(3),
      scores: [
        { target: red, points: 10 },
        { target: blue, points: 5 },
      ],
    });
  });

  it("splits entries of one Competition added more than 10 minutes apart", () => {
    const rows = shapeRecentResults(
      [trivia],
      [entry("trivia", red, 10, at(0)), entry("trivia", blue, 5, at(30))],
    );
    expect(rows.map((r) => r.when)).toEqual([at(30), at(0)]);
  });

  it("does not merge entries of different Competitions", () => {
    const quiz = { ...trivia, id: "quiz", name: "Quiz" };
    const rows = shapeRecentResults(
      [trivia, quiz],
      [entry("trivia", red, 1, at(0)), entry("quiz", red, 2, at(1))],
    );
    expect(rows.map((r) => r.competition)).toEqual(["Quiz", "Trivia"]);
  });

  it("adds up entries for one target within a row", () => {
    const [row] = shapeRecentResults(
      [trivia],
      [entry("trivia", red, 4, at(0)), entry("trivia", red, 6, at(1))],
    );
    expect(row).toMatchObject({ scores: [{ target: red, points: 10 }] });
  });

  it("shows a finalized Bracket's champion instead of its generated entries", () => {
    const bracket: ResultCompetition = {
      id: "b",
      name: "Foosball",
      format: "single-elimination",
      finalizedAt: at(20),
    };
    const rows = shapeRecentResults(
      [bracket, trivia],
      [
        entry("b", blue, 5, at(20), true),
        entry("b", red, 10, at(20), true),
        entry("trivia", red, 3, at(10)),
      ],
    );
    expect(rows.map((r) => r.kind)).toEqual(["bracket-finalized", "points"]);
    expect(rows[0]).toMatchObject({ winners: [red], competition: "Foosball" });
  });

  it("shows a closed games Competition's winner, listing a tie for first", () => {
    const games: ResultCompetition = {
      id: "g",
      name: "Darts",
      format: "games",
      finalizedAt: at(5),
    };
    const [row] = shapeRecentResults(
      [games],
      [entry("g", red, 10, at(5), true), entry("g", blue, 10, at(5), true)],
    );
    expect(row).toMatchObject({ kind: "games-closed", winners: [red, blue] });
  });

  it("orders newest first and keeps at most 5 rows", () => {
    const comps = Array.from({ length: 7 }, (_, i) => ({
      ...trivia,
      id: `c${i}`,
      name: `C${i}`,
    }));
    const rows = shapeRecentResults(
      comps,
      comps.map((c, i) => entry(c.id, red, 1, at(i * 30))),
    );
    expect(rows.map((r) => r.competition)).toEqual([
      "C6",
      "C5",
      "C4",
      "C3",
      "C2",
    ]);
  });
});
