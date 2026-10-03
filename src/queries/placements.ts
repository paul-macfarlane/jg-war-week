import { aliasedTable, and, asc, eq, notInArray, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  type WarWeek,
  competition,
  participant,
  placement,
  team,
} from "@/db/schema";
import {
  orderPlacementRows,
  placementPointsByRow,
} from "@/lib/placement/score";
import { isUuid } from "@/lib/uuid";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/** One row of a Placement sheet, by name: never an email. */
export type PlacementRowView = {
  id: string;
  teamId: string | null;
  participantId: string | null;
  /** The Team's name, or the Participant's shown name (ADR 0007). */
  name: string;
  /** A Participant's picture; null for a Team. */
  image: string | null;
  /** A Participant's Team name; null for a Team row or no Team. */
  team: string | null;
  /** The Team's color, or the Participant's Team's color. */
  color: string | null;
  place: number | null;
  score: number | null;
  /** What its Place earns by the Placement Points; null when nothing. */
  points: number | null;
  seedKey: string | null;
};

export type PlacementCompetition = Pick<
  Competition,
  | "id"
  | "warWeekId"
  | "name"
  | "scoring"
  | "countsTowardTeam"
  | "placementPoints"
  | "scoreDirection"
  | "finalizedAt"
>;

export type PlacementsView = {
  competition: PlacementCompetition;
  /** Placed rows by Place (ties by name), then unplaced rows by name. */
  rows: PlacementRowView[];
};

/**
 * A Placement Competition's rows with names (Profile names, ADR 0007) and
 * what each Place earns, ordered for display. Reads within `dbOrTx`, so
 * Finalize reads the rows it locked.
 */
export async function getPlacementRows(
  competitionRow: Pick<Competition, "id" | "placementPoints">,
  dbOrTx: DBOrTx = db,
): Promise<PlacementRowView[]> {
  const participantTeam = aliasedTable(team, "participant_team");
  const rows = await withProfile(
    dbOrTx
      .select({
        id: placement.id,
        teamId: placement.teamId,
        participantId: placement.participantId,
        participantName: participantNameSql(),
        image: participantImageSql(),
        teamName: team.name,
        teamColor: team.color,
        participantTeam: participantTeam.name,
        participantTeamColor: participantTeam.color,
        place: placement.place,
        score: placement.score,
        seedKey: placement.seedKey,
      })
      .from(placement)
      .leftJoin(team, eq(team.id, placement.teamId))
      .leftJoin(participant, eq(participant.id, placement.participantId))
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .$dynamic(),
  ).where(eq(placement.competitionId, competitionRow.id));

  const points = new Map(
    placementPointsByRow(rows, competitionRow).map((r) => [r.id, r.points]),
  );
  return orderPlacementRows(
    rows.map((r): PlacementRowView => ({
      id: r.id,
      teamId: r.teamId,
      participantId: r.participantId,
      name: (r.teamId ? r.teamName : r.participantName) ?? "Unknown",
      image: r.teamId ? null : r.image,
      team: r.teamId ? null : r.participantTeam,
      color: r.teamId ? r.teamColor : r.participantTeamColor,
      place: r.place,
      score: r.score,
      points: points.get(r.id) ?? null,
      seedKey: r.seedKey,
    })),
  );
}

/**
 * A Placement Competition and its rows, for its sheet, its page and MCP.
 * Undefined for a malformed or unknown id or another Format.
 */
export async function getPlacementsView(
  competitionId: string,
  dbOrTx: DBOrTx = db,
): Promise<PlacementsView | undefined> {
  if (!isUuid(competitionId)) return undefined;
  const [found] = await dbOrTx
    .select({
      id: competition.id,
      warWeekId: competition.warWeekId,
      name: competition.name,
      format: competition.format,
      scoring: competition.scoring,
      countsTowardTeam: competition.countsTowardTeam,
      placementPoints: competition.placementPoints,
      scoreDirection: competition.scoreDirection,
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(eq(competition.id, competitionId))
    .limit(1);
  if (!found || found.format !== "placement") return undefined;
  return {
    competition: {
      id: found.id,
      warWeekId: found.warWeekId,
      name: found.name,
      scoring: found.scoring,
      countsTowardTeam: found.countsTowardTeam,
      placementPoints: found.placementPoints,
      scoreDirection: found.scoreDirection,
      finalizedAt: found.finalizedAt,
    },
    rows: await getPlacementRows(found, dbOrTx),
  };
}

/** Who the sheet's search can add: a Team, or a Participant with their Team. */
export type PlacementCandidate = {
  id: string;
  name: string;
  team: string | null;
};

/**
 * The War Week's Teams (team scoring) or Participants (individual), by
 * name, that aren't on this Competition's sheet yet.
 */
export async function getPlacementCandidates(
  warWeek: Pick<WarWeek, "id">,
  competitionRow: Pick<Competition, "id" | "scoring">,
  dbOrTx: DBOrTx = db,
): Promise<PlacementCandidate[]> {
  if (competitionRow.scoring === "team") {
    const placed = dbOrTx
      .select({ id: sql`${placement.teamId}` })
      .from(placement)
      .where(
        and(
          eq(placement.competitionId, competitionRow.id),
          sql`${placement.teamId} is not null`,
        ),
      );
    const teams = await dbOrTx
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(and(eq(team.warWeekId, warWeek.id), notInArray(team.id, placed)))
      .orderBy(asc(team.name));
    return teams.map((t) => ({ ...t, team: null }));
  }
  const participantTeam = aliasedTable(team, "participant_team");
  const placed = dbOrTx
    .select({ id: sql`${placement.participantId}` })
    .from(placement)
    .where(
      and(
        eq(placement.competitionId, competitionRow.id),
        sql`${placement.participantId} is not null`,
      ),
    );
  return withProfile(
    dbOrTx
      .select({
        id: participant.id,
        name: participantNameSql(),
        team: participantTeam.name,
      })
      .from(participant)
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .$dynamic(),
  )
    .where(
      and(
        eq(participant.warWeekId, warWeek.id),
        notInArray(participant.id, placed),
      ),
    )
    .orderBy(asc(participantNameSql()), asc(participant.id));
}
