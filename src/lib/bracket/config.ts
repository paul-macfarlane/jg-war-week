/**
 * A Bracket's settings, saved in `competition.bracket_config`: how many
 * Entrants play in each Heat, how many of them advance, and the 3rd place
 * game. Never null for a Bracket. Pure, like the engine.
 */
import { z } from "zod";

export type BracketConfig = {
  entrantsPerHeat: number;
  advancePerHeat: number;
  /** Stored and validated as a boolean here; its behavior is part 98's. */
  thirdPlaceGame: boolean;
};

/** What a new Bracket gets: head-to-head, no 3rd place game. */
export const DEFAULT_BRACKET_CONFIG: BracketConfig = {
  entrantsPerHeat: 2,
  advancePerHeat: 1,
  thirdPlaceGame: false,
};

/**
 * Whether a config is the head-to-head preset (2 per Heat, 1 advancing):
 * the one config the single-elimination engine runs. `engineFor`
 * (`formats.ts`) is where it picks the engine.
 */
export function isHeadToHead(config: BracketConfig): boolean {
  return config.entrantsPerHeat === 2 && config.advancePerHeat === 1;
}

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

export const bracketConfigSchema = z
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
    thirdPlaceGame: z.boolean({
      error: "Choose whether to play a 3rd place game.",
    }),
  })
  .refine((c) => c.advancePerHeat < c.entrantsPerHeat, {
    error: "Fewer must advance than play in a Heat.",
    path: ["advancePerHeat"],
  });

/**
 * A Bracket Competition's config: its saved `bracketConfig` when valid,
 * otherwise the default. Never null: only call it for a Bracket.
 */
export function configOf(competition: {
  bracketConfig: unknown;
}): BracketConfig {
  const parsed = bracketConfigSchema.safeParse(competition.bracketConfig);
  return parsed.success ? parsed.data : DEFAULT_BRACKET_CONFIG;
}
