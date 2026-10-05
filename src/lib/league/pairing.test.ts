import { describe, expect, it } from "vitest";

import { shuffleSeedPositions } from "@/lib/bracket/seeding";
import type { LeagueResult } from "@/lib/enums";
import {
  EVERY_PAIRING_REPEATS,
  type LeagueEntrant,
  type LeagueMatchFacts,
  neverMet,
  rematches,
  roundRobin,
  swap,
  swapWarnings,
  swissRound,
} from "@/lib/league/pairing";

/** A small seeded PRNG (mulberry32), so every run is repeatable. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const seeded = (ids: string[]): LeagueEntrant[] =>
  ids.map((id, i) => ({ id, seedPosition: i + 1 }));

const pairKey = (a: string, b: string) => [a, b].sort().join("–");

describe("roundRobin: a round robin of 5", () => {
  const rounds = roundRobin(seeded(["A", "B", "C", "D", "E"]));

  it("plays 5 rounds, each Entrant once per round", () => {
    expect(rounds.map((r) => r.round)).toEqual([1, 2, 3, 4, 5]);
    for (const { matches } of rounds) {
      const seen = matches.flatMap((m) => (m.b ? [m.a, m.b] : [m.a]));
      expect(seen.sort()).toEqual(["A", "B", "C", "D", "E"]);
    }
  });

  it("meets every pair exactly once", () => {
    const pairs = rounds.flatMap((r) =>
      r.matches.flatMap((m) => (m.b ? [pairKey(m.a, m.b)] : [])),
    );
    expect(pairs).toHaveLength(10);
    expect(new Set(pairs).size).toBe(10);
  });

  it("sits one Entrant out each round, and each Entrant out exactly once", () => {
    const sitOuts = rounds.map((r) => r.matches.filter((m) => m.b === null));
    expect(sitOuts.map((s) => s.length)).toEqual([1, 1, 1, 1, 1]);
    expect(sitOuts.map(([s]) => s.a).sort()).toEqual(["A", "B", "C", "D", "E"]);
  });
});

describe("roundRobin: an even count", () => {
  it("plays N − 1 rounds with nobody sitting out, every pair once", () => {
    const rounds = roundRobin(seeded(["A", "B", "C", "D", "E", "F"]));
    expect(rounds).toHaveLength(5);
    expect(rounds.every((r) => r.matches.every((m) => m.b !== null))).toBe(
      true,
    );
    const pairs = rounds.flatMap((r) =>
      r.matches.map((m) => pairKey(m.a, m.b!)),
    );
    expect(new Set(pairs).size).toBe(15);
  });

  it("pairs by Seed Position whatever order the Entrants arrive in", () => {
    const entrants: LeagueEntrant[] = [
      { id: "B", seedPosition: 2 },
      { id: "A", seedPosition: 1 },
    ];
    expect(roundRobin(entrants)).toEqual([
      { round: 1, matches: [{ a: "A", b: "B" }] },
    ]);
  });
});

describe("swissRound: round 1", () => {
  it("is one group paired top half against bottom half by Seed Position", () => {
    const paired = swissRound({
      entrants: seeded(["1", "2", "3", "4", "5", "6", "7", "8"]),
      matches: [],
    });
    expect(paired).toMatchObject({
      ok: true,
      matches: [
        { a: "1", b: "5" },
        { a: "2", b: "6" },
        { a: "3", b: "7" },
        { a: "4", b: "8" },
      ],
    });
  });

  it("with an odd count, gives the lowest seed the bye, listed last", () => {
    const paired = swissRound({
      entrants: seeded(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
      matches: [],
    });
    expect(paired).toMatchObject({
      ok: true,
      matches: [
        { a: "1", b: "5" },
        { a: "2", b: "6" },
        { a: "3", b: "7" },
        { a: "4", b: "8" },
        { a: "9", b: null },
      ],
    });
  });
});

describe("swissRound: a fixed round 2 (the Swiss 1–9 fixture's round 1)", () => {
  // R1: 1–5 1 won, 2–6 draw, 3–7 1st won, 4–8 8 won, 9 bye. Standing:
  // 1, 3, 8, 9 on 1 (Buchholz 0, by seed); 2, 6 on ½; 4, 5, 7 on 0
  // (Buchholz 1 each, by seed). Bye: 7, the lowest. Then 1 meets 8 (the
  // mirror of its group of 4), 3 meets 9, 2 can't meet 6 again so floats to
  // 4, and 6 takes 5.
  const round1: LeagueMatchFacts[] = [
    { round: 1, a: "1", b: "5", result: "a" },
    { round: 1, a: "2", b: "6", result: "draw" },
    { round: 1, a: "3", b: "7", result: "a" },
    { round: 1, a: "4", b: "8", result: "b" },
    { round: 1, a: "9", b: null, result: null },
  ];

  it("pairs within score groups, floats down to avoid a rematch and gives the bye to the lowest-ranked", () => {
    const paired = swissRound({
      entrants: seeded(["1", "2", "3", "4", "5", "6", "7", "8", "9"]),
      matches: round1,
    });
    expect(paired).toMatchObject({
      ok: true,
      matches: [
        { a: "1", b: "8" },
        { a: "3", b: "9" },
        { a: "2", b: "4" },
        { a: "6", b: "5" },
        { a: "7", b: null },
      ],
    });
  });
});

describe("swissRound: a dead end", () => {
  // 6 Entrants whose first three rounds played every pair across {1,2,3}
  // and {4,5,6}: what's left is two triangles, and a triangle can't pair.
  it("refuses when every pairing would repeat a Match", () => {
    const played: [number, string, string][] = [
      [1, "1", "4"],
      [1, "2", "5"],
      [1, "3", "6"],
      [2, "1", "5"],
      [2, "2", "6"],
      [2, "3", "4"],
      [3, "1", "6"],
      [3, "2", "4"],
      [3, "3", "5"],
    ];
    const results: LeagueResult[] = ["a", "b", "draw"];
    const paired = swissRound({
      entrants: seeded(["1", "2", "3", "4", "5", "6"]),
      matches: played.map(([round, a, b], i) => ({
        round,
        a,
        b,
        result: results[i % 3],
      })),
    });
    expect(paired).toMatchObject({
      ok: false,
      error: "Every pairing would repeat a Match. Close the League.",
    });
    expect(EVERY_PAIRING_REPEATS).toBe(
      "Every pairing would repeat a Match. Close the League.",
    );
  });
});

/**
 * The spec's ranking, worked out here on its own: match points (win 1,
 * draw ½, Swiss bye 1), then Buchholz (opponents' match points over played
 * Matches), then Seed Position.
 */
