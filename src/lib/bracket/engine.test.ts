import { describe, expect, it } from "vitest";

import {
  applyResult,
  bracketWinner,
  finalPlacings,
  generate,
  hasResults,
  isComplete,
} from "@/lib/bracket/engine";
import { LATER_MATCH_USED } from "@/lib/bracket/match-report-rule";
import type { Bracket, Entrant, Match } from "@/lib/bracket/types";

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `Seed Position ${i + 1}`,
  }));
}

function match(bracket: Bracket, id: string): Match {
  const found = bracket.matches.find((h) => h.id === id);
  if (!found) throw new Error(`no Match ${id}`);
  return found;
}

/** A Match's slots as entrant ids ("-" for an empty slot). */
function pairing(h: Match): string {
  return h.slots.map((s) => s.entrantId ?? "-").join(" v ");
}

describe("generate", () => {
  it("pairs 4 Entrants 1 v 4 and 2 v 3, with the final waiting", () => {
    const bracket = generate(entrants(4));

    expect(bracket.matches.map((h) => [h.id, pairing(h), h.status])).toEqual([
      ["r1h1", "s1 v s4", "ready"],
      ["r1h2", "s2 v s3", "ready"],
      ["r2h1", "- v -", "pending"],
    ]);
    expect(match(bracket, "r1h1").winnerTo).toEqual({
      matchId: "r2h1",
      slot: 0,
    });
    expect(match(bracket, "r1h2").winnerTo).toEqual({
      matchId: "r2h1",
      slot: 1,
    });
    expect(match(bracket, "r2h1").winnerTo).toBeNull();
  });

  it("uses standard seeding for 16 Entrants", () => {
    const firstRound = generate(entrants(16))
      .matches.filter((h) => h.round === 1)
      .map(pairing);

    expect(firstRound).toEqual([
      "s1 v s16",
      "s8 v s9",
      "s4 v s13",
      "s5 v s12",
      "s2 v s15",
      "s7 v s10",
      "s3 v s14",
      "s6 v s11",
    ]);
  });

  it("gives byes to the top Seed Positions and advances them", () => {
    const bracket = generate(entrants(5));

    expect(bracket.matches.map((h) => [h.id, pairing(h), h.status])).toEqual([
      ["r1h1", "s1 v -", "played"],
      ["r1h2", "s4 v s5", "ready"],
      ["r1h3", "s2 v -", "played"],
      ["r1h4", "s3 v -", "played"],
      ["r2h1", "s1 v -", "pending"],
      ["r2h2", "s2 v s3", "ready"],
      ["r3h1", "- v -", "pending"],
    ]);
    expect(match(bracket, "r1h1").slots[0].place).toBe(1);
  });

  it("puts the only first-Round Match of 17 Entrants between 16 and 17", () => {
    const bracket = generate(entrants(17));
    const ready = bracket.matches.filter(
      (h) => h.round === 1 && h.status === "ready",
    );

    expect(ready.map(pairing)).toEqual(["s16 v s17"]);
    // Seed Positions 8 and 9 got byes, so they meet straight away in Round 2.
    expect(pairing(match(bracket, "r2h2"))).toBe("s8 v s9");
    expect(match(bracket, "r2h2").status).toBe("ready");
  });

  // Bracket size is the next power of two; byes fill the rest.
  it.each([
    [2, 2, 0],
    [3, 4, 1],
    [4, 4, 0],
    [5, 8, 3],
    [6, 8, 2],
    [7, 8, 1],
    [8, 8, 0],
    [9, 16, 7],
    [10, 16, 6],
    [11, 16, 5],
    [12, 16, 4],
    [13, 16, 3],
    [14, 16, 2],
    [15, 16, 1],
    [16, 16, 0],
    [17, 32, 15],
  ])(
    "builds %i Entrants into a %i bracket with %i byes",
    (count, size, byes) => {
      const bracket = generate(entrants(count));
      const firstRound = bracket.matches.filter((h) => h.round === 1);
      const byeMatches = firstRound.filter((h) =>
        h.slots.some((s) => s.entrantId === null),
      );
      const entered = firstRound.flatMap((h) =>
        h.slots.flatMap((s) => (s.entrantId ? [s.entrantId] : [])),
      );

      expect(bracket.matches).toHaveLength(size - 1);
      expect(firstRound).toHaveLength(size / 2);
      expect(byeMatches).toHaveLength(byes);
      expect(new Set(entered).size).toBe(count);
      // Each bye goes to one of the top `byes` Seed Positions.
      expect(
        byeMatches.map((h) => Number(h.slots[0].entrantId!.slice(1))).sort(),
      ).toEqual(Array.from({ length: byes }, (_, i) => i + 1).sort());
    },
  );

  it("orders Entrants by Seed Position, not by list order", () => {
    const [a, b, c, d] = entrants(4);
    const bracket = generate([c, a, d, b]);

    expect(bracket.matches.filter((h) => h.round === 1).map(pairing)).toEqual([
      "s1 v s4",
      "s2 v s3",
    ]);
  });

  it("refuses fewer than 2 Entrants", () => {
    expect(() => generate(entrants(1))).toThrow(
      "A Bracket needs at least 2 Entrants.",
    );
  });

  it("takes match ids from the given function", () => {
    const bracket = generate(
      entrants(2),
      (round, position) => `x${round}${position}`,
    );
    expect(bracket.matches.map((h) => h.id)).toEqual(["x11"]);
  });
});

