/**
 * The Match facts that bound self-report (ADR 0005): whether a linked
 * Participant may enter a Match's result themselves. Pure, and deliberately
 * free of zod and the Bracket engine: `src/lib/access.ts` imports it, and
 * that module reaches the client bundle.
 */

/** Where a Match stands for self-report. */
export type MatchReportState = "open" | "unfilled" | "decided" | "bye";

/** Who a Match's Entrant is: a Team, a Participant or a Squad row's ids. */
export type MatchReportEntrant = {
  /** The Entrant row's own `team_id`: null for a Squad. */
  teamId: string | null;
  participantId: string | null;
  squadId: string | null;
};

/**
 * What `can("bracket.match-report", …)` checks: the Competition's setting,
 * the Match's state (or `missing`), the Participant the actor's email links
 * to with their Team and their Squad in
 * this Competition, and the Match's filled slots' Entrants.
 */
export type MatchReportFacet = {
  selfReport: boolean;
  match: MatchReportState | "missing";
  linked: {
    participantId: string;
    teamId: string | null;
    squadId: string | null;
  } | null;
  entrants: MatchReportEntrant[];
};

export const SELF_REPORT_OFF = "Self-report is off for this Competition.";
export const NOT_LINKED =
  "Your sign-in doesn't match a Participant of this War Week.";
export const MATCH_MISSING = "That Match no longer exists.";
export const NOT_IN_MATCH = "You're not in this Match.";
export const BYE_NOT_REPORTED = "A bye isn't played.";
export const MATCH_UNFILLED = "This Match is still waiting for its Entrants.";
export const MATCH_DECIDED = "This Match already has a result.";

/**
 * Why the linked Participant can't report this Match, or null when they
 * can. In order: self-report off, no linked Participant, no such Match, not
 * in it (as the Entrant, on the Entrant Team, or in the Entrant Squad), a
 * bye, not filled yet, already decided.
 */
export function matchReportError(facet: MatchReportFacet): string | null {
  if (!facet.selfReport) return SELF_REPORT_OFF;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  if (facet.match === "missing") return MATCH_MISSING;
  const inMatch = facet.entrants.some(
    (e) =>
      e.participantId === linked.participantId ||
      (linked.teamId !== null && e.teamId === linked.teamId) ||
      (linked.squadId !== null && e.squadId === linked.squadId),
  );
  if (!inMatch) return NOT_IN_MATCH;
  if (facet.match === "bye") return BYE_NOT_REPORTED;
  if (facet.match === "unfilled") return MATCH_UNFILLED;
  if (facet.match === "decided") return MATCH_DECIDED;
  return null;
}
