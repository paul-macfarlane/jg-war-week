import { describe, expect, it } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import type { Bracket, Heat } from "@/lib/bracket/types";
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
    finalized: false,
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
            finalized: true,
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
        text({ format, hasResult: true, finalized: true, winners: ["Zion"] }),
      ).toBe("Done · Winner: Zion");
    },
  );

  it("a closed team Participation Competition names its top Team", () => {
    expect(
      text({
        format: "participation",
        scoring: "team",
        hasResult: true,
        finalized: true,
        winners: ["Nebuchadnezzar"],
      }),
    ).toBe("Done · Winner: Nebuchadnezzar");
  });

  it("a tie for 1st lists every winner", () => {
    expect(
      text({
        format: "placement",
        hasResult: true,
        finalized: true,
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
          finalized: true,
          // Even were a winner passed, individual Participation names none.
          winners: ["Neo"],
        }),
      ),
    ).toEqual({ kind: "closed", label: "Closed", detail: null });
  });

  it.each(["head-to-head", "best-score"] as const)(
    "a Closed %s Competition without a 1st place is Closed",
    (format) => {
      expect(text({ format, hasResult: true, finalized: true })).toBe("Closed");
    },
  );

  it("a Closed Placement without Placement Points is Done, naming no one", () => {
    expect(
      text({ format: "placement", hasResult: true, finalized: true }),
    ).toBe("Done");
  });
});

/** A Heat of a head-to-head Bracket: two Entrants unless `bye`. */
function heat(
  round: number,
  position: number,
  status: Heat["status"],
  { bye = false, thirdPlace = false } = {},
): Heat {
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

const bracket = (heats: Heat[]): Bracket => ({
  config: DEFAULT_BRACKET_CONFIG,
  heats,
});

describe("bracketRoundInPlay", () => {
  it("is null before Generate", () => {
    expect(bracketRoundInPlay(bracket([]))).toBeNull();
  });

  it("is Round 1 while a first-Round Match is unplayed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          heat(1, 1, "played"),
          heat(1, 2, "ready"),
          heat(2, 1, "pending"),
        ]),
      ),
    ).toEqual({ round: 1, of: 2 });
  });

  it("is the first Round with an unplayed Match, a bye never counting", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          heat(1, 1, "played"),
          heat(1, 2, "pending", { bye: true }),
          heat(2, 1, "ready"),
          heat(2, 2, "pending"),
          heat(3, 1, "pending"),
          heat(4, 1, "pending"),
        ]),
      ),
    ).toEqual({ round: 2, of: 4 });
  });

  it("is the final's Round while only the 3rd place Match is left", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          heat(1, 1, "played"),
          heat(1, 2, "played"),
          heat(2, 1, "played"),
          heat(2, 2, "ready", { thirdPlace: true }),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the first Round with a Match to play in a Matches Bracket, a bye never counting", () => {
    // 4 per Heat, 2 advancing: a Heat before the final with 2 Entrants is a bye.
    expect(
      bracketRoundInPlay({
        config: {
          entrantsPerHeat: 4,
          advancePerHeat: 2,
          thirdPlaceGame: false,
        },
        heats: [
          heat(1, 1, "played"),
          heat(1, 2, "pending", { bye: true }),
          heat(2, 1, "pending"),
        ],
      }),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the final's Round while the final and the 3rd place Match are both unplayed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          heat(1, 1, "played"),
          heat(1, 2, "played"),
          heat(2, 1, "ready"),
          heat(2, 2, "ready", { thirdPlace: true }),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });

  it("is the final's Round once every Match is played but not Closed", () => {
    expect(
      bracketRoundInPlay(
        bracket([
          heat(1, 1, "played"),
          heat(1, 2, "played"),
          heat(2, 1, "played"),
        ]),
      ),
    ).toEqual({ round: 2, of: 2 });
  });
});
