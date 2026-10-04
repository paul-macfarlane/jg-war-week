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
  /** A Bracket's match size, how many advance and the 3rd place Match. */
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
 * Competition has a `game`; once any `match-result` exists; or only while
 * `closed` (Closed or Closed). Every setting but the `never` ones
 * also locks while Closed or Closed.
 */
export type SettingLock =
  "never" | "result" | "game" | "match-result" | "closed";

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
  bracketConfig: "match-result",
  entrants: "match-result",
  bracket: "match-result",
  // They set who joins and until when, so an Organizer can extend a
  // deadline mid-week.
  selfEnroll: "closed",
  entrantLimit: "closed",
  enrollClosesAt: "closed",
  loggingClosesAt: "closed",
  selfReport: "closed",
  selfCheckIn: "closed",
  checkInClosesAt: "closed",
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
export const LOCKED_BY_MATCH =
  "Locked once the Competition has a Match or Attempt.";
export const LOCKED_BY_MATCH_RESULT = "Locked once a Match has a result.";
/** Reopen for a Placement, Games or Participation run; Reopen for a Bracket. */
export const LOCKED_WHILE_CLOSED =
  "Locked while the Competition is Closed. Reopen it first.";
/** A points setting changed while Closed or Closed: when it takes effect. */
export const APPLIES_AT_NEXT_CLOSE = "Applies at the next Close.";

/**
 * What a Competition has entered so far. A result is any of them: an
 * Entrant, Game, Placement, check-in (someone who took part), Match or Match
 * Result, or a generated Points Entry.
 */
export type CompetitionResults = {
  entrants: number;
  games: number;
  placements: number;
  checkIns: number;
  matches: number;
  /** Whether a Match has a Match Result (byes don't count). */
  matchResult: boolean;
  generatedPointsEntries: number;
};

/** Whether the Competition has a result: the one definition. */
export function hasResult(results: CompetitionResults): boolean {
  return (
    results.matchResult ||
    results.entrants +
      results.games +
      results.placements +
      results.checkIns +
      results.matches +
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
  hasMatchResult: boolean;
  /** Closed (Placement, Bracket) or Closed (the others). */
  closed: boolean;
};

export function lockFactsOf(
  results: CompetitionResults,
  { format, closedAt }: { format: Format; closedAt: Date | null },
): CompetitionLockFacts {
  return {
    format,
    hasResult: hasResult(results),
    hasGame: results.games > 0,
    hasMatchResult: results.matchResult,
    closed: closedAt !== null,
  };
}

/**
 * Why `field` can't change now, or null. A result, Game or Match Result
 * lock's reason comes before Closed's: Reopen alone won't unlock it.
 */
export function settingLockReason(
  field: CompetitionSettingField,
  facts: CompetitionLockFacts,
): string | null {
  const lock = settingLock(field, facts.format);
  if (lock === "never") return null;
  if (lock === "result" && facts.hasResult) return LOCKED_BY_RESULT;
  if (lock === "game" && facts.hasGame) return LOCKED_BY_MATCH;
  if (lock === "match-result" && facts.hasMatchResult) {
    return LOCKED_BY_MATCH_RESULT;
  }
  return facts.closed ? LOCKED_WHILE_CLOSED : null;
}

/** The note an unlocked field shows, or null: points changed after Close. */
export function settingNote(
  field: CompetitionSettingField,
  facts: CompetitionLockFacts,
): string | null {
  return (field === "placementPoints" || field === "participationPoints") &&
    facts.closed
    ? APPLIES_AT_NEXT_CLOSE
    : null;
}
