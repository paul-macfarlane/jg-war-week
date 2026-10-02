import { aliasedTable, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  WarWeek,
  competition,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  type RecentResult,
  type ResultEntry,
  shapeRecentResults,
} from "@/lib/recent-results";

/**
 * A War Week's Recent results for Home, newest first (shaping rules in
 * `shapeRecentResults`).
 */
export async function getRecentResults(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<RecentResult[]> {
  const participantTeam = aliasedTable(team, "participant_team");
  const [competitions, rows] = await Promise.all([
    dbOrTx
      .select({
        id: competition.id,
        name: competition.name,
        format: competition.format,
        finalizedAt: competition.finalizedAt,
      })
      .from(competition)
      .where(eq(competition.warWeekId, warWeek.id)),
    dbOrTx
      .select({
        id: pointsEntry.id,
        competitionId: pointsEntry.competitionId,
        points: pointsEntry.points,
        enteredAt: pointsEntry.enteredAt,
        generatedByBracket: pointsEntry.generatedByBracket,
        teamName: team.name,
        teamColor: team.color,
        participantName: participant.displayName,
        participantTeamColor: participantTeam.color,
      })
      .from(pointsEntry)
      .innerJoin(competition, eq(competition.id, pointsEntry.competitionId))
      .leftJoin(team, eq(team.id, pointsEntry.teamId))
      .leftJoin(participant, eq(participant.id, pointsEntry.participantId))
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .where(eq(competition.warWeekId, warWeek.id)),
  ]);

  const entries: ResultEntry[] = rows.map((r) => ({
    id: r.id,
    competitionId: r.competitionId,
    points: r.points,
    enteredAt: r.enteredAt,
    generatedByBracket: r.generatedByBracket,
    target: r.teamName
      ? { kind: "team", name: r.teamName, color: r.teamColor }
      : {
          kind: "participant",
          name: r.participantName ?? "Unknown",
          color: r.participantTeamColor,
        },
  }));
  return shapeRecentResults(competitions, entries);
}
