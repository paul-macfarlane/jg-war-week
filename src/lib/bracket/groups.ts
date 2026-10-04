/**
 * The Group engine (spec R21, decision 11; plan P5): Round after Round of
 * Matches until one Match, the final, is left. Each Round has defaults
 * (entrants per Match, how many advance: `config.rounds`, else the
 * Bracket-wide ones), and each Match its own size and advancing count
 * (`advanceCount`), which Organizers and Hosts edit while its Round has no
 * result. Every function is pure: it takes a Bracket and returns a new one,
 * never changing its input.
 */
import {
  type BracketConfig,
  type RoundDefaults,
  bracketConfigSchema,
  isHeadToHead,
  roundDefaultsSchema,
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

/** Why an edit to a Round with a result is refused (spec R21, decision 11). */
export const ROUND_LOCKED =
  "Editing a round is locked once any Match in it has a result.";

/** A Match a Round is planned with: its size and how many of it advance. */
type PlannedMatch = { size: number; advanceCount: number };

/** A Round that would send on as many Entrants as it received. */
type NeverEnds = { round: number; incoming: number; onward: number };

/** Where a Bracket's new Matches get their ids. */
export type NewMatchId = (round: number, position: number) => string;

/**
 * A Round's defaults: its own (`config.rounds`) when set, otherwise the
 * Bracket-wide entrants per Match and how many advance.
 */
export function roundDefaultsOf(
  config: BracketConfig,
  round: number,
): RoundDefaults {
  return (
    config.rounds[String(round)] ?? {
      entrantsPerMatch: config.entrantsPerMatch,
      advancePerMatch: config.advancePerMatch,
    }
  );
}

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
 * Plans the Rounds from `round` on for `incoming` Entrants, each Round from
 * its own defaults: a Round whose Entrants fit one Match is the final (1
 * advancing, as it's placed, not sent on); any other deals them into
 * ⌈n/S⌉ Matches, each sending on its default (at most its size), and the
 * next Round takes their sum. Or the Round that would never end.
 */
function planRounds(
  config: BracketConfig,
  round: number,
  incoming: number,
): { rounds: PlannedMatch[][] } | { neverEnds: NeverEnds } {
  const rounds: PlannedMatch[][] = [];
  let remaining = incoming;
  for (let r = round; ; r++) {
    if (rounds.length >= MAX_ROUNDS) {
      throw new Error(
        `more than ${MAX_ROUNDS} Rounds for ${incoming} Entrants`,
      );
    }
    const { entrantsPerMatch, advancePerMatch } = roundDefaultsOf(config, r);
    if (remaining <= entrantsPerMatch) {
      rounds.push([{ size: remaining, advanceCount: 1 }]);
      return { rounds };
    }
    const planned = matchSizes(remaining, entrantsPerMatch).map((size) => ({
      size,
      advanceCount: Math.min(advancePerMatch, size),
    }));
    const onward = planned.reduce((n, m) => n + m.advanceCount, 0);
    if (onward >= remaining) {
      return { neverEnds: { round: r, incoming: remaining, onward } };
    }
    rounds.push(planned);
    remaining = onward;
  }
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
  const plan = planRounds(parsed.data, 1, entrantCount);
  if ("neverEnds" in plan) {
    const { entrantsPerMatch, advancePerMatch } = roundDefaultsOf(
      parsed.data,
      plan.neverEnds.round,
    );
    return `With ${entrantCount} Entrants, ${entrantsPerMatch} per Match and ${advancePerMatch} advancing, Round ${plan.neverEnds.round} would never end. Lower how many advance.`;
  }
  return null;
}

/** An edited Round that would send on as many as it received. */
function neverEndsMessage({ round, incoming, onward }: NeverEnds): string {
  return `Round ${round} would never end: it would send on ${onward} of its ${incoming} Entrants. Lower how many advance.`;
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
 * How many of a Match advance: its own count (`advanceCount`), else its
 * Round's default, never more than its size; the final's is 1 (its winner).
 */
export function matchAdvanceCount(bracket: Bracket, match: Match): number {
  if (match.round >= finalRoundOf(bracket)) return 1;
  return Math.min(
    match.advanceCount ??
      roundDefaultsOf(bracket.config, match.round).advancePerMatch,
    match.slots.length,
  );
}

/**
 * A Match that is never played: one before the final Round with no more
 * Entrants than advance, so all of them go through.
 */
export function isBye(bracket: Bracket, match: Match): boolean {
  return (
    match.round < finalRoundOf(bracket) &&
    match.slots.length <= matchAdvanceCount(bracket, match)
  );
}

/**
 * Deals `ranked` Entrants into a Round's Matches snake-style (1st to Match
 * 1, …, then back from the last Match), skipping a Match once it holds its
 * size, so Matches of different sizes keep them. A bye's places follow the
 * deal. When that completes a Round before the final, the next Round is
 * filled in turn.
 */
function fillRound(bracket: Bracket, round: number, ranked: string[]) {
  const matches = roundMatches(bracket, round);
  const capacity = matches.reduce((n, h) => n + h.slots.length, 0);
  if (capacity !== ranked.length) {
    throw new Error(
      `Round ${round} has ${capacity} slots for ${ranked.length} Entrants`,
    );
  }
  const dealt: string[][] = matches.map(() => []);
  let i = 0;
  let step = 1;
  for (const id of ranked) {
    // Never loops forever: some Match still has room.
    while (dealt[i].length >= matches[i].slots.length) {
      ({ i, step } = snakeStep(i, step, matches.length));
    }
    dealt[i].push(id);
    ({ i, step } = snakeStep(i, step, matches.length));
  }
  matches.forEach((match, m) => {
    match.slots = dealt[m].map((entrantId) => ({ ...emptySlot(), entrantId }));
  });
  decideByes(bracket, round);
  fillNextIfComplete(bracket, round);
}

/** The next Match of a snake deal: along, then back at either end. */
function snakeStep(i: number, step: number, count: number) {
  const next = i + step;
  if (next < 0 || next >= count) return { i, step: -step };
  return { i: next, step };
}

/**
 * Sets a filled, unplayed Round's statuses: a bye is decided, its places
 * following its slots; every other Match is ready.
 */
function decideByes(bracket: Bracket, round: number) {
  for (const match of roundMatches(bracket, round)) {
    if (match.slots.some((s) => s.entrantId === null)) continue;
    const bye = isBye(bracket, match);
    match.slots = match.slots.map((slot, place) => ({
      ...slot,
      place: bye ? place + 1 : null,
      score: null,
    }));
    match.status = bye ? "played" : "ready";
  }
}

/** Once every Match of `round` is decided, its advancers fill the next. */
function fillNextIfComplete(bracket: Bracket, round: number) {
  if (round >= finalRoundOf(bracket)) return;
  const advancers = advancersOf(bracket, round);
  if (advancers) fillRound(bracket, round + 1, advancers);
}

/**
 * A complete Round's advancers, ranked by place, then by Match position (all
 * the 1st places in Match order, then all the 2nds…), each Match sending on
 * its own count; null until every Match of the Round is decided.
 */
function advancersOf(bracket: Bracket, round: number): string[] | null {
  const matches = roundMatches(bracket, round);
  if (!matches.every(isDecided)) return null;
  const most = Math.max(...matches.map((h) => matchAdvanceCount(bracket, h)));
  const ranked: string[] = [];
  for (let place = 1; place <= most; place++) {
    for (const match of matches) {
      if (place > matchAdvanceCount(bracket, match)) continue;
      const slot = match.slots.find((s) => s.place === place);
      if (slot) ranked.push(slot.entrantId!);
    }
  }
  return ranked;
}

/** How many a Round sends on: the sum of its Matches' advancing counts. */
function onwardFrom(bracket: Bracket, round: number): number {
  return roundMatches(bracket, round).reduce(
    (n, h) => n + matchAdvanceCount(bracket, h),
    0,
  );
}

/** Empty Matches for the planned Rounds, the first being `round`. */
function plannedMatches(
  planned: PlannedMatch[][],
  round: number,
  newId: NewMatchId,
): Match[] {
  return planned.flatMap((matches, r) =>
    matches.map(({ size, advanceCount }, p) => ({
      id: newId(round + r, p + 1),
      round: round + r,
      position: p + 1,
      slots: Array.from({ length: size }, emptySlot),
      advanceCount,
      winnerTo: null,
      loserTo: null,
      thirdPlace: false,
      status: "pending" as const,
      recordedAt: null,
    })),
  );
}

/**
 * Replaces every Round from `round` on with a fresh plan for `incoming`
 * Entrants, each Round from its defaults (empty Matches, waiting), and
 * drops the Round defaults beyond the new final. Throws when a planned
 * Round would never end.
 */
function replanFrom(
  bracket: Bracket,
  round: number,
  incoming: number,
  newId: NewMatchId,
) {
  const plan = planRounds(bracket.config, round, incoming);
  if ("neverEnds" in plan) {
    throw new BracketError(neverEndsMessage(plan.neverEnds));
  }
  bracket.matches = [
    ...bracket.matches.filter((h) => h.round < round),
    ...plannedMatches(plan.rounds, round, newId),
  ];
}

/** Drops the Round defaults of Rounds after the final. */
function pruneRoundDefaults(bracket: Bracket) {
  const final = finalRoundOf(bracket);
  bracket.config = {
    ...bracket.config,
    rounds: Object.fromEntries(
      Object.entries(bracket.config.rounds).filter(([r]) => Number(r) <= final),
    ),
  };
}

/**
 * Re-plans every Round after `round` from what `round` now sends on (each
 * Round from its defaults), refusing a `round` that would never end; when
 * `round` is complete, its advancers fill the next.
 */
function reprojectAfter(bracket: Bracket, round: number, newId: NewMatchId) {
  const final = finalRoundOf(bracket);
  if (round >= final) return;
  const incoming = roundMatches(bracket, round).reduce(
    (n, h) => n + h.slots.length,
    0,
  );
  const onward = onwardFrom(bracket, round);
  if (onward >= incoming) {
    throw new BracketError(neverEndsMessage({ round, incoming, onward }));
  }
  replanFrom(bracket, round + 1, onward, newId);
  fillNextIfComplete(bracket, round);
}

/**
 * Builds every Match of every Round of a Group Bracket, each Round from its
 * defaults. Round 1 is dealt by Seed Position, and its byes are already
 * decided; later Rounds wait, empty, until the Round before them is
 * complete. Match ids come from `newId`.
 */
export function generate(
  config: BracketConfig,
  entrants: Entrant[],
  newId: NewMatchId,
): Bracket {
  const refusal = validateConfig(config, entrants.length);
  if (refusal) throw new BracketError(refusal);
  const bracket: Bracket = { config, matches: [] };
  replanFrom(bracket, 1, entrants.length, newId);
  fillRound(bracket, 1, bySeed(entrants));
  return bracket;
}

/** Entrant ids by Seed Position. */
function bySeed(entrants: Entrant[]): string[] {
  return [...entrants]
    .sort((a, b) => a.seedPosition - b.seedPosition)
    .map((e) => e.id);
}

/**
 * Why a Round can't be edited now, or null: once any Match in it has a
 * result (a bye isn't one), it is locked.
 */
export function roundLockReason(
  bracket: Bracket,
  round: number,
): string | null {
  return roundMatches(bracket, round).some(
    (h) => isDecided(h) && !isBye(bracket, h),
  )
    ? ROUND_LOCKED
    : null;
}

/** A copy of the Bracket to edit `round` of, refusing a locked Round. */
function editable(bracket: Bracket, round: number): Bracket {
  if (isHeadToHead(bracket.config)) {
    throw new BracketError("Only a Group Bracket's Matches can be edited.");
  }
  const locked = roundLockReason(bracket, round);
  if (locked) throw new BracketError(locked);
  return structuredClone(bracket);
}

/**
 * Sets how many of a Match advance (1 to its size; as many as play makes it
 * a bye), then re-plans every later Round. Refused once the Match's Round
 * has a result, for the final, and when the Round would never end.
 */
export function setMatchAdvance(
  bracket: Bracket,
  matchId: string,
  advanceCount: number,
  newId: NewMatchId,
): Bracket {
  const round = findMatch(bracket, matchId).round;
  const next = editable(bracket, round);
  const match = findMatch(next, matchId);
  if (round >= finalRoundOf(next)) {
    throw new BracketError("Nobody advances from the Final.");
  }
  const size = match.slots.length;
  if (
    !Number.isInteger(advanceCount) ||
    advanceCount < 1 ||
    advanceCount > size
  ) {
    throw new BracketError(
      `Between 1 and ${size} can advance from this Match.`,
    );
  }
  match.advanceCount = advanceCount;
  decideByes(next, round);
  reprojectAfter(next, round, newId);
  pruneRoundDefaults(next);
  return next;
}

/**
 * Moves an Entrant into another Match of its Round (the sizes follow; a
 * Match's advancing count never exceeds its new size), then re-plans every
 * later Round. Refused once the Round has a result, across Rounds, into a
 * full Match (8), when it would empty a Match, and when the Round would
 * never end.
 */
export function moveEntrant(
  bracket: Bracket,
  entrantId: string,
  toMatchId: string,
  newId: NewMatchId,
): Bracket {
  const round = findMatch(bracket, toMatchId).round;
  const next = editable(bracket, round);
  const to = findMatch(next, toMatchId);
  const from = roundMatches(next, round).find((h) =>
    h.slots.some((s) => s.entrantId === entrantId),
  );
  if (!from) throw new BracketError("Move an Entrant only within its Round.");
  if (from.id === to.id) return next;
  if (to.slots.length >= 8) {
    throw new BracketError("A Match holds at most 8 Entrants.");
  }
  if (from.slots.length <= 1) {
    throw new BracketError("A Match keeps at least 1 Entrant.");
  }
  from.advanceCount = matchAdvanceCount(next, from);
  to.advanceCount = matchAdvanceCount(next, to);
  from.slots = from.slots.filter((s) => s.entrantId !== entrantId);
  to.slots = [...to.slots, { ...emptySlot(), entrantId }];
  from.advanceCount = Math.min(from.advanceCount, from.slots.length);
  decideByes(next, round);
  reprojectAfter(next, round, newId);
  pruneRoundDefaults(next);
  return next;
}

/**
 * Sets a Round's defaults (entrants per Match, how many advance): saved in
 * `config.rounds` when they differ from the Bracket-wide ones. The Round is
 * re-planned from what it receives (it becomes the final when that fits one
 * Match) and, when it's already filled, dealt again: Round 1 by Seed
 * Position (`entrants`), a later Round from the one before. Every later
 * Round is re-planned, and Round defaults beyond the final are dropped.
 */
export function setRoundDefaults(
  bracket: Bracket,
  round: number,
  defaults: RoundDefaults,
  entrants: Entrant[],
  newId: NewMatchId,
): Bracket {
  if (!Number.isInteger(round) || round < 1 || round > finalRoundOf(bracket)) {
    throw new BracketError("That Round isn't in this Bracket.");
  }
  const parsed = roundDefaultsSchema.safeParse(defaults);
  if (!parsed.success) throw new BracketError(parsed.error.issues[0].message);
  const next = editable(bracket, round);
  const rounds = { ...next.config.rounds };
  const wide = next.config;
  if (
    parsed.data.entrantsPerMatch === wide.entrantsPerMatch &&
    parsed.data.advancePerMatch === wide.advancePerMatch
  ) {
    delete rounds[String(round)];
  } else {
    rounds[String(round)] = parsed.data;
  }
  next.config = { ...next.config, rounds };
  const incoming = round === 1 ? entrants.length : onwardFrom(next, round - 1);
  replanFrom(next, round, incoming, newId);
  const ranked = round === 1 ? bySeed(entrants) : advancersOf(next, round - 1);
  if (ranked) fillRound(next, round, ranked);
  pruneRoundDefaults(next);
  return next;
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
 * The Matches after `round` with a Match Result, in Round then Match order:
 * what re-planning them clears.
 */
function resultsAfter(bracket: Bracket, round: number): string[] {
  return bracket.matches
    .filter((h) => h.round > round && isDecided(h) && !isBye(bracket, h))
    .sort((a, b) => a.round - b.round || a.position - b.position)
    .map((h) => h.id);
}

/**
 * Re-fills the Rounds after a complete `round` whose advancers changed
 * (D1f): every later Round is re-planned from its defaults, so moves and
 * advancing counts made there are lost, and `round`'s advancers fill the
 * next. A re-plan from the defaults that would never end keeps the later
 * Rounds' shapes and only empties them. New Matches reuse the ids at their
 * Round and position.
 */
export function refillAfter(bracket: Bracket, round: number) {
  const ids = new Map(
    bracket.matches.map((h) => [`${h.round}:${h.position}`, h.id]),
  );
  const newId: NewMatchId = (r, p) => ids.get(`${r}:${p}`) ?? `r${r}m${p}`;
  const plan = planRounds(
    bracket.config,
    round + 1,
    onwardFrom(bracket, round),
  );
  if ("rounds" in plan) {
    bracket.matches = [
      ...bracket.matches.filter((h) => h.round <= round),
      ...plannedMatches(plan.rounds, round + 1, newId),
    ];
  } else {
    for (const match of bracket.matches.filter((h) => h.round > round)) {
      match.slots = match.slots.map(emptySlot);
      match.status = "pending";
    }
  }
  fillNextIfComplete(bracket, round);
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
  const resetMatchIds = resultsAfter(next, match.round);
  refillAfter(next, match.round);
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
export const matches: FormatEngine & {
  roundLockReason: typeof roundLockReason;
  setMatchAdvance: typeof setMatchAdvance;
  moveEntrant: typeof moveEntrant;
  setRoundDefaults: typeof setRoundDefaults;
} = {
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
  roundLockReason,
  setMatchAdvance,
  moveEntrant,
  setRoundDefaults,
};
