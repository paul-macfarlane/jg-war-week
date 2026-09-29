/**
 * A `games` Competition's settings, saved in `competition.game_config`: one
 * shape per Game Type (CONTEXT.md). Null in the column means the Game Type's
 * default. Pure: no database, no framework.
 */
import { z } from "zod";

import type { GameType } from "@/lib/enums";

/** The Best of lengths a head-to-head Competition offers; null is off. */
export const BEST_OF_OPTIONS = [3, 5, 7] as const;

export type BestOf = (typeof BEST_OF_OPTIONS)[number];

export type HeadToHeadConfig = { drawsAllowed: boolean; bestOf: BestOf | null };

export type BestScoreConfig = {
  /** Whether a player's best Game counts, or the total of all of them. */
  count: "best" | "total";
  betterIs: "higher" | "lower";
  /** A label for the score, like "trips"; empty for none. */
  unit: string;
};

export type RankedConfig = {
  /**
   * Finish Points for 1st, 2nd, 3rd… in one Game. Empty means the default:
   * one point per player beaten, worked out when read.
   */
  finishPoints: number[];
};

export type GamesConfig = HeadToHeadConfig | BestScoreConfig | RankedConfig;

/** The config a Game Type takes. */
export type GamesConfigFor<T extends GameType> = T extends "head-to-head"
  ? HeadToHeadConfig
  : T extends "best-score"
    ? BestScoreConfig
    : RankedConfig;

const GAME_TYPE_LABELS: Record<GameType, string> = {
  "head-to-head": "Head-to-head",
  "best-score": "Best score",
  ranked: "Ranked",
};

export function gameTypeLabel(gameType: GameType): string {
  return GAME_TYPE_LABELS[gameType];
}

export function bestOfLabel(bestOf: BestOf | null): string {
  return bestOf === null ? "Off" : `Best of ${bestOf}`;
}

export const headToHeadConfigSchema = z.strictObject({
  drawsAllowed: z.boolean(),
  bestOf: z
    .union([z.literal(3), z.literal(5), z.literal(7), z.null()], {
      error: "Best of is off, 3, 5 or 7.",
    })
    .default(null),
});

export const bestScoreConfigSchema = z.strictObject({
  count: z.enum(["best", "total"], { error: "Count the best or the total." }),
  betterIs: z.enum(["higher", "lower"], {
    error: "Better is higher or lower.",
  }),
  unit: z
    .string()
    .trim()
    .max(20, { error: "A unit is at most 20 characters." }),
});

export const rankedConfigSchema = z.strictObject({
  finishPoints: z
    .array(
      z
        .number({ error: "Finish Points are numbers." })
        .min(0, { error: "Finish Points can't be negative." })
        .max(1000, { error: "Finish Points are at most 1000." }),
    )
    .max(32, { error: "Set Finish Points for at most 32 places." }),
});

const SCHEMAS = {
  "head-to-head": headToHeadConfigSchema,
  "best-score": bestScoreConfigSchema,
  ranked: rankedConfigSchema,
} as const;

/** The zod schema for a Game Type's config. */
export function gamesConfigSchema<T extends GameType>(
  gameType: T,
): z.ZodType<GamesConfigFor<T>> {
  return SCHEMAS[gameType] as unknown as z.ZodType<GamesConfigFor<T>>;
}

/** What a Competition of this Game Type uses when nothing is saved. */
export function defaultGamesConfig<T extends GameType>(
  gameType: T,
): GamesConfigFor<T> {
  const defaults: { [K in GameType]: GamesConfigFor<K> } = {
    "head-to-head": { drawsAllowed: false, bestOf: null },
    "best-score": { count: "best", betterIs: "higher", unit: "" },
    ranked: { finishPoints: [] },
  };
  return defaults[gameType] as GamesConfigFor<T>;
}

/**
 * A Competition's config: its saved `gameConfig` when that's valid for its
 * Game Type, otherwise the Game Type's default.
 */
export function gamesConfigOf<T extends GameType>(competition: {
  gameType: T;
  gameConfig: unknown;
}): GamesConfigFor<T> {
  const parsed = gamesConfigSchema(competition.gameType).safeParse(
    competition.gameConfig,
  );
  return parsed.success
    ? parsed.data
    : defaultGamesConfig(competition.gameType);
}

/**
 * Each player's Finish Points in one ranked Game, in the order of `places`
 * (1-based, ties sharing a place). The Host's table gives a place its points,
 * zero past its end; an empty table gives one point per player beaten.
 */
export function finishPointsFor(
  config: RankedConfig,
  places: readonly number[],
): number[] {
  if (config.finishPoints.length === 0) {
    return places.map((place) => places.filter((p) => p > place).length);
  }
  return places.map((place) => config.finishPoints[place - 1] ?? 0);
}
