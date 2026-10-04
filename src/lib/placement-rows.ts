/**
 * Placement Points as numbered rows (1st, 2nd…) in the Competition form.
 * The rows still submit the comma-separated text `parseCompetitionInput`
 * validates; these live errors mirror the server's rules, reusing its
 * wording where it already has one.
 */
import { placementLimitMessage } from "@/lib/competitions";
import { POINTS_NUMBER } from "@/lib/points-entry";

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

/**
 * Live errors for the rows, in the server's wording; empty when valid.
 * `limit` is the Format's `placementLimit` (null: none).
 */
export function placementRowErrors(
  rows: string[],
  limit: number | null = null,
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
  if (limit !== null && values.length > limit) {
    errors.push(placementLimitMessage(limit));
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
  return errors;
}
