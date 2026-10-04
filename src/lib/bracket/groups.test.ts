import { describe, expect, it } from "vitest";

import { matches } from "@/lib/bracket/groups";
import {
  type Bracket,
  BracketError,
  type Entrant,
  type Match,
} from "@/lib/bracket/types";

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `Seed Position ${i + 1}`,
  }));
}

const newId = (round: number, position: number) => `r${round}h${position}`;

function build(count: number, perMatch: number, advance: number): Bracket {
  return matches.generate(
    {
      entrantsPerHeat: perMatch,
      advancePerHeat: advance,
      thirdPlaceGame: false,
    },
    entrants(count),
    newId,
  );
}

function match(bracket: Bracket, id: string): Match {
  const found = bracket.matches.find((h) => h.id === id);
  if (!found) throw new Error(`no Match ${id}`);
  return found;
}

/** A Match's slots as entrant ids ("-" for an empty slot). */
function lineup(h: Match): string {
  return h.slots.map((s) => s.entrantId ?? "-").join(" ");
}

/** Each Match as [id, lineup, status]. */
function summary(bracket: Bracket): [string, string, string][] {
  return bracket.matches.map((h) => [h.id, lineup(h), h.status]);
}

/** A Match's places, slot by slot. */
function places(h: Match): (number | null)[] {
  return h.slots.map((s) => s.place);
}

/** Records every Entrant of the Match in slot order, top to bottom. */
function recordInSlotOrder(bracket: Bracket, id: string): Bracket {
  return matches.applyResult(bracket, id, {
    order: match(bracket, id).slots.map((s) => s.entrantId!),
  });
}

function rounds(bracket: Bracket): Match[][] {
  const last = Math.max(...bracket.matches.map((h) => h.round));
  return Array.from({ length: last }, (_, r) =>
    bracket.matches
      .filter((h) => h.round === r + 1)
      .sort((a, b) => a.position - b.position),
  );
}

/** Every config the builder offers, over 2–17 Entrants. */
const ranges = Array.from({ length: 16 }, (_, i) => i + 2).flatMap((n) =>
  [2, 3, 4, 5, 6, 7, 8].flatMap((s) =>
    Array.from({ length: s - 1 }, (_, a) => ({
      n,
      config: {
        entrantsPerHeat: s,
        advancePerHeat: a + 1,
        thirdPlaceGame: false,
      },
    })),
  ),
);

describe("validateConfig", () => {
  it("accepts 318 and refuses 130 of the configs over 2–17 Entrants", () => {
    const refusals = ranges.map(({ n, config }) =>
      matches.validateConfig(config, n),
    );
    expect(refusals.filter((r) => r === null)).toHaveLength(318);
    expect(refusals.filter((r) => r !== null)).toHaveLength(130);
    for (const r of refusals) {
      if (r !== null) {
        expect(r).toMatch(
          /^With \d+ Entrants, \d per Match and \d advancing, Round \d+ would never end\. Lower how many advance\.$/,
        );
      }
    }
  });

  it("names the Round that would never end", () => {
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        4,
      ),
    ).toBe(
      "With 4 Entrants, 3 per Match and 2 advancing, Round 1 would never end. Lower how many advance.",
    );
    // 7 → Matches of 3, 2, 2 send 6 on → 3, 3 send 4 on → 2, 2 send 4 on.
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        7,
      ),
    ).toBe(
      "With 7 Entrants, 3 per Match and 2 advancing, Round 3 would never end. Lower how many advance.",
    );
  });

  it("accepts a count that fits in one Match, however many advance", () => {
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        3,
      ),
    ).toBeNull();
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 8, advancePerHeat: 7, thirdPlaceGame: false },
        2,
      ),
    ).toBeNull();
  });

  it("needs 2 Entrants and a valid config", () => {
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
        1,
      ),
    ).toBe("A Bracket needs at least 2 Entrants.");
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 4, thirdPlaceGame: false },
        8,
      ),
    ).toBe("Fewer must advance than play in a Match.");
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 9, advancePerHeat: 2, thirdPlaceGame: false },
        8,
      ),
    ).toBe("A Match holds at most 8 Entrants.");
    // 4 per Match, 2 advancing: 5 → Matches of 3 and 2 send 4 on (the final).
    expect(
      matches.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
        5,
      ),
    ).toBeNull();
  });
});

