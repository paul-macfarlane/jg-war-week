import { cache } from "react";

import { getCompetitionWithLedger } from "@/queries/competitions";

import { getWarWeekForEdition } from "../../war-week";

/**
 * The War Week and the Competition a `/[edition]/competitions/[id]` URL
 * names, memoized per request so the segment's layout and page share one
 * lookup. Undefined when either doesn't exist.
 */
export const getCompetitionPage = cache(async (edition: string, id: string) => {
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) return undefined;
  const found = await getCompetitionWithLedger(warWeek, id);
  return found && { warWeek, ...found };
});
