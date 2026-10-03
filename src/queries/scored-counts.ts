import { and, count, eq, inArray } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, game, heat, pointsEntry } from "@/db/schema";
import type { ScoredCounts } from "@/lib/war-week-lifecycle";

/**
 * What has been scored in a War Week, for Unstart: its Points Entries, its
 * Heat results (a Heat that is `played` or `forfeit`) and its Games, all
 * through the War Week's Competitions.
 */
export async function getScoredCounts(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<ScoredCounts> {
  const [[points], [heats], [games]] = await Promise.all([
    dbOrTx
      .select({ n: count() })
      .from(pointsEntry)
      .where(eq(pointsEntry.warWeekId, warWeekId)),
    dbOrTx
      .select({ n: count() })
      .from(heat)
      .innerJoin(competition, eq(competition.id, heat.competitionId))
      .where(
        and(
          eq(competition.warWeekId, warWeekId),
          inArray(heat.status, ["played", "forfeit"]),
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
    heatResults: heats.n,
    games: games.n,
  };
}
