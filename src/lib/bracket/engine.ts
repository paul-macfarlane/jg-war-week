/**
 * The single-elimination Bracket engine. Every function is pure: it takes a
 * Bracket and returns a new one, never changing its input.
 */
import {
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import { finalMatchOf, thirdPlaceMatchOf } from "@/lib/bracket/final";
import { isDecided } from "@/lib/bracket/match-status";
import {
  type Bracket,
  BracketError,
  type Entrant,
  type FormatEngine,
  type Match,
  type MatchResult,
  type MatchSlot,
  type Placing,
  type WinnerTo,
} from "@/lib/bracket/types";

function emptySlot(): MatchSlot {
  return { entrantId: null, place: null, score: null };
}

/** The Bracket size for `count` Entrants: the next power of two. */
export function bracketSize(count: number): number {
  let size = 2;
  while (size < count) size *= 2;
  return size;
}

/**
 * Seed Positions in first-Round order, so 1 meets the last, and 1 and 2
 * can only meet in the final: 1, 8, 4, 5, 2, 7, 3, 6 for a size of 8.
 */
export function seedingOrder(size: number): number[] {
  let order = [1];
  while (order.length < size) {
    const n = order.length * 2;
    order = order.flatMap((position) => [position, n + 1 - position]);
  }
  return order;
}

function findMatch(bracket: Bracket, matchId: string): Match {
  const found = bracket.matches.find((h) => h.id === matchId);
  if (!found) throw new BracketError("That Match isn't in this Bracket.");
  return found;
}

/** A first-Round Match with an empty slot: its one Entrant advances. */
export function isBye(match: Match): boolean {
  return match.round === 1 && match.slots.some((s) => s.entrantId === null);
}

/**
 * Moves an Entrant along a link (a Match's winner, or a semifinal's loser)
 * into the Match it feeds. One already there is left alone, keeping that
 * Match's own result.
 */
function advance(bracket: Bracket, to: WinnerTo | null, entrantId: string) {
  if (!to) return;
  const next = findMatch(bracket, to.matchId);
  if (next.slots[to.slot].entrantId === entrantId) return;
  next.slots[to.slot] = { ...emptySlot(), entrantId };
  if (next.slots.every((s) => s.entrantId !== null)) next.status = "ready";
}

/**
 * Builds a single-elimination Bracket. Byes go to the top Seed Positions,
 * and each bye's Entrant is already advanced. With a 3rd place Match, it
 * is one more Match in the final's Round at position 2 (the final is 1),
 * fed by each semifinal's loser. Match ids come from `newId`.
 */
export function generate(
  entrants: Entrant[],
  newId: (round: number, position: number) => string = (round, position) =>
    `r${round}h${position}`,
  config: BracketConfig = DEFAULT_BRACKET_CONFIG,
): Bracket {
  if (entrants.length < 2) {
    throw new BracketError("A Bracket needs at least 2 Entrants.");
  }
  const refusal = thirdPlaceRefusal(config, entrants.length);
  if (refusal) throw new BracketError(refusal);
  const ranked = [...entrants].sort((a, b) => a.seedPosition - b.seedPosition);
  const size = bracketSize(ranked.length);
  const rounds = Math.log2(size);

  const ids = new Map<string, string>();
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      ids.set(`${round}:${position}`, newId(round, position));
    }
  }
  const thirdPlaceId = config.thirdPlaceGame ? newId(rounds, 2) : null;

  const bracket: Bracket = { config, matches: [] };
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      bracket.matches.push({
        id: ids.get(`${round}:${position}`)!,
        round,
        position,
        slots: [emptySlot(), emptySlot()],
        winnerTo:
          round < rounds
            ? {
                matchId: ids.get(`${round + 1}:${Math.ceil(position / 2)}`)!,
                slot: (position - 1) % 2,
              }
            : null,
        loserTo:
          thirdPlaceId && round === rounds - 1
            ? { matchId: thirdPlaceId, slot: (position - 1) % 2 }
            : null,
        thirdPlace: false,
        status: "pending",
        recordedAt: null,
      });
    }
  }
  if (thirdPlaceId) {
    bracket.matches.push({
      id: thirdPlaceId,
      round: rounds,
      position: 2,
      slots: [emptySlot(), emptySlot()],
      winnerTo: null,
      loserTo: null,
      thirdPlace: true,
      status: "pending",
      recordedAt: null,
    });
  }

  const order = seedingOrder(size);
  const firstRound = bracket.matches.filter((h) => h.round === 1);
  firstRound.forEach((match, i) => {
    match.slots.forEach((slot, s) => {
      slot.entrantId = ranked[order[i * 2 + s] - 1]?.id ?? null;
    });
  });
  for (const match of firstRound) {
    const lone = match.slots.filter((s) => s.entrantId !== null);
    if (lone.length === match.slots.length) {
      match.status = "ready";
      continue;
    }
    lone[0].place = 1;
    match.status = "played";
    advance(bracket, match.winnerTo, lone[0].entrantId!);
  }
  return bracket;
}

/** Whether any Match has a recorded Match Result (byes don't count). */
export function hasResults(bracket: Bracket): boolean {
  return bracket.matches.some((h) => isDecided(h) && !isBye(h));
}

/** Whether the final, and the 3rd place Match when there is one, are decided. */
export function isComplete(bracket: Bracket): boolean {
  const final = finalMatchOf(bracket);
  const third = thirdPlaceMatchOf(bracket);
  return (
    final !== undefined &&
    isDecided(final) &&
    (third === undefined || isDecided(third))
  );
}