const accepted = ranges.filter(
  ({ n, config }) => matches.validateConfig(config, n) === null,
);
const refused = ranges.filter(
  ({ n, config }) => matches.validateConfig(config, n) !== null,
);

describe("generate", () => {
  it.each(accepted)(
    "builds every Round for $n Entrants, $config.entrantsPerHeat per Match, $config.advancePerHeat advancing",
    ({ n, config }) => {
      const bracket = matches.generate(config, entrants(n), newId);
      expect(bracket.config).toEqual(config);

      const all = rounds(bracket);
      const final = all[all.length - 1];
      expect(final).toHaveLength(1);
      expect(final[0].slots.length).toBeLessThanOrEqual(config.entrantsPerHeat);
      for (const [r, round] of all.entries()) {
        const sizes = round.map((h) => h.slots.length);
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(Math.max(...sizes)).toBeLessThanOrEqual(config.entrantsPerHeat);
        round.forEach((h, i) => {
          expect(h.id).toBe(`r${r + 1}h${i + 1}`);
          expect(h.position).toBe(i + 1);
          expect(h.winnerTo).toBeNull();
        });
      }

      // Round 1 holds every Entrant once; its short Matches are decided byes.
      const first = all[0].flatMap((h) => h.slots.map((s) => s.entrantId));
      expect([...first].sort()).toEqual(
        entrants(n)
          .map((e) => e.id)
          .sort(),
      );
      for (const h of all[0]) {
        const bye = all.length > 1 && h.slots.length <= config.advancePerHeat;
        expect(matches.isBye(bracket, h)).toBe(bye);
        expect(matches.isRecordable(bracket, h.id)).toBe(!bye);
        expect(h.status).toBe(bye ? "played" : "ready");
        expect(h.slots.map((s) => s.place)).toEqual(
          bye ? h.slots.map((_, i) => i + 1) : h.slots.map(() => null),
        );
      }
      // Later Rounds wait, empty.
      for (const h of all.slice(1).flat()) {
        expect(h.status).toBe("pending");
        expect(h.slots.every((s) => s.entrantId === null)).toBe(true);
        expect(matches.isRecordable(bracket, h.id)).toBe(false);
      }
      expect(matches.hasResults(bracket)).toBe(false);
      expect(matches.isComplete(bracket)).toBe(false);
      expect(matches.winner(bracket)).toBeNull();
    },
  );

  it.each(refused)(
    "refuses $n Entrants, $config.entrantsPerHeat per Match, $config.advancePerHeat advancing",
    ({ n, config }) => {
      const message = matches.validateConfig(config, n)!;
      expect(() => matches.generate(config, entrants(n), newId)).toThrow(
        new BracketError(message),
      );
    },
  );

  it("refuses too few Entrants and a bad config", () => {
    expect(() => build(1, 4, 2)).toThrow(
      new BracketError("A Bracket needs at least 2 Entrants."),
    );
    expect(() => build(8, 4, 5)).toThrow(
      new BracketError("Fewer must advance than play in a Match."),
    );
  });

  it("deals 8 Entrants into two Matches of 4 by snake, the final waiting", () => {
    expect(summary(build(8, 4, 2))).toEqual([
      ["r1h1", "s1 s4 s5 s8", "ready"],
      ["r1h2", "s2 s3 s6 s7", "ready"],
      ["r2h1", "- - - -", "pending"],
    ]);
  });

  it("deals 10 Entrants into Matches of 3, 3 and 4, then 3, 3, then the final", () => {
    expect(summary(build(10, 4, 2))).toEqual([
      ["r1h1", "s1 s6 s7", "ready"],
      ["r1h2", "s2 s5 s8", "ready"],
      ["r1h3", "s3 s4 s9 s10", "ready"],
      ["r2h1", "- - -", "pending"],
      ["r2h2", "- - -", "pending"],
      ["r3h1", "- - - -", "pending"],
    ]);
  });

  it("builds a later one-slot Match: 6 Entrants, 2 per Match, 1 advancing", () => {
    expect(summary(build(6, 2, 1))).toEqual([
      ["r1h1", "s1 s6", "ready"],
      ["r1h2", "s2 s5", "ready"],
      ["r1h3", "s3 s4", "ready"],
      ["r2h1", "-", "pending"],
      ["r2h2", "- -", "pending"],
      ["r3h1", "- -", "pending"],
    ]);
  });

  it("decides Round-1 byes at Generate", () => {
    // 5 Entrants, 4 per Match, 2 advancing: s2 and s3 go through unplayed.
    const bracket = build(5, 4, 2);
    expect(summary(bracket)).toEqual([
      ["r1h1", "s1 s4 s5", "ready"],
      ["r1h2", "s2 s3", "played"],
      ["r2h1", "- - - -", "pending"],
    ]);
    expect(match(bracket, "r1h2").slots.map((s) => s.place)).toEqual([1, 2]);
    expect(matches.isBye(bracket, match(bracket, "r1h2"))).toBe(true);
    expect(matches.hasResults(bracket)).toBe(false);

    // 3 Entrants, 2 per Match, 1 advancing: the top Seed Position's bye.
    expect(summary(build(3, 2, 1))).toEqual([
      ["r1h1", "s1", "played"],
      ["r1h2", "s2 s3", "ready"],
      ["r2h1", "- -", "pending"],
    ]);
  });

  it("makes a count that fits in one Match the final, even when all would advance", () => {
    const bracket = build(2, 8, 7);
    expect(summary(bracket)).toEqual([["r1h1", "s1 s2", "ready"]]);
    expect(matches.isBye(bracket, match(bracket, "r1h1"))).toBe(false);
    expect(matches.isRecordable(bracket, "r1h1")).toBe(true);
  });

  it("deals 8 Entrants into Matches of 4 at 4 per Match, 2 advancing", () => {
    const bracket = build(8, 4, 2);
    expect(bracket.matches.map((h) => h.slots.length)).toEqual([4, 4, 4]);
  });
});

