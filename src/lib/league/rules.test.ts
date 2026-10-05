import { describe, expect, it } from "vitest";

import type { LeagueResult } from "@/lib/enums";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import {
  type LeagueRecordFacet,
  clearPairingsError,
  leagueRecordError,
  pairError,
  pairNextError,
  swapError,
  unplayedSummary,
} from "@/lib/league/rules";

const m = (
  round: number,
  a: string,
  b: string | null,
  result: LeagueResult | null = null,
): LeagueMatchFacts => ({ round, a, b, result });

const ada = { teamId: "red", participantId: "ada" };
const bo = { teamId: "blue", participantId: "bo" };

const facet = (over: Partial<LeagueRecordFacet> = {}): LeagueRecordFacet => ({
  runs: false,
  closed: false,
  selfReport: true,
  linked: { participantId: "ada", teamId: "red" },
  scoring: "individual",
  match: { a: ada, b: bo },
  ...over,
});

describe("leagueRecordError: who records a Match", () => {
  it("lets an Organizer or Host record any Match, self-report or not", () => {
    expect(
      leagueRecordError(facet({ runs: true, selfReport: false, linked: null })),
    ).toBeNull();
  });

  it("lets either player record their own Match with self-report on", () => {
    expect(leagueRecordError(facet())).toBeNull();
    expect(
      leagueRecordError(
        facet({ linked: { participantId: "bo", teamId: null } }),
      ),
    ).toBeNull();
  });

  it("lets anyone on a player's Team record it in team scoring", () => {
    expect(
      leagueRecordError(
        facet({
          scoring: "team",
          linked: { participantId: "cy", teamId: "blue" },
          match: {
            a: { teamId: "red", participantId: null },
            b: { teamId: "blue", participantId: null },
          },
        }),
      ),
    ).toBeNull();
  });

  it("refuses a non-player", () => {
    expect(
      leagueRecordError(
        facet({ linked: { participantId: "cy", teamId: "red" } }),
      ),
    ).toBe("You're not a player in this Match.");
  });

  it("refuses everyone but Organizers and Hosts with self-report off", () => {
    expect(leagueRecordError(facet({ selfReport: false }))).toBe(
      "Self-report is off for this Competition.",
    );
  });

  it("refuses a sign-in with no Participant", () => {
    expect(leagueRecordError(facet({ linked: null }))).toBe(
      "Your sign-in doesn't match a Participant of this War Week.",
    );
  });

  it("refuses everyone once Closed, a missing Match and a bye", () => {
    expect(leagueRecordError(facet({ runs: true, closed: true }))).toBe(
      "This Competition is closed.",
    );
    expect(leagueRecordError(facet({ runs: true, match: null }))).toBe(
      "That Match no longer exists.",
    );
    expect(
      leagueRecordError(facet({ runs: true, match: { a: ada, b: null } })),
    ).toBe("A bye has no result.");
  });
});

const swiss = { pairing: "swiss", rounds: 3 } as const;
const roundRobin = { pairing: "round-robin", rounds: null } as const;

describe("pairError: Pair rounds / Pair round 1", () => {
  it("pairs an open League of 2 or more with no pairings yet", () => {
    expect(
      pairError({ closed: false, config: swiss, entrantCount: 6, matches: [] }),
    ).toBeNull();
  });

  it("refuses fewer than 2 Entrants, existing pairings, too many rounds and a Closed League", () => {
    expect(
      pairError({ closed: false, config: swiss, entrantCount: 1, matches: [] }),
    ).toBe("Add at least 2 Entrants before pairing.");
    expect(
      pairError({
        closed: false,
        config: roundRobin,
        entrantCount: 2,
        matches: [m(1, "A", "B")],
      }),
    ).toBe("The League is already paired.");
    expect(
      pairError({
        closed: false,
        config: { pairing: "swiss", rounds: 4 },
        entrantCount: 4,
        matches: [],
      }),
    ).toBe("A Swiss League of 4 Entrants plays 1 to 3 rounds.");
    expect(
      pairError({ closed: true, config: swiss, entrantCount: 6, matches: [] }),
    ).toBe("This Competition is closed.");
  });
});