/** Plays `matchId` with `winner` first. */
function win(bracket: Bracket, matchId: string, winner: string): Bracket {
  const others = match(bracket, matchId)
    .slots.map((s) => s.entrantId!)
    .filter((id) => id !== winner);
  return applyResult(bracket, matchId, { order: [winner, ...others] });
}

describe("applyResult", () => {
  it("records places and scores and advances the winner", () => {
    const start = generate(entrants(4));
    const bracket = applyResult(start, "r1h1", {
      order: ["s4", "s1"],
      scores: { s4: "21", s1: "17" },
    });

    expect(match(bracket, "r1h1")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s1", place: 2, score: "17" },
        { entrantId: "s4", place: 1, score: "21" },
      ],
    });
    expect(pairing(match(bracket, "r2h1"))).toBe("s4 v -");
    expect(match(bracket, "r2h1").status).toBe("pending");
    // The input Bracket is untouched.
    expect(match(start, "r1h1").status).toBe("ready");

    const both = win(bracket, "r1h2", "s2");
    expect(pairing(match(both, "r2h1"))).toBe("s4 v s2");
    expect(match(both, "r2h1").status).toBe("ready");
  });

  it("makes the Entrant listed last lose: a no-show just loses", () => {
    const bracket = applyResult(generate(entrants(2)), "r1h1", {
      order: ["s2", "s1"],
    });

    expect(match(bracket, "r1h1")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s1", place: 2 },
        { entrantId: "s2", place: 1 },
      ],
    });
    expect(bracketWinner(bracket)).toBe("s2");
  });

  it.each([
    ["an Entrant missing", { order: ["s1"] }, "Put every Entrant"],
    ["an Entrant twice", { order: ["s1", "s1"] }, "Put every Entrant"],
    ["an outsider", { order: ["s1", "s2"] }, "Put every Entrant"],
    [
      "an outsider's score",
      { order: ["s1", "s4"], scores: { s2: "3" } },
      "Scores can only be given",
    ],
  ])("refuses a Match Result with %s", (_, result, message) => {
    expect(() => applyResult(generate(entrants(4)), "r1h1", result)).toThrow(
      message,
    );
  });

  it("refuses a Match still waiting for its Entrants", () => {
    expect(() =>
      applyResult(generate(entrants(4)), "r2h1", { order: [] }),
    ).toThrow("This Match is still waiting for its Entrants.");
  });

  it("refuses a bye", () => {
    expect(() =>
      applyResult(generate(entrants(3)), "r1h1", { order: ["s1"] }),
    ).toThrow("A bye has no Match Result.");
  });

  it("refuses an unknown Match", () => {
    expect(() =>
      applyResult(generate(entrants(2)), "nope", { order: [] }),
    ).toThrow("That Match isn't in this Bracket.");
  });

  it("re-recording a played Match replaces the advanced Entrant in the unplayed Match it went to", () => {
    let bracket = generate(entrants(4));
    bracket = win(bracket, "r1h1", "s1");
    bracket = win(bracket, "r1h2", "s2");

    bracket = win(bracket, "r1h1", "s4");

    expect(pairing(match(bracket, "r2h1"))).toBe("s4 v s2");
    expect(match(bracket, "r2h1")).toMatchObject({
      status: "ready",
      slots: [{ place: null }, { place: null }],
    });
    expect(bracketWinner(bracket)).toBeNull();
  });
});