describe("applyResult", () => {
  it("places a Match's Entrants in finishing order, trimming scores", () => {
    const before = build(8, 4, 2);
    const after = matches.applyResult(before, "r1h1", {
      order: ["s5", "s1", "s8", "s4"],
      scores: { s5: " 12 ", s1: "  " },
    });
    expect(match(after, "r1h1")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s1", place: 2, score: null },
        { entrantId: "s4", place: 4, score: null },
        { entrantId: "s5", place: 1, score: "12" },
        { entrantId: "s8", place: 3, score: null },
      ],
    });
    expect(matches.hasResults(after)).toBe(true);
    // The input is untouched, and the final waits for the other Match.
    expect(match(before, "r1h1").status).toBe("ready");
    expect(lineup(match(after, "r2h1"))).toBe("- - - -");
  });

  it("refuses what can't be recorded", () => {
    const bracket = build(8, 4, 2);
    const refusals: [string, Parameters<typeof matches.applyResult>, string][] =
      [
        [
          "an unknown Match",
          [bracket, "nope", { order: [] }],
          "That Match isn't in this Bracket.",
        ],
        [
          "a bye",
          [build(5, 4, 2), "r1h2", { order: ["s2", "s3"] }],
          "A bye has no Match Result.",
        ],
        [
          "a Match still waiting",
          [bracket, "r2h1", { order: [] }],
          "This Match is still waiting for its Entrants.",
        ],
        [
          "a missing Entrant",
          [bracket, "r1h1", { order: ["s1", "s4", "s5"] }],
          "Put every Entrant of this Match in finishing order, once each.",
        ],
        [
          "an Entrant twice",
          [bracket, "r1h1", { order: ["s1", "s4", "s5", "s5"] }],
          "Put every Entrant of this Match in finishing order, once each.",
        ],
        [
          "an Entrant of another Match",
          [bracket, "r1h1", { order: ["s1", "s4", "s5", "s2"] }],
          "Put every Entrant of this Match in finishing order, once each.",
        ],
        [
          "a score from outside the Match",
          [
            bracket,
            "r1h1",
            { order: ["s1", "s4", "s5", "s8"], scores: { s2: "3" } },
          ],
          "Scores can only be given for this Match's Entrants.",
        ],
      ];
    for (const [, args, message] of refusals) {
      expect(() => matches.applyResult(...args)).toThrow(
        new BracketError(message),
      );
    }
  });

  it("fills the next Round by place, then Match position, once the Round is complete", () => {
    let bracket = recordInSlotOrder(build(10, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(lineup(match(bracket, "r2h1"))).toBe("- - -");
    bracket = recordInSlotOrder(bracket, "r1h3");
    // 1sts s1 s2 s3, then 2nds s6 s5 s4, dealt 1→H1 2→H2 3→H2 4→H1 5→H1 6→H2.
    expect(summary(bracket).slice(3)).toEqual([
      ["r2h1", "s1 s6 s5", "ready"],
      ["r2h2", "s2 s3 s4", "ready"],
      ["r3h1", "- - - -", "pending"],
    ]);
  });

  it("fills an upset's winner first", () => {
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = matches.applyResult(bracket, "r1h2", {
      order: ["s7", "s6", "s3", "s2"],
    });
    expect(lineup(match(bracket, "r2h1"))).toBe("s1 s7 s4 s6");
  });

  it("decides a later-Round bye when its Round fills", () => {
    // 6 Entrants, 2 per Match, 1 advancing: s6 upsets s1, and as the top
    // advancer takes Round 2's one-slot Match.
    let bracket = matches.applyResult(build(6, 2, 1), "r1h1", {
      order: ["s6", "s1"],
    });
    bracket = recordInSlotOrder(bracket, "r1h2");
    bracket = recordInSlotOrder(bracket, "r1h3");
    expect(summary(bracket).slice(3)).toEqual([
      ["r2h1", "s6", "played"],
      ["r2h2", "s2 s3", "ready"],
      ["r3h1", "- -", "pending"],
    ]);
    expect(places(match(bracket, "r2h1"))).toEqual([1]);
    expect(matches.isBye(bracket, match(bracket, "r2h1"))).toBe(true);
    expect(matches.isRecordable(bracket, "r2h1")).toBe(false);

    bracket = matches.applyResult(bracket, "r2h2", { order: ["s3", "s2"] });
    expect(lineup(match(bracket, "r3h1"))).toBe("s6 s3");
    expect(matches.isComplete(bracket)).toBe(false);
    bracket = matches.applyResult(bracket, "r3h1", { order: ["s3", "s6"] });
    expect(matches.isComplete(bracket)).toBe(true);
    expect(matches.winner(bracket)).toBe("s3");
  });

  it("records a final that everyone in it would advance from", () => {
    const bracket = matches.applyResult(build(2, 8, 7), "r1h1", {
      order: ["s2", "s1"],
    });
    expect(matches.isComplete(bracket)).toBe(true);
    expect(matches.winner(bracket)).toBe("s2");
  });
});

