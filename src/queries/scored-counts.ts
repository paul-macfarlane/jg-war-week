import { and, count, eq, isNotNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  attempt,
  bracketMatch,
  competition,
  leagueMatch,
  pointsEntry,
  seriesMatch,
} from "@/db/schema";
import type { ScoredCounts } from "@/lib/war-week-lifecycle";

/**
 * What has been scored in a War Week, for Unstart: its Points Entries, its
 * Match results (a Bracket Match that is `played`, a League Match with a
 * result) and its logged Matches and Attempts, all
 * through the War Week's Competitions.
 */
export async function getScoredCounts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<ScoredCounts> {
  const [[points], [matches], [seriesMatches], [attempts], [league]] =
    await Promise.all([
      dbOrTx
        .select({ n: count() })
        .from(pointsEntry)
        .where(eq(pointsEntry.warWeekId, warWeekId)),
      dbOrTx
        .select({ n: count() })
        .from(bracketMatch)
        .innerJoin(competition, eq(competition.id, bracketMatch.competitionId))
        .where(
          and(
            eq(competition.warWeekId, warWeekId),
            eq(bracketMatch.status, "played"),
          ),
        ),
      dbOrTx
        .select({ n: count() })
        .from(seriesMatch)
        .innerJoin(competition, eq(competition.id, seriesMatch.competitionId))
        .where(eq(competition.warWeekId, warWeekId)),
      dbOrTx
        .select({ n: count() })
        .from(attempt)
        .innerJoin(competition, eq(competition.id, attempt.competitionId))
        .where(eq(competition.warWeekId, warWeekId)),
      dbOrTx
        .select({ n: count() })
        .from(leagueMatch)
        .innerJoin(competition, eq(competition.id, leagueMatch.competitionId))
        .where(
          and(
            eq(competition.warWeekId, warWeekId),
            isNotNull(leagueMatch.result),
          ),
        ),
    ]);
  return {
    pointsEntries: points.n,
    matchResults: matches.n + league.n,
    logged: seriesMatches.n + attempts.n,
  };
}
