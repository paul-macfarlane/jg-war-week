import type { Competition } from "@/db/schema";
import { type GameFormat, isGameFormat } from "@/lib/enums";
import { bestOfLabel, gameFormatLabel } from "@/lib/games/config";
import type { BestScoreConfig, HeadToHeadConfig } from "@/lib/games/config";
import { gameSummary } from "@/lib/games/view";
import { notFoundMessage } from "@/mcp/not-found";
import type { GamesView, GamesViewRow } from "@/queries/games";

/** The found Competition's basic facts, before deciding whether to load its Matches or Attempts. */
export type FoundCompetition = Pick<Competition, "name" | "scoring" | "format">;

/** One logged Match or Attempt in the tool payload. */
export type LoggedResult = {
  loggedAt: string;
  summary: string;
  players: { name: string; place: number | null; score: number | null }[];
};

type FoundGames = {
  found: true;
  competition: {
    name: string;
    scoring: Competition["scoring"];
    /** Head-to-head or Best score. */
    format: GamesView["competition"]["gameFormat"];
    /** A short human summary of the Format's settings. */
    settings: string;
    /** "open to everyone", or the fixed list of Entrants by name. */
    entrants: "open to everyone" | string[];
    closed: boolean;
  };
  leaderboard: Record<string, unknown>[];
};

export type GamesResult =
  /** Head-to-head: its Matches, newest first. */
  | (FoundGames & { matches: LoggedResult[] })
  /** Best score: its Attempts, newest first. */
  | (FoundGames & { attempts: LoggedResult[] })
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], GameFormat>;
      };
      matches: null;
      attempts: null;
      message: string;
    }
  | { found: false; message: string };

/** The Format's settings as a short human summary, per Format. */
function settingsSummary(competition: GamesView["competition"]): string {
  const label = gameFormatLabel(competition.gameFormat);
  if (competition.gameFormat === "head-to-head") {
    const config = competition.config as HeadToHeadConfig;
    return `${label} · draws ${config.drawsAllowed ? "on" : "off"} · ${bestOfLabel(config.bestOf)}`;
  }
  const config = competition.config as BestScoreConfig;
  const better = config.betterIs === "higher" ? "higher" : "lower";
  const unit = config.unit ? ` · ${config.unit}` : "";
  return `${label} · ${config.count} · ${better} is better${unit}`;
}

/** A leaderboard row's fields for the tool payload, only the Format's. */
function leaderboardRow(
  competition: GamesView["competition"],
  row: GamesViewRow,
): Record<string, unknown> {
  const base = { rank: row.rank, name: row.name, played: row.played };
  if (competition.gameFormat === "head-to-head") {
    return { ...base, wins: row.wins, losses: row.losses, draws: row.draws };
  }
  const config = competition.config as BestScoreConfig;
  return config.count === "best"
    ? { ...base, best: row.best }
    : { ...base, total: row.total };
}

/**
 * Serializes a Head-to-head or Best score Competition's `get_games` answer:
 * the leaderboard ranked by its Format, and its Matches (Head-to-head) or
 * Attempts (Best score) newest first. Pure: the route resolves
 * the Competition by name, loads `getGamesView` (viewer `null`) only when
 * its Format is one of those, and passes the result here. Names only: never an
 * email, who logged a Match or Attempt, `canEdit`, Hosts or Organizers.
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

  if (!isGameFormat(found.format) || !view) {
    if (isGameFormat(found.format)) {
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
        format: found.format as Exclude<Competition["format"], GameFormat>,
      },
      matches: null,
      attempts: null,
      message:
        found.format === "participation"
          ? `${found.name} isn't run as Head-to-head or Best score; it's run as Participation. Call get_participation instead.`
          : `${found.name} isn't run as Head-to-head or Best score; call get_bracket or get_leaderboard.`,
    };
  }

  const { competition, leaderboard, games } = view;

  const found_: FoundGames = {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: competition.gameFormat,
      settings: settingsSummary(competition),
      entrants: competition.entrantsOpen
        ? "open to everyone"
        : leaderboard.map((row) => row.name),
      closed: competition.closed,
    },
    leaderboard: leaderboard.map((row) => leaderboardRow(competition, row)),
  };
  const logged: LoggedResult[] = games.map((g) => ({
    loggedAt: g.loggedAt.toISOString(),
    summary: gameSummary(
      competition.gameFormat,
      g.players,
      competition.gameFormat === "best-score"
        ? (competition.config as BestScoreConfig).unit
        : "",
    ),
    players: g.players.map((p) => ({
      name: p.name,
      place: p.place,
      score: p.score,
    })),
  }));
  return competition.gameFormat === "best-score"
    ? { ...found_, attempts: logged }
    : { ...found_, matches: logged };
}
