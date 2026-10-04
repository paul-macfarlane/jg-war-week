/**
 * A Bracket's settings, saved in `competition.bracket_config`: its kind
 * (head-to-head, 2 per Match with 1 advancing, or group), how many Entrants
 * play in each Match, how many of them advance, the 3rd place Match, and
 * per-round defaults that differ from the Bracket-wide ones (`rounds`,
 * keyed by round number). Never null for a Bracket. Pure, like the engine.
 */
import { z } from "zod";

export const BRACKET_KINDS = ["head-to-head", "group"] as const;

export type BracketKind = (typeof BRACKET_KINDS)[number];

/** A round's Match size and how many of each Match advance. */
export type RoundDefaults = {
  entrantsPerMatch: number;
  advancePerMatch: number;
};

export type BracketConfig = {
  kind: BracketKind;
  entrantsPerMatch: number;
  advancePerMatch: number;
  /**
   * A 3rd place Match between the semifinal losers: head-to-head only, with
   * at least 4 Entrants (see `thirdPlaceRefusal`).
   */
  thirdPlaceMatch: boolean;
  /** Per-round defaults that differ from the Bracket-wide ones. */
  rounds: Record<string, RoundDefaults>;
};

/** What a new Bracket gets: head-to-head, no 3rd place Match. */
export const DEFAULT_BRACKET_CONFIG: BracketConfig = {
  kind: "head-to-head" as const,
  entrantsPerMatch: 2,
  advancePerMatch: 1,
  thirdPlaceMatch: false,
  rounds: {},
};

/** The kind a Match size and advancing count make: 2 / 1 is head-to-head. */
export function kindOf(entrantsPerMatch: number, advancePerMatch: number) {
  return entrantsPerMatch === 2 && advancePerMatch === 1
    ? ("head-to-head" as const)
    : ("group" as const);
}

/**
 * Whether a config is head-to-head (2 per Match, 1 advancing): the one
 * config the single-elimination engine runs. `engineFor` (`formats.ts`) is
 * where it picks the engine.
 */
export function isHeadToHead(config: BracketConfig): boolean {
  return config.kind === "head-to-head";
}

/** A 3rd place Match on any config but head-to-head. */
export const THIRD_PLACE_HEAD_TO_HEAD_ONLY =
  "A 3rd place Match is only for 2 per Match with 1 advancing.";

/** A 3rd place Match with fewer than two real semifinals. */
export const THIRD_PLACE_NEEDS_FOUR =
  "A 3rd place Match needs at least 4 Entrants.";

/**
 * Why this config's 3rd place Match is refused for `entrantCount` Entrants,
 * or null: it needs head-to-head and two real semifinals (4 Entrants).
 */
export function thirdPlaceRefusal(
  config: BracketConfig,
  entrantCount: number,
): string | null {
  if (!config.thirdPlaceMatch) return null;
  if (!isHeadToHead(config)) return THIRD_PLACE_HEAD_TO_HEAD_ONLY;
  if (entrantCount < 4) return THIRD_PLACE_NEEDS_FOUR;
  return null;
}

/** The Match sizes the builder offers. */
export const ENTRANTS_PER_MATCH_OPTIONS = [2, 3, 4, 5, 6, 7, 8] as const;

/** How many of a Match can advance, before the Match size narrows it. */
export const ADVANCE_PER_MATCH_OPTIONS = [1, 2, 3, 4, 5, 6, 7] as const;

export function entrantsPerMatchLabel(count: number): string {
  return `${count} per Match`;
}

export function advancePerMatchLabel(count: number): string {
  return count === 1 ? "Top 1 advances" : `Top ${count} advance`;
}

const sizes = {
  entrantsPerMatch: z
    .number()
    .int()
    .min(2, { error: "A Match needs at least 2 Entrants." })
    .max(8, { error: "A Match holds at most 8 Entrants." }),
  advancePerMatch: z
    .number()
    .int()
    .min(1, { error: "At least 1 must advance from a Match." })
    .max(7, { error: "At most 7 can advance from a Match." }),
};

const roundDefaultsSchema = z
  .strictObject(sizes)
  .refine((r) => r.advancePerMatch < r.entrantsPerMatch, {
    error: "Fewer must advance than play in a Match.",
    path: ["advancePerMatch"],
  });

/**
 * A Bracket's config as posted or stored. `kind` may be omitted (it follows
 * the sizes); when given it must match them: head-to-head is 2 per Match
 * with 1 advancing. `rounds` may be omitted for none.
 */
export const bracketConfigSchema = z
  .object({
    kind: z
      .enum(BRACKET_KINDS, { error: "Choose Head-to-head or Group." })
      .optional(),
    ...sizes,
    thirdPlaceMatch: z.boolean({
      error: "Choose whether to play a 3rd place Match.",
    }),
    rounds: z
      .record(z.string().regex(/^[1-9]\d*$/), roundDefaultsSchema)
      .optional(),
  })
  .refine((c) => c.advancePerMatch < c.entrantsPerMatch, {
    error: "Fewer must advance than play in a Match.",
    path: ["advancePerMatch"],
  })
  .refine(
    (c) =>
      c.kind === undefined ||
      c.kind === kindOf(c.entrantsPerMatch, c.advancePerMatch),
    {
      error: "Head-to-head is 2 per Match with 1 advancing.",
      path: ["kind"],
    },
  )
  .transform((c): BracketConfig => ({
    kind: kindOf(c.entrantsPerMatch, c.advancePerMatch),
    entrantsPerMatch: c.entrantsPerMatch,
    advancePerMatch: c.advancePerMatch,
    thirdPlaceMatch: c.thirdPlaceMatch,
    rounds: c.rounds ?? {},
  }));

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
