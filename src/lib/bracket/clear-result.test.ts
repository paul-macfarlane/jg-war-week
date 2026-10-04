import { describe, expect, it } from "vitest";

import {
  NO_RESULT_TO_CLEAR,
  clearResult,
  otherResultsChanged,
} from "@/lib/bracket/clear-result";
import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import {
  LATER_MATCH_USED,
  LATER_ROUND_HAS_RESULT,
} from "@/lib/bracket/match-report-rule";
import type { Bracket, Entrant } from "@/lib/bracket/types";

const entrants = (count: number): Entrant[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    seedPosition: i + 1,
    label: `E${i + 1}`,
  }));

const newId = (round: number, position: number) => `r${round}h${position}`;

const match = (bracket: Bracket, id: string) =>
  bracket.matches.find((h) => h.id === id)!;

const ids = (bracket: Bracket, id: string) =>
  match(bracket, id).slots.map((s) => s.entrantId);

const play = (bracket: Bracket, id: string) =>
  applyResult(bracket, id, { order: ids(bracket, id) as string[] });

describe("clearResult, head-to-head", () => {
  it("empties the Match's places and Scores and takes its winner back out of the unplayed Match it went to", () => {
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(4), newId);
    bracket = applyResult(bracket, "r1h1", {
      order: ["e4", "e1"],
      scores: { e4: "21", e1: "15" },
    });
    expect(ids(bracket, "r2h1")).toEqual(["e4", null]);

    const cleared = clearResult(bracket, "r1h1");
    expect(match(cleared, "r1h1")).toMatchObject({
      status: "ready",
      slots: [
        { entrantId: "e1", place: null, score: null },
        { entrantId: "e4", place: null, score: null },
      ],
    });
    expect(ids(cleared, "r2h1")).toEqual([null, null]);
    expect(match(cleared, "r2h1").status).toBe("pending");
    expect(otherResultsChanged(bracket, cleared, "r1h1")).toBe(false);
  });

  it("refuses a Match a later Match already used (D1c), and one with no result", () => {
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(4), newId);
    expect(() => clearResult(bracket, "r1h1")).toThrow(NO_RESULT_TO_CLEAR);
    bracket = play(play(play(bracket, "r1h1"), "r1h2"), "r2h1");
    expect(() => clearResult(bracket, "r1h1")).toThrow(LATER_MATCH_USED);
    // The latest result along the path clears.
    expect(match(clearResult(bracket, "r2h1"), "r2h1").status).toBe("ready");
  });

  it("refuses a bye", () => {
    const bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(3), newId);
    expect(() => clearResult(bracket, "r1h1")).toThrow(NO_RESULT_TO_CLEAR);
  });
});

describe("clearResult, Group", () => {
  const group = {
    kind: "group" as const,
    entrantsPerMatch: 3,
    advancePerMatch: 1,
    thirdPlaceMatch: false,
    rounds: {},
  };

  it("sends the later Rounds back to waiting, as before the Round was complete", () => {
    let bracket = generate(group, entrants(6), newId);
    bracket = play(play(bracket, "r1h1"), "r1h2");
    expect(match(bracket, "r2h1").status).toBe("ready");

    const cleared = clearResult(bracket, "r1h1");
    expect(match(cleared, "r1h1").status).toBe("ready");
    expect(match(cleared, "r1h2").status).toBe("played");
    expect(ids(cleared, "r2h1")).toEqual([null, null]);
    expect(match(cleared, "r2h1").status).toBe("pending");
  });

  it("refuses once a later Round has a result", () => {
    let bracket = generate(group, entrants(6), newId);
    bracket = play(play(play(bracket, "r1h1"), "r1h2"), "r2h1");
    expect(() => clearResult(bracket, "r1h1")).toThrow(LATER_ROUND_HAS_RESULT);
  });
});

describe("otherResultsChanged", () => {
  it("is true when a write would change another Match's recorded result", () => {
    let bracket = generate(DEFAULT_BRACKET_CONFIG, entrants(4), newId);
    bracket = play(play(bracket, "r1h1"), "r1h2");
    const before = bracket;
    const after = structuredClone(bracket);
    match(after, "r1h2").status = "ready";
    expect(otherResultsChanged(before, after, "r1h1")).toBe(true);
    expect(otherResultsChanged(before, after, "r1h2")).toBe(false);
  });
});
