/**
 * Self-report (ADR 0005): where a Heat stands for a Participant's report,
 * and the toggle's input. Pure. The Heat-fact rule itself lives in
 * `heat-report-rule.ts` (kept engine- and zod-free for `access.ts`) and is
 * re-exported here for the mutation and the page.
 */
import { isBye } from "@/lib/bracket/formats";
import type { HeatReportState } from "@/lib/bracket/heat-report-rule";
import { isDecided } from "@/lib/bracket/heat-status";
import type { Bracket, Heat } from "@/lib/bracket/types";

export {
  type HeatReportFacet,
  type HeatReportState,
  heatReportError,
} from "@/lib/bracket/heat-report-rule";

/**
 * A bye (never played), decided (it has a Heat Result), unfilled (still
 * waiting for an Entrant) or open (every slot filled, no result).
 */
export function heatReportState(bracket: Bracket, heat: Heat): HeatReportState {
  if (isBye(bracket, heat)) return "bye";
  if (isDecided(heat)) return "decided";
  if (heat.slots.some((s) => s.entrantId === null)) return "unfilled";
  return "open";
}
