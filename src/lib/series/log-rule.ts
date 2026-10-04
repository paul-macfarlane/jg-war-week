/**
 * The facts that bound logging, editing and deleting a Head-to-head Match
 * (spec R21, decisions 4 and 12; D1b). An Organizer or the Competition's
 * Host logs any Match; with self-report on, either Entrant (or anyone on
 * an Entrant Team) logs one and changes any Match of the series, whoever
 * logged it. Once a side has the majority, or every Match of the Best of
 * is played, no more are logged; a Match is still changed while the
 * Competition is open, and the series recomputes. Pure, and deliberately
 * free of zod and the Bracket engine: `src/lib/access.ts` imports it, and
 * that module reaches the client bundle.
 */
import { NOT_LINKED, SELF_REPORT_OFF } from "@/lib/bracket/match-report-rule";
import { COMPETITION_CLOSED } from "@/lib/logged-results";

export { COMPETITION_CLOSED, NOT_LINKED, SELF_REPORT_OFF };

/** A player in a Match, or an Entrant: a Team or a Participant by id. */
export type MatchSide = { teamId: string | null; participantId: string | null };

/**
 * What `can("series.log" | "series.edit" | "series.delete", …)` checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition
 *   (loaded by the caller, never `hostsIn`).
 * - `closed`: the Competition is closed (`closed_at` set).
 * - `selfReport`: "Participants can log their own results".
 * - `decided`: an Entrant has the majority of the Best of.
 * - `played` and `bestOf`: Matches logged so far, and the series' length.
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `scoring` and `entrants`: the series' two sides.
 * - `players`: the posted players for a log or an edit; empty for a delete.
 * - `match`: for an edit or a delete, the Match's players, or `missing`.
 */
export type SeriesLogFacet = {
  runs: boolean;
  closed: boolean;
  selfReport: boolean;
  decided: boolean;
  played: number;
  bestOf: number;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  entrants: MatchSide[];
  players: MatchSide[];
  match: { players: MatchSide[] } | "missing" | null;
};

export const SERIES_DECIDED = "This series is decided, so logging is closed.";
export const SERIES_DRAWN =
  "Every Match of this series is played with no majority: the series is drawn.";
export const NOT_A_PLAYER = "You're not a player in this Match.";
export const NOT_AN_ENTRANT =
  "A Match is played between this Competition's 2 Entrants.";
export const MATCH_MISSING = "That Match no longer exists.";
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

/** Why the series takes no more Matches (decided or drawn), or null. */
function seriesOverError(facet: SeriesLogFacet): string | null {
  if (facet.decided) return SERIES_DECIDED;
  if (facet.played >= facet.bestOf) return SERIES_DRAWN;
  return null;
}

/**
 * Why a linked Participant may not write here as an Entrant, or null:
 * self-report off, no link, not an Entrant (or on an Entrant Team).
 */
function participantError(facet: SeriesLogFacet): string | null {
  if (!facet.selfReport) return SELF_REPORT_OFF;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  return onSides(facet.scoring, linked, facet.entrants) ? null : NOT_A_PLAYER;
}

/**
 * Why the actor can't log this Match, or null when they can. In order:
 * Closed, then the series decided or drawn (both bind everyone); a Host or
 * Organizer may; else self-report off, no link, not an Entrant, a posted
 * player who isn't an Entrant.
 */
export function seriesLogError(facet: SeriesLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  const over = seriesOverError(facet);
  if (over) return over;
  if (facet.runs) return null;
  return participantError(facet) ?? entrantError(facet, facet.players);
}

/** The Log a Match button a viewer sees, or null for none. */
export type SeriesLogOffer = {
  /** Shown beside the disabled button; null when it's enabled. */
  disabledReason: string | null;
};

/**
 * The Log a Match button: for a Host or Organizer, or an Entrant with
 * self-report on, once the two Entrants are set and until Closed;
 * disabled, with the reason, once the series is decided or drawn.
 */
export function seriesLogOffer(facet: SeriesLogFacet): SeriesLogOffer | null {
  if (facet.closed || facet.entrants.length !== 2) return null;
  if (!facet.runs && participantError(facet)) return null;
  return { disabledReason: seriesOverError(facet) };
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
 * Why the actor can't edit or delete this Match, or null when they can:
 * anyone who could have logged it, while the Competition is open, even
 * once the series is decided (D1b). An edit posts its new `players`; a
 * delete posts none. In order: Closed (binds everyone); a Host or
 * Organizer may; else self-report off, no link, not an Entrant, no such
 * Match, and for an edit a posted player who isn't an Entrant.
 */
export function seriesChangeError(facet: SeriesLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const refusal = participantError(facet);
  if (refusal) return refusal;
  if (!facet.match || facet.match === "missing") return MATCH_MISSING;
  return entrantError(facet, facet.players);
}
