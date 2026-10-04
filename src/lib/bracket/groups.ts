/**
 * The engine for a Bracket of any other match size: Matches of up to S Entrants, the top A of each
 * advancing, Round after Round until one Match is left. Every function is
 * pure: it takes a Bracket and returns a new one, never changing its input.
 */
import {
  type BracketConfig,
  bracketConfigSchema,
  thirdPlaceRefusal,
} from "@/lib/bracket/config";
import { finalMatchOf, finalRoundOf } from "@/lib/bracket/final";
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
} from "@/lib/bracket/types";
import { BRACKET_PLACEMENTS } from "@/lib/competitions";

/** More Rounds than any Bracket the builder allows could need. */
const MAX_ROUNDS = 64;

/**
 * The Match sizes of a Round of `count` Entrants dealt snake-style into
 * ⌈count/S⌉ Matches: they differ by at most one.
 */
function matchSizes(count: number, perMatch: number): number[] {
  const matchCount = Math.ceil(count / perMatch);
  const sizes = Array.from({ length: matchCount }, () => 0);
  for (let rank = 0; rank < count; rank++)
    sizes[snakeMatch(rank, matchCount)]++;
  return sizes;
}

/** Which Match (0-based) the `rank`th Entrant (0-based) is dealt into. */
function snakeMatch(rank: number, matchCount: number): number {
  const pass = Math.floor(rank / matchCount);
  const along = rank % matchCount;
  return pass % 2 === 0 ? along : matchCount - 1 - along;
}

/**
 * Every Round's Match sizes for `count` Entrants, the last Round being one
 * Match; or the Round that would never end (it sends on as many as it got).
 */
function roundShape(
  count: number,
  { entrantsPerMatch, advancePerMatch }: BracketConfig,
): { rounds: number[][] } | { neverEnds: number } {
  const rounds: number[][] = [];
  let remaining = count;
  while (remaining > entrantsPerMatch) {
    if (rounds.length >= MAX_ROUNDS) {
      throw new Error(`more than ${MAX_ROUNDS} Rounds for ${count} Entrants`);
    }
    const sizes = matchSizes(remaining, entrantsPerMatch);
    const onward = sizes.reduce((n, k) => n + Math.min(k, advancePerMatch), 0);
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
    const { entrantsPerMatch, advancePerMatch } = parsed.data;
    return `With ${entrantCount} Entrants, ${entrantsPerMatch} per Match and ${advancePerMatch} advancing, Round ${shape.neverEnds} would never end. Lower how many advance.`;
  }
  return null;
}

function emptySlot(): MatchSlot {
  return { entrantId: null, place: null, score: null };
}

function roundMatches(bracket: Bracket, round: number): Match[] {
  return bracket.matches
    .filter((h) => h.round === round)
    .sort((a, b) => a.position - b.position);
}

/**
 * A Match that is never played: one before the final Round with no more
 * Entrants than advance, so all of them go through.
 */
export function isBye(bracket: Bracket, match: Match): boolean {
  return (
    match.round < finalRoundOf(bracket) &&
    match.slots.length <= bracket.config.advancePerMatch
  );
}

/**
 * Deals `ranked` Entrants into a Round's Matches snake-style (1st to Match 1,
 * …, then back from the last Match), deciding its byes: a bye's places
 * follow the deal. When that completes a Round before the final, the next
 * Round is filled in turn.
 */
function fillRound(bracket: Bracket, round: number, ranked: string[]) {
  const matches = roundMatches(bracket, round);
  const dealt: string[][] = matches.map(() => []);
  ranked.forEach((id, rank) =>
    dealt[snakeMatch(rank, matches.length)].push(id),
  );
  matches.forEach((match, i) => {
    if (dealt[i].length !== match.slots.length) {
      throw new Error(
        `Round ${round} Match ${match.position} dealt ${dealt[i].length} for ${match.slots.length} slots`,
      );
    }
    const bye = isBye(bracket, match);
    match.slots = dealt[i].map((entrantId, place) => ({
      ...emptySlot(),
      entrantId,
      place: bye ? place + 1 : null,
    }));
    match.status = bye ? "played" : "ready";
  });
  fillNextIfComplete(bracket, round);
}

/** Once every Match of `round` is decided, its advancers fill the next. */
function fillNextIfComplete(bracket: Bracket, round: number) {
  if (round >= finalRoundOf(bracket)) return;
  const advancers = advancersOf(bracket, round);
  if (advancers) fillRound(bracket, round + 1, advancers);
}

/**
 * A complete Round's advancers, ranked by place, then by Match position (all
 * the 1st places in Match order, then all the 2nds…); null until every Match
 * of the Round is decided.
 */
function advancersOf(bracket: Bracket, round: number): string[] | null {
  const matches = roundMatches(bracket, round);
  if (!matches.every(isDecided)) return null;
  const { advancePerMatch } = bracket.config;
  const ranked: string[] = [];
  for (let place = 1; place <= advancePerMatch; place++) {
    for (const match of matches) {
      const slot = match.slots.find((s) => s.place === place);
      if (slot) ranked.push(slot.entrantId!);
    }
  }
  return ranked;
}

