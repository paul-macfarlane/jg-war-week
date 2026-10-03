/**
 * A Head-to-head or Best score Competition's settings, saved in
 * `competition.game_config`: one shape per Format (CONTEXT.md). Null in the
 * column means the Format's default. Pure: no database, no framework.
 */
import { z } from "zod";

import type { GameFormat } from "@/lib/enums";

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

export type GamesConfig = HeadToHeadConfig | BestScoreConfig;

/** The config a Games Format takes. */
export type GamesConfigFor<T extends GameFormat> = T extends "head-to-head"
  ? HeadToHeadConfig
  : BestScoreConfig;

const GAME_TYPE_LABELS: Record<GameFormat, string> = {
  "head-to-head": "Head-to-head",
  "best-score": "Best score",
};

export function gameFormatLabel(gameFormat: GameFormat): string {
  return GAME_TYPE_LABELS[gameFormat];
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

const SCHEMAS = {
  "head-to-head": headToHeadConfigSchema,
  "best-score": bestScoreConfigSchema,
} as const;

/** The zod schema for a Games Format's config. */
export function gamesConfigSchema<T extends GameFormat>(
  gameFormat: T,
): z.ZodType<GamesConfigFor<T>> {
  return SCHEMAS[gameFormat] as unknown as z.ZodType<GamesConfigFor<T>>;
}

/** What a Competition of this Format uses when nothing is saved. */
export function defaultGamesConfig<T extends GameFormat>(
  gameFormat: T,
): GamesConfigFor<T> {
  const defaults: { [K in GameFormat]: GamesConfigFor<K> } = {
    "head-to-head": { drawsAllowed: false, bestOf: null },
    "best-score": { count: "best", betterIs: "higher", unit: "" },
  };
  return defaults[gameFormat] as GamesConfigFor<T>;
}

/**
 * A Competition's config: its saved `gameConfig` when that's valid for its
 * Format, otherwise the Format's default.
 */
export function gamesConfigOf<T extends GameFormat>(competition: {
  format: T;
  gameConfig: unknown;
}): GamesConfigFor<T> {
  const parsed = gamesConfigSchema(competition.format).safeParse(
    competition.gameConfig,
  );
  return parsed.success ? parsed.data : defaultGamesConfig(competition.format);
}
