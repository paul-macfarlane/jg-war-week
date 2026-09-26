import { describe, expect, it } from "vitest";

import {
  applyResult,
  champion,
  finalPlacings,
  generate,
  hasResults,
  isComplete,
  resetByResult,
} from "@/lib/bracket/engine";
import type { Bracket, Entrant, Heat } from "@/lib/bracket/types";

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `Seed Position ${i + 1}`,
  }));
}

function heat(bracket: Bracket, id: string): Heat {
  const found = bracket.heats.find((h) => h.id === id);
  if (!found) throw new Error(`no Heat ${id}`);
  return found;
}

/** A Heat's slots as entrant ids ("-" for an empty slot). */
function pairing(h: Heat): string {
  return h.slots.map((s) => s.entrantId ?? "-").join(" v ");
}

describe("generate", () => {
  it("pairs 4 Entrants 1 v 4 and 2 v 3, with the final waiting", () => {
    const bracket = generate(entrants(4));

    expect(bracket.heats.map((h) => [h.id, pairing(h), h.status])).toEqual([
      ["r1h1", "s1 v s4", "ready"],
      ["r1h2", "s2 v s3", "ready"],
      ["r2h1", "- v -", "pending"],
    ]);
    expect(heat(bracket, "r1h1").winnerTo).toEqual({
      heatId: "r2h1",
      slot: 0,
    });
    expect(heat(bracket, "r1h2").winnerTo).toEqual({
      heatId: "r2h1",
      slot: 1,
    });
    expect(heat(bracket, "r2h1").winnerTo).toBeNull();
  });

  it("uses standard seeding for 16 Entrants", () => {
    const firstRound = generate(entrants(16))
      .heats.filter((h) => h.round === 1)
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

    expect(bracket.heats.map((h) => [h.id, pairing(h), h.status])).toEqual([
      ["r1h1", "s1 v -", "played"],
      ["r1h2", "s4 v s5", "ready"],
      ["r1h3", "s2 v -", "played"],
      ["r1h4", "s3 v -", "played"],
      ["r2h1", "s1 v -", "pending"],
      ["r2h2", "s2 v s3", "ready"],
      ["r3h1", "- v -", "pending"],
    ]);
    expect(heat(bracket, "r1h1").slots[0].place).toBe(1);
  });

  it("puts the only first-Round game of 17 Entrants between 16 and 17", () => {
    const bracket = generate(entrants(17));
    const ready = bracket.heats.filter(
      (h) => h.round === 1 && h.status === "ready",
    );

    expect(ready.map(pairing)).toEqual(["s16 v s17"]);
    // Seed Positions 8 and 9 got byes, so they meet straight away in Round 2.
    expect(pairing(heat(bracket, "r2h2"))).toBe("s8 v s9");
    expect(heat(bracket, "r2h2").status).toBe("ready");
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
      const firstRound = bracket.heats.filter((h) => h.round === 1);
      const byeHeats = firstRound.filter((h) =>
        h.slots.some((s) => s.entrantId === null),
      );
      const entered = firstRound.flatMap((h) =>
        h.slots.flatMap((s) => (s.entrantId ? [s.entrantId] : [])),
      );

      expect(bracket.heats).toHaveLength(size - 1);
      expect(firstRound).toHaveLength(size / 2);
      expect(byeHeats).toHaveLength(byes);
      expect(new Set(entered).size).toBe(count);
      // Each bye goes to one of the top `byes` Seed Positions.
      expect(
        byeHeats.map((h) => Number(h.slots[0].entrantId!.slice(1))).sort(),
      ).toEqual(Array.from({ length: byes }, (_, i) => i + 1).sort());
    },
  );

  it("orders Entrants by Seed Position, not by list order", () => {
    const [a, b, c, d] = entrants(4);
    const bracket = generate([c, a, d, b]);

    expect(bracket.heats.filter((h) => h.round === 1).map(pairing)).toEqual([
      "s1 v s4",
      "s2 v s3",
    ]);
  });

  it("refuses fewer than 2 Entrants", () => {
    expect(() => generate(entrants(1))).toThrow(
      "A Bracket needs at least 2 Entrants.",
    );
  });

  it("takes heat ids from the given function", () => {
    const bracket = generate(
      entrants(2),
      (round, position) => `x${round}${position}`,
    );
    expect(bracket.heats.map((h) => h.id)).toEqual(["x11"]);
  });
});

