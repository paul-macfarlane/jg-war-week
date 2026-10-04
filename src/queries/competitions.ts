import { type SQL, and, count, eq, inArray } from "drizzle-orm";
import { type AnyPgColumn, type PgTable } from "drizzle-orm/pg-core";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  WarWeek,
  competition,
  entrant,
  game,
  participation,
  placement,
  pointsEntry,
} from "@/db/schema";
import { hasResults } from "@/lib/bracket/formats";
import { isBracketFormat } from "@/lib/bracket/view";
import { hasResult } from "@/lib/competition-locks";
import {
  type CompetitionStatus,
  bracketRoundInPlay,
  competitionStatus,
} from "@/lib/competition-status";
import {
  type CompetitionListItem,
  groupCompetitions,
} from "@/lib/competitions";
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

/**
 * Finds a War Week's Competition by name for `get_bracket`, with its Format
 * and scoring so the tool can answer a Head-to-head or Best score Competition: an exact name
 * wins; else a case-insensitive (trimmed) name when exactly one Competition
 * has it; else `undefined` (names are unique per War Week only
 * case-sensitively).
 */
export async function getCompetitionByName(
  warWeek: Pick<WarWeek, "id">,
  name: string,
  dbOrTx: DBOrTx = db,
): Promise<
  Pick<Competition, "id" | "name" | "format" | "scoring"> | undefined
> {
  const rows = await dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
      scoring: competition.scoring,
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const exact = rows.find((row) => row.name === name);
  if (exact) return exact;
  const target = name.trim().toLowerCase();
  const sameName = rows.filter(
    (row) => row.name.trim().toLowerCase() === target,
  );
  return sameName.length === 1 ? sameName[0] : undefined;
}

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
    })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id));
  const ids = rows.map((c) => c.id);
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
    games,
    placements,
    checkIns,
    generated,
    brackets,
    generatedEntries,
  ] = await Promise.all([
    countsBy(entrant, entrant.competitionId),
    countsBy(game, game.competitionId),
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
  ]);

  const winnersOf = new Map(
    finalWinners(rows, generatedEntries.map(toResultEntry)).map((final) => [
      final.competition.id,
      // A tie's names in a stable order.
      final.winners.map((w) => w.name).sort((a, b) => a.localeCompare(b)),
    ]),
  );

  const listed = rows.map((row): CompetitionListRow => {
    const bracket = brackets.get(row.id);
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
          games: games.get(row.id) ?? 0,
          placements: placements.get(row.id) ?? 0,
          checkIns: checkIns.get(row.id) ?? 0,
          // Only Brackets have Matches, and `loadBrackets` has them.
          matches: bracket?.matches.length ?? 0,
          matchResult: bracket ? hasResults(bracket) : false,
          generatedPointsEntries: generated.get(row.id) ?? 0,
        }),
        bracketRound: bracket ? bracketRoundInPlay(bracket) : null,
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
