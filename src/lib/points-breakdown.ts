import type { Competition, Participant, PointsEntry, Team } from "@/db/schema";
import { discretionaryLabel } from "@/lib/discretionary-points";

export type BreakdownTeam = Pick<Team, "id">;
export type BreakdownParticipant = Pick<Participant, "id" | "teamId">;
export type BreakdownCompetition = Pick<
  Competition,
  "id" | "name" | "scoring" | "countsTowardTeam"
>;
export type BreakdownPointsEntry = Pick<
  PointsEntry,
  "id" | "competitionId" | "teamId" | "participantId" | "points" | "enteredAt"
> &
  // A Discretionary entry's reason; absent where the caller has none.
  Partial<Pick<PointsEntry, "note">>;

export type PointsBreakdownInput = {
  teams: BreakdownTeam[];
  participants: BreakdownParticipant[];
  competitions: BreakdownCompetition[];
  pointsEntries: BreakdownPointsEntry[];
};

/** One Points Entry as shown behind a Standings row. */
export type PointsBreakdownRow = {
  id: string;
  competition: string;
  points: number;
  when: Date;
};

export type PointsBreakdown = {
  byParticipant: Map<string, PointsBreakdownRow[]>;
  byTeam: Map<string, PointsBreakdownRow[]>;
};

/**
 * The Points Entries behind every Standings total, newest first. Mirrors
 * `computeStandings`'s counting rule exactly, so each row's sum equals the
 * Standings total for the same id:
 *
 * - A Team's breakdown: entries targeting the Team directly, plus entries
 *   targeting its Participants in individual Competitions with Counts
 *   Toward Team on, plus Discretionary points targeting its Participants.
 * - A Participant's breakdown: entries targeting the Participant directly
 *   in individual Competitions, plus Discretionary points.
 */
export function buildPointsBreakdown(
  input: PointsBreakdownInput,
): PointsBreakdown {
  const teams = new Set(input.teams.map((t) => t.id));
  const competitions = new Map(input.competitions.map((c) => [c.id, c]));
  const participants = new Map(input.participants.map((p) => [p.id, p]));

  const byParticipant = new Map<string, PointsBreakdownRow[]>();
  const byTeam = new Map<string, PointsBreakdownRow[]>();

  const push = (
    map: Map<string, PointsBreakdownRow[]>,
    id: string,
    row: PointsBreakdownRow,
  ) => {
    const rows = map.get(id);
    if (rows) rows.push(row);
    else map.set(id, [row]);
  };

  for (const entry of input.pointsEntries) {
    // No Competition: Discretionary points, labelled by their reason.
    const discretionary = entry.competitionId === null;
    const competition = discretionary
      ? undefined
      : competitions.get(entry.competitionId!);
    if (!discretionary && !competition) continue;
    const row: PointsBreakdownRow = {
      id: entry.id,
      competition: discretionary
        ? discretionaryLabel(entry.note ?? null)
        : competition!.name,
      points: entry.points,
      when: entry.enteredAt,
    };

    if (entry.teamId) {
      if (teams.has(entry.teamId)) push(byTeam, entry.teamId, row);
      continue;
    }

    const participant = entry.participantId
      ? participants.get(entry.participantId)
      : undefined;
    if (!participant) continue;
    if (!discretionary && competition!.scoring !== "individual") continue;

    push(byParticipant, participant.id, row);
    if (
      (discretionary || competition!.countsTowardTeam) &&
      participant.teamId &&
      teams.has(participant.teamId)
    ) {
      push(byTeam, participant.teamId, row);
    }
  }

  const sortNewestFirst = (rows: PointsBreakdownRow[]) =>
    [...rows].sort(
      (a, b) => b.when.getTime() - a.when.getTime() || a.id.localeCompare(b.id),
    );

  for (const [id, rows] of byParticipant)
    byParticipant.set(id, sortNewestFirst(rows));
  for (const [id, rows] of byTeam) byTeam.set(id, sortNewestFirst(rows));

  return { byParticipant, byTeam };
}
