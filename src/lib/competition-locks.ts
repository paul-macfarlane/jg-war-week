/**
 * Which of a Competition's settings lock, when, and the one-line reason
 * (ticket 101's lock table). The admin Competition page disables a locked
 * field with this reason, and the per-field save
 * (`saveCompetitionSetting`) refuses the same change with the same words,
 * so the two can't drift. Pure: the caller loads the facts.
 */
import type { Format } from "@/lib/bracket/types";

/** Every setting the admin Competition page saves on its own. */
export const COMPETITION_SETTING_FIELDS = [
  "name",
  "description",
  "group",
  "hosts",
  "placementPoints",
  /** N, an individual Participation Competition's points per Participant. */
  "participationPoints",
  "format",
  "scoring",
  "countsTowardTeam",
  /** A Placement Competition's Score direction. */
  "scoreDirection",
  /**
   * Head-to-head's draws and Best of; Best score's direction and count.
   * Its lock depends on the Format (`settingLock`).
   */
  "gameConfig",
  /** Head-to-head or Best score: open to everyone, or a fixed Entrant list. */
  "entrantsOpen",
  /** A Bracket's heat size, how many advance and the 3rd place game. */
  "bracketConfig",
  "entrants",
  /** Building (generating or re-rolling) the Bracket. */
  "bracket",
  "selfEnroll",
  "entrantLimit",
  "enrollClosesAt",
  "loggingClosesAt",
  "selfReport",
  "selfCheckIn",
  "checkInClosesAt",
] as const;

export type CompetitionSettingField =
  (typeof COMPETITION_SETTING_FIELDS)[number];

/**
 * When a setting locks: `never`; once any `result` exists; once the
 * Competition has a `game`; once any `heat-result` exists; or only while
 * `finalized` (Finalized or Closed). Every setting but the `never` ones
 * also locks while Finalized or Closed.
 */
export type SettingLock =
  "never" | "result" | "game" | "heat-result" | "finalized";

/**
 * Each setting's lock, but `gameConfig`'s, which depends on the Format
 * (`settingLock`).
 */
export const SETTING_LOCKS: Record<
  Exclude<CompetitionSettingField, "gameConfig">,
  SettingLock
> = {
  name: "never",
  description: "never",
  group: "never",
  hosts: "never",
  placementPoints: "never",
  participationPoints: "never",
  format: "result",
  scoring: "result",
  countsTowardTeam: "result",
  scoreDirection: "result",
  // A Best of needs a fixed list of two Entrants, which are a result, so
  // the Entrant list and Head-to-head's settings wait for a Game.
  entrantsOpen: "game",
  bracketConfig: "heat-result",
  entrants: "heat-result",
  bracket: "heat-result",
  // They set who joins and until when, so an Organizer can extend a
  // deadline mid-week.
  selfEnroll: "finalized",
  entrantLimit: "finalized",
  enrollClosesAt: "finalized",
  loggingClosesAt: "finalized",
  selfReport: "finalized",
  selfCheckIn: "finalized",
  checkInClosesAt: "finalized",
};

/**
 * When `field` locks for a Competition of `format`. A Head-to-head
 * Competition's draws and Best of lock once it has a Game; a Best score
 * Competition's direction and attempts once any result exists.
 */
export function settingLock(
  field: CompetitionSettingField,
  format: Format,
): SettingLock {
  if (field === "gameConfig") {
    return format === "head-to-head" ? "game" : "result";
  }
  return SETTING_LOCKS[field];
}

export const LOCKED_BY_RESULT = "Locked once the Competition has a result.";
export const LOCKED_BY_GAME = "Locked once the Competition has a Game.";
export const LOCKED_BY_HEAT_RESULT = "Locked once a Heat has a result.";
/** Reopen for a Placement, Games or Participation run; Un-finalize for a Bracket. */
export const LOCKED_WHILE_FINALIZED =
  "Locked while the Competition is Finalized or Closed. Reopen or Un-finalize it first.";
/** A points setting changed while Finalized or Closed: when it takes effect. */
export const APPLIES_AT_NEXT_FINALIZE =
  "Applies at the next Finalize or Close.";

/**
 * What a Competition has entered so far. A result is any of them: an
 * Entrant, Game, Placement, check-in (someone who took part), Heat or Heat
 * Result, or a generated Points Entry.
 */
export type CompetitionResults = {
  entrants: number;
  games: number;
  placements: number;
  checkIns: number;
  heats: number;
  /** Whether a Heat has a Heat Result (byes don't count). */
  heatResult: boolean;
  generatedPointsEntries: number;
};

/** Whether the Competition has a result: the one definition. */
export function hasResult(results: CompetitionResults): boolean {
  return (
    results.heatResult ||
    results.entrants +
      results.games +
      results.placements +
      results.checkIns +
      results.heats +
      results.generatedPointsEntries >
      0
  );
}

/** What the lock rules read about a Competition. */
export type CompetitionLockFacts = {
  /** The saved Format: `gameConfig`'s lock depends on it. */
  format: Format;
  hasResult: boolean;
  hasGame: boolean;
  hasHeatResult: boolean;
  /** Finalized (Placement, Bracket) or Closed (the others). */
  finalized: boolean;
};

export function lockFactsOf(
  results: CompetitionResults,
  { format, finalizedAt }: { format: Format; finalizedAt: Date | null },
): CompetitionLockFacts {
  return {
    format,
    hasResult: hasResult(results),
    hasGame: results.games > 0,
    hasHeatResult: results.heatResult,
    finalized: finalizedAt !== null,
  };
}

/**
 * Why `field` can't change now, or null. A result, Game or Heat Result
 * lock's reason comes before Finalized's: Reopen alone won't unlock it.
 */
export function settingLockReason(
  field: CompetitionSettingField,
  facts: CompetitionLockFacts,
): string | null {
  const lock = settingLock(field, facts.format);
  if (lock === "never") return null;
  if (lock === "result" && facts.hasResult) return LOCKED_BY_RESULT;
  if (lock === "game" && facts.hasGame) return LOCKED_BY_GAME;
  if (lock === "heat-result" && facts.hasHeatResult) {
    return LOCKED_BY_HEAT_RESULT;
  }
  return facts.finalized ? LOCKED_WHILE_FINALIZED : null;
}

/** The note an unlocked field shows, or null: points changed after Finalize. */
export function settingNote(
  field: CompetitionSettingField,
  facts: CompetitionLockFacts,
): string | null {
  return (field === "placementPoints" || field === "participationPoints") &&
    facts.finalized
    ? APPLIES_AT_NEXT_FINALIZE
    : null;
}
