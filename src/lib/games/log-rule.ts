/**
 * The Game facts that bound logging, editing and deleting a Game in a
 * `games` Competition (ADR 0006). Pure, and deliberately free of zod and
 * the Bracket engine: `src/lib/access.ts` imports it, and that module
 * reaches the client bundle.
 */
import { NOT_LINKED } from "@/lib/bracket/heat-report-rule";

export { NOT_LINKED };

/** A player in a Game, or an Entrant: a Team or a Participant by id. */
export type GameSide = { teamId: string | null; participantId: string | null };

/**
 * What `can("games.log" | "games.edit" | "games.delete", …)` checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition
 *   (loaded by the caller, never `hostsIn`).
 * - `closed`: the Competition is closed (`finalized_at` set).
 * - `loggingOpen`: before `logging_closes_at` (or none) and no Best of
 *   decided; `bestOfDecided` says which of the two closed it.
 * - `linked`: the Participant the actor's email links to, with their Team
 *   (never the "Which one is you?" pick).
 * - `scoring`, `entrantsOpen` and `entrants`: who may play (the fixed
 *   list; empty when open to everyone).
 * - `players`: the posted player set for a log or an edit; empty for a
 *   delete.
 * - `game`: for an edit or a delete, the Game's logger and its current
 *   players, or `missing`.
 */
export type GameLogFacet = {
  runs: boolean;
  closed: boolean;
  loggingOpen: boolean;
  bestOfDecided: boolean;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  entrantsOpen: boolean;
  entrants: GameSide[];
  players: GameSide[];
  game:
    | {
        loggedByParticipantId: string | null;
        players: GameSide[];
      }
    | "missing"
    | null;
};

export const COMPETITION_CLOSED = "This Competition is closed.";
export const LOGGING_CLOSED = "Logging is closed for this Competition.";
export const BEST_OF_DECIDED = "This Best of is decided, so logging is closed.";
export const NOT_A_PLAYER = "You're not a player in this Game.";
export const NOT_AN_ENTRANT =
  "Every player must be an Entrant of this Competition.";
export const GAME_MISSING = "That Game no longer exists.";
export const NOT_THE_LOGGER =
  "Only the player who logged this Game can change it. Ask the Host.";

type Linked = NonNullable<GameLogFacet["linked"]>;

/** Whether the linked Participant plays in `players`: as themselves or their Team. */
function plays(
  scoring: GameLogFacet["scoring"],
  linked: Linked,
  players: GameSide[],
): boolean {
  if (scoring === "team") {
    return (
      linked.teamId !== null && players.some((p) => p.teamId === linked.teamId)
    );
  }
  return players.some((p) => p.participantId === linked.participantId);
}

/** Why a player set breaks a fixed Entrant list, or null. */
function entrantError(facet: GameLogFacet, players: GameSide[]): string | null {
  if (facet.entrantsOpen) return null;
  const entered = (p: GameSide) =>
    facet.entrants.some((e) =>
      facet.scoring === "team"
        ? p.teamId !== null && e.teamId === p.teamId
        : p.participantId !== null && e.participantId === p.participantId,
    );
  return players.every(entered) ? null : NOT_AN_ENTRANT;
}

function loggingError(facet: GameLogFacet): string | null {
  if (facet.loggingOpen) return null;
  return facet.bestOfDecided ? BEST_OF_DECIDED : LOGGING_CLOSED;
}

/**
 * Why the actor can't log this Game, or null when they can. In order: the
 * Competition is closed (binds everyone); a Host or Organizer may; else no
 * linked Participant, logging closed for them, not a player in the posted
 * set (as the Participant or on a Team in it), a player not on the fixed
 * Entrant list.
 */
export function gameLogError(facet: GameLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked } = facet;
  if (!linked) return NOT_LINKED;
  const logging = loggingError(facet);
  if (logging) return logging;
  if (!plays(facet.scoring, linked, facet.players)) return NOT_A_PLAYER;
  return entrantError(facet, facet.players);
}

/**
 * Why the actor can't edit or delete this Game, or null when they can. An
 * edit posts its new `players`; a delete posts none. In order: closed
 * (binds everyone); a Host or Organizer may; else no linked Participant,
 * no such Game, not its logger, logging closed for them, no longer a
 * player in it, and for an edit not a player of the edited set (so a
 * logger can't move a Game onto players they aren't among) or a player
 * not on the fixed Entrant list.
 */
export function gameChangeError(facet: GameLogFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.runs) return null;
  const { linked, game } = facet;
  if (!linked) return NOT_LINKED;
  if (!game || game === "missing") return GAME_MISSING;
  if (game.loggedByParticipantId !== linked.participantId) {
    return NOT_THE_LOGGER;
  }
  const logging = loggingError(facet);
  if (logging) return logging;
  if (!plays(facet.scoring, linked, game.players)) return NOT_A_PLAYER;
  if (facet.players.length === 0) return null;
  if (!plays(facet.scoring, linked, facet.players)) return NOT_A_PLAYER;
  return entrantError(facet, facet.players);
}
