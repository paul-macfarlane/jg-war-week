/**
 * A League's standings (spec R23, decision 7; readings R4, R5): match
 * points (win 1, draw ½, loss 0; a Swiss bye 1, a round-robin sit-out 0),
 * W / D / L over played Matches, and the tiebreaks. Round robin ranks by
 * match points, then head-to-head among the Entrants tied on match points
 * (one pass over the tie group), then Sonneborn-Berger; Swiss by match
 * points, then Buchholz. Still level is a shared place (1, 1, 3). Pure.
 */
import type { Placing } from "@/lib/bracket/types";
import type { LeaguePairing } from "@/lib/league/config";
import type { LeagueMatchFacts } from "@/lib/league/pairing";

export type LeagueStandingsRow = {
  entrantId: string;
  /** Matches with a result; a bye or sit-out isn't one. */
  played: number;
  wins: number;
  draws: number;
  losses: number;
  /** Byes (Swiss) or sit-outs (round robin). */
  byes: number;
  matchPoints: number;
  /** Round robin, on a row tied on match points: its points among them. */
  headToHead: number | null;
  /** Round robin: beaten opponents' match points + half of drawn ones'. */
  sonnebornBerger: number | null;
  /** Swiss: the match points of every opponent actually played. */
  buchholz: number | null;
  /** 1 is first; tied rows share it and the next is skipped. */
  rank: number;
};

type Tally = {
  wins: number;
  draws: number;
  losses: number;
  byes: number;
  matchPoints: number;
  /** Each played opponent with the points this Entrant took off them. */
  matches: { opponent: string; points: number }[];
};

const POINTS = { a: [1, 0], b: [0, 1], draw: [0.5, 0.5] } as const;

function tallies(
  pairing: LeaguePairing,
  entrantIds: string[],
  matches: LeagueMatchFacts[],
): Map<string, Tally> {
  const table = new Map<string, Tally>(
    entrantIds.map((id) => [
      id,
      { wins: 0, draws: 0, losses: 0, byes: 0, matchPoints: 0, matches: [] },
    ]),
  );
  const add = (id: string, points: number, opponent: string) => {
    const tally = table.get(id);
    if (!tally) return;
    tally.matchPoints += points;
    if (points === 1) tally.wins++;
    else if (points === 0) tally.losses++;
    else tally.draws++;
    tally.matches.push({ opponent, points });
  };
  for (const match of matches) {
    if (match.b === null) {
      const tally = table.get(match.a);
      if (!tally) continue;
      tally.byes++;
      if (pairing === "swiss") tally.matchPoints += 1;
      continue;
    }
    if (match.result === null) continue;
    const [a, b] = POINTS[match.result];
    add(match.a, a, match.b);
    add(match.b, b, match.a);
  }
  return table;
}

/**
 * Every Entrant's row, best first (tied rows in `entrantIds` order).
 * `matches` are the League's Matches so far; one with no result counts for
 * nothing yet, and a bye or sit-out never has one.
 */
export function leagueStandings(
  pairing: LeaguePairing,
  entrantIds: string[],
  matches: LeagueMatchFacts[],
): LeagueStandingsRow[] {
  const table = tallies(pairing, entrantIds, matches);
  const pointsOf = (id: string) => table.get(id)?.matchPoints ?? 0;
  const roundRobin = pairing === "round-robin";

  const rows = entrantIds.map((entrantId) => {
    const { matches: played, ...tally } = table.get(entrantId)!;
    const tiedWith = new Set(
      entrantIds.filter(
        (other) => other !== entrantId && pointsOf(other) === tally.matchPoints,
      ),
    );
    return {
      entrantId,
      played: played.length,
      ...tally,
      headToHead:
        roundRobin && tiedWith.size > 0
          ? played
              .filter((m) => tiedWith.has(m.opponent))
              .reduce((sum, m) => sum + m.points, 0)
          : null,
      sonnebornBerger: roundRobin
        ? played.reduce((sum, m) => sum + m.points * pointsOf(m.opponent), 0)
        : null,
      buchholz: roundRobin
        ? null
        : played.reduce((sum, m) => sum + pointsOf(m.opponent), 0),
      rank: 0,
    };
  });

  const compare = (x: LeagueStandingsRow, y: LeagueStandingsRow) =>
    y.matchPoints - x.matchPoints ||
    (y.headToHead ?? 0) - (x.headToHead ?? 0) ||
    (y.sonnebornBerger ?? 0) - (x.sonnebornBerger ?? 0) ||
    (y.buchholz ?? 0) - (x.buchholz ?? 0);
  for (const row of rows) {
    row.rank = 1 + rows.filter((other) => compare(other, row) < 0).length;
  }
  return rows.sort((x, y) => x.rank - y.rank);
}

/** The places the standings give, for Placement Points (`pointsFor`). */
export function leaguePlacings(rows: LeagueStandingsRow[]): Placing[] {
  return rows.map((row) => ({ entrantId: row.entrantId, place: row.rank }));
}

/** Match points as players write them: "2½", "½", "3". */
export function formatMatchPoints(points: number): string {
  const whole = Math.floor(points);
  const half = points - whole === 0.5;
  if (!half) return String(whole);
  return whole === 0 ? "½" : `${whole}½`;
}
