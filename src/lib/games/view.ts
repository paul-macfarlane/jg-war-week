/**
 * Display helpers for a `games` Competition: leaderboard columns, a Game's
 * one-line copy for the log, and the "Mine" filter. Pure, like `bracket/view.ts`.
 */
import type { GameType } from "@/lib/enums";
import type { BestScoreConfig, GamesConfigFor } from "@/lib/games/config";
import type { LeaderboardRow } from "@/lib/games/leaderboard";

export type LeaderboardColumn = { key: string; label: string };

/**
 * The leaderboard's columns per Game Type: head-to-head shows Played and
 * W/L/D; best-score its counted value then Played; ranked Finish Points,
 * Played and Wins. Takes `config` (not just `gameType`) because
 * best-score's column label names its counted value ("Best" or "Total")
 * and unit.
 */
export function leaderboardColumns<T extends GameType>(
  gameType: T,
  config: GamesConfigFor<T>,
): LeaderboardColumn[] {
  if (gameType === "head-to-head") {
    return [
      { key: "played", label: "Played" },
      { key: "wins", label: "W" },
      { key: "losses", label: "L" },
      { key: "draws", label: "D" },
    ];
  }
  if (gameType === "best-score") {
    const cfg = config as BestScoreConfig;
    const base = cfg.count === "best" ? "Best" : "Total";
    return [
      {
        key: cfg.count,
        label: cfg.unit ? `${base} (${cfg.unit})` : base,
      },
      { key: "played", label: "Played" },
    ];
  }
  return [
    { key: "finishPoints", label: "Finish Points" },
    { key: "played", label: "Played" },
    { key: "wins", label: "Wins" },
  ];
}

/** A head-to-head row's record, like "3–1–0" (wins-losses-draws). */
export function recordLabel(
  row: Pick<LeaderboardRow, "wins" | "losses" | "draws">,
): string {
  return `${row.wins}–${row.losses}–${row.draws}`;
}

/** A score with its unit, like "42 trips"; "—" when there is none. */
export function formatScore(score: number | null, unit: string): string {
  if (score === null) return "—";
  return unit ? `${score} ${unit}` : `${score}`;
}

export type GameSummaryPlayer = {
  name: string;
  place: number | null;
  score: number | null;
};

/**
 * One line of Game log copy, per Game Type: "Ashley beat Sam" (a draw:
 * "Ashley and Sam drew"), "Ashley · 42 trips", or "1. Red 2. Blue 3. Green".
 */
export function gameSummary(
  gameType: GameType,
  players: GameSummaryPlayer[],
  unit = "",
): string {
  if (gameType === "head-to-head") {
    const winner = players.find((p) => p.place === 1);
    const loser = players.find((p) => p.place === 2);
    if (winner && loser) return `${winner.name} beat ${loser.name}`;
    if (players.length === 2 && players.every((p) => p.place === 1)) {
      return `${players[0].name} and ${players[1].name} drew`;
    }
    return players.map((p) => p.name).join(" vs ");
  }
  if (gameType === "best-score") {
    const player = players[0];
    if (!player) return "";
    return `${player.name} · ${formatScore(player.score, unit)}`;
  }
  const sorted = [...players].sort((a, b) => (a.place ?? 0) - (b.place ?? 0));
  return sorted.map((p) => `${p.place}. ${p.name}`).join(" ");
}

/**
 * Whether the linked Participant (or their Team) is a player of the Game,
 * for the "Mine" filter. A player's `id` is a Team or Participant id
 * (`GamePlayerFact`), never an Entrant row.
 */
export function isMine(
  players: { id: string }[],
  linked: { participantId: string; teamId: string | null },
): boolean {
  return players.some(
    (p) =>
      p.id === linked.participantId ||
      (linked.teamId !== null && p.id === linked.teamId),
  );
}

/**
 * The leaderboard's top places, listed for the Close confirm: "3, 2, 1", or
 * "none set" for a Competition with none.
 */
export function placementPointsList(placementPoints: number[] | null): string {
  return placementPoints && placementPoints.length > 0
    ? placementPoints.join(", ")
    : "none set";
}
