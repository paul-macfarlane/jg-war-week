import { and, eq, exists, inArray, isNull } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, competition, heat } from "@/db/schema";
import { BRACKET_FORMATS } from "@/lib/bracket/view";

/**
 * A War Week's unfinalized Brackets: Competitions with a Bracket Format
 * (not Placement, Participation, Head-to-head or Best score), not finalized, that have been generated (at least one Heat), by
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
        inArray(competition.format, BRACKET_FORMATS),
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
