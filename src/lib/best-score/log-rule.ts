/**
 * The facts that bound logging, editing and deleting a Best score Attempt
 * (spec R21, decisions 4 and 13; D1a). An Organizer or the Competition's
 * Host logs for anyone; with self-report on, a linked Participant logs as
 * themselves and changes each of their own Attempts, whoever logged it.
 * "Max attempts per person" binds everyone; nothing changes once Closed.
 * Pure, and deliberately free of zod: `src/lib/access.ts` imports it, and
 * that module reaches the client bundle.
 */
import { NOT_LINKED, SELF_REPORT_OFF } from "@/lib/bracket/match-report-rule";
import { COMPETITION_CLOSED } from "@/lib/logged-results";

export { COMPETITION_CLOSED, NOT_LINKED, SELF_REPORT_OFF };

/**
 * What `can("attempts.log" | "attempts.edit" | "attempts.delete", …)`
 * checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition.
 * - `closed`: the Competition is closed (`closed_at` set).
 * - `selfReport`: "Participants can log their own results".
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `scoring`: in team scoring an Attempt counts for its Participant's
 *   Team, so a Participant on no Team logs none.
 * - `participantId`: the posted Participant for a log or an edit; null
 *   for a delete.
 * - `attempt`: for an edit or a delete, the Attempt's Participant, or
 *   `missing`.
 * - `maxAttempts`: the limit per person, null for none.
 * - `attemptsSoFar`: for a log, how many Attempts the posted Participant
 *   already has.
 */
export type AttemptLogFacet = {
  runs: boolean;
  closed: boolean;
  selfReport: boolean;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  participantId: string | null;
  attempt: { participantId: string } | "missing" | null;
  maxAttempts: number | null;
  attemptsSoFar: number;
};

export const NOT_YOURS = "You log only your own Attempts.";
export const NOT_ON_A_TEAM =
  "You're not on a Team, so an Attempt can't count for one.";
export const ATTEMPT_MISSING = "That Attempt no longer exists.";

/** The refusal once a person has used every Attempt the limit allows. */
export function noAttemptsLeft(maxAttempts: number): string {
  return `No Attempts left: the limit is ${maxAttempts} per person.`;
}

/** How many Attempts a person has left; null with no limit. */
export function attemptsLeft(
  maxAttempts: number | null,
  attemptsSoFar: number,
): number | null {
  return maxAttempts === null ? null : Math.max(0, maxAttempts - attemptsSoFar);
}

/**
 * Whether saving a log edits the person's one Attempt instead of adding
 * one: "Max attempts per person" is 1 and they already have it.
 */
export function updatesInPlace(facet: AttemptLogFacet): boolean {
  return facet.maxAttempts === 1 && facet.attemptsSoFar >= 1;
}

/** Why a linked Participant may not write as themselves, or null. */
function participantError(facet: AttemptLogFacet): string | null {
  if (!facet.selfReport) return SELF_REPORT_OFF;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  if (facet.scoring === "team" && linked.teamId === null) return NOT_ON_A_TEAM;
  return null;
}

/**
 * Why the actor can't log this Attempt, or null when they can. In order:
 * Closed (binds everyone); for a Participant, self-report off, no link,
 * on no Team in team scoring, an Attempt for someone else; then, for
 * everyone, no Attempts left (at a limit of 1 the save edits the one
 * there instead, `updatesInPlace`).
 */
export function attemptLogError(facet: AttemptLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (!facet.runs) {
    const refusal = participantError(facet);
    if (refusal) return refusal;
    if (facet.participantId !== facet.linked!.participantId) return NOT_YOURS;
  }
  const { maxAttempts } = facet;
  if (
    maxAttempts !== null &&
    facet.attemptsSoFar >= maxAttempts &&
    !updatesInPlace(facet)
  ) {
    return noAttemptsLeft(maxAttempts);
  }
  return null;
}

/** The Log button a viewer sees, or null for none. */
export type AttemptLogOffer = {
  label: "Log an Attempt" | "Update your score";
  /** The viewer's own Attempts left; null with no limit, or for a Host. */
  attemptsLeft: number | null;
  /** Shown beside the disabled button; null when it's enabled. */
  disabledReason: string | null;
};

/**
 * The Log button for the viewer: a Host or Organizer logs for anyone
 * (each person's count shows in the form); a Participant logs as
 * themselves, with their Attempts left, "Update your score" at a limit of 1
 * with their Attempt in, and disabled with the reason once the limit is
 * used. Null once Closed, or for a Participant who may not log at all.
 * `facet.attemptsSoFar` is the viewer's own count.
 */
export function attemptLogOffer(
  facet: AttemptLogFacet,
): AttemptLogOffer | null {
  if (facet.closed) return null;
  if (facet.runs) {
    return {
      label: "Log an Attempt",
      attemptsLeft: null,
      disabledReason: null,
    };
  }
  if (participantError(facet)) return null;
  const own = { ...facet, participantId: facet.linked!.participantId };
  return {
    label: updatesInPlace(own) ? "Update your score" : "Log an Attempt",
    attemptsLeft: attemptsLeft(facet.maxAttempts, facet.attemptsSoFar),
    disabledReason: attemptLogError(own),
  };
}

/**
 * Why the actor can't edit or delete this Attempt, or null when they can:
 * anyone who could have logged it, while the Competition is open. An edit
 * posts its Participant; a delete posts none. In order: Closed (binds
 * everyone); a Host or Organizer may; else self-report off, no link, no
 * such Attempt, someone else's, and for an edit an Attempt moved to
 * someone else. An edit never counts against "Max attempts per person".
 */
export function attemptChangeError(facet: AttemptLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  if (!facet.selfReport) return SELF_REPORT_OFF;
  const { linked, attempt } = facet;
  if (!linked) return NOT_LINKED;
  if (!attempt || attempt === "missing") return ATTEMPT_MISSING;
  if (attempt.participantId !== linked.participantId) return NOT_YOURS;
  if (
    facet.participantId !== null &&
    facet.participantId !== linked.participantId
  ) {
    return NOT_YOURS;
  }
  return null;
}

/**
 * Why "Max attempts per person" can't be set to `maxAttempts` (null for
 * no limit), or null: never below the most Attempts any one person
 * already has.
 */
export function maxAttemptsError(
  maxAttempts: number | null,
  mostByOnePerson: number,
): string | null {
  if (maxAttempts === null || maxAttempts >= mostByOnePerson) return null;
  return `Someone already has ${mostByOnePerson} Attempts, so the limit can't be below ${mostByOnePerson}.`;
}
