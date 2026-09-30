import { and, eq, exists, isNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, competition, game } from "@/db/schema";

/** An open `games` Competition, named in the End War Week warning. */
export type OpenGamesCompetition = { id: string; name: string };

/**
 * A War Week's open `games` Competitions (not closed: `finalized_at` is null
 * until Close sets it) that have at least one Game, by name. Used to warn
 * when ending a War Week with Competitions whose Placement Points aren't yet
 * in the Standings.
 */
export async function getOpenGamesCompetitions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<OpenGamesCompetition[]> {
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
