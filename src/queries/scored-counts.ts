import { and, count, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { bracketMatch, competition, game, pointsEntry } from "@/db/schema";
import type { ScoredCounts } from "@/lib/war-week-lifecycle";

/**
 * What has been scored in a War Week, for Unstart: its Points Entries, its
 * Match results (a Match that is `played`) and its Games, all
 * through the War Week's Competitions.
 */
export async function getScoredCounts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<ScoredCounts> {
  const [[points], [matches], [games]] = await Promise.all([
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
      .from(game)
      .innerJoin(competition, eq(competition.id, game.competitionId))
      .where(eq(competition.warWeekId, warWeekId)),
  ]);
  return {
    pointsEntries: points.n,
    matchResults: matches.n,
    games: games.n,
  };
}
