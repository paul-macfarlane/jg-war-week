import type { Competition } from "@/db/schema";
import {
  type BestScoreSettings,
  teamScoreLabel,
} from "@/lib/best-score/config";
import { attemptSummary, sumsMembers } from "@/lib/best-score/standings";
import { type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import { loggedFormatLabel } from "@/lib/logged-results";
import { type SeriesConfig, bestOfLabel } from "@/lib/series/config";
import { matchSummary } from "@/lib/series/standings";
import { notFoundMessage } from "@/mcp/not-found";
import {
  type ScoreDirectionLabel,
  scoreDirectionLabel,
  scoreUnitLabel,
} from "@/mcp/score";
import type {
  LoggedResultsRow,
  LoggedResultsView,
} from "@/queries/logged-results";

/** The found Competition's basic facts, before deciding whether to load its Matches or Attempts. */
export type FoundCompetition = Pick<Competition, "name" | "scoring" | "format">;

/** One logged Match or Attempt in the tool payload. */
export type LoggedResult = {
  loggedAt: string;
  summary: string;
  players: { name: string; place: number | null; score: number | null }[];
};

type FoundLogged = {
  found: true;
  competition: {
    name: string;
    scoring: Competition["scoring"];
    /** Head-to-head or Best score. */
    format: LoggedFormat;
    /** A short human summary of the Format's settings. */
    settings: string;
    scoreDirection: ScoreDirectionLabel;
    scoreUnit: string | null;
    closed: boolean;
  } & (
    | {
        /** Head-to-head: the Best of, whether a Match may be a Draw, and the two Entrants by name. */
        bestOf: number;
        drawsAllowed: boolean;
        entrants: string[];
      }
    | {
        /** Best score: "Max attempts per person", or "unlimited". */
        maxAttempts: number | "unlimited";
        /** In team scoring only: how a Team's score adds up. */
        teamScore?: string;
      }
  );
  leaderboard: Record<string, unknown>[];
};

export type LoggedResultsAnswer =
  /** Head-to-head: its Matches, newest first. */
  | (FoundLogged & { matches: LoggedResult[] })
  /** Best score: its Attempts, newest first. */
  | (FoundLogged & { attempts: LoggedResult[] })
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], LoggedFormat>;
      };
      matches: null;
      attempts: null;
      message: string;
    }
  | { found: false; message: string };

/** The Format's settings as a short human summary, per Format. */
function settingsSummary(
  competition: LoggedResultsView["competition"],
): string {
  const label = loggedFormatLabel(competition.format);
  if (competition.format === "head-to-head") {
    const config = competition.config as SeriesConfig;
    return `${label} · draws ${config.drawsAllowed ? "on" : "off"} · ${bestOfLabel(config.bestOf)}`;
  }
  const config = competition.config as BestScoreSettings;
  const unit = config.unit ? ` · ${config.unit}` : "";
  const team =
    competition.scoring === "team"
      ? ` · Team score: ${teamScoreLabel(config.teamScore)}`
      : "";
  return `${label} · ${config.betterIs} is better${unit}${team}`;
}

/** The Format's own fields: a Head-to-head's Best of, draws and Entrants; a Best score's attempt limit and Team score. */
function formatFields(
  competition: LoggedResultsView["competition"],
  view: LoggedResultsView,
) {
  if (competition.format === "head-to-head") {
    const config = competition.config as SeriesConfig;
    return {
      bestOf: config.bestOf,
      drawsAllowed: config.drawsAllowed,
      entrants: view.playerOptions.map((p) => p.name),
    };
  }
  const config = competition.config as BestScoreSettings;
  return {
    maxAttempts: competition.maxAttempts ?? ("unlimited" as const),
    ...(competition.scoring === "team"
      ? { teamScore: teamScoreLabel(config.teamScore) }
      : {}),
  };
}

/** A leaderboard row's fields for the tool payload, only the Format's. */
function leaderboardRow(
  competition: LoggedResultsView["competition"],
  row: LoggedResultsRow,
): Record<string, unknown> {
  const base = { rank: row.rank, name: row.name, played: row.played };
  if (competition.format === "head-to-head") {
    return { ...base, wins: row.wins, losses: row.losses, draws: row.draws };
  }
  const config = competition.config as BestScoreSettings;
  return sumsMembers(competition.scoring, config)
    ? { ...base, total: row.total }
    : { ...base, best: row.best };
}

/**
 * Serializes a Head-to-head or Best score Competition's `get_games` answer:
 * the leaderboard ranked by its Format, and its Matches (Head-to-head) or
 * Attempts (Best score) newest first. Pure: the route resolves
 * the Competition by name, loads `getLoggedResultsView` (viewer `null`) only when
 * its Format is one of those, and passes the result here. Names only: never an
 * email, who logged a Match or Attempt, `canEdit`, Hosts or Organizers.
 */
export function toLoggedResultsAnswer(
  found: FoundCompetition | undefined,
  view: LoggedResultsView | undefined,
  name: string,
): LoggedResultsAnswer {
  if (!found) {
    return {
      found: false,
      message: notFoundMessage(name),
    };
  }

  if (!isLoggedFormat(found.format) || !view) {
    if (isLoggedFormat(found.format)) {
      // Its Format logs results but the Competition is gone by the time it loaded.
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
        format: found.format as Exclude<Competition["format"], LoggedFormat>,
      },
      matches: null,
      attempts: null,
      message:
        found.format === "participation"
          ? `${found.name} isn't run as Head-to-head or Best score; it's run as Participation. Call get_participation instead.`
          : found.format === "league"
            ? `${found.name} isn't run as Head-to-head or Best score; it's run as a League. Call get_league instead.`
            : `${found.name} isn't run as Head-to-head or Best score; call get_bracket or get_leaderboard.`,
    };
  }

  const { competition, leaderboard, results } = view;
  const unit =
    competition.format === "best-score"
      ? (competition.config as BestScoreSettings).unit
      : "";

  const base: FoundLogged = {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
      settings: settingsSummary(competition),
      scoreDirection: scoreDirectionLabel(competition.scoringConfig.direction),
      scoreUnit: scoreUnitLabel(competition.scoringConfig.unit),
      ...formatFields(competition, view),
      closed: competition.closed,
    },
    leaderboard: leaderboard.map((row) => leaderboardRow(competition, row)),
  };
  const logged: LoggedResult[] = results.map((g) => ({
    loggedAt: g.recordedAt.toISOString(),
    summary:
      competition.format === "head-to-head"
        ? matchSummary(g.players)
        : attemptSummary(
            g.players[0]?.name ?? "",
            g.players[0]?.score ?? null,
            unit,
          ),
    players: g.players.map((p) => ({
      name: p.name,
      place: p.place,
      score: p.score,
    })),
  }));
  return competition.format === "best-score"
    ? { ...base, attempts: logged }
    : { ...base, matches: logged };
}
