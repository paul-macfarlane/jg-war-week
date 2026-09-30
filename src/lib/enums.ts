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
  "points",
  "single-elimination",
  "heats",
  "games",
] as const;

/** How a `games` Competition's Games are decided (CONTEXT.md, Game Type). */
export const GAME_TYPES = ["head-to-head", "best-score", "ranked"] as const;

export type GameType = (typeof GAME_TYPES)[number];

export const HEAT_STATUSES = ["pending", "ready", "played", "forfeit"] as const;
