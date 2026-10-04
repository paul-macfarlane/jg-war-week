/**
 * The facts that bound logging, editing and deleting a Best score Attempt
 * (ADR 0006). A linked Participant logs only their own Attempts; an
 * Organizer or the Competition's Host logs for anyone. Pure, and
 * deliberately free of zod: `src/lib/access.ts` imports it, and that
 * module reaches the client bundle.
 */
import { NOT_LINKED } from "@/lib/bracket/match-report-rule";
import { COMPETITION_CLOSED } from "@/lib/logged-results";

export { COMPETITION_CLOSED, NOT_LINKED };

/**
 * What `can("attempts.log" | "attempts.edit" | "attempts.delete", …)`
 * checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition.
 * - `closed`: the Competition is closed (`closed_at` set).
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `scoring`: in team scoring an Attempt counts for its Participant's
 *   Team, so a Participant on no Team logs none.
 * - `participantId`: the posted Participant for a log or an edit; null
 *   for a delete.
 * - `attempt`: for an edit or a delete, the Attempt's logger and its
 *   Participant, or `missing`.
 */
export type AttemptLogFacet = {
  runs: boolean;
  closed: boolean;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  participantId: string | null;
  attempt:
    | { loggedByParticipantId: string | null; participantId: string }
    | "missing"
    | null;
};

export const NOT_YOURS = "You log only your own Attempts.";
export const NOT_ON_A_TEAM =
  "You're not on a Team, so an Attempt can't count for one.";
export const ATTEMPT_MISSING = "That Attempt no longer exists.";
export const NOT_THE_LOGGER =
  "Only the player who logged this Attempt can change it. Ask the Host.";

/**
 * Why the actor can't log this Attempt, or null when they can. In order:
 * closed (binds everyone); a Host or Organizer may; else no linked
 * Participant, on no Team in team scoring, an Attempt for someone else.
 */
export function attemptLogError(facet: AttemptLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  if (facet.scoring === "team" && linked.teamId === null) return NOT_ON_A_TEAM;
  if (facet.participantId !== linked.participantId) return NOT_YOURS;
  return null;
}

/** Whether the actor could log an Attempt right now (a Log button). */
export function canLogAttempt(facet: AttemptLogFacet): boolean {
  return (
    attemptLogError({
      ...facet,
      participantId: facet.linked?.participantId ?? null,
    }) === null
  );
}

/**
 * Why the actor can't edit or delete this Attempt, or null when they can.
 * An edit posts its Participant; a delete posts none. In order: closed
 * (binds everyone); a Host or Organizer may; else no linked Participant,
 * no such Attempt, not its logger, not their own Attempt, and for an edit
 * an Attempt moved to someone else.
 */
export function attemptChangeError(facet: AttemptLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked, attempt } = facet;
  if (!linked) return NOT_LINKED;
  if (!attempt || attempt === "missing") return ATTEMPT_MISSING;
  if (attempt.loggedByParticipantId !== linked.participantId) {
    return NOT_THE_LOGGER;
  }
  if (attempt.participantId !== linked.participantId) return NOT_YOURS;
  if (
    facet.participantId !== null &&
    facet.participantId !== linked.participantId
  ) {
    return NOT_YOURS;
  }
  return null;
}
