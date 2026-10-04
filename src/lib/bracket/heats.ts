/**
 * The engine for a Bracket of any other heat size: Heats of up to S Entrants, the top A of each
 * advancing, Round after Round until one Heat is left. Every function is
 * pure: it takes a Bracket and returns a new one, never changing its input.
 */
import {
  type BracketConfig,
  bracketConfigSchema,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import { finalHeatOf, finalRoundOf } from "@/lib/bracket/final";
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
} from "@/lib/bracket/types";
import { BRACKET_PLACEMENTS } from "@/lib/competitions";

/** More Rounds than any Bracket the builder allows could need. */
const MAX_ROUNDS = 64;

/**
 * The Heat sizes of a Round of `count` Entrants dealt snake-style into
 * ⌈count/S⌉ Heats: they differ by at most one.
 */
function heatSizes(count: number, perHeat: number): number[] {
  const heatCount = Math.ceil(count / perHeat);
  const sizes = Array.from({ length: heatCount }, () => 0);
  for (let rank = 0; rank < count; rank++) sizes[snakeHeat(rank, heatCount)]++;
  return sizes;
}

/** Which Heat (0-based) the `rank`th Entrant (0-based) is dealt into. */
function snakeHeat(rank: number, heatCount: number): number {
  const pass = Math.floor(rank / heatCount);
  const along = rank % heatCount;
  return pass % 2 === 0 ? along : heatCount - 1 - along;
}

/**
 * Every Round's Heat sizes for `count` Entrants, the last Round being one
 * Heat; or the Round that would never end (it sends on as many as it got).
 */
function roundShape(
  count: number,
  { entrantsPerHeat, advancePerHeat }: BracketConfig,
): { rounds: number[][] } | { neverEnds: number } {
  const rounds: number[][] = [];
  let remaining = count;
  while (remaining > entrantsPerHeat) {
    if (rounds.length >= MAX_ROUNDS) {
      throw new Error(`more than ${MAX_ROUNDS} Rounds for ${count} Entrants`);
    }
    const sizes = heatSizes(remaining, entrantsPerHeat);
    const onward = sizes.reduce((n, k) => n + Math.min(k, advancePerHeat), 0);
    if (onward >= remaining) return { neverEnds: rounds.length + 1 };
    rounds.push(sizes);
    remaining = onward;
  }
  rounds.push([remaining]);
  return { rounds };
}

/** Why Generate is refused for this config and Entrant count, or null. */
export function validateConfig(
  config: BracketConfig,
  entrantCount: number,
): string | null {
  const parsed = bracketConfigSchema.safeParse(config);
  if (!parsed.success) return parsed.error.issues[0].message;
  const thirdPlace = thirdPlaceRefusal(parsed.data, entrantCount);
  if (thirdPlace) return thirdPlace;
  if (entrantCount < 2) return "A Bracket needs at least 2 Entrants.";
  const shape = roundShape(entrantCount, parsed.data);
  if ("neverEnds" in shape) {
    const { entrantsPerHeat, advancePerHeat } = parsed.data;
    return `With ${entrantCount} Entrants, ${entrantsPerHeat} per Heat and ${advancePerHeat} advancing, Round ${shape.neverEnds} would never end. Lower how many advance.`;
  }
  return null;
}

function emptySlot(): HeatSlot {
  return { entrantId: null, place: null, score: null };
}

function roundHeats(bracket: Bracket, round: number): Heat[] {
  return bracket.heats
    .filter((h) => h.round === round)
    .sort((a, b) => a.position - b.position);
}

/**
 * A Heat that is never played: one before the final Round with no more
 * Entrants than advance, so all of them go through.
 */
export function isBye(bracket: Bracket, heat: Heat): boolean {
  return (
    heat.round < finalRoundOf(bracket) &&
    heat.slots.length <= bracket.config.advancePerHeat
  );
}

/**
 * Deals `ranked` Entrants into a Round's Heats snake-style (1st to Heat 1,
 * …, then back from the last Heat), deciding its byes: a bye's places
 * follow the deal. When that completes a Round before the final, the next
 * Round is filled in turn.
 */
