import { describe, expect, it } from "vitest";

import {
  APPLIES_AT_NEXT_FINALIZE,
  COMPETITION_SETTING_FIELDS,
  type CompetitionLockFacts,
  type CompetitionSettingField,
  LOCKED_BY_GAME,
  LOCKED_BY_HEAT_RESULT,
  LOCKED_BY_RESULT,
  LOCKED_WHILE_FINALIZED,
  hasResult,
  lockFactsOf,
  settingLockReason,
  settingNote,
} from "@/lib/competition-locks";

const NONE = {
  entrants: 0,
  games: 0,
  placements: 0,
  checkIns: 0,
  heats: 0,
  heatResult: false,
  generatedPointsEntries: 0,
};

const fresh: CompetitionLockFacts = {
  format: "placement",
  hasResult: false,
  hasGame: false,
  hasHeatResult: false,
  finalized: false,
};
const started: CompetitionLockFacts = { ...fresh, hasResult: true };
const heatPlayed: CompetitionLockFacts = {
  ...started,
  format: "bracket",
  hasHeatResult: true,
};
const finalized: CompetitionLockFacts = {
  ...fresh,
  hasResult: true,
  hasGame: true,
  hasHeatResult: true,
  finalized: true,
};

describe("a result", () => {
  it("is none when nothing has been entered", () => {
    expect(hasResult(NONE)).toBe(false);
  });

  it.each([
    ["an Entrant", { entrants: 1 }],
    ["a Game", { games: 1 }],
    ["a Placement", { placements: 1 }],
    ["a check-in", { checkIns: 1 }],
    ["a Heat", { heats: 1 }],
    ["a Heat Result", { heatResult: true }],
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

  it.each(neverLocked)("never locks %s, not even while Finalized", (field) => {
    expect(settingLockReason(field, fresh)).toBeNull();
    expect(settingLockReason(field, heatPlayed)).toBeNull();
    expect(settingLockReason(field, finalized)).toBeNull();
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

  it("locks a Best score Competition's direction and attempts once any result exists, an Entrant included", () => {
    const bestScore = { ...fresh, format: "best-score" } as const;
    expect(settingLockReason("gameConfig", bestScore)).toBeNull();
    expect(
      settingLockReason("gameConfig", { ...bestScore, hasResult: true }),
    ).toBe(LOCKED_BY_RESULT);
  });

  it("locks a Head-to-head Competition's draws and Best of once it has a Game, not before", () => {
    const headToHead = { ...fresh, format: "head-to-head" } as const;
    // Its Entrants are a result, but a Best of needs them first.
    const withEntrants = { ...headToHead, hasResult: true };
    expect(settingLockReason("gameConfig", withEntrants)).toBeNull();
    const played = { ...withEntrants, hasGame: true };
    expect(settingLockReason("gameConfig", played)).toBe(
      "Locked once the Competition has a Game.",
    );
    expect(settingLockReason("gameConfig", played)).toBe(LOCKED_BY_GAME);
  });

  it.each(["head-to-head", "best-score"] as const)(
    "locks a %s Competition's open or fixed Entrants once it has a Game, not before",
    (format) => {
      const withEntrants = { ...fresh, format, hasResult: true };
      expect(settingLockReason("entrantsOpen", withEntrants)).toBeNull();
      expect(
        settingLockReason("entrantsOpen", { ...withEntrants, hasGame: true }),
      ).toBe(LOCKED_BY_GAME);
    },
  );

  it.each<CompetitionSettingField>(["bracketConfig", "entrants", "bracket"])(
    "locks %s once a Heat Result exists, not before",
    (field) => {
      expect(settingLockReason(field, fresh)).toBeNull();
      expect(settingLockReason(field, started)).toBeNull();
      expect(settingLockReason(field, heatPlayed)).toBe(
        "Locked once a Heat has a result.",
      );
      expect(settingLockReason(field, heatPlayed)).toBe(LOCKED_BY_HEAT_RESULT);
    },
  );

  it.each<CompetitionSettingField>([
    "selfEnroll",
    "entrantLimit",
    "enrollClosesAt",
    "loggingClosesAt",
    "selfReport",
    "selfCheckIn",
    "checkInClosesAt",
  ])("locks %s only while Finalized or Closed", (field) => {
    expect(settingLockReason(field, heatPlayed)).toBeNull();
    expect(settingLockReason(field, finalized)).toBe(
      "Locked while the Competition is Finalized or Closed. Reopen or Un-finalize it first.",
    );
    expect(settingLockReason(field, finalized)).toBe(LOCKED_WHILE_FINALIZED);
  });

  it.each(["placement", "bracket", "head-to-head", "best-score"] as const)(
    "locks every field but the never-locked ones while a %s Competition is Finalized or Closed, even with no result",
    (format) => {
      const bare = { ...fresh, format, finalized: true };
      for (const field of COMPETITION_SETTING_FIELDS) {
        expect(settingLockReason(field, bare), field).toBe(
          neverLocked.includes(field) ? null : LOCKED_WHILE_FINALIZED,
        );
      }
    },
  );
});

describe("lockFactsOf", () => {
  it("reads a Game, any result, a Heat Result and Finalized from what was entered", () => {
    expect(
      lockFactsOf(
        { ...NONE, entrants: 2 },
        { format: "head-to-head", finalizedAt: null },
      ),
    ).toEqual({
      format: "head-to-head",
      hasResult: true,
      hasGame: false,
      hasHeatResult: false,
      finalized: false,
    });
    expect(
      lockFactsOf(
        { ...NONE, games: 1 },
        { format: "best-score", finalizedAt: new Date("2027-02-26T17:00:00Z") },
      ),
    ).toEqual({
      format: "best-score",
      hasResult: true,
      hasGame: true,
      hasHeatResult: false,
      finalized: true,
    });
  });
});

describe("settingNote", () => {
  it("says a Placement Points change while Finalized applies at the next Finalize or Close", () => {
    expect(settingNote("placementPoints", finalized)).toBe(
      "Applies at the next Finalize or Close.",
    );
    expect(settingNote("placementPoints", finalized)).toBe(
      APPLIES_AT_NEXT_FINALIZE,
    );
    expect(settingNote("participationPoints", finalized)).toBe(
      APPLIES_AT_NEXT_FINALIZE,
    );
    expect(settingNote("placementPoints", heatPlayed)).toBeNull();
    expect(settingNote("name", finalized)).toBeNull();
  });
});
