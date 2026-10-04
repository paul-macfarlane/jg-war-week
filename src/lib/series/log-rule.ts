/**
 * The facts that bound logging, editing and deleting a Head-to-head Match
 * (ADR 0006). Pure, and deliberately free of zod and the Bracket engine:
 * `src/lib/access.ts` imports it, and that module reaches the client
 * bundle.
 */
import { NOT_LINKED } from "@/lib/bracket/match-report-rule";
import { COMPETITION_CLOSED } from "@/lib/logged-results";

export { COMPETITION_CLOSED, NOT_LINKED };

/** A player in a Match, or an Entrant: a Team or a Participant by id. */
export type MatchSide = { teamId: string | null; participantId: string | null };

/**
 * What `can("series.log" | "series.edit" | "series.delete", …)` checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition
 *   (loaded by the caller, never `hostsIn`).
 * - `closed`: the Competition is closed (`closed_at` set).
 * - `decided`: an Entrant has won the Best of, so a Participant's logging
 *   is closed.
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `scoring` and `entrants`: the series' two sides.
 * - `players`: the posted players for a log or an edit; empty for a delete.
 * - `match`: for an edit or a delete, the Match's logger and its players,
 *   or `missing`.
 */
export type SeriesLogFacet = {
  runs: boolean;
  closed: boolean;
  decided: boolean;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  entrants: MatchSide[];
  players: MatchSide[];
  match:
    | { loggedByParticipantId: string | null; players: MatchSide[] }
    | "missing"
    | null;
};

export const SERIES_DECIDED = "This series is decided, so logging is closed.";
export const NOT_A_PLAYER = "You're not a player in this Match.";
export const NOT_AN_ENTRANT =
  "A Match is played between this Competition's 2 Entrants.";
export const MATCH_MISSING = "That Match no longer exists.";
export const NOT_THE_LOGGER =
  "Only the player who logged this Match can change it. Ask the Host.";
export const REPEATED_PLAYER = "Choose each player only once.";
export const TWO_PLAYERS = "A Head-to-head Match has exactly 2 players.";
export const NEEDS_TWO_ENTRANTS =
  "Set this Competition's 2 Entrants before logging a Match.";

/**
 * Whether the linked Participant is among `sides` (Entrants or a Match's
 * players): as themselves (individual scoring) or their Team (team
 * scoring; a Participant on no Team never is).
 */
export function onSides(
  scoring: SeriesLogFacet["scoring"],
  linked: { participantId: string; teamId: string | null },
  sides: MatchSide[],
): boolean {
  if (scoring === "team") {
    return (
      linked.teamId !== null && sides.some((s) => s.teamId === linked.teamId)
    );
  }
  return sides.some((s) => s.participantId === linked.participantId);
}

/** Why a player set isn't the series' Entrants, or null. */
function entrantError(
  facet: SeriesLogFacet,
  players: MatchSide[],
): string | null {
  const entered = (p: MatchSide) =>
    facet.entrants.some((e) =>
      facet.scoring === "team"
        ? p.teamId !== null && e.teamId === p.teamId
        : p.participantId !== null && e.participantId === p.participantId,
    );
  return players.every(entered) ? null : NOT_AN_ENTRANT;
}

/**
 * Why the actor can't log this Match, or null when they can. In order:
 * closed (binds everyone); a Host or Organizer may; else no linked
 * Participant, the series decided, not a player in the posted set (as the
 * Participant or on a Team in it), a player who isn't an Entrant.
 */
export function seriesLogError(facet: SeriesLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  if (facet.decided) return SERIES_DECIDED;
  if (!onSides(facet.scoring, linked, facet.players)) return NOT_A_PLAYER;
  return entrantError(facet, facet.players);
}

/**
 * Whether the actor could log a Match right now (a Log button):
 * `seriesLogError` without the posted players.
 */
export function canLogMatch(facet: SeriesLogFacet): boolean {
  if (facet.closed) return false;
  if (facet.runs) return facet.entrants.length === 2;
  const { linked } = facet;
  if (!linked || facet.decided || facet.entrants.length !== 2) return false;
  return onSides(facet.scoring, linked, facet.entrants);
}

/**
 * Why the posted players can't be a Match here, for everyone (Hosts
 * included), or null. In order: a repeated player; not two; the series
 * without its two Entrants; a player who isn't an Entrant.
 */
export function playersRuleError({
  scoring,
  ids,
  entrants,
}: {
  scoring: SeriesLogFacet["scoring"];
  ids: string[];
  entrants: MatchSide[];
}): string | null {
  if (new Set(ids).size !== ids.length) return REPEATED_PLAYER;
  if (ids.length !== 2) return TWO_PLAYERS;
  if (entrants.length !== 2) return NEEDS_TWO_ENTRANTS;
  const entered = new Set(
    entrants.map((e) => (scoring === "team" ? e.teamId : e.participantId)),
  );
  return ids.every((id) => entered.has(id)) ? null : NOT_AN_ENTRANT;
}

/**
 * Why the actor can't edit or delete this Match, or null when they can.
 * An edit posts its new `players`; a delete posts none. In order: closed
 * (binds everyone); a Host or Organizer may; else no linked Participant,
 * no such Match, not its logger, the series decided, no longer a player in
 * it, and for an edit not a player of the edited set.
 */
export function seriesChangeError(facet: SeriesLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked, match } = facet;
  if (!linked) return NOT_LINKED;
  if (!match || match === "missing") return MATCH_MISSING;
  if (match.loggedByParticipantId !== linked.participantId) {
    return NOT_THE_LOGGER;
  }
  if (facet.decided) return SERIES_DECIDED;
  if (!onSides(facet.scoring, linked, match.players)) return NOT_A_PLAYER;
  if (facet.players.length === 0) return null;
  if (!onSides(facet.scoring, linked, facet.players)) return NOT_A_PLAYER;
  return entrantError(facet, facet.players);
}
