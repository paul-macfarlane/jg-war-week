import type { Competition } from "@/db/schema";
import { notFoundMessage } from "@/mcp/not-found";
import type { ParticipationView } from "@/queries/participation";

/** The found Competition's basic facts, before deciding whether to load who took part. */
export type FoundCompetition = Pick<Competition, "name" | "scoring" | "format">;

export type ParticipationResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        /** Team scoring only; null for individual. */
        teamScoring: "ranked by headcount" | "per person" | null;
        /** N: individual, and team per person. */
        pointsPerParticipant: number;
        /** Ranked by headcount: the places' points, highest first. */
        placementPoints: number[] | null;
        selfCheckIn: boolean;
        checkInClosesAt: string | null;
        closed: boolean;
      };
      tookPart: { name: string; team: string | null; checkedIn: boolean }[];
      teamCounts: { team: string; count: number; place: number }[];
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], "participation">;
      };
      participation: null;
      message: string;
    }
  | { found: false; message: string };

/**
 * Serializes a `participation` Competition's `get_participation` answer:
 * its settings, closed state, who took part and, in team scoring, each
 * Team's headcount. Pure: the route resolves the Competition by name and
 * loads `getParticipationView` only when its Format is `participation`.
 * Names only: never an email, an id, a picture or who marked someone.
 */
export function toParticipationResult(
  found: FoundCompetition | undefined,
  view: ParticipationView | undefined,
  name: string,
): ParticipationResult {
  if (!found || (found.format === "participation" && !view)) {
    return { found: false, message: notFoundMessage(name) };
  }
  if (found.format !== "participation" || !view) {
    return {
      found: true,
      competition: {
        name: found.name,
        scoring: found.scoring,
        format: found.format as Exclude<Competition["format"], "participation">,
      },
      participation: null,
      message: `${found.name} isn't run as Participation; call get_games, get_bracket or get_leaderboard.`,
    };
  }

  const { competition, tookPart, teamCounts } = view;
  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      teamScoring:
        competition.participationTeamScoring === "ranked"
          ? "ranked by headcount"
          : competition.participationTeamScoring === "per-person"
            ? "per person"
            : null,
      pointsPerParticipant: competition.participationPoints ?? 0,
      placementPoints: competition.placementPoints,
      selfCheckIn: competition.selfCheckIn,
      checkInClosesAt: competition.checkInClosesAt?.toISOString() ?? null,
      closed: competition.closed,
    },
    tookPart: tookPart.map((row) => ({
      name: row.name,
      team: row.team,
      checkedIn: row.checkedIn,
    })),
    teamCounts: teamCounts.map((row) => ({
      team: row.name,
      count: row.count,
      place: row.place,
    })),
  };
}
