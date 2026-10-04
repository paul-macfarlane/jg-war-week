/**
 * Where a Match stands for recording its result (spec R21, D1c, D1d):
 * open, unfilled, decided, a bye, or decided and locked: in a head-to-head
 * Bracket by a later Match that used its result, in a Group Bracket by any
 * result in a later Round. Pure. The Match-fact rules live in
 * `match-report-rule.ts` (kept engine- and zod-free for `access.ts`) and
 * are re-exported here for the mutations and the pages.
 */
import { isHeadToHead } from "@/lib/bracket/config";
import { isBye } from "@/lib/bracket/formats";
import {
  type MatchReportState,
  matchResultError,
} from "@/lib/bracket/match-report-rule";
import { isDecided } from "@/lib/bracket/match-status";
import type { Bracket, Match } from "@/lib/bracket/types";

export {
  LATER_MATCH_USED,
  LATER_ROUND_HAS_RESULT,
  type MatchReportFacet,
  type MatchReportState,
  matchReportError,
  matchResultError,
} from "@/lib/bracket/match-report-rule";

/**
 * Whether a later Match already used `match`'s result: a played Match (not
 * a bye) of a later Round holds one of its Entrants. For a head-to-head
 * Bracket that is the Match its winner (or a semifinal's loser) went to;
 * for a Group Bracket, any Match its advancers went to.
 */
export function usedLater(bracket: Bracket, match: Match): boolean {
  const ids = new Set(
    match.slots.flatMap((s) => (s.entrantId ? [s.entrantId] : [])),
  );
  return bracket.matches.some(
    (later) =>
      later.round > match.round &&
      isDecided(later) &&
      !isBye(bracket, later) &&
      later.slots.some((s) => s.entrantId !== null && ids.has(s.entrantId)),
  );
}

/** Whether a played Match (not a bye) of a Round after `match`'s has a result. */
export function laterRoundHasResult(bracket: Bracket, match: Match): boolean {
  return bracket.matches.some(
    (later) =>
      later.round > match.round && isDecided(later) && !isBye(bracket, later),
  );
}

/**
 * What locks a decided Match's result, or null: in a head-to-head Bracket
 * a later Match that used it (`usedLater`); in a Group Bracket any result
 * in a later Round, since a clear empties every later Round and an
 * advancer change re-deals the next.
 */
function resultLock(
  bracket: Bracket,
  match: Match,
): "used-later" | "later-round-result" | null {
  if (isHeadToHead(bracket.config)) {
    return usedLater(bracket, match) ? "used-later" : null;
  }
  return laterRoundHasResult(bracket, match) ? "later-round-result" : null;
}

/**
 * Why a decided Match's result can't be edited or cleared now, for
 * everyone, or null: the reason the admin tree and the participant page
 * show beside its disabled Edit and Clear result, and the server's refusal.
 */
export function resultLockReason(
  bracket: Bracket,
  match: Match,
): string | null {
  if (isBye(bracket, match) || !isDecided(match)) return null;
  const lock = resultLock(bracket, match);
  return lock ? matchResultError(lock) : null;
}

/**
 * A bye (never played), used-later or later-round-result (decided, and
 * locked by `resultLock`), decided (it has a Match Result it can still
 * change), unfilled (still waiting for an Entrant) or open (every slot
 * filled, no result).
 */
export function matchReportState(
  bracket: Bracket,
  match: Match,
): MatchReportState {
  if (isBye(bracket, match)) return "bye";
  if (isDecided(match)) return resultLock(bracket, match) ?? "decided";
  if (match.slots.some((s) => s.entrantId === null)) return "unfilled";
  return "open";
}