/** Plays `heatId` with `winner` first. */
function win(bracket: Bracket, heatId: string, winner: string): Bracket {
  const others = heat(bracket, heatId)
    .slots.map((s) => s.entrantId!)
    .filter((id) => id !== winner);
  return applyResult(bracket, heatId, { order: [winner, ...others] });
}

describe("applyResult", () => {
  it("records places and scores and advances the winner", () => {
    const start = generate(entrants(4));
    const bracket = applyResult(start, "r1h1", {
      order: ["s4", "s1"],
      scores: { s4: "21", s1: "17" },
    });

    expect(heat(bracket, "r1h1")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s1", place: 2, score: "17", forfeited: false },
        { entrantId: "s4", place: 1, score: "21", forfeited: false },
      ],
    });
    expect(pairing(heat(bracket, "r2h1"))).toBe("s4 v -");
    expect(heat(bracket, "r2h1").status).toBe("pending");
    // The input Bracket is untouched.
    expect(heat(start, "r1h1").status).toBe("ready");

    const both = win(bracket, "r1h2", "s2");
    expect(pairing(heat(both, "r2h1"))).toBe("s4 v s2");
    expect(heat(both, "r2h1").status).toBe("ready");
  });

  it("makes a forfeiting Entrant lose, even when listed first", () => {
    const bracket = applyResult(generate(entrants(2)), "r1h1", {
      order: ["s1", "s2"],
      forfeits: ["s1"],
    });

    expect(heat(bracket, "r1h1")).toMatchObject({
      status: "forfeit",
      slots: [
        { entrantId: "s1", place: 2, forfeited: true },
        { entrantId: "s2", place: 1, forfeited: false },
      ],
    });
    expect(champion(bracket)).toBe("s2");
  });

  it.each([
    ["an Entrant missing", { order: ["s1"] }, "Put every Entrant"],
    ["an Entrant twice", { order: ["s1", "s1"] }, "Put every Entrant"],
    ["an outsider", { order: ["s1", "s2"] }, "Put every Entrant"],
    [
      "everyone forfeiting",
      { order: ["s1", "s4"], forfeits: ["s1", "s4"] },
      "not every Entrant can forfeit",
    ],
    [
      "an outsider forfeiting",
      { order: ["s1", "s4"], forfeits: ["s2"] },
      "Only an Entrant of this Heat",
    ],
    [
      "an outsider's score",
      { order: ["s1", "s4"], scores: { s2: "3" } },
      "Scores can only be given",
    ],
  ])("refuses a Heat Result with %s", (_, result, message) => {
    expect(() => applyResult(generate(entrants(4)), "r1h1", result)).toThrow(
      message,
    );
  });

  it("refuses a Heat still waiting for its Entrants", () => {
    expect(() =>
      applyResult(generate(entrants(4)), "r2h1", { order: [] }),
    ).toThrow("This Heat is still waiting for its Entrants.");
  });

  it("refuses a bye", () => {
    expect(() =>
      applyResult(generate(entrants(3)), "r1h1", { order: ["s1"] }),
    ).toThrow("A bye has no Heat Result.");
  });

  it("refuses an unknown Heat", () => {
    expect(() =>
      applyResult(generate(entrants(2)), "nope", { order: [] }),
    ).toThrow("That Heat isn't in this Bracket.");
  });

  it("re-recording a played Heat replaces the advanced Entrant downstream", () => {
    let bracket = generate(entrants(4));
    bracket = win(bracket, "r1h1", "s1");
    bracket = win(bracket, "r1h2", "s2");
    bracket = win(bracket, "r2h1", "s1");

    bracket = win(bracket, "r1h1", "s4");

    expect(pairing(heat(bracket, "r2h1"))).toBe("s4 v s2");
    expect(heat(bracket, "r2h1")).toMatchObject({
      status: "ready",
      slots: [{ place: null }, { place: null }],
    });
    expect(champion(bracket)).toBeNull();
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

describe("a score-only edit of a decided Heat", () => {
  it("updates the Heat's scores and keeps every later Heat", () => {
    const bracket = played8();

    expect(resetByResult(bracket, "r1h2", "s4")).toEqual([]);
    const edited = applyResult(bracket, "r1h2", {
      order: ["s4", "s5"],
      scores: { s4: "30", s5: "12" },
    });

    expect(heat(edited, "r1h2")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s4", place: 1, score: "30" },
        { entrantId: "s5", place: 2, score: "12" },
      ],
    });
    expect(heat(edited, "r2h1")).toEqual(heat(bracket, "r2h1"));
    expect(heat(edited, "r3h1")).toEqual(heat(bracket, "r3h1"));
    expect(champion(edited)).toBe("s1");
  });
});