function fillRound(bracket: Bracket, round: number, ranked: string[]) {
  const heats = roundHeats(bracket, round);
  const dealt: string[][] = heats.map(() => []);
  ranked.forEach((id, rank) => dealt[snakeHeat(rank, heats.length)].push(id));
  heats.forEach((heat, i) => {
    if (dealt[i].length !== heat.slots.length) {
      throw new Error(
        `Round ${round} Heat ${heat.position} dealt ${dealt[i].length} for ${heat.slots.length} slots`,
      );
    }
    const bye = isBye(bracket, heat);
    heat.slots = dealt[i].map((entrantId, place) => ({
      ...emptySlot(),
      entrantId,
      place: bye ? place + 1 : null,
    }));
    heat.status = bye ? "played" : "ready";
  });
  fillNextIfComplete(bracket, round);
}

/** Once every Heat of `round` is decided, its advancers fill the next. */
function fillNextIfComplete(bracket: Bracket, round: number) {
  if (round >= finalRoundOf(bracket)) return;
  const advancers = advancersOf(bracket, round);
  if (advancers) fillRound(bracket, round + 1, advancers);
}

/**
 * A complete Round's advancers, ranked by place, then by Heat position (all
 * the 1st places in Heat order, then all the 2nds…); null until every Heat
 * of the Round is decided.
 */
function advancersOf(bracket: Bracket, round: number): string[] | null {
  const heats = roundHeats(bracket, round);
  if (!heats.every(isDecided)) return null;
  const { advancePerHeat } = bracket.config;
  const ranked: string[] = [];
  for (let place = 1; place <= advancePerHeat; place++) {
    for (const heat of heats) {
      const slot = heat.slots.find((s) => s.place === place);
      if (slot) ranked.push(slot.entrantId!);
    }
  }
  return ranked;
}

/**
 * Builds every Heat of every Round of a Heats Bracket. Round 1 is dealt by
 * Seed Position, and its byes are already decided; later Rounds wait, empty,
 * until the Round before them is complete. Heat ids come from `newId`.
 */
export function generate(
  config: BracketConfig,
  entrants: Entrant[],
  newId: (round: number, position: number) => string,
): Bracket {
  const refusal = validateConfig(config, entrants.length);
  if (refusal) throw new BracketError(refusal);
  const shape = roundShape(entrants.length, config);
  if (!("rounds" in shape)) throw new Error("validated shape never ends");

  const bracket: Bracket = { config, heats: [] };
  shape.rounds.forEach((sizes, r) => {
    sizes.forEach((size, p) => {
      bracket.heats.push({
        id: newId(r + 1, p + 1),
        round: r + 1,
        position: p + 1,
        slots: Array.from({ length: size }, emptySlot),
        winnerTo: null,
        loserTo: null,
        thirdPlace: false,
        status: "pending",
        recordedAt: null,
      });
    });
  });
  const ranked = [...entrants].sort((a, b) => a.seedPosition - b.seedPosition);
  fillRound(
    bracket,
    1,
    ranked.map((e) => e.id),
  );
  return bracket;
}

function findHeat(bracket: Bracket, heatId: string): Heat {
  const found = bracket.heats.find((h) => h.id === heatId);
  if (!found) throw new BracketError("That Heat isn't in this Bracket.");
  return found;
}

/**
 * Sets a Heat's places from a Heat Result, refusing one that isn't a clear
 * order of every Entrant.
 */
function record(bracket: Bracket, heat: Heat, result: HeatResult) {
  if (isBye(bracket, heat)) throw new BracketError("A bye has no Heat Result.");
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
  const scores = result.scores ?? {};
  if (Object.keys(scores).some((id) => !ids.includes(id))) {
    throw new BracketError(
      "Scores can only be given for this Heat's Entrants.",
    );
  }
  const finishing = order;
  heat.slots = heat.slots.map((slot) => ({
    entrantId: slot.entrantId,
    place: finishing.indexOf(slot.entrantId!) + 1,
    score: scores[slot.entrantId!]?.trim() || null,
  }));
  heat.status = "played";
}

/**
 * Empties every Heat after `round`, sending them back to pending. Returns
 * the ids of the ones that had a Heat Result, in Round then Heat order.
 */
