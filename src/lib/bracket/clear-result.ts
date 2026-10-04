/**
 * Clearing a Bracket Match's result (spec R21, S4; D1c), and the check that
 * a write leaves every other recorded result as it was. Only the latest
 * result along a path changes: a Match whose result a later Match already
 * used (in a Group Bracket, any Match before a Round with a result) is
 * refused. Pure: takes a Bracket and returns a new one.
 */
import { isHeadToHead } from "@/lib/bracket/config";
import { isBye } from "@/lib/bracket/formats";
import { isDecided } from "@/lib/bracket/match-status";
import { resultLockReason } from "@/lib/bracket/self-report";
import {
  type Bracket,
  BracketError,
  type Match,
  type MatchSlot,
  type WinnerTo,
} from "@/lib/bracket/types";

export const NO_RESULT_TO_CLEAR = "This Match has no result to clear.";

const unplaced = (slot: MatchSlot): MatchSlot => ({
  entrantId: slot.entrantId,
  place: null,
  score: null,
});

const empty = (): MatchSlot => ({ entrantId: null, place: null, score: null });

function find(bracket: Bracket, matchId: string): Match {
  const found = bracket.matches.find((h) => h.id === matchId);
  if (!found) throw new BracketError("That Match isn't in this Bracket.");
  return found;
}

/** Takes the Entrant a link sent back out of the (unplayed) Match it fills. */
function unlink(bracket: Bracket, link: WinnerTo | null) {
  if (!link) return;
  const next = find(bracket, link.matchId);
  next.slots = next.slots.map((slot, i) =>
    i === link.slot ? empty() : unplaced(slot),
  );
  next.status = "pending";
}

/**
 * The Bracket with `matchId`'s result cleared: its places and Scores
 * emptied and the Match ready to record again. In a head-to-head Bracket
 * its winner (and a semifinal's loser) leave the Matches they went to; in
 * a Group Bracket the later Rounds wait again, empty, as before the Round
 * was complete. Refuses a bye, a Match with no result, and a locked one
 * (`resultLockReason`: a result a later Match already used, or in a Group
 * Bracket one before a Round with a result).
 */
export function clearResult(bracket: Bracket, matchId: string): Bracket {
  const found = find(bracket, matchId);
  if (isBye(bracket, found) || !isDecided(found)) {
    throw new BracketError(NO_RESULT_TO_CLEAR);
  }
  const locked = resultLockReason(bracket, found);
  if (locked) throw new BracketError(locked);
  const next = structuredClone(bracket);
  const match = find(next, matchId);
  match.slots = match.slots.map(unplaced);
  match.status = "ready";
  if (isHeadToHead(next.config)) {
    unlink(next, match.winnerTo);
    unlink(next, match.loserTo);
  } else {
    for (const later of next.matches) {
      if (later.round <= match.round) continue;
      later.slots = later.slots.map(empty);
      later.status = "pending";
    }
  }
  return next;
}

/**
 * Whether going from `before` to `after` changes the recorded result of a
 * Match other than `matchId` (a bye's doesn't count): the backstop that
 * keeps a write from silently undoing a later Match's result (D1c).
 */
export function otherResultsChanged(
  before: Bracket,
  after: Bracket,
  matchId: string,
): boolean {
  const afterById = new Map(after.matches.map((h) => [h.id, h]));
  return before.matches.some((h) => {
    if (h.id === matchId || !isDecided(h) || isBye(before, h)) return false;
    const now = afterById.get(h.id);
    return (
      !now ||
      now.status !== h.status ||
      JSON.stringify(now.slots) !== JSON.stringify(h.slots)
    );
  });
}
