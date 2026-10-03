import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  WarWeek,
  competition,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import { PointsBreakdown, buildPointsBreakdown } from "@/lib/points-breakdown";
import { Standings, computeStandings } from "@/lib/standings";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/**
 * Loads a War Week's Standings, the same rows for Participants, Organizers,
 * MCP and the Finale.
 */
export async function getStandings(
  warWeek: Pick<WarWeek, "id" | "mode">,
  dbOrTx: DBOrTx = db,
): Promise<Standings> {
  const [teams, participants, competitions, pointsEntries] = await Promise.all([
    dbOrTx
      .select({ id: team.id, name: team.name, color: team.color })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id)),
    withProfile(
      dbOrTx
        .select({
          id: participant.id,
          displayName: participantNameSql(),
          image: participantImageSql(),
          teamId: participant.teamId,
        })
        .from(participant)
        .$dynamic(),
    ).where(eq(participant.warWeekId, warWeek.id)),
    dbOrTx
      .select({
        id: competition.id,
        scoring: competition.scoring,
        countsTowardTeam: competition.countsTowardTeam,
      })
      .from(competition)
      .where(eq(competition.warWeekId, warWeek.id)),
    dbOrTx
      .select({
        competitionId: pointsEntry.competitionId,
        teamId: pointsEntry.teamId,
        participantId: pointsEntry.participantId,
        points: pointsEntry.points,
      })
      .from(pointsEntry)
      .where(eq(pointsEntry.warWeekId, warWeek.id)),
  ]);

  return computeStandings({
    mode: warWeek.mode,
    teams,
    participants,
    competitions,
    pointsEntries,
  });
}

/**
 * The Points Entries behind every Standings total, for the row disclosures
 * on the leaderboard and home page. Mirrors `getStandings`'s scope: every
 * entry of the War Week, Discretionary points included.
 */
export async function getPointsBreakdown(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<PointsBreakdown> {
  const [teams, participants, competitions, pointsEntries] = await Promise.all([
    dbOrTx
      .select({ id: team.id })
      .from(team)
      .where(eq(team.warWeekId, warWeek.id)),
    dbOrTx
      .select({ id: participant.id, teamId: participant.teamId })
      .from(participant)
      .where(eq(participant.warWeekId, warWeek.id)),
    dbOrTx
      .select({
        id: competition.id,
        name: competition.name,
        scoring: competition.scoring,
        countsTowardTeam: competition.countsTowardTeam,
      })
      .from(competition)
      .where(eq(competition.warWeekId, warWeek.id)),
    dbOrTx
      .select({
        id: pointsEntry.id,
        competitionId: pointsEntry.competitionId,
        teamId: pointsEntry.teamId,
        participantId: pointsEntry.participantId,
        points: pointsEntry.points,
        note: pointsEntry.note,
        enteredAt: pointsEntry.enteredAt,
      })
      .from(pointsEntry)
      .where(eq(pointsEntry.warWeekId, warWeek.id)),
  ]);

  return buildPointsBreakdown({
    teams,
    participants,
    competitions,
    pointsEntries,
  });
}
