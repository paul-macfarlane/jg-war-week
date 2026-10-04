/**
 * Where a Match stands for recording its result (spec R21, D1c, D1d):
 * open, unfilled, decided, a bye, or decided with its result already used
 * by a later Match. Pure. The Match-fact rules live in
 * `match-report-rule.ts` (kept engine- and zod-free for `access.ts`) and
 * are re-exported here for the mutations and the pages.
 */
import { isBye } from "@/lib/bracket/formats";
import type { MatchReportState } from "@/lib/bracket/match-report-rule";
import { isDecided } from "@/lib/bracket/match-status";
import type { Bracket, Match } from "@/lib/bracket/types";

export {
  LATER_MATCH_USED,
  type MatchReportFacet,
  type MatchReportState,
  matchReportError,
  matchResultError,
} from "@/lib/bracket/match-report-rule";

/**
 * Whether a later Match already used `match`'s result: a played Match (not
 * a bye) of a later Round holds one of its Entrants. For a head-to-head
 * Bracket that is the Match its winner (or a semifinal's loser) went to;
 * for a Group Bracket, any Match its advancers went to.
 */
export function usedLater(bracket: Bracket, match: Match): boolean {
  const ids = new Set(
    match.slots.flatMap((s) => (s.entrantId ? [s.entrantId] : [])),
  );
  return bracket.matches.some(
    (later) =>
      later.round > match.round &&
      isDecided(later) &&
      !isBye(bracket, later) &&
      later.slots.some((s) => s.entrantId !== null && ids.has(s.entrantId)),
  );
}

/**
 * A bye (never played), used-later (its result fed a later Match that has
 * one), decided (it has a Match Result), unfilled (still waiting for an
 * Entrant) or open (every slot filled, no result).
 */
export function matchReportState(
  bracket: Bracket,
  match: Match,
): MatchReportState {
  if (isBye(bracket, match)) return "bye";
  if (isDecided(match)) {
    return usedLater(bracket, match) ? "used-later" : "decided";
  }
  if (match.slots.some((s) => s.entrantId === null)) return "unfilled";
  return "open";
}
