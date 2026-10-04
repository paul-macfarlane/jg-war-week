import { cache } from "react";

import { isComplete } from "@/lib/bracket/formats";
import { isBracketFormat } from "@/lib/bracket/view";
import { getBracket } from "@/queries/brackets";

import { getWarWeekForEdition } from "../../war-week";

/**
 * The War Week and the closed Bracket a `/[edition]/finale/[competition]`
 * URL names, memoized per request so the segment's layout and page share
 * one lookup. Undefined unless that Competition is a closed Bracket of
 * that edition.
 */
export const getBracketFinalePage = cache(
  async (edition: string, competitionId: string) => {
    const warWeek = await getWarWeekForEdition(edition);
    if (!warWeek) return undefined;
    const view = await getBracket(competitionId);
    if (
      !view ||
      view.competition.warWeekId !== warWeek.id ||
      !isBracketFormat(view.competition.format) ||
      !view.closed ||
      !isComplete(view.bracket)
    ) {
      return undefined;
    }
    return { warWeek, view };
  },
);
