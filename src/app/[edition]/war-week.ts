import { cache } from "react";

import { getWarWeekByEdition } from "@/queries/war-weeks";

/**
 * Loads a War Week by its edition segment, memoized per request so the
 * `[edition]` layout and its pages can each call it without issuing
 * duplicate queries.
 */
export const getWarWeekForEdition = cache(async (edition: string) => {
  return getWarWeekByEdition(edition.toLowerCase());
});
