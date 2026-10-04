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
  competition,
  finaleSlide,
  game,
  heat,
  participant,
  pointsEntry,
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
 * and filters them): Competitions with a Points Entry, Games logged, Heats
 * played, Points Entries (Discretionary points too) and the points they hand out, and the roster.
 */
export async function getFinaleCounts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<FinaleCounts> {
  const ofWarWeek = eq(competition.warWeekId, warWeekId);
  const [[entries], [games], [heats], [roster]] = await Promise.all([
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
      .from(game)
      .innerJoin(competition, eq(competition.id, game.competitionId))
      .where(ofWarWeek),
    dbOrTx
      .select({ n: sql<number>`count(*)::int` })
      .from(heat)
      .innerJoin(competition, eq(competition.id, heat.competitionId))
      .where(and(ofWarWeek, eq(heat.status, "played"))),
    dbOrTx
      .select({ n: sql<number>`count(*)::int` })
      .from(participant)
      .where(eq(participant.warWeekId, warWeekId)),
  ]);
  return {
    competitionsRun: Number(entries?.competitions ?? 0),
    gamesLogged: Number(games?.n ?? 0),
    heatsPlayed: Number(heats?.n ?? 0),
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
      finalizedAt: competition.finalizedAt,
    })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        isNotNull(competition.finalizedAt),
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
        eq(pointsEntry.generatedByBracket, true),
      ),
    )
    .orderBy(asc(pointsEntry.enteredAt), asc(pointsEntry.id));
  return winnersList(competitions, entries.map(toResultEntry));
}
