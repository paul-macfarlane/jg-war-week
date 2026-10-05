/**
 * The League page's per-viewer rules (spec R23; ADR 0001): whether an
 * Entrant is the signed-in viewer, why Edit pairings is off for a round
 * (agreeing with the server's `swapError`), and the viewer's next Match.
 * Pure: `getLeagueView` loads the facts.
 */
import type { LeaguePairing } from "@/lib/league/config";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import {
  ALREADY_PLAY,
  COMPETITION_CLOSED,
  ROUND_HAS_RESULT,
  SWAPPED_MATCH_HAS_RESULT,
} from "@/lib/league/rules";

/** The viewer's linked Participant and Team, or null. */
export type LeagueViewer = {
  participantId: string;
  teamId: string | null;
} | null;

/** Whether an Entrant row is the linked viewer (or their Team). */
export function isViewer(
  scoring: "team" | "individual",
  linked: LeagueViewer,
  side: { teamId: string | null; participantId: string | null },
): boolean {
  if (!linked) return false;
  return scoring === "team"
    ? linked.teamId !== null && side.teamId === linked.teamId
    : side.participantId === linked.participantId;
}

/**
 * Why Edit pairings is off for a round, or null (reading R7), by the rule
 * `swapError` refuses each swap with: Closed; a round of one Match has
 * nothing to swap (its two already play each other); a Swiss round once
 * any Match has a result; a round robin round with fewer than two Matches
 * (a sit-out counts) still without a result.
 */
export function editDisabledReason({
  closed,
  pairing,
  round,
}: {
  closed: boolean;
  pairing: LeaguePairing;
  /** The round's Matches. */
  round: LeagueMatchFacts[];
}): string | null {
  if (closed) return COMPETITION_CLOSED;
  if (round.length < 2) return ALREADY_PLAY;
  if (pairing === "swiss") {
    return round.some((m) => m.result !== null) ? ROUND_HAS_RESULT : null;
  }
  const open = round.filter((m) => m.result === null).length;
  return open >= 2 ? null : SWAPPED_MATCH_HAS_RESULT;
}

/** The viewer's next Match: its round and opponent, or a bye. */
export type LeagueNextMatch = {
  round: number;
  matchId: string;
  /** The opponent's name; null for a bye or sit-out. */
  opponent: string | null;
};

/**
 * The viewer's next Match while open, or null: their first Match without
 * a result, or a bye or sit-out in a round that still has a Match to play.
 * `matches` are in round and position order.
 */
export function yourNextMatch({
  closed,
  yourEntrantId,
  matches,
  nameOf,
}: {
  closed: boolean;
  yourEntrantId: string | null;
  matches: (LeagueMatchFacts & { id: string })[];
  nameOf: (entrantId: string) => string;
}): LeagueNextMatch | null {
  if (closed || yourEntrantId === null) return null;
  const roundOpen = (round: number) =>
    matches.some((m) => m.round === round && m.b !== null && m.result === null);
  for (const m of matches) {
    if (m.a !== yourEntrantId && m.b !== yourEntrantId) continue;
    if (m.b === null) {
      if (roundOpen(m.round)) {
        return { round: m.round, matchId: m.id, opponent: null };
      }
      continue;
    }
    if (m.result !== null) continue;
    const opponent = m.a === yourEntrantId ? m.b : m.a;
    return { round: m.round, matchId: m.id, opponent: nameOf(opponent) };
  }
  return null;
}
