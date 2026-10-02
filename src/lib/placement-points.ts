/**
 * Placement Points as the text a form posts ("5, 3, 1"), parsed once for
 * every form that takes them (the Competition form and a Participation
 * Competition's settings), with one set of messages (ADR 0001: rules
 * shared, not copied). Zero-dependency on zod so it stays cheap to import.
 */
import { MAX_PLACEMENTS } from "@/lib/competitions";
import { POINTS_NUMBER, pointsSchema } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";

const FIELD = "placementPoints";

/** The refusal when 1st place is worth more than Max points. */
export const FIRST_OVER_MAX =
  "1st place's Placement Points can't be more than Max points.";

function refuse(error: string): Parsed<never> {
  return { ok: false, error, fieldErrors: { [FIELD]: error } };
}

/** "5, 3, 1" as Placement Points, highest first; blank is none. */
export function parsePlacementPointsText(
  value: unknown,
): Parsed<number[] | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") {
    return refuse("Placement Points must be text.");
  }
  const places = value.split(/[\s,]+/).filter(Boolean);
  if (places.length === 0) return { ok: true, value: null };
  if (!places.every((place) => POINTS_NUMBER.test(place))) {
    return refuse(
      "Placement Points must be numbers separated by commas, 1st place first.",
    );
  }
  const points = places.map(Number);
  if (points.length > MAX_PLACEMENTS) {
    return refuse(`Placement Points cover at most ${MAX_PLACEMENTS} places.`);
  }
  if (points.some((p) => p < 0)) {
    return refuse("Placement Points must be at least 0.");
  }
  if (!points.every((p) => pointsSchema.safeParse(p).success)) {
    return refuse("Placement Points must have at most two decimal places.");
  }
  if (!points.every((p, i) => i === 0 || p <= points[i - 1])) {
    return refuse(
      "Each place's Placement Points must be no more than the place above it.",
    );
  }
  return { ok: true, value: points };
}

/** Whether 1st place is worth more than Max points (neither set: no). */
export function firstPlaceOverMax(
  placementPoints: number[] | null,
  maxPoints: number | null,
): boolean {
  return (
    maxPoints !== null &&
    placementPoints !== null &&
    placementPoints.length > 0 &&
    placementPoints[0] > maxPoints
  );
}
