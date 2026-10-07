import { type SQL, and, count, eq, inArray } from "drizzle-orm";
import { type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  WarWeek,
  attempt,
  competition,
  entrant,
  leagueMatch,
  participation,
  placement,
  pointsEntry,
  seriesMatch,
} from "@/db/schema";
import { hasResults } from "@/lib/bracket/formats";
import { isBracketFormat } from "@/lib/bracket/view";
import { hasResult } from "@/lib/competition-locks";
import {
  type CompetitionStatus,
  bracketRoundInPlay,
  competitionStatus,
  leagueRoundInPlay,
} from "@/lib/competition-status";
import {
  type CompetitionListItem,
  groupCompetitions,
} from "@/lib/competitions";
import { leagueConfigOf } from "@/lib/league/config";
import { finalWinners } from "@/lib/recent-results";
import { isUuid } from "@/lib/uuid";
import { loadBrackets } from "@/queries/brackets";
import { resultEntryQuery, toResultEntry } from "@/queries/recent-results";

const competitionColumns = {
  id: competition.id,
  name: competition.name,
  description: competition.description,
  scoring: competition.scoring,
  countsTowardTeam: competition.countsTowardTeam,
  competitionGroup: competition.competitionGroup,
  format: competition.format,
} satisfies Record<keyof CompetitionListItem, unknown>;

/** A Competitions list row: the Competition and its status. */
export type CompetitionListRow = CompetitionListItem & {
  status: CompetitionStatus;
};

/**
 * Loads a War Week's Competitions, grouped by `groupCompetitions`, each
 * with its status (`competitionStatus`). The facts come in one batch per
 * War Week, never a query per Competition: what each has entered (as
 * `hasResult` reads it), the Brackets' Matches, and the generated Points
 * Entries of the closed ones, whose winners `finalWinners` names.
 */
export async function getCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
) {
  const rows = await dbOrTx
    .select({
      ...competitionColumns,
      closedAt: competition.closedAt,
      bracketConfig: competition.bracketConfig,
      leagueConfig: competition.leagueConfig,
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const ids = rows.map((c) => c.id);
  const leagueIds = rows.flatMap((c) => (c.format === "league" ? [c.id] : []));
  const closedIds = rows.flatMap((c) => (c.closedAt ? [c.id] : []));

  /** How many rows of `table` each Competition has, by Competition id. */
  const countsBy = async (
    table: PgTable,
    competitionId: AnyPgColumn,
    where?: SQL,
  ): Promise<Map<string, number>> => {
    if (ids.length === 0) return new Map();
    const counts = await dbOrTx
      .select({ id: competitionId, n: count() })
      .from(table)
      .where(and(inArray(competitionId, ids), where))
      .groupBy(competitionId);
    return new Map(counts.map((r) => [String(r.id), r.n]));
  };

  const [
    entrants,
    matches,
    attempts,
    placements,
    checkIns,
    generated,
    brackets,
    generatedEntries,
    leagueMatches,
  ] = await Promise.all([
    countsBy(entrant, entrant.competitionId),
    countsBy(seriesMatch, seriesMatch.competitionId),
    countsBy(attempt, attempt.competitionId),
    countsBy(placement, placement.competitionId),
    countsBy(participation, participation.competitionId),
    countsBy(
      pointsEntry,
      pointsEntry.competitionId,
      eq(pointsEntry.generated, true),
    ),
    loadBrackets(
      rows.filter((c) => isBracketFormat(c.format)),
      dbOrTx,
    ),
    closedIds.length > 0
      ? resultEntryQuery(dbOrTx).where(
          and(
            inArray(pointsEntry.competitionId, closedIds),
            eq(pointsEntry.generated, true),
          ),
        )
      : Promise.resolve([]),
    leagueIds.length > 0
      ? dbOrTx
          .select({
            competitionId: leagueMatch.competitionId,
            round: leagueMatch.round,
            b: leagueMatch.entrantBId,
            result: leagueMatch.result,
          })
          .from(leagueMatch)
          .where(inArray(leagueMatch.competitionId, leagueIds))
      : Promise.resolve([]),
  ]);
  const leagueMatchesOf = (id: string) =>
    leagueMatches.filter((m) => m.competitionId === id);

  const winnersOf = new Map(
    finalWinners(rows, generatedEntries.map(toResultEntry)).map((final) => [
      final.competition.id,
      // A tie's names in a stable order.
      final.winners.map((w) => w.name).sort((a, b) => a.localeCompare(b)),
    ]),
  );

  const listed = rows.map((row): CompetitionListRow => {
    const bracket = brackets.get(row.id);
    const league = row.format === "league" ? leagueMatchesOf(row.id) : [];
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      scoring: row.scoring,
      countsTowardTeam: row.countsTowardTeam,
      competitionGroup: row.competitionGroup,
      format: row.format,
      status: competitionStatus({
        format: row.format,
        scoring: row.scoring,
        closed: row.closedAt !== null,
        hasResult: hasResult({
          entrants: entrants.get(row.id) ?? 0,
          logged: (matches.get(row.id) ?? 0) + (attempts.get(row.id) ?? 0),
          placements: placements.get(row.id) ?? 0,
          checkIns: checkIns.get(row.id) ?? 0,
          // Only Brackets have Matches, and `loadBrackets` has them.
          matches: bracket?.matches.length ?? 0,
          matchResult: bracket ? hasResults(bracket) : false,
          leagueMatches: league.length,
          leagueResult: league.some((m) => m.result !== null),
          generatedPointsEntries: generated.get(row.id) ?? 0,
        }),
        bracketRound: bracket ? bracketRoundInPlay(bracket) : null,
        leagueRound:
          row.format === "league"
            ? leagueRoundInPlay(
                leagueConfigOf(row),
                entrants.get(row.id) ?? 0,
                league,
              )
            : null,
        winners: winnersOf.get(row.id) ?? [],
      }),
    };
  });
  return groupCompetitions(listed);
}

/**
 * Loads one Competition of a War Week. Returns `undefined` when `id` is not
 * a Competition of this War Week.
 */
export async function getCompetition(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<CompetitionListItem | undefined> {
  if (!isUuid(id)) return undefined;
  const [found] = await dbOrTx
    .select(competitionColumns)
    .from(competition)
    .where(and(eq(competition.id, id), eq(competition.warWeekId, warWeek.id)))
    .limit(1);
  return found;
}
