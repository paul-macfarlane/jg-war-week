import type { Competition } from "@/db/schema";
import { isBye } from "@/lib/bracket/formats";
import { groupRounds, heatName } from "@/lib/bracket/view";
import type { BracketView } from "@/queries/brackets";

/** `HH:MM:SS` (or `HH:MM`) as `HH:MM`. */
function toHourMinute(time: string): string {
  return time.slice(0, 5);
}

export type BracketResult =
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: Exclude<Competition["format"], "points">;
        finalized: boolean;
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
        heats: {
          name: string;
          status: string;
          date: string | null;
          startTime: string | null;
          location: string | null;
          entrants: {
            name: string;
            place: number | null;
            score: string | null;
            forfeited: boolean;
          }[];
        }[];
      }[];
      champion: string | null;
    }
  | {
      found: true;
      competition: {
        name: string;
        scoring: Competition["scoring"];
        format: "points";
      };
      bracket: null;
      message: string;
    }
  | { found: false; message: string };

/**
 * Serializes a Bracket (or its absence, or a points Competition) into the
 * `get_bracket` MCP tool payload. Names only: never an email, the Organizer
 * list, Hosts or who self-reported a Heat. Pure: the route resolves the
 * Competition by name and loads `view` and `days`.
 */
export function toBracketResult(
  view: BracketView | undefined,
  days: { id: string; date: string }[],
  name: string,
): BracketResult {
  if (!view) {
    return {
      found: false,
      message: `No Competition named "${name}" found for the current War Week. Call get_current_war_week or ask about its Standings.`,
    };
  }

  if (view.competition.format === "points") {
    return {
      found: true,
      competition: {
        name: view.competition.name,
        scoring: view.competition.scoring,
        format: "points",
      },
      bracket: null,
      message: `${view.competition.name} isn't run as a Bracket; ask about its Standings instead.`,
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
      finalized: view.finalized,
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
      heats: round.heats.map((heat) => {
        // A deleted Day nulls `dayId` but keeps `startTime`; without a Day,
        // there's no date to hang the time on, so both read null together.
        const date = heat.dayId
          ? (days.find((day) => day.id === heat.dayId)?.date ?? null)
          : null;
        return {
          name: heatName(view.bracket, heat),
          status: isBye(view.bracket, heat) ? "bye" : heat.status,
          date,
          startTime:
            date && heat.startTime ? toHourMinute(heat.startTime) : null,
          location: heat.location,
          entrants: heat.slots
            .filter((slot) => slot.entrantId !== null)
            .map((slot) => ({
              name: entrantsById[slot.entrantId!] ?? "Unknown",
              place: slot.place,
              score: slot.score,
              forfeited: slot.forfeited,
            })),
        };
      }),
    })),
    champion:
      view.finalized && view.champion
        ? (entrantsById[view.champion] ?? null)
        : null,
  };
}
