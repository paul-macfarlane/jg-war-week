import type { Competition } from "@/db/schema";
import { notFoundMessage } from "@/mcp/not-found";
import type { PlacementsView } from "@/queries/placements";

/** The found Competition's basic facts, before deciding whether to load its rows. */
export type FoundCompetition = Pick<Competition, "name" | "scoring" | "format">;

const DIRECTIONS = {
  none: "none",
  higher: "higher wins",
  lower: "lower wins",
} as const;

export type PlacementsResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        scoreDirection: (typeof DIRECTIONS)[keyof typeof DIRECTIONS];
        placementPoints: number[] | null;
        closed: boolean;
        closedAt: string | null;
      };
      placements: {
        place: number | null;
        name: string;
        team: string | null;
        score: number | null;
        points: number | null;
      }[];
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], "placement">;
      };
      placements: null;
      message: string;
    }
  | { found: false; message: string };

/**
 * Serializes a Placement Competition's `get_placements` answer: its Score
 * direction, Placement Points, whether it's Finalized, and each row by
 * place with its name, Team, Score and points. Pure: the route resolves
 * the Competition by name and loads `getPlacementsView` only when its
 * Format is `placement`. Names only: never an email, an id or a picture.
 */
export function toPlacementsResult(
  found: FoundCompetition | undefined,
  view: PlacementsView | undefined,
  name: string,
): PlacementsResult {
  if (!found || (found.format === "placement" && !view)) {
    return { found: false, message: notFoundMessage(name) };
  }
  if (found.format !== "placement" || !view) {
    return {
      found: true,
      competition: {
        name: found.name,
        scoring: found.scoring,
        format: found.format as Exclude<Competition["format"], "placement">,
      },
      placements: null,
      message: `${found.name} isn't run as Placement; call get_games, get_bracket, get_participation or get_leaderboard.`,
    };
  }

  const { competition, rows } = view;
  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      scoreDirection: DIRECTIONS[competition.scoreDirection],
      placementPoints: competition.placementPoints,
      closed: competition.finalizedAt !== null,
      closedAt: competition.finalizedAt?.toISOString() ?? null,
    },
    placements: rows.map((row) => ({
      place: row.place,
      name: row.name,
      team: row.team,
      score: row.score,
      points: row.points,
    })),
  };
}
