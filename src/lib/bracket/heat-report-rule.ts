/**
 * The Heat facts that bound self-report (ADR 0005): whether a linked
 * Participant may enter a Heat's result themselves. Pure, and deliberately
 * free of zod and the Bracket engine: `src/lib/access.ts` imports it, and
 * that module reaches the client bundle.
 */

/** Where a Heat stands for self-report. */
export type HeatReportState = "open" | "unfilled" | "decided" | "bye";

/** Who a Heat's Entrant is: a Team, a Participant or a Squad row's ids. */
export type HeatReportEntrant = {
  /** The Entrant row's own `team_id`: null for a Squad. */
  teamId: string | null;
  participantId: string | null;
  squadId: string | null;
};

/**
 * What `can("bracket.heat-report", …)` checks: the Competition's setting,
 * the Heat's state (or `missing`), the Participant the actor's email links
 * to (never the "Which one is you?" pick) with their Team and their Squad in
 * this Competition, and the Heat's filled slots' Entrants.
 */
export type HeatReportFacet = {
  selfReport: boolean;
  heat: HeatReportState | "missing";
  linked: {
    participantId: string;
    teamId: string | null;
    squadId: string | null;
  } | null;
  entrants: HeatReportEntrant[];
};

export const SELF_REPORT_OFF = "Self-report is off for this Competition.";
export const NOT_LINKED =
  "Your sign-in doesn't match a Participant of this War Week.";
export const HEAT_MISSING = "That Heat no longer exists.";
export const NOT_IN_HEAT = "You're not in this Heat.";
export const BYE_NOT_REPORTED = "A bye isn't played.";
export const HEAT_UNFILLED = "This Heat is still waiting for its Entrants.";
export const HEAT_DECIDED = "This Heat already has a result.";

/**
 * Why the linked Participant can't report this Heat, or null when they
 * can. In order: self-report off, no linked Participant, no such Heat, not
 * in it (as the Entrant, on the Entrant Team, or in the Entrant Squad), a
 * bye, not filled yet, already decided.
 */
export function heatReportError(facet: HeatReportFacet): string | null {
  if (!facet.selfReport) return SELF_REPORT_OFF;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  if (facet.heat === "missing") return HEAT_MISSING;
  const inHeat = facet.entrants.some(
    (e) =>
      e.participantId === linked.participantId ||
      (linked.teamId !== null && e.teamId === linked.teamId) ||
      (linked.squadId !== null && e.squadId === linked.squadId),
  );
  if (!inHeat) return NOT_IN_HEAT;
  if (facet.heat === "bye") return BYE_NOT_REPORTED;
  if (facet.heat === "unfilled") return HEAT_UNFILLED;
  if (facet.heat === "decided") return HEAT_DECIDED;
  return null;
}
