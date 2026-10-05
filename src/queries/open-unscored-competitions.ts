import { and, eq, exists, inArray, isNotNull, isNull, or } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type WarWeek,
  attempt,
  competition,
  leagueMatch,
  participation,
  seriesMatch,
} from "@/db/schema";
import { LOGGED_FORMATS, type LoggedFormat } from "@/lib/enums";

/** An open Head-to-head, Best score, `participation` or League Competition, named in the End War Week warning. */
export type OpenUnscoredCompetition = {
  id: string;
  name: string;
  format: LoggedFormat | "participation" | "league";
};

/**
 * A War Week's open Head-to-head or Best score Competitions with at least
 * one Match or Attempt, open
 * `participation` Competitions with anyone marked, and open Leagues with a
 * Match result (not closed:
 * `closed_at` is null until Close sets it), by name. Used to warn when
 * ending a War Week with Competitions whose points aren't yet in the
 * Standings: they land only on Close.
 */
export async function getOpenUnscoredCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<OpenUnscoredCompetition[]> {
  const rows = await dbOrTx
    .select({
      id: competition.id,
      name: competition.name,
      format: competition.format,
    })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        isNull(competition.closedAt),
        or(
          and(
            inArray(competition.format, [...LOGGED_FORMATS]),
            or(
              exists(
                dbOrTx
                  .select()
                  .from(seriesMatch)
                  .where(eq(seriesMatch.competitionId, competition.id)),
              ),
              exists(
                dbOrTx
                  .select()
                  .from(attempt)
                  .where(eq(attempt.competitionId, competition.id)),
              ),
            ),
          ),
          and(
            eq(competition.format, "league"),
            exists(
              dbOrTx
                .select()
                .from(leagueMatch)
                .where(
                  and(
                    eq(leagueMatch.competitionId, competition.id),
                    isNotNull(leagueMatch.result),
                  ),
                ),
            ),
          ),
          and(
            eq(competition.format, "participation"),
            exists(
              dbOrTx
                .select()
                .from(participation)
                .where(eq(participation.competitionId, competition.id)),
            ),
          ),
        ),
      ),
    )
    .orderBy(competition.name);
  return rows.map((row) => ({
    ...row,
    format: row.format as OpenUnscoredCompetition["format"],
  }));
}
