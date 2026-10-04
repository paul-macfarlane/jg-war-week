/**
 * The Competition facts that bound self-enrollment (ADR 0006): whether a
 * linked Participant may enroll (or withdraw) themselves, their Team, or
 * join (or leave) a Squad. Pure, and deliberately free of zod and the
 * Bracket engine: `src/lib/access.ts` imports it, and that module reaches
 * the client bundle. There is no Host shortcut: a Host adds and removes
 * Entrants through the picker.
 */
import { NOT_LINKED } from "@/lib/bracket/match-report-rule";
import { type COMPETITION_FORMATS, isGameFormat } from "@/lib/enums";
import type { GamesConfig } from "@/lib/games/config";
import { onEntrantList } from "@/lib/games/log-rule";

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
 * - `selfEnroll`: the "Participants can enroll" switch.
 * - The close conditions: `built` (the Bracket has Matches), `entrantLimit`
 *   against `entrantCount`, `enrollClosesAt` against `now`, `closed`
 *   (closed), `hasGames` (a Head-to-head or Best score Competition's first Game).
 * - `linked`: the Participant the actor's email links to, with their Team
 *   and their Squad in this Competition.
 * - `scoring` and `entrants`: who is entered.
 * - `hasSquads` and `squad`: for a Squads Bracket, whether any Squad
 *   exists and the Squad being joined or left (`missing` when gone, null
 *   when not joining or leaving a Squad).
 */
export type EnrollFacet = {
  selfEnroll: boolean;
  closed: boolean;
  built: boolean;
  hasGames: boolean;
  entrantLimit: number | null;
  entrantCount: number;
  enrollClosesAt: Date | null;
  now: Date;
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
export const ENROLL_CLOSED_FULL =
  "Enrollment is closed: the Entrant limit is reached.";
export const ENROLL_CLOSED_TIME =
  "Enrollment is closed: the close time has passed.";
export const ENROLL_CLOSED_BY_HOST =
  "Enrollment is closed: the Host closed this Competition.";
export const ENROLL_CLOSED_GAME_LOGGED =
  "Enrollment is closed: the first Match or Attempt is logged.";
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
/** The enroll switch on a points Competition: it has no Entrant list. */
export const POINTS_NO_ENROLL =
  "Participants enroll only in a Bracket, Head-to-head or Best score Competition.";
/** The enroll switch on a `participation` Competition: no Entrant list. */
export const PARTICIPATION_NO_ENROLL =
  "A Participation Competition takes check-ins, not Entrants.";
/** The enroll switch on a Best of: the Host sets its two Entrants. */
export const BEST_OF_NO_ENROLL =
  "A Best of is set by the Host; enrollment is off.";
/** The enroll switch on an open-to-everyone Head-to-head or Best score Competition. */
export const OPEN_NO_ENROLL =
  "Everyone can play already; there's no list to enroll in.";

/**
 * Why this Competition offers no enrollment whatever its switch says, or
 * null when it does: a points or `participation` Competition has no Entrant
 * list; a Head-to-head or Best score
 * Competition open to everyone needs none; a Best of's two Entrants are
 * set by the Host. A Bracket and a fixed-list Head-to-head or Best score Competition offer it.
 * `gameConfig` is the parsed config (null for any other Format).
 */
export function enrollmentUnavailable({
  format,
  entrantsOpen,
  gameConfig,
}: {
  format: (typeof COMPETITION_FORMATS)[number];
  entrantsOpen: boolean;
  gameConfig: GamesConfig | null;
}): string | null {
  if (format === "placement") return POINTS_NO_ENROLL;
  if (format === "participation") return PARTICIPATION_NO_ENROLL;
  if (!isGameFormat(format)) return null;
  if (entrantsOpen) return OPEN_NO_ENROLL;
  if (
    format === "head-to-head" &&
    gameConfig !== null &&
    "bestOf" in gameConfig &&
    gameConfig.bestOf !== null
  ) {
    return BEST_OF_NO_ENROLL;
  }
  return null;
}

/**
 * Why enrollment is closed, or null, in order: Bracket built, Entrant
 * limit reached (only when adding an Entrant), close time passed, closed
 * by the Host, first Game logged.
 */
function closeError(facet: EnrollFacet, addsEntrant: boolean): string | null {
  if (facet.built) return ENROLL_CLOSED_BUILT;
  if (
    addsEntrant &&
    facet.entrantLimit !== null &&
    facet.entrantCount >= facet.entrantLimit
  ) {
    return ENROLL_CLOSED_FULL;
  }
  if (facet.enrollClosesAt && facet.now >= facet.enrollClosesAt) {
    return ENROLL_CLOSED_TIME;
  }
  if (facet.closed) return ENROLL_CLOSED_BY_HOST;
  if (facet.hasGames) return ENROLL_CLOSED_GAME_LOGGED;
  return null;
}

type Linked = NonNullable<EnrollFacet["linked"]>;

/** Whether the linked Participant (or their Team) is an Entrant. */
const isEntered = (facet: EnrollFacet, linked: Linked) =>
  onEntrantList(facet.scoring, linked, facet.entrants);

/**
 * Why the linked Participant can't enroll, or null when they can. In
 * order: switch off, no linked Participant, enrollment closed; then for a
 * Squad join: no such Squad, another Team's, already in a Squad here,
 * full; otherwise: on no Team (team scoring), already entered, a Squads
 * Bracket (join a Squad instead).
 */
export function enrollError(facet: EnrollFacet): string | null {
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
 * order: switch off, no linked Participant; for a Squad: no such Squad,
 * not in it, enrollment closed, the last Participant in it; otherwise: not
 * entered, enrollment closed. At the Entrant limit they may still
 * withdraw: that frees a place. After close, only the Host or an Organizer
 * removes an Entrant.
 */
export function withdrawError(facet: EnrollFacet): string | null {
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