function oracleRanking(
  entrants: LeagueEntrant[],
  matches: LeagueMatchFacts[],
): string[] {
  const points = new Map(entrants.map((e) => [e.id, 0]));
  const opponents = new Map<string, string[]>(entrants.map((e) => [e.id, []]));
  for (const m of matches) {
    if (m.b === null) {
      points.set(m.a, points.get(m.a)! + 1);
      continue;
    }
    if (m.result === null) continue;
    const [pa, pb] =
      m.result === "a" ? [1, 0] : m.result === "b" ? [0, 1] : [0.5, 0.5];
    points.set(m.a, points.get(m.a)! + pa);
    points.set(m.b, points.get(m.b)! + pb);
    opponents.get(m.a)!.push(m.b);
    opponents.get(m.b)!.push(m.a);
  }
  const buchholz = (id: string) =>
    opponents.get(id)!.reduce((sum, o) => sum + points.get(o)!, 0);
  return [...entrants]
    .sort(
      (x, y) =>
        points.get(y.id)! - points.get(x.id)! ||
        buchholz(y.id) - buchholz(x.id) ||
        x.seedPosition - y.seedPosition,
    )
    .map((e) => e.id);
}

/**
 * Plays a Swiss League of `n` over `rounds` rounds with random results and
 * random Seed Positions from `seed`, checking each round as it's paired.
 */
function playSwiss(n: number, rounds: number, seed: number) {
  const rng = seededRng(seed);
  const ids = Array.from({ length: n }, (_, i) => `e${i + 1}`);
  const entrants = shuffleSeedPositions(ids, rng).map(
    ({ entrantId, seedPosition }) => ({ id: entrantId, seedPosition }),
  );
  const matches: LeagueMatchFacts[] = [];
  const steps: number[] = [];
  for (let round = 1; round <= rounds; round++) {
    const ranking = oracleRanking(entrants, matches);
    const hadBye = new Set(matches.filter((m) => !m.b).map((m) => m.a));
    const paired = swissRound({ entrants, matches });
    if (!paired.ok) throw new Error(`seed ${seed} round ${round}: refused`);
    steps.push(paired.steps);

    // Every Entrant exactly once.
    const seen = paired.matches.flatMap((m) => (m.b ? [m.a, m.b] : [m.a]));
    expect(seen.sort()).toEqual([...ids].sort());

    // The bye: one with an odd count, to the lowest-ranked without one.
    const byes = paired.matches.filter((m) => m.b === null);
    if (n % 2 === 1) {
      expect(byes).toHaveLength(1);
      const due = ranking.filter((id) => !hadBye.has(id)).at(-1);
      expect(byes[0].a, `seed ${seed} round ${round}`).toBe(due);
    } else {
      expect(byes).toHaveLength(0);
    }

    for (const m of paired.matches) {
      const result: LeagueResult | null = m.b
        ? (["a", "b", "draw"] as const)[Math.floor(rng() * 3)]
        : null;
      matches.push({ round, a: m.a, b: m.b, result });
    }
  }
  return { matches, steps };
}

