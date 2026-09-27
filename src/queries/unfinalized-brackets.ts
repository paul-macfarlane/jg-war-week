import { and, eq, exists, isNull, ne } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, competition, heat } from "@/db/schema";

/**
 * A War Week's unfinalized Brackets: Competitions with a Format other than
 * `points`, not finalized, that have been generated (at least one Heat), by
 * name. Used to warn when ending a War Week with Brackets whose placings
 * aren't yet in the Standings.
 */
export async function getUnfinalizedBrackets(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<{ id: string; name: string }[]> {
  return dbOrTx
    .select({ id: competition.id, name: competition.name })
    .from(competition)
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        ne(competition.format, "points"),
        isNull(competition.finalizedAt),
        exists(
          dbOrTx
            .select()
            .from(heat)
            .where(eq(heat.competitionId, competition.id)),
        ),
      ),
    )
    .orderBy(competition.name);
}
