import { and, asc, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  WarWeek,
  competition,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  type AdminLedgerEntry,
  type PointsEntryTargetKind,
  buildAdminLedger,
  isPointsEntryId,
} from "@/lib/points-entry";

export type PointsEntryFormCompetition = {
  id: string;
  name: string;
  scoring: "team" | "individual";
  maxPoints: number | null;
  placementPoints: number[] | null;
};

export type PointsEntryFormTarget = {
  id: string;
  name: string;
  /** A Participant's Team name; null for Teams and unassigned Participants. */
  team: string | null;
};

export type PointsEntryFormOptions = {
  competitions: PointsEntryFormCompetition[];
  teams: PointsEntryFormTarget[];
  participants: PointsEntryFormTarget[];
};

const participantTeam = alias(team, "participant_team");

/**
 * Everything the Points Entry form offers: every Competition of the War Week
 * (scheduled or not) and its Teams and Participants, each by name.
 */
export async function getPointsEntryFormOptions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<PointsEntryFormOptions> {
  const [competitions, teams, participants] = await Promise.all([
    dbOrTx
      .select({
        id: competition.id,
        name: competition.name,
        scoring: competition.scoring,
        maxPoints: competition.maxPoints,
        placementPoints: competition.placementPoints,
      })
      .from(competition)
      .where(eq(competition.warWeekId, warWeek.id))
      .orderBy(asc(competition.name)),
    dbOrTx
      .select({ id: team.id, name: team.name })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id))
      .orderBy(asc(team.name)),
    dbOrTx
      .select({
        id: participant.id,
        name: participant.displayName,
        team: participantTeam.name,
      })
      .from(participant)
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .where(eq(participant.warWeekId, warWeek.id))
      .orderBy(asc(participant.displayName)),
  ]);

  return {
    competitions,
    teams: teams.map((t) => ({ ...t, team: null })),
    participants,
  };
}

/** Every Points Entry of a War Week for the admin ledger, newest first. */
export async function getAdminLedger(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AdminLedgerEntry[]> {
  const rows = await dbOrTx
    .select({
      id: pointsEntry.id,
      competition: competition.name,
      competitionId: competition.id,
      teamName: team.name,
      participantName: participant.displayName,
      points: pointsEntry.points,
      note: pointsEntry.note,
      enteredByEmail: pointsEntry.enteredByEmail,
      enteredAt: pointsEntry.enteredAt,
      createdAt: pointsEntry.createdAt,
      updatedAt: pointsEntry.updatedAt,
      generatedByBracket: pointsEntry.generatedByBracket,
    })
    .from(pointsEntry)
    .innerJoin(competition, eq(competition.id, pointsEntry.competitionId))
    .leftJoin(team, eq(team.id, pointsEntry.teamId))
    .leftJoin(participant, eq(participant.id, pointsEntry.participantId))
    .where(eq(competition.warWeekId, warWeek.id));
  return buildAdminLedger(rows);
}

/** One Points Entry of a War Week, for the edit form. */
export async function getPointsEntryForEdit(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
) {
  if (!isPointsEntryId(id)) return undefined;
  const [found] = await dbOrTx
    .select({
      id: pointsEntry.id,
      competitionId: pointsEntry.competitionId,
      targetId: sql<string>`coalesce(${pointsEntry.teamId}, ${pointsEntry.participantId})`,
      points: pointsEntry.points,
      note: pointsEntry.note,
      enteredByEmail: pointsEntry.enteredByEmail,
    })
    .from(pointsEntry)
    .innerJoin(competition, eq(competition.id, pointsEntry.competitionId))
    .where(and(eq(pointsEntry.id, id), eq(competition.warWeekId, warWeek.id)))
    .limit(1);
  return found;
}

/** One Competition of a War Week, with what the target rule needs. */
export async function getCompetitionInWarWeek(
  warWeekId: string,
  competitionId: string,
  dbOrTx: DBOrTx = db,
) {
  const [found] = await dbOrTx
    .select({ name: competition.name, scoring: competition.scoring })
    .from(competition)
    .where(
      and(
        eq(competition.id, competitionId),
        eq(competition.warWeekId, warWeekId),
      ),
    )
    .limit(1);
  return found;
}

/**
 * Whether `targetId` is a Team or a Participant of this War Week, or
 * neither (including one from another War Week).
 */
export async function getTargetKind(
  warWeekId: string,
  targetId: string,
  dbOrTx: DBOrTx = db,
): Promise<PointsEntryTargetKind | null> {
  const [teams, participants] = await Promise.all([
    dbOrTx
      .select({ id: team.id })
      .from(team)
      .where(and(eq(team.id, targetId), eq(team.warWeekId, warWeekId))),
    dbOrTx
      .select({ id: participant.id })
      .from(participant)
      .where(
        and(eq(participant.id, targetId), eq(participant.warWeekId, warWeekId)),
      ),
  ]);
  if (teams.length > 0) return "team";
  if (participants.length > 0) return "participant";
  return null;
}