/** The Entrant who won the final, or null while it's undecided. */
export function bracketWinner(bracket: Bracket): string | null {
  const final = finalMatchOf(bracket);
  if (!final || !isDecided(final)) return null;
  return final.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

function winnerOf(match: Match): string | null {
  return match.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

/**
 * Empties the slot a link fills, sending its Match back to pending, then
 * follows that Match's own winner and loser on. Collects the ids of the
 * Matches that had a Match Result.
 */
function clearLink(bracket: Bracket, link: WinnerTo, resetMatchIds: string[]) {
  const next = findMatch(bracket, link.matchId);
  if (next.slots[link.slot].entrantId === null) return;
  if (isDecided(next)) resetMatchIds.push(next.id);
  next.slots = next.slots.map((slot, i) =>
    i === link.slot
      ? emptySlot()
      : { ...emptySlot(), entrantId: slot.entrantId },
  );
  next.status = "pending";
  if (next.winnerTo) clearLink(bracket, next.winnerTo, resetMatchIds);
  if (next.loserTo) clearLink(bracket, next.loserTo, resetMatchIds);
}

/**
 * Clears `match`'s winner (and a semifinal's loser) out of every later Match
 * they reached, sending those Matches back to pending. Returns the ids of the
 * ones that had a Match Result.
 */
function clearDownstream(bracket: Bracket, match: Match): string[] {
  const resetMatchIds: string[] = [];
  if (match.winnerTo) clearLink(bracket, match.winnerTo, resetMatchIds);
  if (match.loserTo) clearLink(bracket, match.loserTo, resetMatchIds);
  return resetMatchIds;
}

/**
 * The later Matches that recording `winnerId` as the winner of `matchId` would
 * send back to unplayed: those with a Match Result that the current winner
 * reached. None when the Match is undecided, is a bye, or keeps its winner
 * (a score-only edit).
 */
export function resetByResult(
  bracket: Bracket,
  matchId: string,
  winnerId: string | null,
): string[] {
  const match = findMatch(bracket, matchId);
  if (!isDecided(match) || isBye(match) || winnerId === null) return [];
  if (winnerOf(match) === winnerId) return [];
  const next = structuredClone(bracket);
  return clearDownstream(next, findMatch(next, matchId));
}

/**
 * Records a Match Result and advances the winner (and a semifinal's loser,
 * to the 3rd place Match). A knockout Match needs a
 * clear order of every Entrant.
 * Re-recording a decided Match with a new winner first clears the old winner
 * from the later Matches it reached (see `resetByResult`); keeping the winner
 * changes only this Match.
 */
export function applyResult(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): Bracket {
  const next = structuredClone(bracket);
  const match = findMatch(next, matchId);
  if (isBye(match)) throw new BracketError("A bye has no Match Result.");
  if (match.slots.some((s) => s.entrantId === null)) {
    throw new BracketError("This Match is still waiting for its Entrants.");
  }
  const ids = match.slots.map((s) => s.entrantId!);
  const { order } = result;
  if (
    order.length !== ids.length ||
    new Set(order).size !== order.length ||
    !order.every((id) => ids.includes(id))
  ) {
    throw new BracketError(
      "Put every Entrant of this Match in finishing order, once each.",
    );
  }
  const scores = result.scores ?? {};
  if (Object.keys(scores).some((id) => !ids.includes(id))) {
    throw new BracketError(
      "Scores can only be given for this Match's Entrants.",
    );
  }

  const finishing = order;
  if (isDecided(match) && winnerOf(match) !== finishing[0]) {
    clearDownstream(next, match);
  }

  match.slots = match.slots.map((slot) => ({
    entrantId: slot.entrantId,
    place: finishing.indexOf(slot.entrantId!) + 1,
    score: scores[slot.entrantId!]?.trim() || null,
  }));
  match.status = "played";
  advance(next, match.winnerTo, finishing[0]);
  advance(next, match.loserTo, finishing[1]);
  return next;
}

/**
 * Final placings of a finished Bracket, from the final only: 1st and 2nd;
 * then the 3rd place Match's 3rd and 4th. Without a 3rd place Match only
 * 1st and 2nd are placed: semifinal losers aren't. Nobody else is placed.
 * Sorted by place, then Seed Position.
 */
export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  if (!isComplete(bracket)) {
    throw new BracketError("The Bracket isn't finished yet.");
  }
  const final = finalMatchOf(bracket)!;
  const third = thirdPlaceMatchOf(bracket);
  const place = new Map<string, number>();
  for (const slot of final.slots) place.set(slot.entrantId!, slot.place!);
  if (third) {
    for (const slot of third.slots) place.set(slot.entrantId!, slot.place! + 2);
  }
  return [...entrants]
    .sort((a, b) => a.seedPosition - b.seedPosition)
    .flatMap((e) => {
      const at = place.get(e.id);
      return at === undefined ? [] : [{ entrantId: e.id, place: at }];
    })
    .sort((a, b) => a.place - b.place);
}

/**
 * The engine for a Bracket of 2 per Match with 1 advancing (a head-to-head
 * knockout, not a Format of its own): the winner advances. Its one extra
 * setting is the 3rd place Match.
 */
export const singleElimination: FormatEngine = {
  validateConfig: thirdPlaceRefusal,
  generate: (config, entrants, newId) => generate(entrants, newId, config),
  applyResult,
  resetByResult(bracket, matchId, result) {
    return resetByResult(bracket, matchId, result.order[0] ?? null);
  },
  isRecordable(bracket, matchId) {
    const match = bracket.matches.find((h) => h.id === matchId);
    return (
      match !== undefined &&
      !isBye(match) &&
      match.slots.every((s) => s.entrantId !== null)
    );
  },
  isBye: (_bracket, match) => isBye(match),
  hasResults,
  isComplete,
  winner: bracketWinner,
  finalPlacings,
};
