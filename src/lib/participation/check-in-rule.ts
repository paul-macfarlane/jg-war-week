/**
 * The Competition facts that bound Check in (ADR 0009): whether a linked
 * Participant may check themselves in to (or out of) a `participation`
 * Competition. Pure, and deliberately free of zod: `src/lib/access.ts`
 * imports it, and that module reaches the client bundle. A Host or
 * Organizer marks anyone through `participation.mark`; checking
 * themselves in, they're bound by this rule like any Participant.
 */
import { NOT_LINKED } from "@/lib/bracket/heat-report-rule";

export { NOT_LINKED };

/**
 * What `can("participation.check-in" | "participation.check-out", …)`
 * checks:
 * - `isParticipation`: the Competition is run as Participation.
 * - `closed`: the Host closed it (its points are in).
 * - `selfCheckIn` and `checkInClosesAt` against `now`: the switch and the
 *   optional close time.
 * - `scoring` and `teamLabel`: in team scoring only a Participant on a
 *   Team (named by the War Week's Team Label) can take part.
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `mark`: their took-part row, null when they aren't in; `checkedIn`
 *   false when the Host or an Organizer marked them.
 */
export type CheckInFacet = {
  isParticipation: boolean;
  closed: boolean;
  selfCheckIn: boolean;
  checkInClosesAt: Date | null;
  now: Date;
  scoring: "team" | "individual";
  teamLabel: string;
  linked: { participantId: string; teamId: string | null } | null;
  mark: { checkedIn: boolean } | null;
};

export const NOT_PARTICIPATION = "This Competition isn't run as Participation.";
export const PARTICIPATION_CLOSED = "This Competition is closed.";
export const CHECK_IN_OFF = "Check-in is off for this Competition.";
export const CHECK_IN_CLOSED = "Check-in is closed: the close time has passed.";
export const ALREADY_CHECKED_IN = "You're already checked in.";
export const NOT_CHECKED_IN = "You're not checked in.";
export const MARKED_BY_HOST = "The Host marked you; ask them to remove it.";

/** A team Competition's refusal for a Participant on no Team. */
export function notOnATeam(teamLabel: string): string {
  return `Only Participants on a ${teamLabel} can take part in a team Competition.`;
}

/**
 * Why a Participant can't take part (or be marked) in this Competition
 * for their Team, or null: in team scoring only a Participant on a Team can.
 */
export function markError({
  scoring,
  teamId,
  teamLabel,
}: {
  scoring: "team" | "individual";
  teamId: string | null;
  teamLabel: string;
}): string | null {
  return scoring === "team" && teamId === null ? notOnATeam(teamLabel) : null;
}

/**
 * Why checking in or out isn't open for the linked Participant, or null.
 * In order: not Participation, closed, switch off, close time passed, no
 * linked Participant, on no Team in team scoring.
 */
function openError(facet: CheckInFacet): string | null {
  if (!facet.isParticipation) return NOT_PARTICIPATION;
  if (facet.closed) return PARTICIPATION_CLOSED;
  if (!facet.selfCheckIn) return CHECK_IN_OFF;
  if (facet.checkInClosesAt && facet.now >= facet.checkInClosesAt) {
    return CHECK_IN_CLOSED;
  }
  if (!facet.linked) return NOT_LINKED;
  return markError({
    scoring: facet.scoring,
    teamId: facet.linked.teamId,
    teamLabel: facet.teamLabel,
  });
}

/** Why the linked Participant can't check in, or null when they can. */
export function checkInError(facet: CheckInFacet): string | null {
  return openError(facet) ?? (facet.mark ? ALREADY_CHECKED_IN : null);
}

/**
 * Why the linked Participant can't check out, or null when they can: only
 * their own check-in, never a mark the Host or an Organizer made.
 */
export function checkOutError(facet: CheckInFacet): string | null {
  const open = openError(facet);
  if (open) return open;
  if (!facet.mark) return NOT_CHECKED_IN;
  return facet.mark.checkedIn ? null : MARKED_BY_HOST;
}
