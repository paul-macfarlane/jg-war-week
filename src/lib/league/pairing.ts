/**
 * The League pairing engine (spec R23, decisions 5 and 6; reading R3):
 * round robin by the circle method, all rounds at once; Swiss one round at
 * a time by score groups with no rematch. A pairing's row order is its
 * Match position in the round (from 0); a pairing with no `b` is a bye
 * (Swiss) or sit-out (round robin). Pure: the mutations draw Seed
 * Positions (`shuffleSeedPositions`) and save the rows.
 */
import type { LeagueResult } from "@/lib/enums";
import { type LeagueConfig, roundsOf } from "@/lib/league/config";
import { leagueStandings } from "@/lib/league/standings";

/** An Entrant of the League, at its Seed Position. */
export type LeagueEntrant = { id: string; seedPosition: number };

/** A League Match as the engine and standings read it. */
export type LeagueMatchFacts = {
  round: number;
  a: string;
  /** Null for a bye or sit-out. */
  b: string | null;
  /** Null until recorded; a bye or sit-out never has one. */
  result: LeagueResult | null;
};

/** One pairing in a round: Entrant A against B, or A's bye or sit-out. */
export type Pairing = { a: string; b: string | null };

export type PairedRound = { round: number; matches: Pairing[] };

export const EVERY_PAIRING_REPEATS =
  "Every pairing would repeat a Match. Close the League.";

/** `swissRound`'s search budget: opponents tried, bye retries included. */
export const SWISS_MAX_STEPS = 200_000;

const bySeed = (entrants: LeagueEntrant[]) =>
  [...entrants].sort((x, y) => x.seedPosition - y.seedPosition);

/**
 * Every round of a round robin by the circle method over Seed Position
 * order: the first Entrant stays put and the rest rotate, so each plays
 * once per round and meets everyone once. With an odd count a phantom
 * joins and whoever it meets sits out that round (listed last).
 */
export function roundRobin(entrants: LeagueEntrant[]): PairedRound[] {
  const ids: (string | null)[] = bySeed(entrants).map((e) => e.id);
  if (ids.length < 2) return [];
  if (ids.length % 2 === 1) ids.push(null);
  const size = ids.length;
  const rounds: PairedRound[] = [];
  let circle = ids;
  for (let round = 1; round < size; round++) {
    const matches: Pairing[] = [];
    const sitOuts: Pairing[] = [];
    for (let i = 0; i < size / 2; i++) {
      const [x, y] = [circle[i], circle[size - 1 - i]];
      if (x === null) sitOuts.push({ a: y!, b: null });
      else if (y === null) sitOuts.push({ a: x, b: null });
      else matches.push({ a: x, b: y });
    }
    rounds.push({ round, matches: [...matches, ...sitOuts] });
    circle = [circle[0], circle[size - 1], ...circle.slice(1, size - 1)];
  }
  return rounds;
}

const pairKey = (a: string, b: string) => (a < b ? `${a} ${b}` : `${b} ${a}`);

export type SwissPairing =
  | { ok: true; matches: Pairing[]; steps: number }
  | { ok: false; error: string; steps: number };

/**
 * The next Swiss round. Entrants rank by match points, then Buchholz,
 * then Seed Position, and group by match points. With an odd count the
 * bye goes to the lowest-ranked Entrant who hasn't had one (the next one
 * up when the rest can't pair). A depth-first search pairs the top
 * unpaired Entrant with, in order: its group's bottom half from its mirror
 * position, the rest of its group, then lower groups top first (a float
 * down), never a previous opponent, backtracking when a later Entrant
 * can't be paired. Round 1 is one group, so it is seed 1 v 1 + ⌊N/2⌋…
 * `steps` counts the opponents tried, across every bye tried; once it
 * reaches `maxSteps` the search stops and the round is a dead end
 * (`EVERY_PAIRING_REPEATS`) rather than searching on.
 */
export function swissRound({
  entrants,
  matches,
  maxSteps = SWISS_MAX_STEPS,
}: {
  entrants: LeagueEntrant[];
  matches: LeagueMatchFacts[];
  /** The search budget; tests inject a small one. */
  maxSteps?: number;
}): SwissPairing {
  const seedOf = new Map(entrants.map((e) => [e.id, e.seedPosition]));
  const table = new Map(
    leagueStandings(
      "swiss",
      entrants.map((e) => e.id),
      matches,
    ).map((row) => [row.entrantId, row]),
  );
  const ranked = entrants
    .map((e) => e.id)
    .sort(
      (x, y) =>
        table.get(y)!.matchPoints - table.get(x)!.matchPoints ||
        table.get(y)!.buchholz! - table.get(x)!.buchholz! ||
        seedOf.get(x)! - seedOf.get(y)!,
    );
  const played = new Set(
    matches.flatMap((m) => (m.b === null ? [] : [pairKey(m.a, m.b)])),
  );
  const pointsOf = (id: string) => table.get(id)!.matchPoints;
  let steps = 0;

  const candidates = (top: string, rest: string[]): string[] => {
    const group = rest.filter((id) => pointsOf(id) === pointsOf(top));
    const lower = rest.filter((id) => pointsOf(id) !== pointsOf(top));
    if (group.length === 0) return lower;
    // The top is index 0 of its group of `group.length + 1`; its mirror is
    // index ⌊size / 2⌋, which is `group[mirror - 1]`.
    const mirror = Math.floor((group.length + 1) / 2) - 1;
    return [...group.slice(mirror), ...group.slice(0, mirror), ...lower];
  };

  const pairAll = (remaining: string[]): Pairing[] | null => {
    if (remaining.length === 0) return [];
    const [top, ...rest] = remaining;
    for (const opponent of candidates(top, rest)) {
      if (steps >= maxSteps) return null;
      steps++;
      if (played.has(pairKey(top, opponent))) continue;
      const others = pairAll(rest.filter((id) => id !== opponent));
      if (others) return [{ a: top, b: opponent }, ...others];
    }
    return null;
  };

  if (ranked.length % 2 === 0) {
    const pairs = pairAll(ranked);
    return pairs
      ? { ok: true, matches: pairs, steps }
      : { ok: false, error: EVERY_PAIRING_REPEATS, steps };
  }
  const hadBye = new Set(matches.filter((m) => m.b === null).map((m) => m.a));
  const byeOrder = [...ranked].reverse().filter((id) => !hadBye.has(id));
  for (const bye of byeOrder) {
    if (steps >= maxSteps) break;
    const pairs = pairAll(ranked.filter((id) => id !== bye));
    if (pairs) {
      return { ok: true, matches: [...pairs, { a: bye, b: null }], steps };
    }
  }
  return { ok: false, error: EVERY_PAIRING_REPEATS, steps };
}