/**
 * Builds every Match of every Round of a Matches Bracket. Round 1 is dealt by
 * Seed Position, and its byes are already decided; later Rounds wait, empty,
 * until the Round before them is complete. Match ids come from `newId`.
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

  const bracket: Bracket = { config, matches: [] };
  shape.rounds.forEach((sizes, r) => {
    sizes.forEach((size, p) => {
      bracket.matches.push({
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

function findMatch(bracket: Bracket, matchId: string): Match {
  const found = bracket.matches.find((h) => h.id === matchId);
  if (!found) throw new BracketError("That Match isn't in this Bracket.");
  return found;
}

/**
 * Sets a Match's places from a Match Result, refusing one that isn't a clear
 * order of every Entrant.
 */
function record(bracket: Bracket, match: Match, result: MatchResult) {
  if (isBye(bracket, match))
    throw new BracketError("A bye has no Match Result.");
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
  match.slots = match.slots.map((slot) => ({
    entrantId: slot.entrantId,
    place: finishing.indexOf(slot.entrantId!) + 1,
    score: scores[slot.entrantId!]?.trim() || null,
  }));
  match.status = "played";
}

/**
 * Empties every Match after `round`, sending them back to pending. Returns
 * the ids of the ones that had a Match Result, in Round then Match order.
 */
function clearAfter(bracket: Bracket, round: number): string[] {
  const later = bracket.matches
    .filter((h) => h.round > round)
    .sort((a, b) => a.round - b.round || a.position - b.position);
  const resetMatchIds = later
    .filter((h) => isDecided(h) && !isBye(bracket, h))
    .map((h) => h.id);
  for (const match of later) {
    match.slots = match.slots.map(emptySlot);
    match.status = "pending";
  }
  return resetMatchIds;
}

function sameOrder(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/**
 * Records `result` on a copy of the Bracket, clearing the later Rounds when
 * the Match's Round was already complete and the result changes who
 * advances or their order. Returns the copy and the Matches that had a Match
 * Result among those cleared.
 */
function rerecord(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): { next: Bracket; resetMatchIds: string[] } {
  const next = structuredClone(bracket);
  const match = findMatch(next, matchId);
  const before = advancersOf(next, match.round);
  record(next, match, result);
  if (match.round === finalRoundOf(next)) return { next, resetMatchIds: [] };
  if (before === null) {
    fillNextIfComplete(next, match.round);
    return { next, resetMatchIds: [] };
  }
  if (sameOrder(before, advancersOf(next, match.round)!)) {
    return { next, resetMatchIds: [] };
  }
  const resetMatchIds = clearAfter(next, match.round);
  fillNextIfComplete(next, match.round);
  return { next, resetMatchIds };
}

/**
 * Records a Match Result. When that completes the Match's Round, its
 * advancers fill the next Round. Re-recording a Match of a complete Round
 * that changes who advances, or their order, first empties every later
 * Round (see `resetByResult`) and then fills the next one again.
 */
export function applyResult(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): Bracket {
  return rerecord(bracket, matchId, result).next;
}

/**
 * The later Matches with a Match Result that recording `result` would clear:
 * none when the Match is undecided or a bye, its Round isn't complete yet,
 * or the same Entrants still advance in the same order (a score-only edit,
 * or a change below the advance line).
 */
export function resetByResult(
  bracket: Bracket,
  matchId: string,
  result: MatchResult,
): string[] {
  const match = findMatch(bracket, matchId);
  if (!isDecided(match) || isBye(bracket, match)) return [];
  return rerecord(bracket, matchId, result).resetMatchIds;
}

/** Whether the Match can take a Match Result now. */
export function isRecordable(bracket: Bracket, matchId: string): boolean {
  const match = bracket.matches.find((h) => h.id === matchId);
  return (
    match !== undefined &&
    !isBye(bracket, match) &&
    match.slots.every((s) => s.entrantId !== null)
  );
}

/** Whether any Match has a recorded Match Result (byes don't count). */
export function hasResults(bracket: Bracket): boolean {
  return bracket.matches.some((h) => isDecided(h) && !isBye(bracket, h));
}

/** Whether the final Match has been decided. */
export function isComplete(bracket: Bracket): boolean {
  const final = finalMatchOf(bracket);
  return final !== undefined && isDecided(final);
}

/** The Entrant 1st in the final Match, or null while it's undecided. */
export function bracketWinner(bracket: Bracket): string | null {
  const final = finalMatchOf(bracket);
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
  return finalMatchOf(bracket)!
    .slots.filter(
      (s) => entered.has(s.entrantId!) && s.place! <= BRACKET_PLACEMENTS,
    )
    .map((s) => ({ entrantId: s.entrantId!, place: s.place! }))
    .sort((a, b) => a.place - b.place);
}

/**
 * A Bracket of any config but 2 / 1: Matches of up to `entrantsPerMatch` Entrants, the top
 * `advancePerMatch` of each going on, Round after Round until one Match is
 * left.
 */
export const matches: FormatEngine = {
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
