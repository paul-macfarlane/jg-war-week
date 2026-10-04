/**
 * Leaderboard ranking for a Head-to-head or Best score Competition (CONTEXT.md,
 * R3 decision 4). Pure: no database, no framework.
 */
import type { Placing } from "@/lib/bracket/types";
import type { GameFormat } from "@/lib/enums";
import type {
  BestScoreConfig,
  GamesConfigFor,
  HeadToHeadConfig,
} from "@/lib/games/config";

/** One player of one Game: an opaque Team or Participant id (never an Entrant row). */
export type GamePlayerFact = {
  id: string;
  place: number | null;
  score: number | null;
};

export type GameFact = {
  id: string;
  loggedAt: Date;
  players: GamePlayerFact[];
};

export type LeaderboardRow = {
  id: string;
  /** Standard competition ranking (1, 1, 3); null when the id has no Game. */
  rank: number | null;
  played: number;
  /** Head-to-head: Games won. */
  wins: number;
  losses: number;
  draws: number;
  best: number | null;
  total: number | null;
};

function uniqueIdsOf(games: GameFact[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const game of games) {
    for (const player of game.players) {
      if (!seen.has(player.id)) {
        seen.add(player.id);
        ids.push(player.id);
      }
    }
  }
  return ids;
}

function emptyRow(id: string): LeaderboardRow {
  return {
    id,
    rank: null,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    best: null,
    total: null,
  };
}

function applyHeadToHead(rows: Map<string, LeaderboardRow>, games: GameFact[]) {
  for (const game of games) {
    const [a, b] = game.players;
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
}

function applyBestScore(
  rows: Map<string, LeaderboardRow>,
  games: GameFact[],
  config: BestScoreConfig,
) {
  for (const game of games) {
    for (const player of game.players) {
      const row = rows.get(player.id);
      if (!row || player.score === null) continue;
      row.played += 1;
      row.total = (row.total ?? 0) + player.score;
      row.best =
        row.best === null
          ? player.score
          : config.betterIs === "higher"
            ? Math.max(row.best, player.score)
            : Math.min(row.best, player.score);
    }
  }
}

function rankKeyOf<T extends GameFormat>(
  gameFormat: T,
  config: GamesConfigFor<T>,
  row: LeaderboardRow,
): number | null {
  if (row.played === 0) return null;
  if (gameFormat === "head-to-head") return row.wins;
  const cfg = config as BestScoreConfig;
  return cfg.count === "best" ? row.best : row.total;
}

/**
 * Rank Games per Games Format: `entrantIds` is the fixed Entrant list (a row
 * for every id, even with no Game) or `null` for open-to-everyone (rows
 * only for ids that appear in a Game). Sorted best first; ties share the
 * higher rank (standard competition ranking); an id with no Game is
 * unranked (`rank: null`) and sorts last.
 */
export function rankGames<T extends GameFormat>(
  gameFormat: T,
  config: GamesConfigFor<T>,
  games: GameFact[],
  entrantIds: string[] | null,
): LeaderboardRow[] {
  const ids = entrantIds ?? uniqueIdsOf(games);
  const rows = new Map<string, LeaderboardRow>();
  for (const id of ids) rows.set(id, emptyRow(id));

  if (gameFormat === "head-to-head") applyHeadToHead(rows, games);
  else applyBestScore(rows, games, config as BestScoreConfig);

  const direction: "desc" | "asc" =
    gameFormat === "best-score" &&
    (config as BestScoreConfig).betterIs === "lower"
      ? "asc"
      : "desc";

  const all = [...rows.values()];
  const ranked = all.filter(
    (row) => rankKeyOf(gameFormat, config, row) !== null,
  );
  const unranked = all
    .filter((row) => rankKeyOf(gameFormat, config, row) === null)
    .sort((a, b) => a.id.localeCompare(b.id));

  ranked.sort((x, y) => {
    const kx = rankKeyOf(gameFormat, config, x)!;
    const ky = rankKeyOf(gameFormat, config, y)!;
    if (kx !== ky) return direction === "desc" ? ky - kx : kx - ky;
    return x.id.localeCompare(y.id);
  });

  let rank = 0;
  let prevKey: number | null = null;
  for (const [i, row] of ranked.entries()) {
    const key = rankKeyOf(gameFormat, config, row);
    if (key !== prevKey) rank = i + 1;
    row.rank = rank;
    prevKey = key;
  }

  return [...ranked, ...unranked];
}

/**
 * The leaderboard's rows as Placings, the input to `pointsFor`
 * (`src/lib/bracket/points.ts`) so Close awards Placement Points with the
 * Bracket's tie rule. Rows with no rank (no Game) are omitted.
 */
export function placingsOf(rows: LeaderboardRow[]): Placing[] {
  return rows.flatMap((row) =>
    row.rank === null ? [] : [{ entrantId: row.id, place: row.rank }],
  );
}

/**
 * The id with a majority of `bestOf` Games won (a draw counts for nobody);
 * `null` when nobody has a majority yet, or `bestOf` is off.
 */
export function bestOfWinner(
  config: HeadToHeadConfig,
  games: GameFact[],
): string | null {
  if (config.bestOf === null) return null;
  const wins = new Map<string, number>();
  for (const game of games) {
    const [a, b] = game.players;
    if (!a || !b) continue;
    if (a.place === 1 && b.place === 2)
      wins.set(a.id, (wins.get(a.id) ?? 0) + 1);
    else if (b.place === 1 && a.place === 2)
      wins.set(b.id, (wins.get(b.id) ?? 0) + 1);
  }
  const majority = Math.floor(config.bestOf / 2) + 1;
  for (const [id, count] of wins) {
    if (count >= majority) return id;
  }
  return null;
}

/** Whether a Best of has reached its decided moment. */
export function isBestOfDecided(
  config: HeadToHeadConfig,
  games: GameFact[],
): boolean {
  return bestOfWinner(config, games) !== null;
}

/** A Best score player's Attempts, by Game id. */
export type PlayerAttempts = {
  /** The Attempt that counts in `count: best` mode (a tie: the earlier). */
  best: string;
  /** Every Attempt with a Score, newest first. */
  attempts: string[];
};

/**
 * Each Best score player's Attempts (spec R20, decision 4): the one their
 * row's best comes from, by the configured direction, and all of them
 * newest first, so a row can list "2 more attempts" (or, in `total` mode,
 * the Attempts its total adds up). A player with no scored Attempt has no
 * entry.
 */
export function attemptsOf(
  config: BestScoreConfig,
  games: GameFact[],
): Map<string, PlayerAttempts> {
  type Scored = { id: string; at: number; score: number };
  const byPlayer = new Map<string, Scored[]>();
  for (const game of games) {
    for (const player of game.players) {
      if (player.score === null) continue;
      const list = byPlayer.get(player.id) ?? [];
      list.push({
        id: game.id,
        at: game.loggedAt.getTime(),
        score: player.score,
      });
      byPlayer.set(player.id, list);
    }
  }
  const better = (a: Scored, b: Scored) =>
    a.score !== b.score
      ? config.betterIs === "higher"
        ? a.score > b.score
        : a.score < b.score
      : a.at !== b.at
        ? a.at < b.at
        : a.id < b.id;
  const result = new Map<string, PlayerAttempts>();
  for (const [id, list] of byPlayer) {
    const best = list.reduce((top, next) => (better(next, top) ? next : top));
    const newestFirst = [...list].sort(
      (a, b) => b.at - a.at || a.id.localeCompare(b.id),
    );
    result.set(id, { best: best.id, attempts: newestFirst.map((a) => a.id) });
  }
  return result;
}
