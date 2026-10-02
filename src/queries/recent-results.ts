import { aliasedTable, and, desc, eq, inArray } from "drizzle-orm";

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
 * The most manual Points Entries Home reads: far more than the newest
 * `RECENT_RESULTS_LIMIT` rows' groups need, so the War Week's whole ledger
 * isn't loaded for five rows.
 */
const MANUAL_ENTRY_LIMIT = 200;

/**
 * A War Week's Recent results for Home, newest first (shaping rules in
 * `shapeRecentResults`). Reads the newest manual Points Entries and the
 * generated ones of only the newest finalized Competitions: the rest
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
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const newestFinalized = competitions
    .flatMap((c) =>
      c.finalizedAt && c.format !== "points"
        ? [{ id: c.id, at: c.finalizedAt.getTime() }]
        : [],
    )
    .sort((a, b) => b.at - a.at)
    .slice(0, RECENT_RESULTS_LIMIT)
    .map((c) => c.id);

  const entries = () => resultEntryQuery(dbOrTx);
  const [manual, generated] = await Promise.all([
    entries()
      .where(
        and(
          eq(competition.warWeekId, warWeek.id),
          eq(pointsEntry.generatedByBracket, false),
        ),
      )
      .orderBy(desc(pointsEntry.enteredAt))
      .limit(MANUAL_ENTRY_LIMIT),
    newestFinalized.length > 0
      ? entries().where(
          and(
            inArray(pointsEntry.competitionId, newestFinalized),
            eq(pointsEntry.generatedByBracket, true),
          ),
        )
      : Promise.resolve([]),
  ]);

  const shaped = [...manual, ...generated].map(toResultEntry);
  return shapeRecentResults(competitions, shaped);
}

/**
 * Points Entries with who each is for, as Recent results and the Finale's
 * Champions read them: a query to add `where`, `orderBy` and `limit` to.
 */
export function resultEntryQuery(dbOrTx: DBOrTx) {
  const participantTeam = aliasedTable(team, "participant_team");
  return withProfile(
    dbOrTx
      .select({
        id: pointsEntry.id,
        competitionId: pointsEntry.competitionId,
        points: pointsEntry.points,
        enteredAt: pointsEntry.enteredAt,
        generatedByBracket: pointsEntry.generatedByBracket,
        teamId: pointsEntry.teamId,
        participantId: pointsEntry.participantId,
        teamName: team.name,
        teamColor: team.color,
        participantName: participantNameSql(),
        participantImage: participantImageSql(),
        participantTeamColor: participantTeam.color,
      })
      .from(pointsEntry)
      .innerJoin(competition, eq(competition.id, pointsEntry.competitionId))
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
    enteredAt: r.enteredAt,
    generatedByBracket: r.generatedByBracket,
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
        },
  };
}
