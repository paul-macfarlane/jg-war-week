import { describe, expect, it } from "vitest";

import { heats } from "@/lib/bracket/heats";
import {
  type Bracket,
  BracketError,
  type Entrant,
  type Heat,
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

function build(count: number, perHeat: number, advance: number): Bracket {
  return heats.generate(
    {
      entrantsPerHeat: perHeat,
      advancePerHeat: advance,
      thirdPlaceGame: false,
    },
    entrants(count),
    newId,
  );
}

function heat(bracket: Bracket, id: string): Heat {
  const found = bracket.heats.find((h) => h.id === id);
  if (!found) throw new Error(`no Heat ${id}`);
  return found;
}

/** A Heat's slots as entrant ids ("-" for an empty slot). */
function lineup(h: Heat): string {
  return h.slots.map((s) => s.entrantId ?? "-").join(" ");
}

/** Each Heat as [id, lineup, status]. */
function summary(bracket: Bracket): [string, string, string][] {
  return bracket.heats.map((h) => [h.id, lineup(h), h.status]);
}

/** A Heat's places, slot by slot. */
function places(h: Heat): (number | null)[] {
  return h.slots.map((s) => s.place);
}

/** Records every Entrant of the Heat in slot order, top to bottom. */
function recordInSlotOrder(bracket: Bracket, id: string): Bracket {
  return heats.applyResult(bracket, id, {
    order: heat(bracket, id).slots.map((s) => s.entrantId!),
  });
}

function rounds(bracket: Bracket): Heat[][] {
  const last = Math.max(...bracket.heats.map((h) => h.round));
  return Array.from({ length: last }, (_, r) =>
    bracket.heats
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
      heats.validateConfig(config, n),
    );
    expect(refusals.filter((r) => r === null)).toHaveLength(318);
    expect(refusals.filter((r) => r !== null)).toHaveLength(130);
    for (const r of refusals) {
      if (r !== null) {
        expect(r).toMatch(
          /^With \d+ Entrants, \d per Heat and \d advancing, Round \d+ would never end\. Lower how many advance\.$/,
        );
      }
    }
  });

  it("names the Round that would never end", () => {
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        4,
      ),
    ).toBe(
      "With 4 Entrants, 3 per Heat and 2 advancing, Round 1 would never end. Lower how many advance.",
    );
    // 7 → Heats of 3, 2, 2 send 6 on → 3, 3 send 4 on → 2, 2 send 4 on.
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        7,
      ),
    ).toBe(
      "With 7 Entrants, 3 per Heat and 2 advancing, Round 3 would never end. Lower how many advance.",
    );
  });

  it("accepts a count that fits in one Heat, however many advance", () => {
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 3, advancePerHeat: 2, thirdPlaceGame: false },
        3,
      ),
    ).toBeNull();
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 8, advancePerHeat: 7, thirdPlaceGame: false },
        2,
      ),
    ).toBeNull();
  });

  it("needs 2 Entrants and a valid config", () => {
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
        1,
      ),
    ).toBe("A Bracket needs at least 2 Entrants.");
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 4, thirdPlaceGame: false },
        8,
      ),
    ).toBe("Fewer must advance than play in a Heat.");
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 9, advancePerHeat: 2, thirdPlaceGame: false },
        8,
      ),
    ).toBe("A Heat holds at most 8 Entrants.");
    // 4 per Heat, 2 advancing: 5 → Heats of 3 and 2 send 4 on (the final).
    expect(
      heats.validateConfig(
        { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
        5,
      ),
    ).toBeNull();
  });
});

const accepted = ranges.filter(
  ({ n, config }) => heats.validateConfig(config, n) === null,
);
const refused = ranges.filter(
  ({ n, config }) => heats.validateConfig(config, n) !== null,
);

