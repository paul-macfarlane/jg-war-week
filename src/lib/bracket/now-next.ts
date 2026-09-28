/**
 * Timed Heats as Now/Next entries (decision 5): a `ready` Heat with a Day
 * and a start time reads like a Schedule Item with no end time, so every
 * Schedule display rule applies to it unchanged. Pure.
 */
import type { Format, Heat } from "@/lib/bracket/types";
import { heatEntrantLabels, heatNameAt, isTimed } from "@/lib/bracket/view";
import type { ScheduleEntry } from "@/lib/schedule";

/** One Heat as `getTimedHeats` returns it, with what names it. */
export type TimedHeatRow = {
  competition: { id: string; name: string; format: Format };
  /** The Competition's final Round, for the Heat's name. */
  finalRound: number;
  heat: Pick<
    Heat,
    | "id"
    | "round"
    | "position"
    | "slots"
    | "status"
    | "dayId"
    | "startTime"
    | "location"
  >;
  /** Each Entrant's label (Team or Participant name) by Entrant id. */
  labels: Record<string, string>;
};

/**
 * The Now/Next entries for the Heats that are ready to play (every slot
 * filled, no Heat Result) and timed; every other Heat is left out.
 */
export function heatEntries(
  rows: TimedHeatRow[],
): { dayId: string; entry: ScheduleEntry }[] {
  return rows.flatMap(({ competition, finalRound, heat, labels }) => {
    if (heat.status !== "ready" || !isTimed(heat)) return [];
    const name = heatNameAt({
      format: competition.format,
      finalRound,
      round: heat.round,
      position: heat.position,
    });
    return [
      {
        dayId: heat.dayId!,
        entry: {
          id: heat.id,
          kind: "heat" as const,
          title: `${competition.name} · ${name}`,
          entrants: heatEntrantLabels(heat, labels),
          startTime: heat.startTime!,
          endTime: null,
          host: null,
          location: heat.location,
          virtualLink: null,
          description: null,
          category: "competition" as const,
          competition: { id: competition.id, name: competition.name },
        },
      },
    ];
  });
}
