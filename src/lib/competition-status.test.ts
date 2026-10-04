import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import type { Bracket, Match } from "@/lib/bracket/types";
import {
  type CompetitionStatusFacts,
  bracketRoundInPlay,
  competitionStatus,
  competitionStatusText,
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
