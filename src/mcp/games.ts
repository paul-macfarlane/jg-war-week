import type { Competition } from "@/db/schema";
import { bestOfLabel, gameTypeLabel } from "@/lib/games/config";
import type {
  BestScoreConfig,
  HeadToHeadConfig,
  RankedConfig,
} from "@/lib/games/config";
import { gameSummary } from "@/lib/games/view";
import { notFoundMessage } from "@/mcp/not-found";
import type { GamesView, GamesViewRow } from "@/queries/games";

/** The found Competition's basic facts, before deciding whether to load its Games. */
export type FoundCompetition = Pick<Competition, "name" | "scoring" | "format">;

export type GamesResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        gameType: GamesView["competition"]["gameType"];
        /** A short human summary of the Games settings, per Game Type. */
        settings: string;
        /** "open to everyone", or the fixed list of Entrants by name. */
        entrants: "open to everyone" | string[];
        closed: boolean;
      };
      leaderboard: Record<string, unknown>[];
      games: {
        loggedAt: string;
        summary: string;
        players: { name: string; place: number | null; score: number | null }[];
      }[];
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], "games">;
      };
      games: null;
      message: string;
    }
  | { found: false; message: string };

/** The Games settings as a short human summary, per Game Type. */
function settingsSummary(competition: GamesView["competition"]): string {
  const label = gameTypeLabel(competition.gameType);
  if (competition.gameType === "head-to-head") {
    const config = competition.config as HeadToHeadConfig;
    return `${label} · draws ${config.drawsAllowed ? "on" : "off"} · ${bestOfLabel(config.bestOf)}`;
  }
  if (competition.gameType === "best-score") {
    const config = competition.config as BestScoreConfig;
    const better = config.betterIs === "higher" ? "higher" : "lower";
    const unit = config.unit ? ` · ${config.unit}` : "";
    return `${label} · ${config.count} · ${better} is better${unit}`;
  }
  const config = competition.config as RankedConfig;
  return config.finishPoints.length === 0
    ? `${label} · one per player beaten`
    : `${label} · Finish Points ${config.finishPoints.join(", ")}`;
}

/** A leaderboard row's fields for the tool payload, only the Game Type's. */
function leaderboardRow(
  competition: GamesView["competition"],
  row: GamesViewRow,
): Record<string, unknown> {
  const base = { rank: row.rank, name: row.name, played: row.played };
  if (competition.gameType === "head-to-head") {
    return { ...base, wins: row.wins, losses: row.losses, draws: row.draws };
  }
  if (competition.gameType === "best-score") {
    const config = competition.config as BestScoreConfig;
    return config.count === "best"
      ? { ...base, best: row.best }
      : { ...base, total: row.total };
  }
  return { ...base, wins: row.wins, finishPoints: row.finishPoints };
}

/**
 * Serializes a `games` Competition's `get_games` answer: the leaderboard
 * ranked by its Game Type and Games newest first. Pure: the route resolves
 * the Competition by name, loads `getGamesView` (viewer `null`) only when
 * its Format is `games`, and passes the result here. Names only: never an
 * email, who logged a Game, `canEdit`, Hosts or Organizers.
 */
export function toGamesResult(
  found: FoundCompetition | undefined,
  view: GamesView | undefined,
  name: string,
): GamesResult {
  if (!found) {
    return {
      found: false,
      message: notFoundMessage(name),
    };
  }

  if (found.format !== "games" || !view) {
    if (found.format === "games") {
      // Format says games but the Competition is gone by the time it loaded.
      return {
        found: false,
        message: notFoundMessage(name),
      };
    }
    return {
      found: true,
      competition: {
        name: found.name,
        scoring: found.scoring,
        format: found.format as Exclude<Competition["format"], "games">,
      },
      games: null,
      message: `${found.name} isn't run as Games; call get_bracket or get_leaderboard.`,
    };
  }

  const { competition, leaderboard, games } = view;

  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      gameType: competition.gameType,
      settings: settingsSummary(competition),
      entrants: competition.entrantsOpen
        ? "open to everyone"
        : leaderboard.map((row) => row.name),
      closed: competition.closed,
    },
    leaderboard: leaderboard.map((row) => leaderboardRow(competition, row)),
    games: games.map((g) => ({
      loggedAt: g.loggedAt.toISOString(),
      summary: gameSummary(
        competition.gameType,
        g.players,
        competition.gameType === "best-score"
          ? (competition.config as BestScoreConfig).unit
          : "",
      ),
      players: g.players.map((p) => ({
        name: p.name,
        place: p.place,
        score: p.score,
      })),
    })),
  };
}
