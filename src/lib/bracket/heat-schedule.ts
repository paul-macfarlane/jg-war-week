/**
 * Validation for a Heat's time and place form (decision 1, `heat-schedule`).
 * A Day and a start time are set together, or cleared together; a location
 * may stand alone. Pure, like the rest of `src/lib/bracket`.
 */
import { z } from "zod";

import type { Parsed } from "@/lib/result";
import { optional, parseWith } from "@/lib/setup";
import { clockTime } from "@/lib/setup-schedule-faq";

/** The form's raw fields, all as the inputs (a posted `FormData`) hold them. */
export type HeatScheduleInput = {
  dayId: string;
  startTime: string;
  location: string;
};

/** The `heat` columns the form writes; null clears a field. */
export type HeatScheduleValues = {
  dayId: string | null;
  startTime: string | null;
  location: string | null;
};

export const HEAT_SCHEDULE_LABELS: Record<string, string> = {
  dayId: "Day",
  startTime: "Start time",
  location: "Location",
};

const heatScheduleSchema = z
  .object({
    dayId: optional(z.uuid({ error: "Pick a Day." }).nullish()),
    startTime: optional(clockTime.nullish()),
    location: optional(z.string().max(200).nullish()),
  })
  .refine((values) => (values.dayId === null) === (values.startTime === null), {
    error: "Pick a Day and a start time together, or clear both.",
    path: ["startTime"],
  });

/** Validates the Time & place form's `FormData`. Never throws. */
export function parseHeatScheduleInput(
  formData: FormData,
): Parsed<HeatScheduleValues> {
  return parseWith(
    heatScheduleSchema,
    {
      dayId: String(formData.get("dayId") ?? ""),
      startTime: String(formData.get("startTime") ?? ""),
      location: String(formData.get("location") ?? ""),
    },
    () => null,
    HEAT_SCHEDULE_LABELS,
  );
}
