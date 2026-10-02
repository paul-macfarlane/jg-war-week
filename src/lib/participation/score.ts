/**
 * Scoring a `participation` Competition at Close (CONTEXT.md, Participation
 * rules): the Points Entries its took-part list turns into. Pure, so the
 * Close mutation and the tests share one rule.
 */
import type { Competition } from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";

/** A Participant who took part, with their Team at Close (null for none). */
export type TookPart = { participantId: string; teamId: string | null };

/** A Points Entry draft: to the Team or to the Participant. */
export type ParticipationPoints = {
  teamId: string | null;
  participantId: string | null;
  points: number;
};

export type ParticipationScoring = Pick<
  Competition,
  | "scoring"
  | "placementPoints"
  | "participationPoints"
  | "participationTeamScoring"
>;

/** A Team's headcount and its place: ties share the higher place. */
export type TeamHeadcount = { teamId: string; count: number; place: number };

/**
 * Each Team's headcount among those who took part, most first (ties by
 * Team id, for a stable order), with its place by standard competition
 * ranking (3, 3, 1 → 1, 1, 3). A Participant with no Team counts for none;
 * a Team with nobody isn't listed.
 */
export function teamHeadcounts(tookPart: TookPart[]): TeamHeadcount[] {
  const counts = new Map<string, number>();
  for (const { teamId } of tookPart) {
    if (teamId) counts.set(teamId, (counts.get(teamId) ?? 0) + 1);
  }
  const rows = [...counts]
    .map(([teamId, count]) => ({ teamId, count }))
    .sort((a, b) => b.count - a.count || a.teamId.localeCompare(b.teamId));
  return rows.map((row) => ({
    ...row,
    place: rows.findIndex((r) => r.count === row.count) + 1,
  }));
}

/** Points to the cent, as `points_entry.points` stores them. */
const cents = (points: number) => Math.round(points * 100) / 100;

/**
 * The Points Entries a Close writes:
 * - individual: N to each Participant who took part;
 * - team, ranked by headcount: each Team's place's Placement Points (ties
 *   each get that place's points; places without Placement Points get
 *   nothing; `pointsFor`, the Bracket and Games rule);
 * - team, per person: N × headcount to each Team.
 */
export function scoreParticipation(
  tookPart: TookPart[],
  competition: ParticipationScoring,
): ParticipationPoints[] {
  const n = competition.participationPoints ?? 0;
  if (competition.scoring === "individual") {
    return tookPart.map(({ participantId }) => ({
      teamId: null,
      participantId,
      points: n,
    }));
  }
  const headcounts = teamHeadcounts(tookPart);
  if (competition.participationTeamScoring === "per-person") {
    return headcounts.map(({ teamId, count }) => ({
      teamId,
      participantId: null,
      points: cents(n * count),
    }));
  }
  return pointsFor(
    headcounts.map(({ teamId, place }) => ({ entrantId: teamId, place })),
    competition,
  ).map(({ entrantId, points }) => ({
    teamId: entrantId,
    participantId: null,
    points,
  }));
}