/** Deals ranked ids into Matches of the given sizes: 1→H1 … h→Hh, h+1→Hh … */
function snakeDeal(ranked: string[], matchCount: number): string[][] {
  const dealt: string[][] = Array.from({ length: matchCount }, () => []);
  let i = 0;
  let step = 1;
  for (const id of ranked) {
    dealt[i].push(id);
    const next = i + step;
    if (next < 0 || next >= matchCount) step = -step;
    else i = next;
  }
  return dealt;
}

describe("playing a whole Bracket", () => {
  it.each(accepted)(
    "plays $n Entrants, $config.entrantsPerHeat per Match, $config.advancePerHeat advancing to a Winner",
    ({ n, config }) => {
      let bracket = matches.generate(config, entrants(n), newId);
      const roundCount = rounds(bracket).length;
      for (let r = 1; r <= roundCount; r++) {
        for (const h of rounds(bracket)[r - 1]) {
          if (matches.isBye(bracket, h)) continue;
          if (r < roundCount) {
            // Nobody has a slot in the next Round until this one is complete.
            const next = rounds(bracket)[r];
            expect(
              next.every((x) => x.slots.every((s) => s.entrantId === null)),
            ).toBe(true);
          }
          expect(matches.isRecordable(bracket, h.id)).toBe(true);
          expect(matches.isComplete(bracket)).toBe(false);
          // Odd Matches finish in slot order, even Matches the other way round.
          const ids = h.slots.map((s) => s.entrantId!);
          bracket = matches.applyResult(bracket, h.id, {
            order: h.position % 2 === 1 ? ids : [...ids].reverse(),
          });
        }
        if (r === roundCount) break;

        const played = rounds(bracket)[r - 1];
        const ranked: string[] = [];
        for (let place = 1; place <= config.advancePerHeat; place++) {
          for (const h of played) {
            const slot = h.slots.find((s) => s.place === place);
            if (slot) ranked.push(slot.entrantId!);
          }
        }
        const next = rounds(bracket)[r];
        expect(next.map((h) => h.slots.map((s) => s.entrantId))).toEqual(
          snakeDeal(ranked, next.length),
        );
        for (const h of next) {
          const bye = matches.isBye(bracket, h);
          expect(h.status).toBe(bye ? "played" : "ready");
          expect(places(h)).toEqual(
            h.slots.map((_, i) => (bye ? i + 1 : null)),
          );
        }
      }
      const final = rounds(bracket)[roundCount - 1][0];
      expect(matches.isComplete(bracket)).toBe(true);
      expect(matches.winner(bracket)).toBe(final.slots[0].entrantId);
      expect(matches.hasResults(bracket)).toBe(true);
    },
  );
});

