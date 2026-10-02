import { type SQL, sql } from "drizzle-orm";

import { competition } from "@/db/schema";
import type { Competition } from "@/db/schema";

/**
 * A `participation` Competition's team scoring after a scoring save (the
 * CHECK `competition_participation_columns`): kept while still team
 * scoring, `ranked` on becoming team, null for individual or another
 * Format. `scoring` is the saved value, from the excluded row in a seed
 * load.
 */
export function participationTeamScoringFor(
  scoring: SQL | Competition["scoring"],
): SQL<"ranked" | "per-person" | null> {
  return sql`case when ${competition.format}::text = 'participation' and ${scoring} = 'team'
    then coalesce(${competition.participationTeamScoring}, 'ranked') end`;
}
