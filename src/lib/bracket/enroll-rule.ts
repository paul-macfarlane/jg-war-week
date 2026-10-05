/**
 * The Competition facts that bound self-enrollment (ADR 0006): whether a
 * linked Participant may enroll (or withdraw) themselves, their Team, or
 * join (or leave) a Squad. Pure, and deliberately free of zod and the
 * Bracket engine: `src/lib/access.ts` imports it, and that module reaches
 * the client bundle. There is no Host shortcut: a Host adds and removes
 * Entrants through the picker.
 */
import { NOT_LINKED } from "@/lib/bracket/match-report-rule";
import type { COMPETITION_FORMATS } from "@/lib/enums";

export { NOT_LINKED };

/** The most Participants a Squad holds (the Bracket engine's limit). */
export const SQUAD_PARTICIPANTS_MAX = 16;

/** An Entrant by id: a Team or a Participant. */
export type EnrollEntrant = {
  teamId: string | null;
  participantId: string | null;
};

/**
 * What `can("competition.enroll" | "competition.withdraw", …)` checks:
 * - `format`: only a Bracket or a League takes enrollment
 *   (`enrollmentUnavailable`).
 * - `selfEnroll`: the "Participants can enroll" switch.
 * - The close conditions: `built` (the Bracket has Matches, or the
 *   League's round 1 is paired), `entrantLimit`
 *   against `entrantCount`, `closed` (the Competition is Closed).
 * - `linked`: the Participant the actor's email links to, with their Team
 *   and their Squad in this Competition.
 * - `scoring` and `entrants`: who is entered.
 * - `hasSquads` and `squad`: for a Squads Bracket, whether any Squad
 *   exists and the Squad being joined or left (`missing` when gone, null
 *   when not joining or leaving a Squad).
 */
export type EnrollFacet = {
  format: (typeof COMPETITION_FORMATS)[number];
  selfEnroll: boolean;
  closed: boolean;
  built: boolean;
  entrantLimit: number | null;
  entrantCount: number;
  scoring: "team" | "individual";
  linked: {
    participantId: string;
    teamId: string | null;
    squadId: string | null;
  } | null;
  entrants: EnrollEntrant[];
  hasSquads: boolean;
  squad:
    | {
        id: string;
        teamId: string;
        participantCount: number;
      }
    | "missing"
    | null;
};

export const ENROLL_OFF = "Enrollment is off for this Competition.";
export const ENROLL_CLOSED_BUILT =
  "Enrollment is closed: the Bracket is built.";
/** A League's enrollment closes when round 1 is paired (spec R23, decision 2). */
export const ENROLL_CLOSED_PAIRED = "Enrollment is closed: round 1 is paired.";
export const ENROLL_CLOSED_FULL =
  "Enrollment is closed: the Entrant limit is reached.";
export const ENROLL_CLOSED_BY_HOST =
  "Enrollment is closed: the Host closed this Competition.";
export const ALREADY_ENTERED = "You're already entered.";
export const TEAM_ALREADY_ENTERED = "Your Team is already entered.";
export const NOT_ENTERED = "You're not entered.";
export const TEAM_NOT_ENTERED = "Your Team isn't entered.";
export const NOT_ON_A_TEAM = "You're not on a Team.";
export const JOIN_A_SQUAD = "Join a Squad instead.";
export const SQUAD_MISSING = "That Squad no longer exists.";
export const NOT_YOUR_TEAMS_SQUAD = "That Squad isn't your Team's.";
export const SQUAD_FULL = `A Squad has at most ${SQUAD_PARTICIPANTS_MAX} Participants.`;
export const ALREADY_IN_A_SQUAD =
  "You're already in a Squad in this Competition.";
export const NOT_IN_SQUAD = "You're not in that Squad.";
export const LAST_IN_SQUAD =
  "You're the last Participant in this Squad. Ask the Host to remove the Squad.";
/** Enrollment on a Placement Competition: it has no Entrant list. */
export const POINTS_NO_ENROLL =
  "Participants enroll only in a Bracket or a League.";
/** Enrollment on a `participation` Competition: no Entrant list. */
export const PARTICIPATION_NO_ENROLL =
  "A Participation Competition takes check-ins, not Entrants.";
/** Enrollment on a Head-to-head: the Host sets its two Entrants. */
export const HEAD_TO_HEAD_NO_ENROLL =
  "A Head-to-head's 2 Entrants are set by the Host; enrollment is off.";
/** Enrollment on a Best score Competition: it has no Entrant list. */
export const BEST_SCORE_NO_ENROLL =
  "Best score has no Entrant list: anyone can log an Attempt.";

const NO_ENROLL: Partial<Record<(typeof COMPETITION_FORMATS)[number], string>> =
  {
    placement: POINTS_NO_ENROLL,
    participation: PARTICIPATION_NO_ENROLL,
    "head-to-head": HEAD_TO_HEAD_NO_ENROLL,
    "best-score": BEST_SCORE_NO_ENROLL,
  };

