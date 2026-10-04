/**
 * A Head-to-head series' standings and its view (CONTEXT.md; spec R20,
 * decision 7): two Entrants, ranked by Matches won, and the series score
 * with its Winner once one Entrant has a majority of the Best of. Pure: no
 * database, no framework.
 */
import {
  type ResultFact,
  type StandingsRow,
  emptyRow,
  rankRows,
} from "@/lib/logged-results";
import { type SeriesConfig, majorityOf } from "@/lib/series/config";

/**
 * The series' standings: a row for every Entrant (`entrantIds`, each a
 * Team or Participant id), even with no Match, ranked by Matches won;
 * ties share the higher rank; an Entrant with no Match is unranked.
 */
export function rankSeries(
  matches: ResultFact[],
  entrantIds: string[],
): StandingsRow[] {
  const rows = new Map<string, StandingsRow>();
  for (const id of entrantIds) rows.set(id, emptyRow(id));
  for (const match of matches) {
    const [a, b] = match.players;
    if (!a || !b) continue;
    for (const [player, opponent] of [
      [a, b],
      [b, a],
    ] as const) {
      const row = rows.get(player.id);
      if (!row) continue;
      row.played += 1;
      if (player.place === 1 && opponent.place === 2) row.wins += 1;
      else if (player.place === 2 && opponent.place === 1) row.losses += 1;
      else if (player.place === 1 && opponent.place === 1) row.draws += 1;
    }
  }
  return rankRows(
    [...rows.values()],
    (row) => (row.played === 0 ? null : row.wins),
    "desc",
  );
}

/**
 * The id with a majority of the Best of's Matches won (a Draw counts for
 * nobody); null while nobody has one.
 */
export function bestOfWinner(
  config: SeriesConfig,
  matches: ResultFact[],
): string | null {
  const wins = new Map<string, number>();
  for (const match of matches) {
    const [a, b] = match.players;
    if (!a || !b) continue;
    if (a.place === 1 && b.place === 2) {
      wins.set(a.id, (wins.get(a.id) ?? 0) + 1);
    } else if (b.place === 1 && a.place === 2) {
      wins.set(b.id, (wins.get(b.id) ?? 0) + 1);
    }
  }
  const majority = majorityOf(config.bestOf);
  for (const [id, count] of wins) {
    if (count >= majority) return id;
  }
  return null;
}

/** A head-to-head row's record, like "3–1–0" (wins-losses-draws). */
export function recordLabel(
  row: Pick<StandingsRow, "wins" | "losses" | "draws">,
): string {
  return `${row.wins}–${row.losses}–${row.draws}`;
}

/**
 * One line of a Match's copy: "Ashley beat Sam", "Ashley and Sam drew",
 * else "Ashley vs Sam".
 */
export function matchSummary(
  players: { name: string; place: number | null }[],
): string {
  const winner = players.find((p) => p.place === 1);
  const loser = players.find((p) => p.place === 2);
  if (winner && loser) return `${winner.name} beat ${loser.name}`;
  if (players.length === 2 && players.every((p) => p.place === 1)) {
    return `${players[0].name} and ${players[1].name} drew`;
  }
  return players.map((p) => p.name).join(" vs ");
}

/** A Match of the series: its Winner's id, "draw", or null. */
export type SeriesMatch = { id: string; winner: string | "draw" | null };

export type Series = {
  /** Oldest first. */
  matches: SeriesMatch[];
  /** Matches won by each of the two Entrants, in their order. */
  wins: [number, number];
  draws: number;
  /** The wins as "2–1". */
  score: string;
  /** The series Winner once decided, else null. */
  winner: string | null;
};

/**
 * The two Entrants' series: the Matches in order with each one's Winner
 * (or a Draw), the series score, and the series Winner. A Best of is
 * decided the moment a side has a majority (`bestOfWinner`, the rule
 * logging stops on); Closed short of one, the side with more wins.
 */
export function seriesOf(
  config: SeriesConfig,
  matches: ResultFact[],
  entrants: [string, string],
  closed: boolean,
): Series {
  const ordered = [...matches].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const wins: [number, number] = [0, 0];
  let draws = 0;
  const listed = ordered.map((match): SeriesMatch => {
    const [a, b] = match.players;
    let winner: SeriesMatch["winner"] = null;
    if (a && b && a.place === 1 && b.place === 1) {
      winner = "draw";
      draws += 1;
    } else {
      const won = match.players.find((p) => p.place === 1)?.id ?? null;
      const side = won === null ? -1 : entrants.indexOf(won);
      if (side >= 0) {
        wins[side] += 1;
        winner = won;
      }
    }
    return { id: match.id, winner };
  });
  const leader =
    wins[0] === wins[1] ? null : wins[0] > wins[1] ? entrants[0] : entrants[1];
  return {
    matches: listed,
    wins,
    draws,
    score: `${wins[0]}–${wins[1]}`,
    winner: bestOfWinner(config, matches) ?? (closed ? leader : null),
  };
}

/**
 * The line under the series score while it has no Winner: the Best of's
 * target while it's open and, once Closed level, that it ended with no
 * series Winner. Null once the series has a Winner.
 */
export function seriesNote(
  config: SeriesConfig,
  series: Series,
  closed: boolean,
): string | null {
  if (series.winner !== null) return null;
  if (closed) return "Closed level: no series Winner.";
  if (config.bestOf === 1) return "Best of 1: one Match decides it.";
  return `Best of ${config.bestOf}: first to ${majorityOf(config.bestOf)} wins.`;
}
