import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import type { Bracket, Match } from "@/lib/bracket/types";
import {
  type CompetitionStatusFacts,
  bracketRoundInPlay,
  competitionStatus,
  competitionStatusText,
  leagueRoundInPlay,
} from "@/lib/competition-status";

/** A Competition with nothing entered yet; each case overrides a fact. */
function facts(
  overrides: Partial<CompetitionStatusFacts>,
): CompetitionStatusFacts {
  return {
    format: "placement",
    scoring: "team",
    closed: false,
    hasResult: false,
    bracketRound: null,
    winners: [],
    ...overrides,
  };
}

const text = (overrides: Partial<CompetitionStatusFacts>) =>
  competitionStatusText(competitionStatus(facts(overrides)));

describe("competitionStatus", () => {
  it.each([
    "placement",
    "bracket",
    "head-to-head",
    "best-score",
    "participation",
  ] as const)("a %s Competition with no result is Not started", (format) => {
    expect(competitionStatus(facts({ format }))).toEqual({
      kind: "not-started",
      label: "Not started",
      detail: null,
    });
  });

  it.each([
    "placement",
    "head-to-head",
    "best-score",
    "participation",
  ] as const)("a %s Competition with a result is Underway", (format) => {
    expect(text({ format, hasResult: true })).toBe("Underway");
  });

  it("a Bracket in its second of four Rounds is Underway · Round 2 of 4", () => {
    expect(
      competitionStatus(
        facts({
          format: "bracket",
          hasResult: true,
          bracketRound: { round: 2, of: 4 },
        }),
      ),
    ).toEqual({ kind: "underway", label: "Underway", detail: "Round 2 of 4" });
  });

  it("a Bracket whose final is in play is Underway · Final", () => {
    expect(
      text({
        format: "bracket",
        hasResult: true,
        bracketRound: { round: 4, of: 4 },
      }),
    ).toBe("Underway · Final");
  });

  it("a Bracket with Entrants but no Matches yet is Underway, with no Round", () => {
    expect(text({ format: "bracket", hasResult: true })).toBe("Underway");
  });

  it.each(["placement", "bracket"] as const)(
    "a Closed %s with a 1st place is Done · Winner",
    (format) => {
      expect(
        competitionStatus(
          facts({
            format,
            hasResult: true,
            closed: true,
            winners: ["Red Pill"],
          }),
        ),
      ).toEqual({ kind: "done", label: "Done", detail: "Winner: Red Pill" });
    },
  );

  it.each(["head-to-head", "best-score"] as const)(
    "a Closed %s Competition with a 1st place is Done · Winner",
    (format) => {
      expect(
        text({ format, hasResult: true, closed: true, winners: ["Zion"] }),
      ).toBe("Done · Winner: Zion");
    },
  );

  it("a closed team Participation Competition names its top Team", () => {
    expect(
      text({
        format: "participation",
        scoring: "team",
        hasResult: true,
        closed: true,
        winners: ["Nebuchadnezzar"],
      }),
    ).toBe("Done · Winner: Nebuchadnezzar");
  });

  it("a tie for 1st lists every winner", () => {
    expect(
      text({
        format: "placement",
        hasResult: true,
        closed: true,
        winners: ["Morpheus", "Trinity"],
      }),
    ).toBe("Done · Winners: Morpheus, Trinity");
  });

  it("a closed individual Participation Competition has no winner: Closed", () => {
    expect(
      competitionStatus(
        facts({
          format: "participation",
          scoring: "individual",
          hasResult: true,
          closed: true,
          // Even were a winner passed, individual Participation names none.
          winners: ["Neo"],
        }),
      ),
    ).toEqual({ kind: "closed", label: "Closed", detail: null });
  });

  it.each(["head-to-head", "best-score"] as const)(
    "a Closed %s Competition without a 1st place is Closed",
    (format) => {
      expect(text({ format, hasResult: true, closed: true })).toBe("Closed");
    },
  );

  it("a Closed Placement without Placement Points is Done, naming no one", () => {
    expect(text({ format: "placement", hasResult: true, closed: true })).toBe(
      "Done",
    );
  });
});

/** A Match of a head-to-head Bracket: two Entrants unless `bye`. */
function match(
  round: number,
  position: number,
  status: Match["status"],
  { bye = false, thirdPlace = false } = {},
): Match {
  return {
    id: `r${round}p${position}${thirdPlace ? "-3rd" : ""}`,
    round,
    position,
    slots: [
      { entrantId: "a", place: null, score: null },
      { entrantId: bye ? null : "b", place: null, score: null },
    ],
    winnerTo: null,
    loserTo: null,
    thirdPlace,
    status,
    recordedAt: null,
  };
}