describe("generate", () => {
  it.each(accepted)(
    "builds every Round for $n Entrants, $config.entrantsPerHeat per Heat, $config.advancePerHeat advancing",
    ({ n, config }) => {
      const bracket = heats.generate(config, entrants(n), newId);
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

      // Round 1 holds every Entrant once; its short Heats are decided byes.
      const first = all[0].flatMap((h) => h.slots.map((s) => s.entrantId));
      expect([...first].sort()).toEqual(
        entrants(n)
          .map((e) => e.id)
          .sort(),
      );
      for (const h of all[0]) {
        const bye = all.length > 1 && h.slots.length <= config.advancePerHeat;
        expect(heats.isBye(bracket, h)).toBe(bye);
        expect(heats.isRecordable(bracket, h.id)).toBe(!bye);
        expect(h.status).toBe(bye ? "played" : "ready");
        expect(h.slots.map((s) => s.place)).toEqual(
          bye ? h.slots.map((_, i) => i + 1) : h.slots.map(() => null),
        );
      }
      // Later Rounds wait, empty.
      for (const h of all.slice(1).flat()) {
        expect(h.status).toBe("pending");
        expect(h.slots.every((s) => s.entrantId === null)).toBe(true);
        expect(heats.isRecordable(bracket, h.id)).toBe(false);
      }
      expect(heats.hasResults(bracket)).toBe(false);
      expect(heats.isComplete(bracket)).toBe(false);
      expect(heats.champion(bracket)).toBeNull();
    },
  );

  it.each(refused)(
    "refuses $n Entrants, $config.entrantsPerHeat per Heat, $config.advancePerHeat advancing",
    ({ n, config }) => {
      const message = heats.validateConfig(config, n)!;
      expect(() => heats.generate(config, entrants(n), newId)).toThrow(
        new BracketError(message),
      );
    },
  );

  it("refuses too few Entrants and a bad config", () => {
    expect(() => build(1, 4, 2)).toThrow(
      new BracketError("A Bracket needs at least 2 Entrants."),
    );
    expect(() => build(8, 4, 5)).toThrow(
      new BracketError("Fewer must advance than play in a Heat."),
    );
  });

  it("deals 8 Entrants into two Heats of 4 by snake, the final waiting", () => {
    expect(summary(build(8, 4, 2))).toEqual([
      ["r1h1", "s1 s4 s5 s8", "ready"],
      ["r1h2", "s2 s3 s6 s7", "ready"],
      ["r2h1", "- - - -", "pending"],
    ]);
  });

  it("deals 10 Entrants into Heats of 3, 3 and 4, then 3, 3, then the final", () => {
    expect(summary(build(10, 4, 2))).toEqual([
      ["r1h1", "s1 s6 s7", "ready"],
      ["r1h2", "s2 s5 s8", "ready"],
      ["r1h3", "s3 s4 s9 s10", "ready"],
      ["r2h1", "- - -", "pending"],
      ["r2h2", "- - -", "pending"],
      ["r3h1", "- - - -", "pending"],
    ]);
  });

  it("builds a later one-slot Heat: 6 Entrants, 2 per Heat, 1 advancing", () => {
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
    // 5 Entrants, 4 per Heat, 2 advancing: s2 and s3 go through unplayed.
    const bracket = build(5, 4, 2);
    expect(summary(bracket)).toEqual([
      ["r1h1", "s1 s4 s5", "ready"],
      ["r1h2", "s2 s3", "played"],
      ["r2h1", "- - - -", "pending"],
    ]);
    expect(heat(bracket, "r1h2").slots.map((s) => s.place)).toEqual([1, 2]);
    expect(heats.isBye(bracket, heat(bracket, "r1h2"))).toBe(true);
    expect(heats.hasResults(bracket)).toBe(false);

    // 3 Entrants, 2 per Heat, 1 advancing: the top Seed Position's bye.
    expect(summary(build(3, 2, 1))).toEqual([
      ["r1h1", "s1", "played"],
      ["r1h2", "s2 s3", "ready"],
      ["r2h1", "- -", "pending"],
    ]);
  });

  it("makes a count that fits in one Heat the final, even when all would advance", () => {
    const bracket = build(2, 8, 7);
    expect(summary(bracket)).toEqual([["r1h1", "s1 s2", "ready"]]);
    expect(heats.isBye(bracket, heat(bracket, "r1h1"))).toBe(false);
    expect(heats.isRecordable(bracket, "r1h1")).toBe(true);
  });

  it("deals 8 Entrants into Heats of 4 at 4 per Heat, 2 advancing", () => {
    const bracket = build(8, 4, 2);
    expect(bracket.heats.map((h) => h.slots.length)).toEqual([4, 4, 4]);
  });
});