describe("pairNextError: Pair next round", () => {
  const round1 = [m(1, "A", "B", "a"), m(1, "C", "D", "draw"), m(1, "E", null)];

  it("pairs once every Match of the latest round has a result, ignoring its bye", () => {
    expect(
      pairNextError({
        closed: false,
        config: swiss,
        entrantCount: 5,
        matches: round1,
      }),
    ).toBeNull();
  });

  it("waits for the latest round's results", () => {
    expect(
      pairNextError({
        closed: false,
        config: swiss,
        entrantCount: 5,
        matches: [...round1.slice(0, 1), m(1, "C", "D"), round1[2]],
      }),
    ).toBe("Every Match of round 1 needs a result first.");
  });

  it("stops at the League's rounds", () => {
    expect(
      pairNextError({
        closed: false,
        config: { pairing: "swiss", rounds: 1 },
        entrantCount: 5,
        matches: round1,
      }),
    ).toBe("Every round is paired.");
  });

  it("refuses before round 1, on a round robin, and once Closed", () => {
    expect(
      pairNextError({
        closed: false,
        config: swiss,
        entrantCount: 5,
        matches: [],
      }),
    ).toBe("Pair round 1 first.");
    expect(
      pairNextError({
        closed: false,
        config: roundRobin,
        entrantCount: 5,
        matches: round1,
      }),
    ).toBe("A round robin pairs every round at once.");
    expect(
      pairNextError({
        closed: true,
        config: swiss,
        entrantCount: 5,
        matches: round1,
      }),
    ).toBe("This Competition is closed.");
  });
});

describe("swapError: Edit pairings", () => {
  const round = [m(2, "A", "B"), m(2, "C", "D"), m(2, "E", null)];

  it("swaps two Entrants of a round before it has a result, the bye included", () => {
    for (const [x, y] of [
      ["B", "C"],
      ["E", "A"],
    ]) {
      expect(
        swapError({ closed: false, pairing: "swiss", round, x, y }),
      ).toBeNull();
    }
  });

  it("refuses Entrants outside the round, the same one twice, and two already paired", () => {
    expect(
      swapError({ closed: false, pairing: "swiss", round, x: "A", y: "Z" }),
    ).toBe("Choose two Entrants of this round.");
    expect(
      swapError({ closed: false, pairing: "swiss", round, x: "A", y: "A" }),
    ).toBe("Choose two Entrants of this round.");
    expect(
      swapError({ closed: false, pairing: "swiss", round, x: "A", y: "B" }),
    ).toBe("Those two already play each other.");
  });

  it("refuses any swap in a Swiss round once a Match of it has a result", () => {
    const played = [m(2, "A", "B", "a"), m(2, "C", "D"), m(2, "E", null)];
    expect(
      swapError({
        closed: false,
        pairing: "swiss",
        round: played,
        x: "C",
        y: "E",
      }),
    ).toBe("A Match in this round has a result.");
  });

  it("in a round robin, refuses only a swap touching a Match with a result", () => {
    const played = [m(2, "A", "B", "a"), m(2, "C", "D"), m(2, "E", null)];
    expect(
      swapError({
        closed: false,
        pairing: "round-robin",
        round: played,
        x: "C",
        y: "E",
      }),
    ).toBeNull();
    expect(
      swapError({
        closed: false,
        pairing: "round-robin",
        round: played,
        x: "B",
        y: "C",
      }),
    ).toBe("A Match being swapped has a result.");
  });

  it("refuses once Closed", () => {
    expect(
      swapError({ closed: true, pairing: "swiss", round, x: "B", y: "C" }),
    ).toBe("This Competition is closed.");
  });
});

