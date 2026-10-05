import type { Competition } from "@/db/schema";
import { PAIRING_LABELS } from "@/lib/league/config";
import { notFoundMessage } from "@/mcp/not-found";
import {
  type ScoreDirectionLabel,
  scoreDirectionLabel,
  scoreUnitLabel,
} from "@/mcp/score";
import type { LeagueView } from "@/queries/league";

export type LeagueResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: "League";
        pairing: "round robin" | "swiss";
        /** How many rounds the League plays with its Entrants. */
        rounds: number;
        /** How many are paired so far. */
        roundsPaired: number;
        scoreDirection: ScoreDirectionLabel;
        scoreUnit: string | null;
        selfReport: boolean;
        closed: boolean;
      };
      standings: {
        rank: number;
        name: string;
        team: string | null;
        wins: number;
        draws: number;
        losses: number;
        /** Byes (Swiss) or sit-outs (round robin). */
        byes: number;
        matchPoints: number;
        tiebreaks:
          | { headToHead: number | null; sonnebornBerger: number | null }
          | { buchholz: number | null };
        points: number | null;
        /** `points` are what Close would award, not yet written. */
        provisional: boolean;
      }[];
      rounds: {
        round: number;
        matches: {
          a: string;
          /** Null for a bye or sit-out. */
          b: string | null;
          result: "a won" | "b won" | "draw" | null;
          scoreA: number | null;
          scoreB: number | null;
          /** ISO instant; null until it has a result. */
          recordedAt: string | null;
        }[];
      }[];
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Competition["format"];
      };
      league: null;
      message: string;
    }
  | { found: false; message: string };

const RESULT_WORDS = { a: "a won", b: "b won", draw: "draw" } as const;

/** The tool that reads a Competition run in each other Format. */
const OTHER_TOOLS: Record<Exclude<Competition["format"], "league">, string> = {
  placement: "get_placements",
  bracket: "get_bracket",
  "head-to-head": "get_games",
  "best-score": "get_games",
  participation: "get_participation",
};

/**
 * The `get_league` answer for a Competition that isn't a League: no
 * League, and a pointer to the tool for its Format. Pure.
 */
export function toNotLeagueResult(
  found: Pick<Competition, "name" | "scoring" | "format">,
): LeagueResult {
  const tool =
    found.format === "league" ? "get_leaderboard" : OTHER_TOOLS[found.format];
  return {
    found: true,
    competition: {
      name: found.name,
      scoring: found.scoring,
      format: found.format,
    },
    league: null,
    message: `${found.name} isn't run as a League; call ${tool} instead.`,
  };
}

/**
 * Serializes a League into the `get_league` MCP tool payload: its
 * settings, standings with tiebreaks and the rounds with each Match and
 * its result. Names only, whitelisted field by field: never an email, an
 * id, a picture or who recorded a Match. Pure: the route resolves the
 * Competition by name and loads `view`.
 */
export function toLeagueResult(
  view: LeagueView | undefined,
  name: string,
): LeagueResult {
  if (!view) return { found: false, message: notFoundMessage(name) };

  const { competition } = view;
  const swiss = competition.config.pairing === "swiss";
  const nameOf = new Map(view.entrants.map((e) => [e.id, e.name]));
  const standingNames = new Map(
    view.standings.map((s) => [s.entrantId, s.name]),
  );
  const label = (id: string) =>
    nameOf.get(id) ?? standingNames.get(id) ?? "Unknown";

  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: "League",
      pairing: PAIRING_LABELS[competition.config.pairing].toLowerCase() as
        "round robin" | "swiss",
      rounds: view.roundsTotal,
      roundsPaired: view.roundsPaired,
      scoreDirection: scoreDirectionLabel(competition.scoreDirection),
      scoreUnit: scoreUnitLabel(competition.scoreUnit),
      selfReport: competition.selfReport,
      closed: competition.closed,
    },
    standings: view.standings.map((row) => ({
      rank: row.rank,
      name: row.name,
      team: row.team,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      byes: row.byes,
      matchPoints: row.matchPoints,
      tiebreaks: swiss
        ? { buchholz: row.buchholz }
        : {
            headToHead: row.headToHead,
            sonnebornBerger: row.sonnebornBerger,
          },
      points: row.points,
      provisional: view.provisional && row.points !== null,
    })),
    rounds: view.rounds.map((round) => ({
      round: round.round,
      matches: round.matches.map((match) => ({
        a: label(match.a),
        b: match.b === null ? null : label(match.b),
        result: match.result ? RESULT_WORDS[match.result] : null,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        recordedAt: match.recordedAt ? match.recordedAt.toISOString() : null,
      })),
    })),
  };
}
