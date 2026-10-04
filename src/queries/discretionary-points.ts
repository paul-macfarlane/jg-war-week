import { aliasedTable, and, eq, isNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { WarWeek, participant, pointsEntry, team, warWeek } from "@/db/schema";
import {
  type DiscretionaryLedgerEntry,
  buildDiscretionaryLedger,
  discretionaryAllowsTeams,
} from "@/lib/discretionary-points";
import type { PointsEntryTargetKind } from "@/lib/points-entry";
import { participantNameSql, withProfile } from "@/queries/profile-join";

/**
 * Every Discretionary points entry of a War Week (a Points Entry with no
 * Competition), newest first, with its target's name.
 */
export async function getDiscretionaryLedger(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<DiscretionaryLedgerEntry[]> {
  const participantTeam = aliasedTable(team, "participant_team");
  const rows = await withProfile(
    dbOrTx
      .select({
        id: pointsEntry.id,
        teamId: pointsEntry.teamId,
        participantId: pointsEntry.participantId,
        teamName: team.name,
        participantName: participantNameSql(),
        participantTeamName: participantTeam.name,
        participantTeamColor: participantTeam.color,
        points: pointsEntry.points,
        note: pointsEntry.note,
        enteredByEmail: pointsEntry.enteredByEmail,
        enteredAt: pointsEntry.enteredAt,
        createdAt: pointsEntry.createdAt,
        updatedAt: pointsEntry.updatedAt,
      })
      .from(pointsEntry)
      .leftJoin(team, eq(team.id, pointsEntry.teamId))
      .leftJoin(participant, eq(participant.id, pointsEntry.participantId))
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .$dynamic(),
  ).where(
    and(
      eq(pointsEntry.warWeekId, warWeek.id),
      isNull(pointsEntry.competitionId),
    ),
  );
  return buildDiscretionaryLedger(rows);
}

/**
 * Whether `targetId` is a Team or a Participant of this War Week, or
 * neither (including one from another War Week). A free-for-all War Week has
 * no Teams to give points to (`discretionaryAllowsTeams`), so a Team's id
 * there is neither.
 */
export async function getTargetKind(
  warWeekId: string,
  targetId: string,
  dbOrTx: DBOrTx = db,
): Promise<PointsEntryTargetKind | null> {
  const [week] = await dbOrTx
    .select({ mode: warWeek.mode })
    .from(warWeek)
    .where(eq(warWeek.id, warWeekId));
  if (!week) return null;
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
  if (teams.length > 0 && discretionaryAllowsTeams(week.mode)) return "team";
  if (participants.length > 0) return "participant";
  return null;
}
