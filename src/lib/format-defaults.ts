/**
 * What a Competition of a Format starts with: the settings
 * `createCompetition` gives a new one and `setCompetitionFormat` gives one
 * whose Format changes. Pure.
 */
import {
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
} from "@/lib/bracket/config";
import type { Format } from "@/lib/bracket/types";
import { BRACKET_PLACEMENTS } from "@/lib/competitions";
import { type COMPETITION_SCORINGS, isGameFormat } from "@/lib/enums";
import { type GamesConfig, defaultGamesConfig } from "@/lib/games/config";

export type FormatDefaults = {
  bracketConfig: BracketConfig | null;
  gameConfig: GamesConfig | null;
  entrantsOpen: boolean;
  participationPoints: number | null;
  placementPoints: number[] | null;
};

/**
 * A `format` Competition's settings from its scoring and Placement Points:
 * a Bracket's match settings (`bracketConfig`, else the default) and at
 * most its first 4 Placement Points; a Head-to-head or Best score
 * Competition's default settings, open to everyone (Best of off); a team
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
    gameConfig: isGameFormat(format) ? defaultGamesConfig(format) : null,
    entrantsOpen: isGameFormat(format),
    ...points,
  };
}
