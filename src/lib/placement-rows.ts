/**
 * Placement Points as numbered rows (1st, 2nd…) in the Competition form.
 * The rows still submit the comma-separated text `parseCompetitionInput`
 * validates; these live errors mirror the server's rules, reusing its
 * wording where it already has one.
 */
import { MAX_PLACEMENTS } from "@/lib/competitions";
import { POINTS_NUMBER } from "@/lib/points-entry";

/** The "5 · 3 · 1" quick fill. */
export const QUICK_FILL = ["5", "3", "1"];

/** One row per place from the form's Placement Points text. */
export function rowsFromPlacementPoints(text: string): string[] {
  return text.split(/[\s,]+/).filter(Boolean);
}

/** The form's Placement Points text from its rows; blank rows are skipped. */
export function placementPointsFromRows(rows: string[]): string {
  return rows
    .map((row) => row.trim())
    .filter(Boolean)
    .join(", ");
}

/** Live errors for the rows, in the server's wording; empty when valid. */
export function placementRowErrors(
  rows: string[],
  maxPoints: string,
): string[] {
  const values = rows.map((row) => row.trim()).filter(Boolean);
  const errors: string[] = [];
  const lastFilled = rows.reduce(
    (last, row, index) => (row.trim() ? index : last),
    -1,
  );
  if (rows.slice(0, lastFilled).some((row) => !row.trim())) {
    errors.push("Fill in every place above the last one, or remove it.");
  }
  if (values.length > MAX_PLACEMENTS) {
    errors.push(`Placement Points cover at most ${MAX_PLACEMENTS} places.`);
  }
  if (!values.every((value) => POINTS_NUMBER.test(value))) {
    errors.push("Each place's Placement Points must be a number.");
    return errors;
  }
  const points = values.map(Number);
  if (points.some((p) => p < 0)) {
    errors.push("Placement Points can't be negative.");
  }
  if (points.some((p, i) => i > 0 && p > points[i - 1])) {
    errors.push(
      "Each place's Placement Points must be no more than the place above it.",
    );
  }
  const max = maxPoints.trim();
  if (points.length > 0 && POINTS_NUMBER.test(max) && points[0] > Number(max)) {
    errors.push("1st place's Placement Points can't be more than Max points.");
  }
  return errors;
}
