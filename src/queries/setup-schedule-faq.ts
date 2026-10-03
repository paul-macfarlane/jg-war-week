import { asc, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type WarWeek, competition } from "@/db/schema";

/** A War Week's Competitions by name, for the Schedule Item form's picker. */
export async function getCompetitionOptions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<{ id: string; name: string }[]> {
  return dbOrTx
    .select({ id: competition.id, name: competition.name })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id))
    .orderBy(asc(competition.name));
}
