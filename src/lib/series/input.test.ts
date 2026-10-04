import { describe, expect, it } from "vitest";

import {
  EQUAL_SCORES_PICK,
  computedOutcome,
  parseMatchInput,
  postedMatchPlayerIds,
} from "@/lib/series/input";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const noDraws = { drawsAllowed: false, bestOf: 3 } as const;
const draws = { drawsAllowed: true, bestOf: 3 } as const;

const posted = (a: string, b: string, winner = "") => ({
  sides: [
    { id: A, score: a },
    { id: B, score: b },
  ],
  winner,
});

describe("computedOutcome", () => {
  it("gives the Match to the better Score by the direction", () => {
    expect(computedOutcome("higher", noDraws, [21, 15])).toBe(0);
    expect(computedOutcome("lower", noDraws, [21, 15])).toBe(1);
  });

  it("makes equal Scores a Draw when draws are allowed, else a tie to settle", () => {
    expect(computedOutcome("higher", draws, [7, 7])).toBe("draw");
    expect(computedOutcome("higher", noDraws, [7, 7])).toBe("tie");
  });

  it("works nothing out with direction none or a Score missing", () => {
    expect(computedOutcome("none", noDraws, [21, 15])).toBeNull();
    expect(computedOutcome("higher", noDraws, [21, null])).toBeNull();
  });
});

describe("parseMatchInput", () => {
  it("places the two Entrants from their Scores (AC 5)", () => {
    expect(parseMatchInput(noDraws, "higher", posted("21", "15"))).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: 21 },
          { id: B, place: 2, score: 15 },
        ],
      },
    });
    expect(
      parseMatchInput(noDraws, "lower", posted("21.5", "15")),
    ).toMatchObject({
      ok: true,
      value: {
        players: [
          { id: A, place: 2, score: 21.5 },
          { id: B, place: 1, score: 15 },
        ],
      },
    });
  });

  it("records equal Scores as a Draw when draws are allowed (AC 5)", () => {
    expect(parseMatchInput(draws, "higher", posted("7", "7"))).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: 7 },
          { id: B, place: 1, score: 7 },
        ],
      },
    });
  });

  it("needs a pick for equal Scores without draws, and takes it (AC 5)", () => {
    expect(parseMatchInput(noDraws, "higher", posted("7", "7"))).toEqual({
      ok: false,
      error: EQUAL_SCORES_PICK,
      fieldErrors: { winner: EQUAL_SCORES_PICK },
    });
    expect(
      parseMatchInput(noDraws, "higher", posted("7", "7", B)),
    ).toMatchObject({
      ok: true,
      value: {
        players: [
          { id: A, place: 2, score: 7 },
          { id: B, place: 1, score: 7 },
        ],
      },
    });
  });

  it("takes a Winner set by hand over the Scores", () => {
    expect(
      parseMatchInput(noDraws, "higher", posted("21", "15", B)),
    ).toMatchObject({
      ok: true,
      value: {
        players: [
          { id: A, place: 2, score: 21 },
          { id: B, place: 1, score: 15 },
        ],
      },
    });
  });

  it("with direction none, keeps the Winner by hand and Scores optional", () => {
    expect(parseMatchInput(noDraws, "none", posted("", "", A))).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: null },
          { id: B, place: 2, score: null },
        ],
      },
    });
    expect(parseMatchInput(noDraws, "none", posted("3", "1"))).toMatchObject({
      ok: false,
      error: "Choose the Winner.",
    });
  });

  it("refuses a Draw when draws aren't allowed, a bad Score and the same side twice", () => {
    expect(
      parseMatchInput(noDraws, "none", posted("", "", "draw")),
    ).toMatchObject({
      ok: false,
      error: "Draws aren't allowed in this Competition.",
    });
    expect(
      parseMatchInput(noDraws, "higher", posted("abc", "1")),
    ).toMatchObject({ ok: false });
    expect(
      parseMatchInput(noDraws, "none", {
        sides: [
          { id: A, score: "" },
          { id: A, score: "" },
        ],
        winner: A,
      }),
    ).toMatchObject({ ok: false, error: "Each Entrant plays once." });
  });

  it("refuses a Winner who isn't one of the two", () => {
    expect(
      parseMatchInput(noDraws, "none", posted("", "", "someone")),
    ).toMatchObject({ ok: false, error: "Choose the Winner." });
  });
});

describe("postedMatchPlayerIds", () => {
  it("reads the two sides' ids only", () => {
    expect(postedMatchPlayerIds(posted("1", "2"))).toEqual([A, B]);
    expect(postedMatchPlayerIds({ player: "x" })).toEqual([]);
    expect(postedMatchPlayerIds(null)).toEqual([]);
  });
});
