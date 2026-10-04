import {
  and,
  asc,
  countDistinct,
  eq,
  inArray,
  isNotNull,
  sql,
} from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type WarWeek,
  attempt,
  bracketMatch,
  competition,
  finaleSlide,
  participant,
  pointsEntry,
  seriesMatch,
} from "@/db/schema";
import {
  type FinaleCounts,
  type FinaleWinner,
  type ResolvedFinaleSlide,
  resolveFinaleSlides,
  winnersList,
} from "@/lib/finale-slides";
import { resultEntryQuery, toResultEntry } from "@/queries/recent-results";

/** A War Week's saved `finale_slide` rows, in no particular order. */
export async function getFinaleSlideRows(warWeekId: string, dbOrTx: DBOrTx) {
  return dbOrTx
    .select({
      id: finaleSlide.id,
      kind: finaleSlide.kind,
      sortOrder: finaleSlide.sortOrder,
      hidden: finaleSlide.hidden,
      heading: finaleSlide.heading,
      body: finaleSlide.body,
      backgroundColor: finaleSlide.backgroundColor,
    })
    .from(finaleSlide)
    .where(eq(finaleSlide.warWeekId, warWeekId))
    .orderBy(asc(finaleSlide.sortOrder), asc(finaleSlide.id));
}

/**
 * A War Week's Finale slide list, hidden slides included: its saved order,
 * or the default order when nothing is saved (`resolveFinaleSlides`).
 */
export async function getFinaleSlides(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<ResolvedFinaleSlide[]> {
  return resolveFinaleSlides(await getFinaleSlideRows(warWeekId, dbOrTx));
}

/**
 * A War Week's figures for the By the numbers slide (`byTheNumbers` labels
 * and filters them): Competitions with a Points Entry, Matches and Attempts
 * logged, Bracket Matches
 * played, Points Entries (Discretionary points too) and the points they hand out, and the roster.
 */
export async function getFinaleCounts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<FinaleCounts> {
  const ofWarWeek = eq(competition.warWeekId, warWeekId);
  const [[entries], [seriesMatches], [attempts], [matches], [roster]] =
    await Promise.all([
      dbOrTx
        .select({
          competitions: countDistinct(pointsEntry.competitionId),
          entries: sql<number>`count(*)::int`,
          points: sql<string>`coalesce(sum(${pointsEntry.points}), 0)`,
        })
        .from(pointsEntry)
        .where(eq(pointsEntry.warWeekId, warWeekId)),
      dbOrTx
        .select({ n: sql<number>`count(*)::int` })
        .from(seriesMatch)
        .innerJoin(competition, eq(competition.id, seriesMatch.competitionId))
        .where(ofWarWeek),
      dbOrTx
        .select({ n: sql<number>`count(*)::int` })
        .from(attempt)
        .innerJoin(competition, eq(competition.id, attempt.competitionId))
        .where(ofWarWeek),
      dbOrTx
        .select({ n: sql<number>`count(*)::int` })
        .from(bracketMatch)
        .innerJoin(competition, eq(competition.id, bracketMatch.competitionId))
        .where(and(ofWarWeek, eq(bracketMatch.status, "played"))),
      dbOrTx
        .select({ n: sql<number>`count(*)::int` })
        .from(participant)
        .where(eq(participant.warWeekId, warWeekId)),
    ]);
  return {
    competitionsRun: Number(entries?.competitions ?? 0),
    resultsLogged: Number(seriesMatches?.n ?? 0) + Number(attempts?.n ?? 0),
    matchesPlayed: Number(matches?.n ?? 0),
    pointsEntries: Number(entries?.entries ?? 0),
    pointsHandedOut: Number(entries?.points ?? 0),
    participants: Number(roster?.n ?? 0),
  };
}

/**
 * The Winners slide's lines (`winnersList`): every Closed Bracket's and
 * Closed Competition's Winner, uncapped. Reads the Closed Competitions
 * and only their generated Points Entries.
 */
export async function getWinners(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<FinaleWinner[]> {
  const competitions = await dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
      closedAt: competition.closedAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        isNotNull(competition.closedAt),
      ),
    );
  if (competitions.length === 0) return [];
  const entries = await resultEntryQuery(dbOrTx)
    .where(
      and(
        inArray(
          pointsEntry.competitionId,
          competitions.map((c) => c.id),
        ),
        eq(pointsEntry.generated, true),
      ),
    )
    .orderBy(asc(pointsEntry.enteredAt), asc(pointsEntry.id));
  return winnersList(competitions, entries.map(toResultEntry));
}
