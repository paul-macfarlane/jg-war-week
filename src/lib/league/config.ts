/**
 * A League's settings, saved in `competition.league_config` (CONTEXT.md,
 * League): its Pairing, Round robin (everyone plays everyone) or Swiss (N
 * rounds, paired one at a time), and a Swiss League's rounds (blank for
 * ⌈log₂ N⌉). Never null for a League (the CHECK
 * `competition_league_config_league`). Pure and deliberately free of zod:
 * `src/lib/league/rules.ts` imports it, and that module reaches the client
 * through `src/lib/access.ts`. The zod rule is `config-schema.ts`.
 */

export const LEAGUE_PAIRINGS = ["round-robin", "swiss"] as const;

export type LeaguePairing = (typeof LEAGUE_PAIRINGS)[number];

export type LeagueConfig = {
  pairing: LeaguePairing;
  /** Swiss only: how many rounds; null for the default. */
  rounds: number | null;
};

/** The most rounds a Swiss League's settings take (the field's `max`). */
export const LEAGUE_MAX_ROUNDS = 64;

/** What a new League gets: a round robin (R12). */
export const DEFAULT_LEAGUE_CONFIG: LeagueConfig = {
  pairing: "round-robin",
  rounds: null,
};

export const PAIRING_LABELS: Record<LeaguePairing, string> = {
  "round-robin": "Round robin",
  swiss: "Swiss",
};

/** A Swiss League's default rounds for `entrants`: ⌈log₂ N⌉, at least 1. */
export function swissDefaultRounds(entrants: number): number {
  return entrants < 2 ? 1 : Math.max(1, Math.ceil(Math.log2(entrants)));
}

/**
 * How many rounds the League plays with `entrants`: a round robin N − 1
 * (even) or N (odd, one sitting out each round); a Swiss League its set
 * rounds, or the default.
 */
export function roundsOf(config: LeagueConfig, entrants: number): number {
  if (config.pairing === "round-robin") {
    return entrants % 2 === 0 ? entrants - 1 : entrants;
  }
  return config.rounds ?? swissDefaultRounds(entrants);
}

/**
 * Why a Swiss League can't play its rounds with `entrants`, or null: it
 * plays 1 to N − 1 (no one can meet more opponents than there are). A round
 * robin, or fewer than 2 Entrants, has nothing to refuse here.
 */
export function roundsError(
  config: LeagueConfig,
  entrants: number,
): string | null {
  if (config.pairing !== "swiss" || entrants < 2) return null;
  const rounds = roundsOf(config, entrants);
  return rounds >= 1 && rounds <= entrants - 1
    ? null
    : `A Swiss League of ${entrants} Entrants plays 1 to ${entrants - 1} rounds.`;
}

/** Whether `value` is a well-formed League config (the CHECK's rule). */
export function isLeagueConfig(value: unknown): value is LeagueConfig {
  if (typeof value !== "object" || value === null) return false;
  const { pairing, rounds, ...rest } = value as Record<string, unknown>;
  if (Object.keys(rest).length > 0) return false;
  if (pairing !== "round-robin" && pairing !== "swiss") return false;
  if (rounds === null) return true;
  return (
    pairing === "swiss" &&
    typeof rounds === "number" &&
    Number.isInteger(rounds) &&
    rounds >= 1
  );
}

/** A League's config: its saved `leagueConfig` when valid, else the default. */
export function leagueConfigOf(competition: {
  leagueConfig: unknown;
}): LeagueConfig {
  return isLeagueConfig(competition.leagueConfig)
    ? competition.leagueConfig
    : DEFAULT_LEAGUE_CONFIG;
}
