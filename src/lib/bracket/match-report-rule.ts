/**
 * The Match facts that bound recording a Bracket Match's result (spec R21,
 * decision 4; D1c, D1d): with self-report on, a linked Participant in a
 * Match (or on its Team or Squad) records it, and edits its recorded
 * result; for everyone, a result a later Match already used (head-to-head)
 * or one before a Round that has a result (Group) can't change.
 * Pure, and deliberately free of zod and the Bracket engine:
 * `src/lib/access.ts` imports it, and that module reaches the client
 * bundle.
 */

/**
 * Where a Match stands: open (every slot filled, no result), unfilled
 * (still waiting for an Entrant), decided (it has a result it can still
 * change), used-later (head-to-head: a later Match its Entrants went to
 * already has a result), later-round-result (Group: a later Round already
 * has a result, and changing this one would empty or re-deal it), or a
 * bye.
 */
export type MatchReportState =
  "open" | "unfilled" | "decided" | "used-later" | "later-round-result" | "bye";

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
export const LATER_MATCH_USED =
  "A later Match already used this result. Change that Match first.";
export const LATER_ROUND_HAS_RESULT =
  "A later round already has a result. Change that round first.";

/**
 * Why nobody, Organizers and Hosts included, can record or clear this
 * Match's result now, or null: only the latest result along a path
 * changes (D1c); in a Group Bracket, only while no later Round has one.
 */
export function matchResultError(state: MatchReportState): string | null {
  if (state === "used-later") return LATER_MATCH_USED;
  if (state === "later-round-result") return LATER_ROUND_HAS_RESULT;
  return null;
}

/**
 * Why the linked Participant can't record (or edit, or clear) this Match's
 * result, or null when they can. In order: self-report off, no linked
 * Participant, no such Match, not in it (as the Entrant, on the Entrant
 * Team, or in the Entrant Squad), a bye, not filled yet, a result a later
 * Match already used (or, in a Group Bracket, before a Round with one).
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
  return matchResultError(facet.match);
}
