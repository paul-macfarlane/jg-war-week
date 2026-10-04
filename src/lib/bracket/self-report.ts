/**
 * Self-report (ADR 0005): where a Match stands for a Participant's report,
 * and the toggle's input. Pure. The Match-fact rule itself lives in
 * `match-report-rule.ts` (kept engine- and zod-free for `access.ts`) and is
 * re-exported here for the mutation and the page.
 */
import { isBye } from "@/lib/bracket/formats";
import type { MatchReportState } from "@/lib/bracket/match-report-rule";
import { isDecided } from "@/lib/bracket/match-status";
import type { Bracket, Match } from "@/lib/bracket/types";

export {
  type MatchReportFacet,
  type MatchReportState,
  matchReportError,
} from "@/lib/bracket/match-report-rule";

/**
 * A bye (never played), decided (it has a Match Result), unfilled (still
 * waiting for an Entrant) or open (every slot filled, no result).
 */
export function matchReportState(
  bracket: Bracket,
  match: Match,
): MatchReportState {
  if (isBye(bracket, match)) return "bye";
  if (isDecided(match)) return "decided";
  if (match.slots.some((s) => s.entrantId === null)) return "unfilled";
  return "open";
}
