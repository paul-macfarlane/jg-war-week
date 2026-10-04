import { describe, expect, it } from "vitest";

import { parseMatchInput, postedMatchPlayerIds } from "@/lib/series/input";

const A = "00000000-0000-4000-8000-00000000000a";
const B = "00000000-0000-4000-8000-00000000000b";
const noDraws = { drawsAllowed: false, bestOf: 3 } as const;

describe("parseMatchInput", () => {
  it("turns who won into places", () => {
    expect(
      parseMatchInput(noDraws, { playerA: A, playerB: B, outcome: "b" }),
    ).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 2, score: null },
          { id: B, place: 1, score: null },
        ],
      },
    });
  });

  it("records a Draw only when draws are allowed", () => {
    const draw = { playerA: A, playerB: B, outcome: "draw" };
    expect(parseMatchInput(noDraws, draw)).toMatchObject({
      ok: false,
      error: "Draws aren't allowed in this Competition.",
    });
    expect(
      parseMatchInput({ drawsAllowed: true, bestOf: 3 }, draw),
    ).toMatchObject({ ok: true });
  });

  it("refuses the same player twice and a missing winner", () => {
    expect(
      parseMatchInput(noDraws, { playerA: A, playerB: A, outcome: "a" }),
    ).toMatchObject({ ok: false, error: "Choose two different players." });
    expect(parseMatchInput(noDraws, { playerA: A, playerB: B })).toMatchObject({
      ok: false,
      error: "Choose a winner.",
    });
  });
});

describe("postedMatchPlayerIds", () => {
  it("reads playerA and playerB only", () => {
    expect(
      postedMatchPlayerIds({ playerA: A, playerB: B, player: "x" }),
    ).toEqual([A, B]);
    expect(postedMatchPlayerIds(null)).toEqual([]);
  });
});
