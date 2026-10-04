/**
 * The single-elimination Bracket engine. Every function is pure: it takes a
 * Bracket and returns a new one, never changing its input.
 */
import {
  type BracketConfig,
  DEFAULT_BRACKET_CONFIG,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import { finalHeatOf, thirdPlaceHeatOf } from "@/lib/bracket/final";
import { isDecided } from "@/lib/bracket/heat-status";
import {
  type Bracket,
  BracketError,
  type Entrant,
  type FormatEngine,
  type Heat,
  type HeatResult,
  type HeatSlot,
  type Placing,
  type WinnerTo,
} from "@/lib/bracket/types";

function emptySlot(): HeatSlot {
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

function findHeat(bracket: Bracket, heatId: string): Heat {
  const found = bracket.heats.find((h) => h.id === heatId);
  if (!found) throw new BracketError("That Match isn't in this Bracket.");
  return found;
}

/** A first-Round Heat with an empty slot: its one Entrant advances. */
export function isBye(heat: Heat): boolean {
  return heat.round === 1 && heat.slots.some((s) => s.entrantId === null);
}

/**
 * Moves an Entrant along a link (a Heat's winner, or a semifinal's loser)
 * into the Heat it feeds. One already there is left alone, keeping that
 * Heat's own result.
 */
function advance(bracket: Bracket, to: WinnerTo | null, entrantId: string) {
  if (!to) return;
  const next = findHeat(bracket, to.heatId);
  if (next.slots[to.slot].entrantId === entrantId) return;
  next.slots[to.slot] = { ...emptySlot(), entrantId };
  if (next.slots.every((s) => s.entrantId !== null)) next.status = "ready";
}

/**
 * Builds a single-elimination Bracket. Byes go to the top Seed Positions,
 * and each bye's Entrant is already advanced. With a 3rd place Match, it
 * is one more Heat in the final's Round at position 2 (the final is 1),
 * fed by each semifinal's loser. Heat ids come from `newId`.
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

  const bracket: Bracket = { config, heats: [] };
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      bracket.heats.push({
        id: ids.get(`${round}:${position}`)!,
        round,
        position,
        slots: [emptySlot(), emptySlot()],
        winnerTo:
          round < rounds
            ? {
                heatId: ids.get(`${round + 1}:${Math.ceil(position / 2)}`)!,
                slot: (position - 1) % 2,
              }
            : null,
        loserTo:
          thirdPlaceId && round === rounds - 1
            ? { heatId: thirdPlaceId, slot: (position - 1) % 2 }
            : null,
        thirdPlace: false,
        status: "pending",
        recordedAt: null,
      });
    }
  }
  if (thirdPlaceId) {
    bracket.heats.push({
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
  const firstRound = bracket.heats.filter((h) => h.round === 1);
  firstRound.forEach((heat, i) => {
    heat.slots.forEach((slot, s) => {
      slot.entrantId = ranked[order[i * 2 + s] - 1]?.id ?? null;
    });
  });
  for (const heat of firstRound) {
    const lone = heat.slots.filter((s) => s.entrantId !== null);
    if (lone.length === heat.slots.length) {
      heat.status = "ready";
      continue;
    }
    lone[0].place = 1;
    heat.status = "played";
    advance(bracket, heat.winnerTo, lone[0].entrantId!);
  }
  return bracket;
}

/** Whether any Heat has a recorded Heat Result (byes don't count). */
export function hasResults(bracket: Bracket): boolean {
  return bracket.heats.some((h) => isDecided(h) && !isBye(h));
}

/** Whether the final, and the 3rd place Match when there is one, are decided. */
export function isComplete(bracket: Bracket): boolean {
  const final = finalHeatOf(bracket);
  const third = thirdPlaceHeatOf(bracket);
  return (
    final !== undefined &&
    isDecided(final) &&
    (third === undefined || isDecided(third))
  );
}

/** The Entrant who won the final, or null while it's undecided. */
export function bracketWinner(bracket: Bracket): string | null {
  const final = finalHeatOf(bracket);
  if (!final || !isDecided(final)) return null;
  return final.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

function winnerOf(heat: Heat): string | null {
  return heat.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

/**
 * Empties the slot a link fills, sending its Heat back to pending, then
 * follows that Heat's own winner and loser on. Collects the ids of the
 * Heats that had a Heat Result.
 */
function clearLink(bracket: Bracket, link: WinnerTo, resetHeatIds: string[]) {
  const next = findHeat(bracket, link.heatId);
  if (next.slots[link.slot].entrantId === null) return;
  if (isDecided(next)) resetHeatIds.push(next.id);
  next.slots = next.slots.map((slot, i) =>
    i === link.slot
      ? emptySlot()
      : { ...emptySlot(), entrantId: slot.entrantId },
  );
  next.status = "pending";
  if (next.winnerTo) clearLink(bracket, next.winnerTo, resetHeatIds);
  if (next.loserTo) clearLink(bracket, next.loserTo, resetHeatIds);
}

/**
 * Clears `heat`'s winner (and a semifinal's loser) out of every later Heat
 * they reached, sending those Heats back to pending. Returns the ids of the
 * ones that had a Heat Result.
 */
function clearDownstream(bracket: Bracket, heat: Heat): string[] {
  const resetHeatIds: string[] = [];
  if (heat.winnerTo) clearLink(bracket, heat.winnerTo, resetHeatIds);
  if (heat.loserTo) clearLink(bracket, heat.loserTo, resetHeatIds);
  return resetHeatIds;
}

/**
 * The later Heats that recording `winnerId` as the winner of `heatId` would
 * send back to unplayed: those with a Heat Result that the current winner
 * reached. None when the Heat is undecided, is a bye, or keeps its winner
 * (a score-only edit).
 */
export function resetByResult(
  bracket: Bracket,
  heatId: string,
  winnerId: string | null,
): string[] {
  const heat = findHeat(bracket, heatId);
  if (!isDecided(heat) || isBye(heat) || winnerId === null) return [];
  if (winnerOf(heat) === winnerId) return [];
  const next = structuredClone(bracket);
  return clearDownstream(next, findHeat(next, heatId));
}

/**
 * Records a Heat Result and advances the winner (and a semifinal's loser,
 * to the 3rd place Match). A knockout Heat needs a
 * clear order of every Entrant.
 * Re-recording a decided Heat with a new winner first clears the old winner
 * from the later Heats it reached (see `resetByResult`); keeping the winner
 * changes only this Heat.
 */
export function applyResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): Bracket {
  const next = structuredClone(bracket);
  const heat = findHeat(next, heatId);
  if (isBye(heat)) throw new BracketError("A bye has no Match Result.");
  if (heat.slots.some((s) => s.entrantId === null)) {
    throw new BracketError("This Match is still waiting for its Entrants.");
  }
  const ids = heat.slots.map((s) => s.entrantId!);
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
  if (isDecided(heat) && winnerOf(heat) !== finishing[0]) {
    clearDownstream(next, heat);
  }

  heat.slots = heat.slots.map((slot) => ({
    entrantId: slot.entrantId,
    place: finishing.indexOf(slot.entrantId!) + 1,
    score: scores[slot.entrantId!]?.trim() || null,
  }));
  heat.status = "played";
  advance(next, heat.winnerTo, finishing[0]);
  advance(next, heat.loserTo, finishing[1]);
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
  const final = finalHeatOf(bracket)!;
  const third = thirdPlaceHeatOf(bracket);
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
 * The engine for a Bracket of 2 per Heat with 1 advancing (a head-to-head
 * knockout, not a Format of its own): the winner advances. Its one extra
 * setting is the 3rd place Match.
 */
export const singleElimination: FormatEngine = {
  validateConfig: thirdPlaceRefusal,
  generate: (config, entrants, newId) => generate(entrants, newId, config),
  applyResult,
  resetByResult(bracket, heatId, result) {
    return resetByResult(bracket, heatId, result.order[0] ?? null);
  },
  isRecordable(bracket, heatId) {
    const heat = bracket.heats.find((h) => h.id === heatId);
    return (
      heat !== undefined &&
      !isBye(heat) &&
      heat.slots.every((s) => s.entrantId !== null)
    );
  },
  isBye: (_bracket, heat) => isBye(heat),
  hasResults,
  isComplete,
  winner: bracketWinner,
  finalPlacings,
};
