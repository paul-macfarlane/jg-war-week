/**
 * The facts that bound a League's writes (spec R23, decisions 5, 6, 8 and
 * 9; readings R4, R7, R9, R10): who records a Match, when rounds pair,
 * when a pairing swap or Clear pairings is allowed, and what Close waits
 * for. Pure, and deliberately free of zod and the engine: `src/lib/access.ts`
 * imports it, and that module reaches the client bundle.
 */
import type { LeagueResult } from "@/lib/enums";
import {
  type LeagueConfig,
  type LeaguePairing,
  roundsError,
  roundsOf,
} from "@/lib/league/config";
import type { LeagueMatchFacts } from "@/lib/league/pairing";
import {
  COMPETITION_CLOSED,
  MATCH_MISSING,
  type MatchSide,
  NOT_A_PLAYER,
  NOT_LINKED,
  SELF_REPORT_OFF,
  onSides,
} from "@/lib/series/log-rule";

export {
  COMPETITION_CLOSED,
  MATCH_MISSING,
  NOT_A_PLAYER,
  NOT_LINKED,
  SELF_REPORT_OFF,
};

export const BYE_NO_RESULT = "A bye has no result.";
export const NEEDS_TWO_ENTRANTS = "Add at least 2 Entrants before pairing.";
export const ALREADY_PAIRED = "The League is already paired.";
export const PAIR_ROUND_1_FIRST = "Pair round 1 first.";
export const ROUND_ROBIN_PAIRED_AT_ONCE =
  "A round robin pairs every round at once.";
export const EVERY_ROUND_PAIRED = "Every round is paired.";
export const CHOOSE_TWO_IN_ROUND = "Choose two Entrants of this round.";
export const ALREADY_PLAY = "Those two already play each other.";
export const ROUND_HAS_RESULT = "A Match in this round has a result.";
export const SWAPPED_MATCH_HAS_RESULT = "A Match being swapped has a result.";
export const NO_PAIRINGS = "There are no pairings to clear.";
export const PAIRINGS_HAVE_RESULT =
  "A Match has a result: clear its result first.";
/** Close's refusal for a League with a Match or round still to play. */
export const LEAGUE_UNFINISHED = "Finish every Match before closing.";

/**
 * What `can("league.record" | "league.clear", …)` checks:
 * - `runs`: the actor is an Organizer or a Host of this Competition.
 * - `closed`: the Competition is closed.
 * - `selfReport`: "Participants can log their own results".
 * - `linked`: the Participant the actor's email links to, with their Team.
 * - `scoring`: whether a Match's sides are Teams or Participants.
 * - `match`: the Match's two sides (`b` null for a bye), or null when it
 *   doesn't exist in this Competition.
 */
export type LeagueRecordFacet = {
  runs: boolean;
  closed: boolean;
  selfReport: boolean;
  linked: { participantId: string; teamId: string | null } | null;
  scoring: "team" | "individual";
  match: { a: MatchSide; b: MatchSide | null } | null;
};

/**
 * Why the actor can't record, edit or clear this Match's result, or null.
 * In order: Closed, no such Match, a bye (all bind everyone); a Host or
 * Organizer may; else self-report off, no link, not a player (as
 * themselves, or on a player Team in team scoring).
 */
export function leagueRecordError(facet: LeagueRecordFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (!facet.match) return MATCH_MISSING;
  const { a, b } = facet.match;
  if (b === null) return BYE_NO_RESULT;
  if (facet.runs) return null;
  if (!facet.selfReport) return SELF_REPORT_OFF;
  if (!facet.linked) return NOT_LINKED;
  return onSides(facet.scoring, facet.linked, [a, b]) ? null : NOT_A_PLAYER;
}

/** What pairing a League reads: its settings, Entrants and Matches so far. */
export type LeaguePairFacet = {
  closed: boolean;
  config: LeagueConfig;
  entrantCount: number;
  matches: LeagueMatchFacts[];
};

const hasResult = (m: LeagueMatchFacts) => m.result !== null;
/** A Match still to play: paired against someone, with no result. */
const isUnplayed = (m: LeagueMatchFacts) => m.b !== null && m.result === null;

/**
 * Why "Pair rounds" (round robin) or "Pair round 1" (Swiss) is refused,
 * or null: Closed, already paired, fewer than 2 Entrants, or a Swiss
 * League's rounds out of range.
 */
export function pairError(facet: LeaguePairFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.matches.length > 0) return ALREADY_PAIRED;
  if (facet.entrantCount < 2) return NEEDS_TWO_ENTRANTS;
  return roundsError(facet.config, facet.entrantCount);
}

/**
 * Why "Pair next round" (Swiss) is refused, or null: Closed, a round
 * robin, nothing paired yet, a Match of the latest round without a result
 * (its bye never needs one), or every round already paired.
 */