describe("resetByResult", () => {
  it("names every decided later Heat that followed from it when the winner changes", () => {
    const bracket = played8();

    expect(resetByResult(bracket, "r1h2", "s5")).toEqual(["r2h1", "r3h1"]);
    const edited = win(bracket, "r1h2", "s5");
    expect(heat(edited, "r2h1")).toMatchObject({
      status: "ready",
      slots: [
        { entrantId: "s1", place: null, score: null },
        { entrantId: "s5", place: null },
      ],
    });
    expect(heat(edited, "r3h1")).toMatchObject({
      status: "pending",
      slots: [{ entrantId: null }, { entrantId: "s2", place: null }],
    });
    // The other side stays as it was.
    expect(heat(edited, "r2h2").status).toBe("played");
    expect(isComplete(edited)).toBe(false);
  });

  it("counts only later Heats that had a Heat Result", () => {
    let bracket = generate(entrants(8));
    for (const [id, winner] of [
      ["r1h1", "s1"],
      ["r1h2", "s4"],
      ["r2h1", "s1"],
    ]) {
      bracket = win(bracket, id, winner);
    }
    // s1 sits in the still-pending final, which has no Heat Result.
    expect(pairing(heat(bracket, "r3h1"))).toBe("s1 v -");

    expect(resetByResult(bracket, "r1h1", "s8")).toEqual(["r2h1"]);
    const edited = win(bracket, "r1h1", "s8");
    expect(pairing(heat(edited, "r2h1"))).toBe("s8 v s4");
    // Cleared of the old winner, but not counted as reset.
    expect(pairing(heat(edited, "r3h1"))).toBe("- v -");
  });

  it("names nothing when the winner has reached no decided Heat", () => {
    const bracket = win(generate(entrants(4)), "r1h1", "s1");
    expect(resetByResult(bracket, "r1h1", "s4")).toEqual([]);
  });

  it("names nothing for an undecided Heat, a bye or no winner", () => {
    const bracket = win(generate(entrants(3)), "r1h2", "s2");
    expect(resetByResult(bracket, "r2h1", "s1")).toEqual([]);
    expect(resetByResult(bracket, "r1h1", "s1")).toEqual([]);
    expect(resetByResult(bracket, "r1h2", null)).toEqual([]);
  });
});

describe("finalPlacings", () => {
  it("places 8 Entrants 1st, 2nd, tied 3rd and tied 5th", () => {
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
    expect(champion(bracket)).toBe("s2");
    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s5", place: 2 },
      { entrantId: "s1", place: 3 },
      { entrantId: "s3", place: 3 },
      { entrantId: "s4", place: 5 },
      { entrantId: "s6", place: 5 },
      { entrantId: "s7", place: 5 },
      { entrantId: "s8", place: 5 },
    ]);
  });

  it("doesn't count a bye as a played Heat", () => {
    // 3 Entrants: 1 has a bye, then loses the final.
    const list = entrants(3);
    let bracket = generate(list);
    bracket = win(bracket, "r1h2", "s3");
    bracket = win(bracket, "r2h1", "s3");

    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s3", place: 1 },
      { entrantId: "s1", place: 2 },
      { entrantId: "s2", place: 3 },
    ]);
  });

  it("places 5 Entrants 1st, 2nd, 3rd, 3rd, 5th", () => {
    const list = entrants(5);
    let bracket = generate(list);
    bracket = win(bracket, "r1h2", "s4");
    bracket = win(bracket, "r2h1", "s1");
    bracket = win(bracket, "r2h2", "s3");
    bracket = win(bracket, "r3h1", "s1");

    expect(finalPlacings(bracket, list)).toEqual([
      { entrantId: "s1", place: 1 },
      { entrantId: "s3", place: 2 },
      { entrantId: "s2", place: 3 },
      { entrantId: "s4", place: 3 },
      { entrantId: "s5", place: 5 },
    ]);
  });

  it("refuses an unfinished Bracket", () => {
    expect(() => finalPlacings(generate(entrants(4)), entrants(4))).toThrow(
      "The Bracket isn't finished yet.",
    );
  });
});

describe("hasResults", () => {
  it("ignores byes and counts recorded Heat Results", () => {
    const bracket = generate(entrants(3));
    expect(hasResults(bracket)).toBe(false);
    expect(hasResults(win(bracket, "r1h2", "s2"))).toBe(true);
  });
});
