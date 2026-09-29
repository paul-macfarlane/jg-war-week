import { and, eq, exists, isNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, competition, game } from "@/db/schema";

/**
 * A War Week's open `games` Competitions: Format `games`, not closed
 * (`finalized_at` null, which means "closed" for a `games` Competition), that
 * have at least one Game, by name. Used to warn when ending a War Week with
 * Games Competitions whose Placement Points aren't yet in the Standings.
 */
export async function getOpenGamesCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<{ id: string; name: string }[]> {
  return dbOrTx
    .select({ id: competition.id, name: competition.name })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        eq(competition.format, "games"),
        isNull(competition.finalizedAt),
        exists(
          dbOrTx
            .select()
            .from(game)
            .where(eq(game.competitionId, competition.id)),
        ),
      ),
    )
    .orderBy(competition.name);
}
