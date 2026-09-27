/**
 * A Bracket's Format settings, saved in `competition.bracket_config`: how
 * many Entrants play in each Heat and how many of them advance. Only the
 * heats Format has any; single elimination's is null. Pure, like the engine.
 */
import { z } from "zod";

import type { Format } from "@/lib/bracket/types";

export type HeatsConfig = { entrantsPerHeat: number; advancePerHeat: number };

/** Null for single elimination (and points, which has no Bracket). */
export type BracketConfig = HeatsConfig | null;

/** The Heat sizes the builder offers. */
export const ENTRANTS_PER_HEAT_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

/** How many of a Heat can advance, before the Heat size narrows it. */
export const ADVANCE_PER_HEAT_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function entrantsPerHeatLabel(count: number): string {
  return `${count} per Heat`;
}

export function advancePerHeatLabel(count: number): string {
  return count === 1 ? "Top 1 advances" : `Top ${count} advance`;
}

export const heatsConfigSchema = z
  .object({
    entrantsPerHeat: z
      .number()
      .int()
      .min(2, { error: "A Heat needs at least 2 Entrants." })
      .max(8, { error: "A Heat holds at most 8 Entrants." }),
    advancePerHeat: z
      .number()
      .int()
      .min(1, { error: "At least 1 must advance from a Heat." })
      .max(7, { error: "At most 7 can advance from a Heat." }),
  })
  .refine((c) => c.advancePerHeat < c.entrantsPerHeat, {
    error: "Fewer must advance than play in a Heat.",
    path: ["advancePerHeat"],
  });

const noConfigSchema = z.null().optional();

/** The config a Format takes: a Heats config, or none. */
export function bracketConfigSchema(
  format: Format,
): z.ZodType<BracketConfig | undefined> {
  return format === "heats" ? heatsConfigSchema : noConfigSchema;
}

/** What a Bracket of this Format uses when nothing is saved. */
export function defaultConfig(format: Format): BracketConfig {
  return format === "heats" ? { entrantsPerHeat: 4, advancePerHeat: 2 } : null;
}

/**
 * A Competition's config: its saved `bracketConfig` when that's valid for
 * its Format, otherwise the Format's default.
 */
export function configOf(competition: {
  format: Format;
  bracketConfig: unknown;
}): BracketConfig {
  if (competition.format !== "heats") return null;
  const parsed = heatsConfigSchema.safeParse(competition.bracketConfig);
  return parsed.success ? parsed.data : defaultConfig(competition.format);
}