function clearAfter(bracket: Bracket, round: number): string[] {
  const later = bracket.heats
    .filter((h) => h.round > round)
    .sort((a, b) => a.round - b.round || a.position - b.position);
  const resetHeatIds = later
    .filter((h) => isDecided(h) && !isBye(bracket, h))
    .map((h) => h.id);
  for (const heat of later) {
    heat.slots = heat.slots.map(emptySlot);
    heat.status = "pending";
  }
  return resetHeatIds;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Records `result` on a copy of the Bracket, clearing the later Rounds when
 * the Heat's Round was already complete and the result changes who
 * advances or their order. Returns the copy and the Heats that had a Heat
 * Result among those cleared.
 */
function rerecord(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): { next: Bracket; resetHeatIds: string[] } {
  const next = structuredClone(bracket);
  const heat = findHeat(next, heatId);
  const before = advancersOf(next, heat.round);
  record(next, heat, result);
  if (heat.round === finalRoundOf(next)) return { next, resetHeatIds: [] };
  if (before === null) {
    fillNextIfComplete(next, heat.round);
    return { next, resetHeatIds: [] };
  }
  if (sameOrder(before, advancersOf(next, heat.round)!)) {
    return { next, resetHeatIds: [] };
  }
  const resetHeatIds = clearAfter(next, heat.round);
  fillNextIfComplete(next, heat.round);
  return { next, resetHeatIds };
}

/**
 * Records a Heat Result. When that completes the Heat's Round, its
 * advancers fill the next Round. Re-recording a Heat of a complete Round
 * that changes who advances, or their order, first empties every later
 * Round (see `resetByResult`) and then fills the next one again.
 */
export function applyResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): Bracket {
  return rerecord(bracket, heatId, result).next;
}

/**
 * The later Heats with a Heat Result that recording `result` would clear:
 * none when the Heat is undecided or a bye, its Round isn't complete yet,
 * or the same Entrants still advance in the same order (a score-only edit,
 * or a change below the advance line).
 */
export function resetByResult(
  bracket: Bracket,
  heatId: string,
  result: HeatResult,
): string[] {
  const heat = findHeat(bracket, heatId);
  if (!isDecided(heat) || isBye(bracket, heat)) return [];
  return rerecord(bracket, heatId, result).resetHeatIds;
}

/** Whether the Heat can take a Heat Result now. */
export function isRecordable(bracket: Bracket, heatId: string): boolean {
  const heat = bracket.heats.find((h) => h.id === heatId);
  return (
    heat !== undefined &&
    !isBye(bracket, heat) &&
    heat.slots.every((s) => s.entrantId !== null)
  );
}

/** Whether any Heat has a recorded Heat Result (byes don't count). */
export function hasResults(bracket: Bracket): boolean {
  return bracket.heats.some((h) => isDecided(h) && !isBye(bracket, h));
}

/** Whether the final Heat has been decided. */
export function isComplete(bracket: Bracket): boolean {
  const final = finalHeatOf(bracket);
  return final !== undefined && isDecided(final);
}

/** The Entrant 1st in the final Heat, or null while it's undecided. */
export function bracketWinner(bracket: Bracket): string | null {
  const final = finalHeatOf(bracket);
  if (!final || !isDecided(final)) return null;
  return final.slots.find((s) => s.place === 1)?.entrantId ?? null;
}

/**
 * Final placings of a finished Bracket, from the final only: its finishing
 * order gives places 1 to 4; nobody else is placed. Sorted by place.
 */
export function finalPlacings(
  bracket: Bracket,
  entrants: Entrant[],
): Placing[] {
  if (!isComplete(bracket)) {
    throw new BracketError("The Bracket isn't finished yet.");
  }
  const entered = new Set(entrants.map((e) => e.id));
  return finalHeatOf(bracket)!
    .slots.filter(
      (s) => entered.has(s.entrantId!) && s.place! <= BRACKET_PLACEMENTS,
    )
    .map((s) => ({ entrantId: s.entrantId!, place: s.place! }))
    .sort((a, b) => a.place - b.place);
}

/**
 * A Bracket of any config but 2 / 1: Heats of up to `entrantsPerHeat` Entrants, the top
 * `advancePerHeat` of each going on, Round after Round until one Heat is
 * left.
 */
export const heats: FormatEngine = {
  validateConfig,
  generate,
  applyResult,
  resetByResult,
  isRecordable,
  isBye,
  hasResults,
  isComplete,
  winner: bracketWinner,
  finalPlacings,
};
