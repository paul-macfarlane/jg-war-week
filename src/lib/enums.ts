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
 * A Placement Competition's Score direction (CONTEXT.md): whether a higher
 * or lower Score wins, or `none` when Places are set by hand. Other Formats
 * keep `none`.
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
  "champions",
  "standings",
  "winner",
  "custom",
] as const;

export type FinaleSlideKind = (typeof FINALE_SLIDE_KINDS)[number];

/** How the Finale shows Awards: one slide, or one slide per Award Category. */
export const FINALE_AWARDS_LAYOUTS = ["one-slide", "per-category"] as const;

export type FinaleAwardsLayout = (typeof FINALE_AWARDS_LAYOUTS)[number];

/**
 * The two Formats run as Games (CONTEXT.md): a Head-to-head or Best score
 * Competition's Games are logged, then it is closed for its Placement Points.
 */
export const GAME_FORMATS = ["head-to-head", "best-score"] as const;

export type GameFormat = (typeof GAME_FORMATS)[number];

/** Whether a Competition Format is one of the Games Formats. */
export function isGameFormat(
  format: (typeof COMPETITION_FORMATS)[number],
): format is GameFormat {
  return (GAME_FORMATS as readonly string[]).includes(format);
}
