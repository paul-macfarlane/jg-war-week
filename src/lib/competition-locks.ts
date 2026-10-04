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
  /** Placement's and Best score's Score direction. */
  "scoreDirection",
  /** The Scores' unit label: never locks. */
  "scoreUnit",
  /** Head-to-head's draws and Best of. */
  "seriesConfig",
  /** Best score's Team score. */
  "bestScoreConfig",
  /** A Bracket's match size, how many advance and the 3rd place Match. */
  "bracketConfig",
  "entrants",
  /** Building (generating or re-rolling) the Bracket. */
  "bracket",
  "selfEnroll",
  "entrantLimit",
  "selfReport",
  "selfCheckIn",
] as const;

export type CompetitionSettingField =
  (typeof COMPETITION_SETTING_FIELDS)[number];

/**
 * When a setting locks: `never`; once any `result` exists; once the
 * Competition has a `logged` Match or Attempt; once any `match-result`
 * exists; or only while `closed`. Every setting but the `never` ones also
 * locks while Closed.
 */
export type SettingLock =
  "never" | "result" | "logged" | "match-result" | "closed";

/** Each setting's lock. */
export const SETTING_LOCKS: Record<CompetitionSettingField, SettingLock> = {
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
  scoreUnit: "never",
  // A Head-to-head's two Entrants are a result, so its settings wait for
  // its first Match.
  seriesConfig: "logged",
  bestScoreConfig: "result",
  bracketConfig: "match-result",
  entrants: "match-result",
  bracket: "match-result",
  // They set who joins, so an Organizer can raise a limit mid-week.
  selfEnroll: "closed",
  entrantLimit: "closed",
  selfReport: "closed",
  selfCheckIn: "closed",
};

/** When `field` locks. */
export function settingLock(field: CompetitionSettingField): SettingLock {
  return SETTING_LOCKS[field];
}

export const LOCKED_BY_RESULT = "Locked once the Competition has a result.";
export const LOCKED_BY_MATCH =
  "Locked once the Competition has a Match or Attempt.";
export const LOCKED_BY_MATCH_RESULT = "Locked once a Match has a result.";
/** Every Format reopens the same way. */
export const LOCKED_WHILE_CLOSED =
  "Locked while the Competition is Closed. Reopen it first.";
/** A points setting changed while Closed: when it takes effect. */
export const APPLIES_AT_NEXT_CLOSE = "Applies at the next Close.";

/**
 * What a Competition has entered so far. A result is any of them: an
 * Entrant, a logged Head-to-head Match or Best score Attempt, a Placement,
 * a check-in (someone who took part), a Bracket Match or Match Result, or
 * a generated Points Entry.
 */
export type CompetitionResults = {
  entrants: number;
  /** Head-to-head Matches and Best score Attempts. */
  logged: number;
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
      results.logged +
      results.placements +
      results.checkIns +
      results.matches +
      results.generatedPointsEntries >
      0
  );
}

/** What the lock rules read about a Competition. */
export type CompetitionLockFacts = {
  /** The saved Format. */
  format: Format;
  hasResult: boolean;
  /** A Head-to-head Match or Best score Attempt is logged. */
  hasLogged: boolean;
  hasMatchResult: boolean;
  closed: boolean;
};

export function lockFactsOf(
  results: CompetitionResults,
  { format, closedAt }: { format: Format; closedAt: Date | null },
): CompetitionLockFacts {
  return {
    format,
    hasResult: hasResult(results),
    hasLogged: results.logged > 0,
    hasMatchResult: results.matchResult,
    closed: closedAt !== null,
  };
}

/**
 * Why `field` can't change now, or null. A result, Match, Attempt or Match
 * Result
 * lock's reason comes before Closed's: Reopen alone won't unlock it.
 */
export function settingLockReason(
  field: CompetitionSettingField,
  facts: CompetitionLockFacts,
): string | null {
  const lock = settingLock(field);
  if (lock === "never") return null;
  if (lock === "result" && facts.hasResult) return LOCKED_BY_RESULT;
  if (lock === "logged" && facts.hasLogged) return LOCKED_BY_MATCH;
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