describe("swissRound: a Swiss League of 9 over 4 rounds", () => {
  const check = (seed: number) => {
    const { matches } = playSwiss(9, 4, seed);
    // No rematch.
    const pairs = matches.flatMap((m) => (m.b ? [pairKey(m.a, m.b)] : []));
    expect(new Set(pairs).size, `seed ${seed}`).toBe(pairs.length);
    // A bye each round, never twice to the same Entrant.
    const byes = matches.filter((m) => m.b === null).map((m) => m.a);
    expect(byes).toHaveLength(4);
    expect(new Set(byes).size, `seed ${seed}`).toBe(4);
  };

  it("holds every rule on a fixed run", () => {
    check(20261004);
  });

  it("holds every rule over 200 seeded runs", () => {
    for (let seed = 1; seed <= 200; seed++) check(seed);
  });
});

describe("swissRound: 64 Entrants over 6 rounds", () => {
  // A search-step budget, counted rather than timed: a round that needs
  // more than this many tries has stopped pairing by score groups.
  const STEP_BUDGET = 500;

  it("pairs every round within the step budget, with no rematch", () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const { matches, steps } = playSwiss(64, 6, seed);
      expect(steps).toHaveLength(6);
      for (const s of steps) expect(s).toBeLessThanOrEqual(STEP_BUDGET);
      const pairs = matches.map((m) => pairKey(m.a, m.b!));
      expect(new Set(pairs).size).toBe(64 * 3);
    }
  });
});

describe("swap", () => {
  const round = [
    { a: "A", b: "B" },
    { a: "C", b: "D" },
    { a: "E", b: null },
  ];

  it("exchanges two Entrants of a round, keeping each Match's place", () => {
    expect(swap(round, "B", "C")).toEqual([
      { a: "A", b: "C" },
      { a: "B", b: "D" },
      { a: "E", b: null },
    ]);
  });

  it("can move an Entrant onto the bye", () => {
    expect(swap(round, "E", "A")).toEqual([
      { a: "E", b: "B" },
      { a: "C", b: "D" },
      { a: "A", b: null },
    ]);
  });
});

describe("rematches and neverMet", () => {
  const matches = [
    { a: "A", b: "B" },
    { a: "C", b: "D" },
    { a: "B", b: "A" },
    { a: "E", b: null },
    { a: "C", b: "E" },
  ];

  it("names each pair that meets more than once", () => {
    expect(rematches(matches)).toEqual([{ a: "A", b: "B" }]);
  });

  it("names each pair of Entrants that never meets", () => {
    expect(neverMet(["A", "B", "C", "D"], matches)).toEqual([
      { a: "A", b: "C" },
      { a: "A", b: "D" },
      { a: "B", b: "C" },
      { a: "B", b: "D" },
    ]);
  });
});

describe("swapWarnings: the Edit pairings dialog's warning (R7, Q4)", () => {
  const rounds = [
    {
      round: 1,
      matches: [
        { a: "A", b: "B" },
        { a: "C", b: "D" },
      ],
    },
    {
      round: 2,
      matches: [
        { a: "A", b: "C" },
        { a: "B", b: "D" },
      ],
    },
    {
      round: 3,
      matches: [
        { a: "A", b: "D" },
        { a: "B", b: "C" },
      ],
    },
  ];

  it("names the pairs a round-robin swap repeats and the pairs that then never meet", () => {
    // Round 1 becomes A–C, B–D: both already meet in round 2.
    expect(
      swapWarnings({
        entrantIds: ["A", "B", "C", "D"],
        rounds,
        round: 1,
        x: "B",
        y: "C",
        roundRobin: true,
      }),
    ).toEqual({
      repeats: [
        { a: "A", b: "C" },
        { a: "B", b: "D" },
      ],
      neverMeet: [
        { a: "A", b: "B" },
        { a: "C", b: "D" },
      ],
    });
  });

  it("names nothing for a swap that repeats no one, and no never-meet pairs in a Swiss League", () => {
    expect(
      swapWarnings({
        entrantIds: ["A", "B", "C", "D"],
        rounds: [rounds[0]],
        round: 1,
        x: "B",
        y: "C",
        roundRobin: false,
      }),
    ).toEqual({ repeats: [], neverMeet: [] });
  });
});
