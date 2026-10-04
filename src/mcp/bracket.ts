import type { Competition } from "@/db/schema";
import { isBye } from "@/lib/bracket/formats";
import type { BracketFormat } from "@/lib/bracket/types";
import { groupRounds, matchName } from "@/lib/bracket/view";
import { type LoggedFormat, isLoggedFormat } from "@/lib/enums";
import { notFoundMessage } from "@/mcp/not-found";
import type { BracketView } from "@/queries/brackets";

export type BracketResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: BracketFormat;
        /** Entrants per Match. */
        matchSize: number;
        /** How many of each Match advance. */
        advancing: number;
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
        format: LoggedFormat | "participation";
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
      matchSize: view.bracket.config.entrantsPerMatch,
      advancing: view.bracket.config.advancePerMatch,
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
