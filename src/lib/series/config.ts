/**
 * A Head-to-head Competition's settings, saved in
 * `competition.series_config`: whether a Match may be a Draw, and the Best
 * of its two Entrants play (CONTEXT.md). Never null for a Head-to-head
 * (the CHECK `competition_series_config_head_to_head`). Pure: no database,
 * no framework.
 */
import { z } from "zod";

/** The Best of lengths a Head-to-head offers; Best of 1 is a single Match. */
export const BEST_OF_OPTIONS = [1, 3, 5, 7] as const;

export type BestOf = (typeof BEST_OF_OPTIONS)[number];

export type SeriesConfig = { drawsAllowed: boolean; bestOf: BestOf };

/** What a new Head-to-head gets: no draws, Best of 3. */
export const DEFAULT_SERIES_CONFIG: SeriesConfig = {
  drawsAllowed: false,
  bestOf: 3,
};

export function bestOfLabel(bestOf: BestOf): string {
  return `Best of ${bestOf}`;
}

/** How many Matches an Entrant must win to take a Best of. */
export function majorityOf(bestOf: BestOf): number {
  return Math.floor(bestOf / 2) + 1;
}

export const seriesConfigSchema = z.strictObject({
  drawsAllowed: z.boolean({ error: "Choose whether draws are allowed." }),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(7)], {
    error: "Best of is 1, 3, 5 or 7.",
  }),
});

/**
 * A Head-to-head Competition's config: its saved `seriesConfig` when
 * valid, otherwise the default.
 */
export function seriesConfigOf(competition: {
  seriesConfig: unknown;
}): SeriesConfig {
  const parsed = seriesConfigSchema.safeParse(competition.seriesConfig);
  return parsed.success ? parsed.data : DEFAULT_SERIES_CONFIG;
}