/**
 * Why this Competition offers no enrollment, or null: only a Bracket or a
 * League takes it (spec R21, decision 5; spec R23, decision 2). The
 * database CHECK
 * `competition_self_enroll_bracket_only` backs it.
 */
export function enrollmentUnavailable({
  format,
}: {
  format: (typeof COMPETITION_FORMATS)[number];
}): string | null {
  return NO_ENROLL[format] ?? null;
}

/**
 * Why enrollment is closed, or null, in order: Bracket built (a League's
 * round 1 paired), Entrant limit reached (only when adding an Entrant),
 * closed by the Host.
 */
function closeError(facet: EnrollFacet, addsEntrant: boolean): string | null {
  if (facet.built) {
    return facet.format === "league"
      ? ENROLL_CLOSED_PAIRED
      : ENROLL_CLOSED_BUILT;
  }
  if (
    addsEntrant &&
    facet.entrantLimit !== null &&
    facet.entrantCount >= facet.entrantLimit
  ) {
    return ENROLL_CLOSED_FULL;
  }
  if (facet.closed) return ENROLL_CLOSED_BY_HOST;
  return null;
}

/**
 * Whether the linked Participant is among the Entrants: as themselves
 * (individual scoring) or their Team (team scoring; a Participant on no
 * Team never is).
 */
export function onEntrantList(
  scoring: EnrollFacet["scoring"],
  linked: { participantId: string; teamId: string | null },
  entrants: EnrollEntrant[],
): boolean {
  if (scoring === "team") {
    return (
      linked.teamId !== null && entrants.some((e) => e.teamId === linked.teamId)
    );
  }
  return entrants.some((e) => e.participantId === linked.participantId);
}

type Linked = NonNullable<EnrollFacet["linked"]>;

/** Whether the linked Participant (or their Team) is an Entrant. */
const isEntered = (facet: EnrollFacet, linked: Linked) =>
  onEntrantList(facet.scoring, linked, facet.entrants);

/**
 * Why the linked Participant can't enroll, or null when they can. In
 * order: not a Bracket, switch off, no linked Participant, enrollment
 * closed; then for a
 * Squad join: no such Squad, another Team's, already in a Squad here,
 * full; otherwise: on no Team (team scoring), already entered, a Squads
 * Bracket (join a Squad instead).
 */
export function enrollError(facet: EnrollFacet): string | null {
  const unavailable = enrollmentUnavailable(facet);
  if (unavailable) return unavailable;
  if (!facet.selfEnroll) return ENROLL_OFF;
  const { linked, squad } = facet;
  if (!linked) return NOT_LINKED;
  if (squad) {
    // Joining a Squad adds no Entrant, so the Entrant limit doesn't apply.
    const closed = closeError(facet, false);
    if (closed) return closed;
    if (squad === "missing") return SQUAD_MISSING;
    if (squad.teamId !== linked.teamId) return NOT_YOUR_TEAMS_SQUAD;
    if (linked.squadId !== null) return ALREADY_IN_A_SQUAD;
    if (squad.participantCount >= SQUAD_PARTICIPANTS_MAX) return SQUAD_FULL;
    return null;
  }
  const closed = closeError(facet, true);
  if (closed) return closed;
  if (facet.scoring === "team" && linked.teamId === null) return NOT_ON_A_TEAM;
  if (isEntered(facet, linked)) {
    return facet.scoring === "team" ? TEAM_ALREADY_ENTERED : ALREADY_ENTERED;
  }
  if (facet.scoring === "team" && facet.hasSquads) return JOIN_A_SQUAD;
  return null;
}

/**
 * Why the linked Participant can't withdraw, or null when they can. In
 * order: not a Bracket, switch off, no linked Participant; for a Squad: no
 * such Squad,
 * not in it, enrollment closed, the last Participant in it; otherwise: not
 * entered, enrollment closed. At the Entrant limit they may still
 * withdraw: that frees a place. After close, only the Host or an Organizer
 * removes an Entrant.
 */
export function withdrawError(facet: EnrollFacet): string | null {
  const unavailable = enrollmentUnavailable(facet);
  if (unavailable) return unavailable;
  if (!facet.selfEnroll) return ENROLL_OFF;
  const { linked, squad } = facet;
  if (!linked) return NOT_LINKED;
  if (squad) {
    if (squad === "missing") return SQUAD_MISSING;
    if (linked.squadId !== squad.id) return NOT_IN_SQUAD;
    const closed = closeError(facet, false);
    if (closed) return closed;
    if (squad.participantCount <= 1) return LAST_IN_SQUAD;
    return null;
  }
  if (!isEntered(facet, linked)) {
    return facet.scoring === "team" ? TEAM_NOT_ENTERED : NOT_ENTERED;
  }
  return closeError(facet, false);
}