/**
 * Whether a Swiss League could pair its next round now: false only at a
 * dead end, where every paired Match has a result, rounds are left, and
 * `swissRound` can't pair the next one without a repeat Match. True for a
 * round robin, before round 1, while a Match is unplayed and once every
 * round is paired. Close counts a dead end as finished (`unplayedSummary`).
 */
export function nextRoundPairable({
  config,
  entrants,
  matches,
}: {
  config: LeagueConfig;
  entrants: LeagueEntrant[];
  matches: LeagueMatchFacts[];
}): boolean {
  if (config.pairing !== "swiss" || entrants.length < 2) return true;
  if (matches.length === 0) return true;
  if (matches.some((m) => m.b !== null && m.result === null)) return true;
  const latest = Math.max(...matches.map((m) => m.round));
  const rounds = Math.min(
    roundsOf(config, entrants.length),
    entrants.length - 1,
  );
  if (latest >= rounds) return true;
  return swissRound({ entrants, matches }).ok;
}

/**
 * A round with Entrants `x` and `y` exchanged (reading R7): each Match
 * keeps its place, and either may be the bye or sit-out.
 */
export function swap(matches: Pairing[], x: string, y: string): Pairing[] {
  const other = (id: string) => (id === x ? y : id === y ? x : id);
  return matches.map((m) => ({
    a: other(m.a),
    b: m.b === null ? null : other(m.b),
  }));
}

/** Each pair that meets more than once, in the order first met. */
export function rematches(matches: Pairing[]): Pairing[] {
  const seen = new Map<string, { pair: Pairing; times: number }>();
  for (const m of matches) {
    if (m.b === null) continue;
    const key = pairKey(m.a, m.b);
    const found = seen.get(key);
    if (found) found.times++;
    else seen.set(key, { pair: { a: m.a, b: m.b }, times: 1 });
  }
  return [...seen.values()].filter((s) => s.times > 1).map((s) => s.pair);
}

/** Each pair of `entrantIds` that never meets in `matches`, in list order. */
export function neverMet(entrantIds: string[], matches: Pairing[]): Pairing[] {
  const met = new Set(
    matches.flatMap((m) => (m.b === null ? [] : [pairKey(m.a, m.b)])),
  );
  return entrantIds.flatMap((a, i) =>
    entrantIds
      .slice(i + 1)
      .filter((b) => !met.has(pairKey(a, b)))
      .map((b) => ({ a, b })),
  );
}

/**
 * What swapping `x` and `y` in `round` would newly cause, for the Edit
 * pairings dialog's warning (reading R7; Paul, Q4): the pairs that would
 * then meet twice, (a round robin) the pairs that would then never meet,
 * and (Swiss) an Entrant the swap moves the bye onto who already had a bye
 * in another round. Pairs already repeated or missing before the swap, and
 * a bye the swap leaves where it is, aren't named.
 */
export function swapWarnings({
  entrantIds,
  rounds,
  round,
  x,
  y,
  roundRobin: isRoundRobin,
}: {
  entrantIds: string[];
  rounds: PairedRound[];
  round: number;
  x: string;
  y: string;
  roundRobin: boolean;
}): { repeats: Pairing[]; neverMeet: Pairing[]; secondByes: string[] } {
  const key = (p: Pairing) => pairKey(p.a, p.b!);
  const before = rounds.flatMap((r) => r.matches);
  const after = rounds.flatMap((r) =>
    r.round === round ? swap(r.matches, x, y) : r.matches,
  );
  const byesIn = (matches: Pairing[]) =>
    matches.filter((m) => m.b === null).map((m) => m.a);
  const swapped = rounds.find((r) => r.round === round)?.matches ?? [];
  const byeBefore = new Set(byesIn(swapped));
  const hadBye = new Set(
    byesIn(rounds.filter((r) => r.round !== round).flatMap((r) => r.matches)),
  );
  const repeatedBefore = new Set(rematches(before).map(key));
  const missingBefore = new Set(neverMet(entrantIds, before).map(key));
  return {
    repeats: rematches(after).filter((p) => !repeatedBefore.has(key(p))),
    neverMeet: isRoundRobin
      ? neverMet(entrantIds, after).filter((p) => !missingBefore.has(key(p)))
      : [],
    secondByes: isRoundRobin
      ? []
      : byesIn(swap(swapped, x, y)).filter(
          (id) => !byeBefore.has(id) && hadBye.has(id),
        ),
  };
}