const bracket = (matches: Match[]): Bracket => ({
  config: DEFAULT_BRACKET_CONFIG,
  matches,
});

describe("bracketRoundInPlay", () => {
  it("is null before Generate", () => {
    expect(bracketRoundInPlay(bracket([]))).toBeNull();
  });

  it("is Round 1 while a first-Round Match is unplayed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          match(1, 1, "played"),
          match(1, 2, "ready"),
          match(2, 1, "pending"),
        ]),
      ),
    ).toEqual({ round: 1, of: 2 });
  });

  it("is the first Round with an unplayed Match, a bye never counting", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          match(1, 1, "played"),
          match(1, 2, "pending", { bye: true }),
          match(2, 1, "ready"),
          match(2, 2, "pending"),
          match(3, 1, "pending"),
          match(4, 1, "pending"),
        ]),
      ),
    ).toEqual({ round: 2, of: 4 });
  });

  it("is the final's Round while only the 3rd place Match is left", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          match(1, 1, "played"),
          match(1, 2, "played"),
          match(2, 1, "played"),
          match(2, 2, "ready", { thirdPlace: true }),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the first Round with a Match to play in a Matches Bracket, a bye never counting", () => {
    // 4 per Match, 2 advancing: a Match before the final with 2 Entrants is a bye.
    expect(
      bracketRoundInPlay({
        config: {
          kind: "group" as const,
          entrantsPerMatch: 4,
          advancePerMatch: 2,
          thirdPlaceMatch: false,
          rounds: {},
        },
        matches: [
          match(1, 1, "played"),
          match(1, 2, "pending", { bye: true }),
          match(2, 1, "pending"),
        ],
      }),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the final's Round while the final and the 3rd place Match are both unplayed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          match(1, 1, "played"),
          match(1, 2, "played"),
          match(2, 1, "ready"),
          match(2, 2, "ready", { thirdPlace: true }),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the final's Round once every Match is played but not Closed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          match(1, 1, "played"),
          match(1, 2, "played"),
          match(2, 1, "played"),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });
});

describe("a League's status", () => {
  it("is Not started with no Entrant, Underway · Round 2 of 3 mid-League, and Done once Closed", () => {
    expect(text({ format: "league" })).toBe("Not started");
    expect(
      text({
        format: "league",
        hasResult: true,
        leagueRound: { round: 2, of: 3 },
      }),
    ).toBe("Underway · Round 2 of 3");
    // A League has no final: its last round is still "Round m of m".
    expect(
      text({
        format: "league",
        hasResult: true,
        leagueRound: { round: 3, of: 3 },
      }),
    ).toBe("Underway · Round 3 of 3");
    expect(text({ format: "league", closed: true, hasResult: true })).toBe(
      "Done",
    );
    expect(
      text({
        format: "league",
        closed: true,
        hasResult: true,
        winners: ["Ada"],
      }),
    ).toBe("Done · Winner: Ada");
  });
});

describe("leagueRoundInPlay", () => {
  const swiss3 = { pairing: "swiss", rounds: 3 } as const;
  const m = (
    round: number,
    b: string | null,
    result: "a" | "b" | "draw" | null,
  ) => ({ round, b, result });

  it("is null before round 1 is paired", () => {
    expect(leagueRoundInPlay(swiss3, 6, [])).toBeNull();
  });

  it("is the first round with a Match to play, a bye never being one", () => {
    expect(
      leagueRoundInPlay(swiss3, 5, [
        m(1, "x", "a"),
        m(1, "y", null),
        m(1, null, null),
      ]),
    ).toEqual({ round: 1, of: 3 });
  });

  it("is the next round to pair once every paired round is played", () => {
    expect(
      leagueRoundInPlay(swiss3, 6, [m(1, "x", "a"), m(1, "y", "draw")]),
    ).toEqual({ round: 2, of: 3 });
  });

  it("is the last round once every round is played", () => {
    const rr = { pairing: "round-robin", rounds: null } as const;
    // A round robin of 4 plays 3 rounds.
    expect(
      leagueRoundInPlay(rr, 4, [
        m(1, "x", "a"),
        m(2, "x", "b"),
        m(3, "x", "a"),
      ]),
    ).toEqual({ round: 3, of: 3 });
  });
});
