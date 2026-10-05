import { describe, expect, it } from "vitest";

import { parseLeagueResult } from "@/lib/league/result";

describe("parseLeagueResult with a Score direction", () => {
  it("lets the higher Score win when higher is better", () => {
    expect(
      parseLeagueResult("higher", { scoreA: "3", scoreB: "1", result: "" }),
    ).toEqual({ ok: true, value: { result: "a", scoreA: 3, scoreB: 1 } });
    expect(parseLeagueResult("higher", { scoreA: 1, scoreB: 2.5 })).toEqual({
      ok: true,
      value: { result: "b", scoreA: 1, scoreB: 2.5 },
    });
  });

  it("lets the lower Score win when lower is better", () => {
    expect(
      parseLeagueResult("lower", { scoreA: "41.2", scoreB: "39.9" }),
    ).toEqual({ ok: true, value: { result: "b", scoreA: 41.2, scoreB: 39.9 } });
  });

  it("records equal Scores as a draw", () => {
    expect(parseLeagueResult("higher", { scoreA: "2", scoreB: "2" })).toEqual({
      ok: true,
      value: { result: "draw", scoreA: 2, scoreB: 2 },
    });
  });

  it("takes a posted result that agrees with the Scores", () => {
    expect(
      parseLeagueResult("higher", { scoreA: "2", scoreB: "2", result: "draw" }),
    ).toEqual({ ok: true, value: { result: "draw", scoreA: 2, scoreB: 2 } });
  });

  it("refuses a posted result against the Scores", () => {
    for (const result of ["b", "draw"]) {
      expect(
        parseLeagueResult("higher", { scoreA: "3", scoreB: "1", result }),
      ).toEqual({
        ok: false,
        error: "The Scores decide this result: change a Score.",
        fieldErrors: {
          result: "The Scores decide this result: change a Score.",
        },
      });
    }
  });

  it("needs a picked result while a Score is missing", () => {
    expect(parseLeagueResult("higher", { scoreA: "3", result: "a" })).toEqual({
      ok: true,
      value: { result: "a", scoreA: 3, scoreB: null },
    });
    expect(parseLeagueResult("higher", { scoreA: "3" })).toMatchObject({
      ok: false,
      error: "Choose the result.",
    });
  });
});

describe("parseLeagueResult with direction none", () => {
  it("needs a picked result, whatever the Scores say", () => {
    expect(parseLeagueResult("none", { scoreA: "3", scoreB: "1" })).toEqual({
      ok: false,
      error: "Choose the result.",
      fieldErrors: { result: "Choose the result." },
    });
    expect(
      parseLeagueResult("none", { scoreA: "1", scoreB: "3", result: "a" }),
    ).toEqual({ ok: true, value: { result: "a", scoreA: 1, scoreB: 3 } });
  });

  it("takes a draw with no Scores", () => {
    expect(parseLeagueResult("none", { result: "draw" })).toEqual({
      ok: true,
      value: { result: "draw", scoreA: null, scoreB: null },
    });
  });
});

describe("parseLeagueResult refusals", () => {
  it("refuses a result that isn't A won, B won or a draw", () => {
    expect(parseLeagueResult("none", { result: "forfeit" })).toMatchObject({
      ok: false,
      error: "Choose the result.",
    });
  });

  it("refuses a Score that isn't a number", () => {
    expect(
      parseLeagueResult("none", { scoreA: "W/O", result: "a" }),
    ).toMatchObject({ ok: false, error: "Enter a score." });
  });

  it("refuses anything that isn't a form", () => {
    expect(parseLeagueResult("none", null)).toMatchObject({ ok: false });
  });
});