describe("resetByResult", () => {
  /** 8 Entrants, 4 per Match, 2 advancing: Round 1 in slot order, final s2 s1 s4 s3. */
  function finished(): Bracket {
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(lineup(match(bracket, "r2h1"))).toBe("s1 s2 s4 s3");
    return matches.applyResult(bracket, "r2h1", {
      order: ["s2", "s1", "s4", "s3"],
    });
  }

  it("resets nothing for a score-only edit or a swap below the advance line", () => {
    const bracket = finished();
    expect(
      matches.resetByResult(bracket, "r1h1", {
        order: ["s1", "s4", "s5", "s8"],
        scores: { s1: "40" },
      }),
    ).toEqual([]);
    expect(
      matches.resetByResult(bracket, "r1h1", {
        order: ["s1", "s4", "s8", "s5"],
      }),
    ).toEqual([]);
    const edited = matches.applyResult(bracket, "r1h1", {
      order: ["s1", "s4", "s8", "s5"],
    });
    expect(places(match(edited, "r1h1"))).toEqual([1, 2, 4, 3]);
    expect(matches.winner(edited)).toBe("s2");
  });

  it("clears the later Matches when an advancer changes", () => {
    const bracket = finished();
    const result = { order: ["s5", "s4", "s1", "s8"] };
    expect(matches.resetByResult(bracket, "r1h1", result)).toEqual(["r2h1"]);
    // The input is untouched.
    expect(matches.isComplete(bracket)).toBe(true);

    const edited = matches.applyResult(bracket, "r1h1", result);
    expect(summary(edited)[2]).toEqual(["r2h1", "s5 s2 s4 s3", "ready"]);
    expect(places(match(edited, "r2h1"))).toEqual([null, null, null, null]);
    expect(matches.isComplete(edited)).toBe(false);
    expect(matches.winner(edited)).toBeNull();
  });

  it("clears the later Matches when only the advancers' order changes", () => {
    const bracket = finished();
    const result = { order: ["s4", "s1", "s5", "s8"] };
    expect(matches.resetByResult(bracket, "r1h1", result)).toEqual(["r2h1"]);
    expect(
      lineup(match(matches.applyResult(bracket, "r1h1", result), "r2h1")),
    ).toBe("s4 s2 s1 s3");
  });

  it("resets nothing before the Round is complete, or for byes and undecided Matches", () => {
    const partial = recordInSlotOrder(build(8, 4, 2), "r1h1");
    expect(
      matches.resetByResult(partial, "r1h1", {
        order: ["s8", "s5", "s4", "s1"],
      }),
    ).toEqual([]);
    expect(
      matches.resetByResult(partial, "r1h2", {
        order: ["s7", "s6", "s3", "s2"],
      }),
    ).toEqual([]);
    expect(
      matches.resetByResult(build(5, 4, 2), "r1h2", { order: ["s3", "s2"] }),
    ).toEqual([]);
  });

  it("names no Match when the next Round is filled but unplayed, and refills it", () => {
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    const result = { order: ["s8", "s5", "s4", "s1"] };
    expect(matches.resetByResult(bracket, "r1h1", result)).toEqual([]);
    expect(
      lineup(match(matches.applyResult(bracket, "r1h1", result), "r2h1")),
    ).toBe("s8 s2 s5 s3");
  });

  it("clears every later Round of a three-Round Bracket", () => {
    // 10 Entrants, 4 per Match, 2 advancing, every Match in slot order.
    let bracket = build(10, 4, 2);
    for (const id of ["r1h1", "r1h2", "r1h3", "r2h1", "r2h2"]) {
      bracket = recordInSlotOrder(bracket, id);
    }
    // Round 2: s1 s6 s5 and s2 s3 s4 → 1sts s1 s2, 2nds s6 s3.
    expect(lineup(match(bracket, "r3h1"))).toBe("s1 s2 s6 s3");
    bracket = recordInSlotOrder(bracket, "r3h1");
    expect(matches.winner(bracket)).toBe("s1");

    const result = { order: ["s6", "s1", "s7"] };
    expect(matches.resetByResult(bracket, "r1h1", result)).toEqual([
      "r2h1",
      "r2h2",
      "r3h1",
    ]);
    // A final has no later Matches.
    expect(
      matches.resetByResult(bracket, "r3h1", {
        order: ["s3", "s6", "s2", "s1"],
      }),
    ).toEqual([]);

    // Ranked s6 s2 s3, then s1 s5 s4: dealt 1→H1 2→H2 3→H2 4→H1 5→H1 6→H2.
    const edited = matches.applyResult(bracket, "r1h1", result);
    expect(summary(edited).slice(3)).toEqual([
      ["r2h1", "s6 s1 s5", "ready"],
      ["r2h2", "s2 s3 s4", "ready"],
      ["r3h1", "- - - -", "pending"],
    ]);
  });
});

