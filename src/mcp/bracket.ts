import type { Competition } from "@/db/schema";
import { isBye } from "@/lib/bracket/formats";
import { matchAdvanceCount } from "@/lib/bracket/groups";
import type { BracketFormat } from "@/lib/bracket/types";
import { groupRounds, matchName } from "@/lib/bracket/view";
import { type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import { notFoundMessage } from "@/mcp/not-found";
import {
  type ScoreDirectionLabel,
  scoreDirectionLabel,
  scoreUnitLabel,
} from "@/mcp/score";
import type { BracketView } from "@/queries/brackets";

export type BracketResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: BracketFormat;
        /** Head-to-head (2 per Match, 1 advancing) or group. */
        kind: "head-to-head" | "group";
        scoreDirection: ScoreDirectionLabel;
        scoreUnit: string | null;
        /** Entrants per Match. */
        matchSize: number;
        /** How many of each Match advance. */
        advancing: number;
        /** Rounds whose defaults differ from the Bracket-wide ones. */
        roundDefaults: {
          round: number;
          matchSize: number;
          advancing: number;
        }[];
        thirdPlaceMatch: boolean;
        closed: boolean;
      };
      entrants: {
        seedPosition: number;
        name: string;
        team: string | null;
        /** A Squad's Participants by name; null for a Team or Participant. */
        participants: string[] | null;
      }[];
      rounds: {
        round: number;
        name: string;
        matches: {
          name: string;
          status: string;
          /** Entrants the Match holds. */
          size: number;
          /** How many of the Match advance. */
          advancing: number;
          /** When a played Match's result was recorded (ISO instant); else null. */
          recordedAt: string | null;
          /**
           * The 3rd place Match, beside the final in the last Round; the
           * final is the last Round's other Match.
           */
          thirdPlace: boolean;
          entrants: {
            name: string;
            place: number | null;
            score: string | null;
          }[];
        }[];
      }[];
      /** The final's Winner once the Bracket is Closed; else null. */
      winner: string | null;
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: "placement";
      };
      bracket: null;
      message: string;
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: LoggedFormat | "participation" | "league";
      };
      bracket: null;
      message: string;
    }
  | { found: false; message: string };

/**
 * The `get_bracket` answer for a Head-to-head or Best score Competition,
 * which is never a Bracket: no Bracket, and a pointer to `get_games`. Pure.
 */
export function toLoggedBracketResult(
  competition: Pick<Competition, "name" | "scoring"> & { format: LoggedFormat },
): BracketResult {
  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: competition.format,
    },
    bracket: null,
    message: `${competition.name} isn't run as a Bracket; it's run as Head-to-head or Best score. Call get_games instead.`,
  };
}

/**
 * The `get_bracket` answer for a `participation` Competition, which is
 * never a Bracket: no Bracket, and a pointer to `get_participation`. Pure.
 */
export function toParticipationBracketResult(
  competition: Pick<Competition, "name" | "scoring">,
): BracketResult {
  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: "participation",
    },
    bracket: null,
    message: `${competition.name} isn't run as a Bracket; it's run as Participation. Call get_participation instead.`,
  };
}

/**
 * The `get_bracket` answer for a League, which is never a Bracket: no
 * Bracket, and a pointer to `get_league`. Pure.
 */
export function toLeagueBracketResult(
  competition: Pick<Competition, "name" | "scoring">,
): BracketResult {
  return {
    found: true,
    competition: {
      name: competition.name,
      scoring: competition.scoring,
      format: "league",
    },
    bracket: null,
    message: `${competition.name} isn't run as a Bracket; it's run as a League. Call get_league instead.`,
  };
}

/**
 * Serializes a Bracket (or its absence, or a Placement Competition) into the
 * `get_bracket` MCP tool payload. Names only: never an email, the Organizer
 * list, Hosts or who self-reported a Match. Pure: the route resolves the
 * Competition by name and loads `view`.
 */
export function toBracketResult(
  view: BracketView | undefined,
  name: string,
): BracketResult {
  if (!view) {
    return {
      found: false,
      message: notFoundMessage(name),
    };
  }

  if (isLoggedFormat(view.competition.format)) {
    return toLoggedBracketResult({
      name: view.competition.name,
      scoring: view.competition.scoring,
      format: view.competition.format,
    });
  }
  if (view.competition.format === "participation") {
    return toParticipationBracketResult(view.competition);
  }

  if (view.competition.format === "league") {
    return toLeagueBracketResult(view.competition);
  }

  if (view.competition.format === "placement") {
    return {
      found: true,
      competition: {
        name: view.competition.name,
        scoring: view.competition.scoring,
        format: "placement",
      },
      bracket: null,
      message: `${view.competition.name} isn't run as a Bracket; it's run as Placement: call get_placements.`,
    };
  }

  const entrantsById = Object.fromEntries(
    view.entrants.map((entrant) => [entrant.id, entrant.label]),
  );

  return {
    found: true,
    competition: {
      name: view.competition.name,
      scoring: view.competition.scoring,
      format: view.competition.format,
      kind: view.bracket.config.kind,
      scoreDirection: scoreDirectionLabel(view.competition.scoreDirection),
      scoreUnit: scoreUnitLabel(view.competition.scoreUnit),
      matchSize: view.bracket.config.entrantsPerMatch,
      advancing: view.bracket.config.advancePerMatch,
      roundDefaults: Object.entries(view.bracket.config.rounds)
        .map(([round, defaults]) => ({
          round: Number(round),
          matchSize: defaults.entrantsPerMatch,
          advancing: defaults.advancePerMatch,
        }))
        .sort((a, b) => a.round - b.round),
      thirdPlaceMatch: view.bracket.config.thirdPlaceMatch,
      closed: view.closed,
    },
    entrants: view.entrants.map((entrant) => ({
      seedPosition: entrant.seedPosition,
      name: entrant.label,
      team: entrant.teamName,
      participants: entrant.squadId ? [...entrant.participantNames] : null,
    })),
    rounds: groupRounds(view.bracket).map((round) => ({
      round: round.round,
      name: round.name,
      matches: round.matches.map((match) => ({
        name: matchName(view.bracket, match),
        status: isBye(view.bracket, match) ? "bye" : match.status,
        size: match.slots.length,
        advancing: matchAdvanceCount(view.bracket, match),
        recordedAt: match.recordedAt ? match.recordedAt.toISOString() : null,
        thirdPlace: match.thirdPlace,
        entrants: match.slots
          .filter((slot) => slot.entrantId !== null)
          .map((slot) => ({
            name: entrantsById[slot.entrantId!] ?? "Unknown",
            place: slot.place,
            score: slot.score,
          })),
      })),
    })),
    winner:
      view.closed && view.winner ? (entrantsById[view.winner] ?? null) : null,
  };
}