describe("applyResult", () => {
  it("places a Heat's Entrants in finishing order, trimming scores", () => {
    const before = build(8, 4, 2);
    const after = heats.applyResult(before, "r1h1", {
      order: ["s5", "s1", "s8", "s4"],
      scores: { s5: " 12 ", s1: "  " },
    });
    expect(heat(after, "r1h1")).toMatchObject({
      status: "played",
      slots: [
        { entrantId: "s1", place: 2, score: null, forfeited: false },
        { entrantId: "s4", place: 4, score: null, forfeited: false },
        { entrantId: "s5", place: 1, score: "12", forfeited: false },
        { entrantId: "s8", place: 3, score: null, forfeited: false },
      ],
    });
    expect(heats.hasResults(after)).toBe(true);
    // The input is untouched, and the final waits for the other Heat.
    expect(heat(before, "r1h1").status).toBe("ready");
    expect(lineup(heat(after, "r2h1"))).toBe("- - - -");
  });

  it("refuses what can't be recorded", () => {
    const bracket = build(8, 4, 2);
    const refusals: [string, Parameters<typeof heats.applyResult>, string][] = [
      [
        "an unknown Heat",
        [bracket, "nope", { order: [] }],
        "That Heat isn't in this Bracket.",
      ],
      [
        "a bye",
        [build(5, 4, 2), "r1h2", { order: ["s2", "s3"] }],
        "A bye has no Heat Result.",
      ],
      [
        "a Heat still waiting",
        [bracket, "r2h1", { order: [] }],
        "This Heat is still waiting for its Entrants.",
      ],
      [
        "a missing Entrant",
        [bracket, "r1h1", { order: ["s1", "s4", "s5"] }],
        "Put every Entrant of this Heat in finishing order, once each.",
      ],
      [
        "an Entrant twice",
        [bracket, "r1h1", { order: ["s1", "s4", "s5", "s5"] }],
        "Put every Entrant of this Heat in finishing order, once each.",
      ],
      [
        "an Entrant of another Heat",
        [bracket, "r1h1", { order: ["s1", "s4", "s5", "s2"] }],
        "Put every Entrant of this Heat in finishing order, once each.",
      ],
      [
        "a forfeit from outside the Heat",
        [
          bracket,
          "r1h1",
          { order: ["s1", "s4", "s5", "s8"], forfeits: ["s2"] },
        ],
        "Only an Entrant of this Heat can forfeit it.",
      ],
      [
        "a score from outside the Heat",
        [
          bracket,
          "r1h1",
          { order: ["s1", "s4", "s5", "s8"], scores: { s2: "3" } },
        ],
        "Scores can only be given for this Heat's Entrants.",
      ],
      [
        "every Entrant forfeiting",
        [
          bracket,
          "r1h1",
          {
            order: ["s1", "s4", "s5", "s8"],
            forfeits: ["s1", "s4", "s5", "s8"],
          },
        ],
        "Someone has to advance, so not every Entrant can forfeit.",
      ],
    ];
    for (const [, args, message] of refusals) {
      expect(() => heats.applyResult(...args)).toThrow(
        new BracketError(message),
      );
    }
  });

  it("puts a forfeiter listed first behind everyone who didn't forfeit", () => {
    const bracket = heats.applyResult(build(8, 4, 2), "r1h1", {
      order: ["s1", "s4", "s5", "s8"],
      forfeits: ["s1"],
    });
    const h = heat(bracket, "r1h1");
    expect(h.status).toBe("forfeit");
    expect(places(h)).toEqual([4, 1, 2, 3]);
    expect(h.slots.map((s) => s.forfeited)).toEqual([
      true,
      false,
      false,
      false,
    ]);
  });

  it("advances a forfeiter only when fewer than the advancing number didn't forfeit", () => {
    // Top 2 advance; only s8 didn't forfeit, so s1 (first of the forfeiters)
    // is 2nd and goes on with s8.
    let bracket = heats.applyResult(build(8, 4, 2), "r1h1", {
      order: ["s1", "s4", "s5", "s8"],
      forfeits: ["s1", "s4", "s5"],
    });
    expect(places(heat(bracket, "r1h1"))).toEqual([2, 3, 4, 1]);
    bracket = recordInSlotOrder(bracket, "r1h2");
    // 1sts: s8, s2; 2nds: s1, s3.
    expect(lineup(heat(bracket, "r2h1"))).toBe("s8 s2 s1 s3");
  });

  it("fills the next Round by place, then Heat position, once the Round is complete", () => {
    let bracket = recordInSlotOrder(build(10, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(lineup(heat(bracket, "r2h1"))).toBe("- - -");
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
    bracket = heats.applyResult(bracket, "r1h2", {
      order: ["s7", "s6", "s3", "s2"],
    });
    expect(lineup(heat(bracket, "r2h1"))).toBe("s1 s7 s4 s6");
  });

  it("decides a later-Round bye when its Round fills", () => {
    // 6 Entrants, 2 per Heat, 1 advancing: s6 upsets s1, and as the top
    // advancer takes Round 2's one-slot Heat.
    let bracket = heats.applyResult(build(6, 2, 1), "r1h1", {
      order: ["s6", "s1"],
    });
    bracket = recordInSlotOrder(bracket, "r1h2");
    bracket = recordInSlotOrder(bracket, "r1h3");
    expect(summary(bracket).slice(3)).toEqual([
      ["r2h1", "s6", "played"],
      ["r2h2", "s2 s3", "ready"],
      ["r3h1", "- -", "pending"],
    ]);
    expect(places(heat(bracket, "r2h1"))).toEqual([1]);
    expect(heats.isBye(bracket, heat(bracket, "r2h1"))).toBe(true);
    expect(heats.isRecordable(bracket, "r2h1")).toBe(false);

    bracket = heats.applyResult(bracket, "r2h2", { order: ["s3", "s2"] });
    expect(lineup(heat(bracket, "r3h1"))).toBe("s6 s3");
    expect(heats.isComplete(bracket)).toBe(false);
    bracket = heats.applyResult(bracket, "r3h1", { order: ["s3", "s6"] });
    expect(heats.isComplete(bracket)).toBe(true);
    expect(heats.champion(bracket)).toBe("s3");
  });

  it("records a final that everyone in it would advance from", () => {
    const bracket = heats.applyResult(build(2, 8, 7), "r1h1", {
      order: ["s2", "s1"],
    });
    expect(heats.isComplete(bracket)).toBe(true);
    expect(heats.champion(bracket)).toBe("s2");
  });
});

/** Deals ranked ids into Heats of the given sizes: 1→H1 … h→Hh, h+1→Hh … */
function snakeDeal(ranked: string[], heatCount: number): string[][] {
  const dealt: string[][] = Array.from({ length: heatCount }, () => []);
  let i = 0;
  let step = 1;
  for (const id of ranked) {
    dealt[i].push(id);
    const next = i + step;
    if (next < 0 || next >= heatCount) step = -step;
    else i = next;
  }
  return dealt;
}

describe("playing a whole Bracket", () => {
  it.each(accepted)(
    "plays $n Entrants, $config.entrantsPerHeat per Heat, $config.advancePerHeat advancing to a champion",
    ({ n, config }) => {
      let bracket = heats.generate(config, entrants(n), newId);
      const roundCount = rounds(bracket).length;
      for (let r = 1; r <= roundCount; r++) {
        for (const h of rounds(bracket)[r - 1]) {
          if (heats.isBye(bracket, h)) continue;
          if (r < roundCount) {
            // Nobody has a slot in the next Round until this one is complete.
            const next = rounds(bracket)[r];
            expect(
              next.every((x) => x.slots.every((s) => s.entrantId === null)),
            ).toBe(true);
          }
          expect(heats.isRecordable(bracket, h.id)).toBe(true);
          expect(heats.isComplete(bracket)).toBe(false);
          // Odd Heats finish in slot order, even Heats the other way round.
          const ids = h.slots.map((s) => s.entrantId!);
          bracket = heats.applyResult(bracket, h.id, {
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
          const bye = heats.isBye(bracket, h);
          expect(h.status).toBe(bye ? "played" : "ready");
          expect(places(h)).toEqual(
            h.slots.map((_, i) => (bye ? i + 1 : null)),
          );
        }
      }
      const final = rounds(bracket)[roundCount - 1][0];
      expect(heats.isComplete(bracket)).toBe(true);
      expect(heats.champion(bracket)).toBe(final.slots[0].entrantId);
      expect(heats.hasResults(bracket)).toBe(true);
    },
  );
});

describe("resetByResult", () => {
  /** 8 Entrants, 4 per Heat, 2 advancing: Round 1 in slot order, final s2 s1 s4 s3. */
  function finished(): Bracket {
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(lineup(heat(bracket, "r2h1"))).toBe("s1 s2 s4 s3");
    return heats.applyResult(bracket, "r2h1", {
      order: ["s2", "s1", "s4", "s3"],
    });
  }

  it("resets nothing for a score-only edit or a swap below the advance line", () => {
    const bracket = finished();
    expect(
      heats.resetByResult(bracket, "r1h1", {
        order: ["s1", "s4", "s5", "s8"],
        scores: { s1: "40" },
      }),
    ).toEqual([]);
    expect(
      heats.resetByResult(bracket, "r1h1", {
        order: ["s1", "s4", "s8", "s5"],
      }),
    ).toEqual([]);
    const edited = heats.applyResult(bracket, "r1h1", {
      order: ["s1", "s4", "s8", "s5"],
    });
    expect(places(heat(edited, "r1h1"))).toEqual([1, 2, 4, 3]);
    expect(heats.champion(edited)).toBe("s2");
  });

  it("clears the later Heats when an advancer changes", () => {
    const bracket = finished();
    const result = { order: ["s5", "s4", "s1", "s8"] };
    expect(heats.resetByResult(bracket, "r1h1", result)).toEqual(["r2h1"]);
    // The input is untouched.
    expect(heats.isComplete(bracket)).toBe(true);

    const edited = heats.applyResult(bracket, "r1h1", result);
    expect(summary(edited)[2]).toEqual(["r2h1", "s5 s2 s4 s3", "ready"]);
    expect(places(heat(edited, "r2h1"))).toEqual([null, null, null, null]);
    expect(heats.isComplete(edited)).toBe(false);
    expect(heats.champion(edited)).toBeNull();
  });

  it("clears the later Heats when only the advancers' order changes", () => {
    const bracket = finished();
    const result = { order: ["s4", "s1", "s5", "s8"] };
    expect(heats.resetByResult(bracket, "r1h1", result)).toEqual(["r2h1"]);
    expect(
      lineup(heat(heats.applyResult(bracket, "r1h1", result), "r2h1")),
    ).toBe("s4 s2 s1 s3");
  });

  it("resets nothing before the Round is complete, or for byes and undecided Heats", () => {
    const partial = recordInSlotOrder(build(8, 4, 2), "r1h1");
    expect(
      heats.resetByResult(partial, "r1h1", { order: ["s8", "s5", "s4", "s1"] }),
    ).toEqual([]);
    expect(
      heats.resetByResult(partial, "r1h2", { order: ["s7", "s6", "s3", "s2"] }),
    ).toEqual([]);
    expect(
      heats.resetByResult(build(5, 4, 2), "r1h2", { order: ["s3", "s2"] }),
    ).toEqual([]);
  });

  it("names no Heat when the next Round is filled but unplayed, and refills it", () => {
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    const result = { order: ["s8", "s5", "s4", "s1"] };
    expect(heats.resetByResult(bracket, "r1h1", result)).toEqual([]);
    expect(
      lineup(heat(heats.applyResult(bracket, "r1h1", result), "r2h1")),
    ).toBe("s8 s2 s5 s3");
  });

  it("clears every later Round of a three-Round Bracket", () => {
    // 10 Entrants, 4 per Heat, 2 advancing, every Heat in slot order.
    let bracket = build(10, 4, 2);
    for (const id of ["r1h1", "r1h2", "r1h3", "r2h1", "r2h2"]) {
      bracket = recordInSlotOrder(bracket, id);
    }
    // Round 2: s1 s6 s5 and s2 s3 s4 → 1sts s1 s2, 2nds s6 s3.
    expect(lineup(heat(bracket, "r3h1"))).toBe("s1 s2 s6 s3");
    bracket = recordInSlotOrder(bracket, "r3h1");
    expect(heats.champion(bracket)).toBe("s1");

    const result = { order: ["s6", "s1", "s7"] };
    expect(heats.resetByResult(bracket, "r1h1", result)).toEqual([
      "r2h1",
      "r2h2",
      "r3h1",
    ]);
    // A final has no later Heats.
    expect(
      heats.resetByResult(bracket, "r3h1", { order: ["s3", "s6", "s2", "s1"] }),
    ).toEqual([]);

    // Ranked s6 s2 s3, then s1 s5 s4: dealt 1→H1 2→H2 3→H2 4→H1 5→H1 6→H2.
    const edited = heats.applyResult(bracket, "r1h1", result);
    expect(summary(edited).slice(3)).toEqual([
      ["r2h1", "s6 s1 s5", "ready"],
      ["r2h2", "s2 s3 s4", "ready"],
      ["r3h1", "- - - -", "pending"],
    ]);
  });
});

describe("finalPlacings", () => {
  it("places the final in order and ties each Round's losers", () => {
    // 8 Entrants, 4 per Heat, 2 advancing; the final finishes s2 s1 s4 s3.
    let bracket = recordInSlotOrder(build(8, 4, 2), "r1h1");
    bracket = recordInSlotOrder(bracket, "r1h2");
    expect(() => heats.finalPlacings(bracket, entrants(8))).toThrow(
      new BracketError("The Bracket isn't finished yet."),
    );
    bracket = heats.applyResult(bracket, "r2h1", {
      order: ["s2", "s1", "s4", "s3"],
    });
    expect(heats.finalPlacings(bracket, entrants(8))).toEqual([
      { entrantId: "s2", place: 1 },
      { entrantId: "s1", place: 2 },
      { entrantId: "s4", place: 3 },
      { entrantId: "s3", place: 4 },
      { entrantId: "s5", place: 5 },
      { entrantId: "s6", place: 5 },
      { entrantId: "s7", place: 5 },
      { entrantId: "s8", place: 5 },
    ]);
  });

  it("ranks those who went out later above those who went out earlier", () => {
    // 10 Entrants, 4 per Heat, 2 advancing, every Heat in slot order:
    // Round 1 loses s7, s8, s9, s10; Round 2 loses s5, s4; final s1 s2 s6 s3.
    let bracket = build(10, 4, 2);
    for (const id of ["r1h1", "r1h2", "r1h3", "r2h1", "r2h2", "r3h1"]) {
      bracket = recordInSlotOrder(bracket, id);
    }
    expect(heats.finalPlacings(bracket, entrants(10))).toEqual([
      { entrantId: "s1", place: 1 },
      { entrantId: "s2", place: 2 },
      { entrantId: "s6", place: 3 },
      { entrantId: "s3", place: 4 },
      { entrantId: "s4", place: 5 },
      { entrantId: "s5", place: 5 },
      { entrantId: "s7", place: 7 },
      { entrantId: "s8", place: 7 },
      { entrantId: "s9", place: 7 },
      { entrantId: "s10", place: 7 },
    ]);
  });

  it("counts a bye as going through, not going out", () => {
    // 6 Entrants, 2 per Heat, 1 advancing: s6 beats s1, takes Round 2's bye
    // and loses the final to s3, who beat s2 in Round 2.
    let bracket = heats.applyResult(build(6, 2, 1), "r1h1", {
      order: ["s6", "s1"],
    });
    for (const id of ["r1h2", "r1h3"]) bracket = recordInSlotOrder(bracket, id);
    bracket = heats.applyResult(bracket, "r2h2", { order: ["s3", "s2"] });
    bracket = heats.applyResult(bracket, "r3h1", { order: ["s3", "s6"] });
    expect(heats.finalPlacings(bracket, entrants(6))).toEqual([
      { entrantId: "s3", place: 1 },
      { entrantId: "s6", place: 2 },
      { entrantId: "s2", place: 3 },
      { entrantId: "s1", place: 4 },
      { entrantId: "s4", place: 4 },
      { entrantId: "s5", place: 4 },
    ]);
  });
});

describe("hasResults", () => {
  it("counts a recorded Heat, not a bye or an empty Heat", () => {
    const bracket = build(5, 4, 2);
    expect(heat(bracket, "r1h2").status).toBe("played");
    expect(heats.hasResults(bracket)).toBe(false);
    expect(heats.hasResults(recordInSlotOrder(bracket, "r1h1"))).toBe(true);
  });
});