describe("clearPairingsError: Clear pairings", () => {
  it("clears pairings while no Match has a result", () => {
    expect(
      clearPairingsError({ closed: false, matches: [m(1, "A", "B")] }),
    ).toBeNull();
  });

  it("refuses with no pairings, with a result, and once Closed", () => {
    expect(clearPairingsError({ closed: false, matches: [] })).toBe(
      "There are no pairings to clear.",
    );
    expect(
      clearPairingsError({ closed: false, matches: [m(1, "A", "B", "draw")] }),
    ).toBe("A Match has a result: clear its result first.");
    expect(
      clearPairingsError({ closed: true, matches: [m(1, "A", "B")] }),
    ).toBe("This Competition is closed.");
  });
});

describe("unplayedSummary: Close waits for a finished League", () => {
  const names: Record<string, string> = {
    A: "Ada",
    B: "Bo",
    C: "Cy",
    D: "Di",
    E: "Ed",
  };
  const nameOf = (id: string) => names[id];

  it("is nothing once every round is paired and every Match but the byes has a result", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 1 },
        entrantCount: 5,
        matches: [m(1, "A", "B", "a"), m(1, "C", "D", "b"), m(1, "E", null)],
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBeNull();
  });

  it("names each unplayed Match by round", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 2 },
        entrantCount: 4,
        matches: [
          m(1, "A", "B", "a"),
          m(1, "C", "D", "b"),
          m(2, "A", "D"),
          m(2, "B", "C"),
        ],
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe(
      "Finish every Match before closing. Unplayed: Round 2: Ada v Di; Round 2: Bo v Cy.",
    );
  });

  it("names the Swiss rounds not yet paired", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 3 },
        entrantCount: 4,
        matches: [m(1, "A", "B", "a"), m(1, "C", "D")],
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe(
      "Finish every Match before closing. Unplayed: Round 1: Cy v Di. Not yet paired: rounds 2, 3.",
    );
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 2 },
        entrantCount: 4,
        matches: [m(1, "A", "B", "a"), m(1, "C", "D", "a")],
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe("Finish every Match before closing. Not yet paired: round 2.");
  });

  it("counts an unpaired round robin as every round unpaired", () => {
    expect(
      unplayedSummary({
        config: roundRobin,
        entrantCount: 3,
        matches: [],
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe(
      "Finish every Match before closing. Not yet paired: rounds 1, 2, 3.",
    );
  });

  it("refuses a League of fewer than 2 Entrants with pairing's own words", () => {
    for (const entrantCount of [0, 1]) {
      expect(
        unplayedSummary({
          config: swiss,
          entrantCount,
          matches: [],
          nameOf,
          nextRoundPairable: true,
        }),
      ).toBe("Add at least 2 Entrants before pairing.");
    }
  });

  // 6 Entrants whose first three rounds played every pair across {1,2,3}
  // and {4,5,6}: two triangles are left, and a triangle can't pair.
  const deadEnd = [
    m(1, "A", "D", "a"),
    m(1, "B", "E", "b"),
    m(1, "C", "F", "draw"),
    m(2, "A", "E", "a"),
    m(2, "B", "F", "b"),
    m(2, "C", "D", "draw"),
    m(3, "A", "F", "a"),
    m(3, "B", "D", "b"),
    m(3, "C", "E", "draw"),
  ];

  it("is nothing for a Swiss League of 5 rounds at a dead end after round 3", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 5 },
        entrantCount: 6,
        matches: deadEnd,
        nameOf,
        nextRoundPairable: false,
      }),
    ).toBeNull();
  });

  it("still names the rounds left while the next round can pair", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 5 },
        entrantCount: 6,
        matches: deadEnd,
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe("Finish every Match before closing. Not yet paired: rounds 4, 5.");
  });

  it("refuses a Swiss League whose saved rounds are out of range with the rounds rule, not a list", () => {
    expect(
      unplayedSummary({
        config: { pairing: "swiss", rounds: 1e9 },
        entrantCount: 6,
        matches: deadEnd,
        nameOf,
        nextRoundPairable: true,
      }),
    ).toBe("A Swiss League of 6 Entrants plays 1 to 5 rounds.");
  });
});
