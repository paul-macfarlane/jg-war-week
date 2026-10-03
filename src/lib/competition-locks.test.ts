import { describe, expect, it } from "vitest";

import {
  APPLIES_AT_NEXT_FINALIZE,
  COMPETITION_SETTING_FIELDS,
  type CompetitionLockFacts,
  type CompetitionSettingField,
  LOCKED_BY_HEAT_RESULT,
  LOCKED_BY_RESULT,
  LOCKED_WHILE_FINALIZED,
  hasResult,
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
  hasResult: false,
  hasHeatResult: false,
  finalized: false,
};
const started: CompetitionLockFacts = { ...fresh, hasResult: true };
const heatPlayed: CompetitionLockFacts = {
  ...started,
  hasHeatResult: true,
};
const finalized: CompetitionLockFacts = {
  hasResult: true,
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
    "gameConfig",
    "entrantsOpen",
  ])("locks %s once any result exists", (field) => {
    expect(settingLockReason(field, fresh)).toBeNull();
    expect(settingLockReason(field, started)).toBe(
      "Locked once the Competition has a result.",
    );
    expect(settingLockReason(field, started)).toBe(LOCKED_BY_RESULT);
  });

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
      "Locked while the Competition is Finalized or Closed. Reopen it first.",
    );
    expect(settingLockReason(field, finalized)).toBe(LOCKED_WHILE_FINALIZED);
  });

  it("locks every field but the never-locked ones while Finalized, even with no result", () => {
    const bare = { ...fresh, finalized: true };
    for (const field of COMPETITION_SETTING_FIELDS) {
      expect(settingLockReason(field, bare), field).toBe(
        neverLocked.includes(field) ? null : LOCKED_WHILE_FINALIZED,
      );
    }
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