export function pairNextError(facet: LeaguePairFacet): string | null {
  if (facet.closed) return COMPETITION_CLOSED;
  if (facet.config.pairing === "round-robin") {
    return ROUND_ROBIN_PAIRED_AT_ONCE;
  }
  if (facet.matches.length === 0) return PAIR_ROUND_1_FIRST;
  const latest = Math.max(...facet.matches.map((m) => m.round));
  if (facet.matches.some((m) => m.round === latest && isUnplayed(m))) {
    return `Every Match of round ${latest} needs a result first.`;
  }
  if (latest >= roundsOf(facet.config, facet.entrantCount)) {
    return EVERY_ROUND_PAIRED;
  }
  return roundsError(facet.config, facet.entrantCount);
}

/**
 * Why swapping Entrants `x` and `y` within one round is refused, or null
 * (reading R7): Closed; either not in the round, or the same Entrant; the
 * two already in one Match. A Swiss round is fixed once any of its Matches
 * has a result; a round robin only once a Match the swap touches has one.
 */
export function swapError({
  closed,
  pairing,
  round,
  x,
  y,
}: {
  closed: boolean;
  pairing: LeaguePairing;
  /** The round's Matches. */
  round: LeagueMatchFacts[];
  x: string;
  y: string;
}): string | null {
  if (closed) return COMPETITION_CLOSED;
  const matchOf = (id: string) =>
    round.find((m) => m.a === id || m.b === id) ?? null;
  const [mx, my] = [matchOf(x), matchOf(y)];
  if (x === y || !mx || !my) return CHOOSE_TWO_IN_ROUND;
  if (mx === my) return ALREADY_PLAY;
  if (pairing === "swiss") {
    return round.some(hasResult) ? ROUND_HAS_RESULT : null;
  }
  return hasResult(mx) || hasResult(my) ? SWAPPED_MATCH_HAS_RESULT : null;
}

/**
 * Why "Clear pairings" is refused, or null (reading R9): Closed, nothing
 * paired, or a Match already with a result.
 */
export function clearPairingsError({
  closed,
  matches,
}: {
  closed: boolean;
  matches: { result: LeagueResult | null }[];
}): string | null {
  if (closed) return COMPETITION_CLOSED;
  if (matches.length === 0) return NO_PAIRINGS;
  return matches.some((m) => m.result !== null) ? PAIRINGS_HAVE_RESULT : null;
}

/**
 * Why Close is refused, naming what's left, or null once the League is
 * complete (reading R10): every Match that isn't a bye or sit-out has a
 * result, and every round is paired, or (Swiss) the next round can't be
 * paired without a repeat Match (`nextRoundPairable` false, a dead end:
 * `EVERY_PAIRING_REPEATS` tells the Organizer to close). `matches` are in
 * round and position order. A League of fewer than 2 Entrants can't close
 * (pairing's own words), and a Swiss League's rounds out of range refuse
 * with `roundsError`'s words rather than listing the rounds.
 */
export function unplayedSummary({
  config,
  entrantCount,
  matches,
  nameOf,
  nextRoundPairable,
}: {
  config: LeagueConfig;
  entrantCount: number;
  matches: LeagueMatchFacts[];
  nameOf: (entrantId: string) => string;
  /** False at a Swiss dead end (`nextRoundPairable` in the engine). */
  nextRoundPairable: boolean;
}): string | null {
  if (entrantCount < 2) return NEEDS_TWO_ENTRANTS;
  const outOfRange = roundsError(config, entrantCount);
  if (outOfRange) return outOfRange;
  const unplayed = matches
    .filter(isUnplayed)
    .sort((x, y) => x.round - y.round)
    .map((m) => `Round ${m.round}: ${nameOf(m.a)} v ${nameOf(m.b!)}`);
  const paired = new Set(matches.map((m) => m.round));
  // A Swiss League plays at most N − 1 rounds (`roundsError`).
  const rounds =
    config.pairing === "swiss"
      ? Math.min(roundsOf(config, entrantCount), entrantCount - 1)
      : roundsOf(config, entrantCount);
  const unpaired: number[] = [];
  const deadEnd = config.pairing === "swiss" && !nextRoundPairable;
  for (let round = 1; !deadEnd && round <= rounds; round++) {
    if (!paired.has(round)) unpaired.push(round);
  }
  if (unplayed.length === 0 && unpaired.length === 0) return null;
  const parts = [LEAGUE_UNFINISHED];
  if (unplayed.length > 0) parts.push(`Unplayed: ${unplayed.join("; ")}.`);
  if (unpaired.length > 0) {
    parts.push(
      `Not yet paired: ${unpaired.length === 1 ? "round" : "rounds"} ${unpaired.join(", ")}.`,
    );
  }
  return parts.join(" ");
}
