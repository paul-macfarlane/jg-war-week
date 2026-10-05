import { aliasedTable, and, desc, eq, inArray, isNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  WarWeek,
  competition,
  participant,
  pointsEntry,
  team,
} from "@/db/schema";
import {
  RECENT_RESULTS_LIMIT,
  type RecentResult,
  type ResultEntry,
  shapeRecentResults,
} from "@/lib/recent-results";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/**
 * A War Week's Recent results for Home, newest first (shaping rules in
 * `shapeRecentResults`). Reads the newest Discretionary entries and the
 * generated ones of only the newest closed Competitions: the rest
 * can't reach the newest `RECENT_RESULTS_LIMIT` rows.
 */
export async function getRecentResults(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<RecentResult[]> {
  const competitions = await dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
      closedAt: competition.closedAt,
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const newestClosed = competitions
    .flatMap((c) =>
      c.closedAt ? [{ id: c.id, at: c.closedAt.getTime() }] : [],
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENT_RESULTS_LIMIT)
    .map((c) => c.id);

  const entries = () => resultEntryQuery(dbOrTx);
  const [discretionary, generated] = await Promise.all([
    entries()
      .where(
        and(
          eq(pointsEntry.warWeekId, warWeek.id),
          isNull(pointsEntry.competitionId),
        ),
      )
      .orderBy(desc(pointsEntry.enteredAt))
      .limit(RECENT_RESULTS_LIMIT),
    newestClosed.length > 0
      ? entries().where(
          and(
            inArray(pointsEntry.competitionId, newestClosed),
            eq(pointsEntry.generated, true),
          ),
        )
      : Promise.resolve([]),
  ]);

  const shaped = [...discretionary, ...generated].map(toResultEntry);
  return shapeRecentResults(competitions, shaped);
}

/**
 * Points Entries (Discretionary ones included: no Competition) with who each
 * is for, as Recent results and the Finale's Winners slide read them: a query to add `where`, `orderBy` and `limit` to.
 */
export function resultEntryQuery(dbOrTx: DBOrTx) {
  const participantTeam = aliasedTable(team, "participant_team");
  return withProfile(
    dbOrTx
      .select({
        id: pointsEntry.id,
        competitionId: pointsEntry.competitionId,
        points: pointsEntry.points,
        note: pointsEntry.note,
        enteredAt: pointsEntry.enteredAt,
        generated: pointsEntry.generated,
        teamId: pointsEntry.teamId,
        participantId: pointsEntry.participantId,
        teamName: team.name,
        teamColor: team.color,
        participantName: participantNameSql(),
        participantImage: participantImageSql(),
        participantTeamColor: participantTeam.color,
        participantTeamName: participantTeam.name,
      })
      .from(pointsEntry)
      .leftJoin(team, eq(team.id, pointsEntry.teamId))
      .leftJoin(participant, eq(participant.id, pointsEntry.participantId))
      .leftJoin(participantTeam, eq(participantTeam.id, participant.teamId))
      .$dynamic(),
  );
}

/** A `resultEntryQuery` row as `shapeRecentResults` and `finalWinners` read it. */
export function toResultEntry(
  r: Awaited<ReturnType<typeof resultEntryQuery>>[number],
): ResultEntry {
  return {
    id: r.id,
    competitionId: r.competitionId,
    points: r.points,
    note: r.note,
    enteredAt: r.enteredAt,
    generated: r.generated,
    target: r.teamId
      ? {
          kind: "team",
          id: r.teamId,
          name: r.teamName ?? "Unknown",
          image: null,
          color: r.teamColor,
        }
      : {
          kind: "participant",
          id: r.participantId ?? r.id,
          name: r.participantName ?? "Unknown",
          image: r.participantImage,
          color: r.participantTeamColor,
          teamName: r.participantTeamName,
        },
  };
}