describe("finalPlacings", () => {
  it("places the final in order, and nobody outside it", () => {
    // 8 Entrants, 4 per Match, 2 advancing; the final finishes s2 s1 s4 s3.
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(() => matches.finalPlacings(bracket, entrants(8))).toThrow(
      new BracketError("The Bracket isn't finished yet."),
    );
    bracket = matches.applyResult(bracket, "r2h1", {
      order: ["s2", "s1", "s4", "s3"],
    });
    expect(matches.finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s1", place: 2 },
      { entrantId: "s4", place: 3 },
      { entrantId: "s3", place: 4 },
    ]);
  });

  it("places only the final of a three-Round Bracket", () => {
    // 10 Entrants, 4 per Match, 2 advancing, every Match in slot order:
    // Round 1 loses s7, s8, s9, s10; Round 2 loses s5, s4; final s1 s2 s6 s3.
    let bracket = build(10, 4, 2);
    for (const id of ["r1h1", "r1h2", "r1h3", "r2h1", "r2h2", "r3h1"]) {
      bracket = recordInSlotOrder(bracket, id);
    }
    expect(matches.finalPlacings(bracket, entrants(10))).toEqual([
      { entrantId: "s1", place: 1 },
      { entrantId: "s2", place: 2 },
      { entrantId: "s6", place: 3 },
      { entrantId: "s3", place: 4 },
    ]);
  });

  it("places a final of 2 1st and 2nd, after a bye", () => {
    // 6 Entrants, 2 per Match, 1 advancing: s6 beats s1, takes Round 2's bye
    // and loses the final to s3, who beat s2 in Round 2.
    let bracket = matches.applyResult(build(6, 2, 1), "r1h1", {
      order: ["s6", "s1"],
    });
    for (const id of ["r1h2", "r1h3"]) bracket = recordInSlotOrder(bracket, id);
    bracket = matches.applyResult(bracket, "r2h2", { order: ["s3", "s2"] });
    bracket = matches.applyResult(bracket, "r3h1", { order: ["s3", "s6"] });
    expect(matches.finalPlacings(bracket, entrants(6))).toEqual([
      { entrantId: "s3", place: 1 },
      { entrantId: "s6", place: 2 },
    ]);
  });
});

describe("hasResults", () => {
  it("counts a recorded Match, not a bye or an empty Match", () => {
    const bracket = build(5, 4, 2);
    expect(match(bracket, "r1h2").status).toBe("played");
    expect(matches.hasResults(bracket)).toBe(false);
    expect(matches.hasResults(recordInSlotOrder(bracket, "r1h1"))).toBe(true);
  });
});
