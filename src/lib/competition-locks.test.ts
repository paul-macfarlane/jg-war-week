import { describe, expect, it } from "vitest";

import {
  APPLIES_AT_NEXT_CLOSE,
  COMPETITION_SETTING_FIELDS,
  type CompetitionLockFacts,
  type CompetitionSettingField,
  LOCKED_BY_MATCH,
  LOCKED_BY_MATCH_RESULT,
  LOCKED_BY_RESULT,
  LOCKED_WHILE_CLOSED,
  hasResult,
  lockFactsOf,
  settingLockReason,
  settingNote,
} from "@/lib/competition-locks";

const NONE = {
  entrants: 0,
  logged: 0,
  placements: 0,
  checkIns: 0,
  matches: 0,
  matchResult: false,
  generatedPointsEntries: 0,
};

const fresh: CompetitionLockFacts = {
  format: "placement",
  hasResult: false,
  hasLogged: false,
  hasMatchResult: false,
  closed: false,
};
const started: CompetitionLockFacts = { ...fresh, hasResult: true };
const matchPlayed: CompetitionLockFacts = {
  ...started,
  format: "bracket",
  hasMatchResult: true,
};
const closed: CompetitionLockFacts = {
  ...fresh,
  hasResult: true,
  hasLogged: true,
  hasMatchResult: true,
  closed: true,
};

describe("a result", () => {
  it("is none when nothing has been entered", () => {
    expect(hasResult(NONE)).toBe(false);
  });

  it.each([
    ["an Entrant", { entrants: 1 }],
    ["a Match or Attempt", { logged: 1 }],
    ["a Placement", { placements: 1 }],
    ["a check-in", { checkIns: 1 }],
    ["a Match", { matches: 1 }],
    ["a Match Result", { matchResult: true }],
    ["a generated Points Entry", { generatedPointsEntries: 1 }],
  ])("is %s", (_name, some) => {
    expect(hasResult({ ...NONE, ...some })).toBe(true);
  });
});

describe("settingLockReason", () => {
  const neverLocked: CompetitionSettingField[] = [
    "name",
    "description",
    "group",
    "hosts",
    "placementPoints",
    // N, a Participation Competition's points per Participant: its
    // Placement Points.
    "participationPoints",
  ];

  it.each(neverLocked)("never locks %s, not even while Closed", (field) => {
    expect(settingLockReason(field, fresh)).toBeNull();
    expect(settingLockReason(field, matchPlayed)).toBeNull();
    expect(settingLockReason(field, closed)).toBeNull();
  });

  it.each<CompetitionSettingField>([
    "format",
    "scoring",
    "countsTowardTeam",
    "scoreDirection",
  ])("locks %s once any result exists", (field) => {
    expect(settingLockReason(field, fresh)).toBeNull();
    expect(settingLockReason(field, started)).toBe(
      "Locked once the Competition has a result.",
    );
    expect(settingLockReason(field, started)).toBe(LOCKED_BY_RESULT);
  });

  it("never locks the Score unit: it's a label", () => {
    expect(settingLockReason("scoreUnit", matchPlayed)).toBeNull();
    expect(settingLockReason("scoreUnit", closed)).toBeNull();
  });

  it("locks a Best score Competition's Team score once any result exists", () => {
    const bestScore = { ...fresh, format: "best-score" } as const;
    expect(settingLockReason("bestScoreConfig", bestScore)).toBeNull();
    expect(
      settingLockReason("bestScoreConfig", { ...bestScore, hasResult: true }),
    ).toBe(LOCKED_BY_RESULT);
  });

  it("locks a Head-to-head's draws and Best of once it has a Match, not before", () => {
    const headToHead = { ...fresh, format: "head-to-head" } as const;
    // Its two Entrants are a result, but they come first.
    const withEntrants = { ...headToHead, hasResult: true };
    expect(settingLockReason("seriesConfig", withEntrants)).toBeNull();
    const played = { ...withEntrants, hasLogged: true };
    expect(settingLockReason("seriesConfig", played)).toBe(
      "Locked once the Competition has a Match or Attempt.",
    );
    expect(settingLockReason("seriesConfig", played)).toBe(LOCKED_BY_MATCH);
  });

  it.each<CompetitionSettingField>(["bracketConfig", "entrants", "bracket"])(
    "locks %s once a Match Result exists, not before",
    (field) => {
      expect(settingLockReason(field, fresh)).toBeNull();
      expect(settingLockReason(field, started)).toBeNull();
      expect(settingLockReason(field, matchPlayed)).toBe(
        "Locked once a Match has a result.",
      );
      expect(settingLockReason(field, matchPlayed)).toBe(
        LOCKED_BY_MATCH_RESULT,
      );
    },
  );

  it.each<CompetitionSettingField>([
    "selfEnroll",
    "entrantLimit",
    "selfReport",
    "selfCheckIn",
  ])("locks %s only while Closed", (field) => {
    expect(settingLockReason(field, matchPlayed)).toBeNull();
    expect(settingLockReason(field, closed)).toBe(
      "Locked while the Competition is Closed. Reopen it first.",
    );
    expect(settingLockReason(field, closed)).toBe(LOCKED_WHILE_CLOSED);
  });

  it.each(["placement", "bracket", "head-to-head", "best-score"] as const)(
    "locks every field but the never-locked ones while a %s Competition is Closed, even with no result",
    (format) => {
      const bare = { ...fresh, format, closed: true };
      for (const field of COMPETITION_SETTING_FIELDS) {
        expect(settingLockReason(field, bare), field).toBe(
          neverLocked.includes(field) || field === "scoreUnit"
            ? null
            : LOCKED_WHILE_CLOSED,
        );
      }
    },
  );
});

describe("lockFactsOf", () => {
  it("reads a Match or Attempt, any result, a Match Result and Closed from what was entered", () => {
    expect(
      lockFactsOf(
        { ...NONE, entrants: 2 },
        { format: "head-to-head", closedAt: null },
      ),
    ).toEqual({
      format: "head-to-head",
      hasResult: true,
      hasLogged: false,
      hasMatchResult: false,
      closed: false,
    });
    expect(
      lockFactsOf(
        { ...NONE, logged: 1 },
        { format: "best-score", closedAt: new Date("2027-02-26T17:00:00Z") },
      ),
    ).toEqual({
      format: "best-score",
      hasResult: true,
      hasLogged: true,
      hasMatchResult: false,
      closed: true,
    });
  });
});

describe("settingNote", () => {
  it("says a Placement Points change while Closed applies at the next Close or Close", () => {
    expect(settingNote("placementPoints", closed)).toBe(
      "Applies at the next Close.",
    );
    expect(settingNote("placementPoints", closed)).toBe(APPLIES_AT_NEXT_CLOSE);
    expect(settingNote("participationPoints", closed)).toBe(
      APPLIES_AT_NEXT_CLOSE,
    );
    expect(settingNote("placementPoints", matchPlayed)).toBeNull();
    expect(settingNote("name", closed)).toBeNull();
  });
});
