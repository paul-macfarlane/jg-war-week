/**
 * The single-elimination Bracket engine. Every function is pure: it takes a
 * Bracket and returns a new one, never changing its input.
 */
import {
  type Bracket,
  BracketError,
  type Entrant,
  type Heat,
  type HeatResult,
  type HeatSlot,
  type Placing,
} from "@/lib/bracket/types";

function emptySlot(): HeatSlot {
  return { entrantId: null, place: null, score: null, forfeited: false };
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
  if (!found) throw new BracketError("That Heat isn't in this Bracket.");
  return found;
}

/** A first-Round Heat with an empty slot: its one Entrant advances. */
export function isBye(heat: Heat): boolean {
  return heat.round === 1 && heat.slots.some((s) => s.entrantId === null);
}

export function isDecided(heat: Heat): boolean {
  return heat.status === "played" || heat.status === "forfeit";
}

/**
 * Moves a Heat's winner into the Heat it feeds. A winner already there is
 * left alone, keeping that Heat's own result.
 */
function advance(bracket: Bracket, heat: Heat, entrantId: string) {
  if (!heat.winnerTo) return;
  const next = findHeat(bracket, heat.winnerTo.heatId);
  if (next.slots[heat.winnerTo.slot].entrantId === entrantId) return;
  next.slots[heat.winnerTo.slot] = { ...emptySlot(), entrantId };
  if (next.slots.every((s) => s.entrantId !== null)) next.status = "ready";
}

/**
 * Builds a single-elimination Bracket. Byes go to the top Seed Positions,
 * and each bye's Entrant is already advanced. Heat ids come from `newId`.
 */
export function generate(
  entrants: Entrant[],
  newId: (round: number, position: number) => string = (round, position) =>
    `r${round}h${position}`,
): Bracket {
  if (entrants.length < 2) {
    throw new BracketError("A Bracket needs at least 2 Entrants.");
  }
  const ranked = [...entrants].sort((a, b) => a.seedPosition - b.seedPosition);
  const size = bracketSize(ranked.length);
  const rounds = Math.log2(size);

  const ids = new Map<string, string>();
  for (let round = 1; round <= rounds; round++) {
    for (let position = 1; position <= size / 2 ** round; position++) {
      ids.set(`${round}:${position}`, newId(round, position));
    }
  }

  const bracket: Bracket = { heats: [] };
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
        status: "pending",
      });
    }
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
    advance(bracket, heat, lone[0].entrantId!);
  }
  return bracket;
}

/** Whether any Heat has a recorded Heat Result (byes don't count). */
export function hasResults(bracket: Bracket): boolean {
  return bracket.heats.some((h) => isDecided(h) && !isBye(h));
}

function finalHeat(bracket: Bracket): Heat | undefined {
  return bracket.heats.find((h) => h.winnerTo === null);
}

/** Whether the final has been decided. */
export function isComplete(bracket: Bracket): boolean {
  const final = finalHeat(bracket);
  return final !== undefined && isDecided(final);
}

/** The Entrant who won the final, or null while it's undecided. */
export function champion(bracket: Bracket): string | null {
  const final = finalHeat(bracket);
  if (!final || !isDecided(final)) return null;
  return final.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

function winnerOf(heat: Heat): string | null {
  return heat.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

/**
 * Clears `heat`'s winner out of every later Heat it reached, sending those
 * Heats back to pending. Returns the ids of the ones that had a Heat Result.
 */
function clearDownstream(bracket: Bracket, heat: Heat): string[] {
  const resetHeatIds: string[] = [];
  let current = heat;
  while (current.winnerTo) {
    const next = findHeat(bracket, current.winnerTo.heatId);
    if (next.slots[current.winnerTo.slot].entrantId === null) break;
    if (isDecided(next)) resetHeatIds.push(next.id);
    next.slots = next.slots.map((slot, i) =>
      i === current.winnerTo!.slot
        ? emptySlot()
        : { ...emptySlot(), entrantId: slot.entrantId },
    );
    next.status = "pending";
    current = next;
  }
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
 * Records a Heat Result and advances the winner. A knockout Heat needs a
 * clear order of every Entrant; forfeiting Entrants finish behind the rest.
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
  if (isBye(heat)) throw new BracketError("A bye has no Heat Result.");
  if (heat.slots.some((s) => s.entrantId === null)) {
    throw new BracketError("This Heat is still waiting for its Entrants.");
  }
  const ids = heat.slots.map((s) => s.entrantId!);
  const { order } = result;
  if (
    order.length !== ids.length ||
    new Set(order).size !== order.length ||
    !order.every((id) => ids.includes(id))
  ) {
    throw new BracketError(
      "Put every Entrant of this Heat in finishing order, once each.",
    );
  }
  const forfeits = new Set(result.forfeits ?? []);
  if ([...forfeits].some((id) => !ids.includes(id))) {
    throw new BracketError("Only an Entrant of this Heat can forfeit it.");
  }
  if (forfeits.size === ids.length) {
    throw new BracketError(
      "Someone has to advance, so not every Entrant can forfeit.",
    );
  }
  const scores = result.scores ?? {};
  if (Object.keys(scores).some((id) => !ids.includes(id))) {
    throw new BracketError(
      "Scores can only be given for this Heat's Entrants.",
    );
  }

  const finishing = [
    ...order.filter((id) => !forfeits.has(id)),
    ...order.filter((id) => forfeits.has(id)),
  ];
  if (isDecided(heat) && winnerOf(heat) !== finishing[0]) {
    clearDownstream(next, heat);
  }

  heat.slots = heat.slots.map((slot) => ({
    entrantId: slot.entrantId,
    place: finishing.indexOf(slot.entrantId!) + 1,
    score: scores[slot.entrantId!]?.trim() || null,
    forfeited: forfeits.has(slot.entrantId!),
  }));
  heat.status = forfeits.size > 0 ? "forfeit" : "played";
  advance(next, heat, finishing[0]);
  return next;
}

/**
 * Final placings of a finished Bracket: 1st, 2nd, then tied places by the
 * Round each Entrant lost in (both semifinal losers are 3rd). A bye is not
 * a played Heat. Sorted by place, then Seed Position.
 */
export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  if (!isComplete(bracket)) {
    throw new BracketError("The Bracket isn't finished yet.");
  }
  const finalRound = finalHeat(bracket)!.round;
  // How far each Entrant got: the Round they lost in, or one past the final.
  const reached = new Map<string, number>();
  for (const heat of bracket.heats) {
    if (!isDecided(heat) || isBye(heat)) continue;
    for (const slot of heat.slots) {
      if (slot.place !== 1) reached.set(slot.entrantId!, heat.round);
      else if (heat.round === finalRound) {
        reached.set(slot.entrantId!, finalRound + 1);
      }
    }
  }
  const depth = (id: string) => reached.get(id) ?? 0;
  return [...entrants]
    .sort((a, b) => a.seedPosition - b.seedPosition)
    .map((e) => ({
      entrantId: e.id,
      place: 1 + entrants.filter((o) => depth(o.id) > depth(e.id)).length,
    }))
    .sort((a, b) => a.place - b.place);
}
