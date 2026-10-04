/**
 * A Best score Competition's settings (CONTEXT.md). Its Score direction
 * (higher or lower is better) and unit are the Competition's scoring
 * columns; `competition.best_score_config` holds how a Team's score adds up
 * in team scoring. Pure: no database, no framework.
 */
import { z } from "zod";

/**
 * A Team's score in team scoring: the Team's single best Attempt by any
 * member, or each member's best Attempt added up.
 */
export const TEAM_SCORES = ["best-member", "sum-of-members"] as const;

export type TeamScore = (typeof TEAM_SCORES)[number];

export type BestScoreConfig = { teamScore: TeamScore };

/** What a new Best score Competition gets: Best member. */
export const DEFAULT_BEST_SCORE_CONFIG: BestScoreConfig = {
  teamScore: "best-member",
};

const TEAM_SCORE_LABELS: Record<TeamScore, string> = {
  "best-member": "Best member",
  "sum-of-members": "Sum of members",
};

export function teamScoreLabel(teamScore: TeamScore): string {
  return TEAM_SCORE_LABELS[teamScore];
}

export const bestScoreConfigSchema = z.strictObject({
  teamScore: z.enum(TEAM_SCORES, {
    error: "Choose how a Team's score adds up.",
  }),
});

/**
 * A Best score Competition's config: its saved `bestScoreConfig` when
 * valid, otherwise the default.
 */
export function bestScoreConfigOf(competition: {
  bestScoreConfig: unknown;
}): BestScoreConfig {
  const parsed = bestScoreConfigSchema.safeParse(competition.bestScoreConfig);
  return parsed.success ? parsed.data : DEFAULT_BEST_SCORE_CONFIG;
}

/** Which Score wins a Best score Competition: never `none`. */
export type BetterIs = "higher" | "lower";

/**
 * Everything a Best score Competition's standings and pages read: the
 * direction and unit from its scoring columns, and its Team score.
 */
export type BestScoreSettings = BestScoreConfig & {
  betterIs: BetterIs;
  /** A label for the Score, like "trips"; empty for none. */
  unit: string;
};

/** A Best score Competition's settings from its stored columns. */
export function bestScoreSettingsOf(competition: {
  scoreDirection: string;
  scoreUnit: string | null;
  bestScoreConfig: unknown;
}): BestScoreSettings {
  return {
    ...bestScoreConfigOf(competition),
    betterIs: competition.scoreDirection === "lower" ? "lower" : "higher",
    unit: competition.scoreUnit ?? "",
  };
}
