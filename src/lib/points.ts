const formatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Formats a points value for display: up to two decimals, no trailing zeros. */
export function formatPoints(points: number): string {
  return formatter.format(points);
}

/**
 * A points value with its unit, grammatically: "1 point", "2.5 points".
 * For prose (e.g. the Points Entry delete confirm), where `formatPoints`
 * alone reads as a bare number. The unit follows the number shown, so
 * 1.001 (shown as "1") reads "1 point".
 */
export function formatPointsLabel(points: number): string {
  const shown = formatPoints(points);
  return `${shown} ${shown === "1" ? "point" : "points"}`;
}
