/**
 * What a Competition of a Format starts with: the settings
 * `createCompetition` gives a new one and `setCompetitionFormat` gives one
 * whose Format changes. Pure.
 */
import {
  type BestScoreConfig,
  DEFAULT_BEST_SCORE_CONFIG,
} from "@/lib/best-score/config";
import {
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
} from "@/lib/bracket/config";
import type { Format } from "@/lib/bracket/types";
import { BRACKET_PLACEMENTS } from "@/lib/competitions";
import type { COMPETITION_SCORINGS, ScoreDirection } from "@/lib/enums";
import { DEFAULT_SERIES_CONFIG, type SeriesConfig } from "@/lib/series/config";

export type FormatDefaults = {
  bracketConfig: BracketConfig | null;
  seriesConfig: SeriesConfig | null;
  bestScoreConfig: BestScoreConfig | null;
  scoreDirection: ScoreDirection;
  participationPoints: number | null;
  placementPoints: number[] | null;
};

/**
 * A `format` Competition's settings from its scoring and Placement Points:
 * a Bracket's match settings (`bracketConfig`, else the default) and at
 * most its first 4 Placement Points; a Head-to-head's default series (no
 * draws, Best of 3); Best score's default Team score and a `higher` Score
 * direction (it has no `none`); every other Format `none`; a team
 * Participation Competition's Placement Points (3/2/1 when it has none)
 * and an individual one's 1 point per Participant instead.
 */
export function formatDefaults(
  format: Format,
  {
    scoring,
    placementPoints,
  }: {
    scoring: (typeof COMPETITION_SCORINGS)[number];
    placementPoints: number[] | null;
  },
  bracketConfig?: BracketConfig,
): FormatDefaults {
  const kept =
    format === "bracket"
      ? (placementPoints?.slice(0, BRACKET_PLACEMENTS) ?? null)
      : placementPoints;
  const points =
    format !== "participation"
      ? { participationPoints: null, placementPoints: kept }
      : scoring === "team"
        ? {
            participationPoints: null,
            placementPoints: kept?.length ? kept : [3, 2, 1],
          }
        : { participationPoints: 1, placementPoints: null };
  return {
    bracketConfig:
      format === "bracket" ? (bracketConfig ?? DEFAULT_BRACKET_CONFIG) : null,
    seriesConfig: format === "head-to-head" ? DEFAULT_SERIES_CONFIG : null,
    bestScoreConfig: format === "best-score" ? DEFAULT_BEST_SCORE_CONFIG : null,
    scoreDirection: format === "best-score" ? "higher" : "none",
    ...points,
  };
}