/** An 8-Entrant Bracket played to the end: s1 beats s2 in the final. */
function played8(): Bracket {
  let bracket = generate(entrants(8));
  for (const [id, winner] of [
    ["r1h1", "s1"],
    ["r1h2", "s4"],
    ["r1h3", "s2"],
    ["r1h4", "s3"],
    ["r2h1", "s1"],
    ["r2h2", "s2"],
    ["r3h1", "s1"],
  ]) {
    bracket = win(bracket, id, winner);
  }
  return bracket;
}

describe("a score-only edit of a decided Match", () => {
  it("updates the Match's scores and keeps every later Match", () => {
    const bracket = played8();

    const edited = applyResult(bracket, "r1h2", {
      order: ["s4", "s5"],
      scores: { s4: "30", s5: "12" },
    });

    expect(match(edited, "r1h2")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s4", place: 1, score: "30" },
        { entrantId: "s5", place: 2, score: "12" },
      ],
    });
    expect(match(edited, "r2h1")).toEqual(match(bracket, "r2h1"));
    expect(match(edited, "r3h1")).toEqual(match(bracket, "r3h1"));
    expect(bracketWinner(edited)).toBe("s1");
  });
});

describe("a changed winner once a later Match used the result (D1c)", () => {
  it("is refused: the later Match keeps its result and nothing resets", () => {
    const bracket = played8();

    expect(() => win(bracket, "r1h2", "s5")).toThrow(LATER_MATCH_USED);
    expect(() => win(bracket, "r2h1", "s4")).toThrow(LATER_MATCH_USED);
    // The latest result along the path, the final, still changes.
    expect(bracketWinner(win(bracket, "r3h1", "s2"))).toBe("s2");
  });

  it("takes the old winner out of an unplayed later Match, and refuses once that Match is played", () => {
    let bracket = generate(entrants(8));
    bracket = win(bracket, "r1h1", "s1");
    expect(pairing(match(bracket, "r2h1"))).toBe("s1 v -");

    const edited = win(bracket, "r1h1", "s8");
    expect(pairing(match(edited, "r2h1"))).toBe("s8 v -");
    expect(match(edited, "r2h1").status).toBe("pending");

    bracket = win(bracket, "r1h2", "s4");
    bracket = win(bracket, "r2h1", "s1");
    expect(() => win(bracket, "r1h1", "s8")).toThrow(LATER_MATCH_USED);
  });
});

describe("finalPlacings", () => {
  it("places 8 Entrants 1st and 2nd only: semifinal losers aren't placed", () => {
    const list = entrants(8);
    let bracket = generate(list);
    for (const [id, winner] of [
      ["r1h1", "s1"],
      ["r1h2", "s5"],
      ["r1h3", "s2"],
      ["r1h4", "s3"],
      ["r2h1", "s5"],
      ["r2h2", "s2"],
      ["r3h1", "s2"],
    ]) {
      bracket = win(bracket, id, winner);
    }

    expect(isComplete(bracket)).toBe(true);
    expect(bracketWinner(bracket)).toBe("s2");
    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s5", place: 2 },
    ]);
  });

  it("places 3 Entrants 1st and 2nd: the semifinal loser isn't placed", () => {
    // 3 Entrants: 1 has a bye, then loses the final.
    const list = entrants(3);
    let bracket = generate(list);
    bracket = win(bracket, "r1h2", "s3");
    bracket = win(bracket, "r2h1", "s3");

    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s3", place: 1 },
      { entrantId: "s1", place: 2 },
    ]);
  });

  it("places 5 Entrants 1st and 2nd: no semifinal or first-Round loser is placed", () => {
    const list = entrants(5);
    let bracket = generate(list);
    bracket = win(bracket, "r1h2", "s4");
    bracket = win(bracket, "r2h1", "s1");
    bracket = win(bracket, "r2h2", "s3");
    bracket = win(bracket, "r3h1", "s1");

    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s1", place: 1 },
      { entrantId: "s3", place: 2 },
    ]);
  });

  it("refuses an unfinished Bracket", () => {
    expect(() => finalPlacings(generate(entrants(4)), entrants(4))).toThrow(
      "The Bracket isn't finished yet.",
    );
  });
});

describe("hasResults", () => {
  it("ignores byes and counts recorded Match Results", () => {
    const bracket = generate(entrants(3));
    expect(hasResults(bracket)).toBe(false);
    expect(hasResults(win(bracket, "r1h2", "s2"))).toBe(true);
  });
});
