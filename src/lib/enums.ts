/**
 * The value lists behind the database enums. `src/db/schema.ts` builds its
 * pgEnums from them and the zod rules in `src/lib/` validate against them,
 * so client code can use them without pulling Drizzle into the bundle.
 * Imports nothing.
 */

export const WAR_WEEK_STATUSES = ["upcoming", "live", "complete"] as const;

export const WAR_WEEK_MODES = ["teams", "free-for-all"] as const;

export const FONT_PRESETS = ["sans", "serif", "mono"] as const;

export const SCHEDULE_ITEM_CATEGORIES = [
  "competition",
  "education",
  "social",
  "meal",
  "work",
  "other",
] as const;

export const COMPETITION_SCORINGS = ["team", "individual"] as const;

export const COMPETITION_FORMATS = [
  "placement",
  "bracket",
  "head-to-head",
  "best-score",
  "participation",
] as const;

/**
 * A Competition's Score direction (CONTEXT.md): whether a higher or lower
 * Score wins, or `none` when places are set by hand. Best score is always
 * higher or lower; Participation keeps `none` (the CHECK
 * `competition_score_direction_by_format`).
 */
export const SCORE_DIRECTIONS = ["none", "higher", "lower"] as const;

export type ScoreDirection = (typeof SCORE_DIRECTIONS)[number];

export const MATCH_STATUSES = ["pending", "ready", "played"] as const;

/**
 * A Finale slide's kind: the built-in slides, in their default order, then
 * `custom` (CONTEXT.md, Finale slide).
 */
export const FINALE_SLIDE_KINDS = [
  "title",
  "numbers",
  "awards",
  "winners",
  "standings",
  "winner",
  "custom",
] as const;

export type FinaleSlideKind = (typeof FINALE_SLIDE_KINDS)[number];

/**
 * The two Formats whose results are logged one at a time (CONTEXT.md): a
 * Head-to-head series' Matches and a Best score Competition's Attempts.
 * Each is closed for its Placement Points.
 */
export const LOGGED_FORMATS = ["head-to-head", "best-score"] as const;

export type LoggedFormat = (typeof LOGGED_FORMATS)[number];

/** Whether a Competition Format logs Matches (a series) or Attempts. */
export function isLoggedFormat(
  format: (typeof COMPETITION_FORMATS)[number],
): format is LoggedFormat {
  return (LOGGED_FORMATS as readonly string[]).includes(format);
}
