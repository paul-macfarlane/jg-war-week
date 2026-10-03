/**
 * The Placement Format's rules (CONTEXT.md, Placement): Places from Scores
 * by the Score direction, points by Place from the Placement Points, and
 * what Finalize refuses. Pure, so the sheet, Finalize, the seed loader and
 * the tests share one rule.
 */
import type { Competition } from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";

/** Finalize's refusal for a row with a Score and no Place. */
export const SCORE_WITHOUT_PLACE =
  "Give every row with a Score a Place, or clear its Score.";
/** Finalize's refusal for a sheet with nobody placed. */
export const NOBODY_PLACED = "Give someone a Place first.";

/**
 * The Places a Score direction gives the rows with a Score, by standard
 * competition ranking: equal Scores share a place and the next is skipped
 * (1, 1, 3). A row without a Score isn't in the map, so its Place stays as
 * typed.
 */
export function placesFromScores(
  rows: { id: string; score: number | null }[],
  direction: "higher" | "lower",
): Map<string, number> {
  const scored = rows.filter(
    (row): row is { id: string; score: number } => row.score !== null,
  );
  const better = (a: number, b: number) =>
    direction === "higher" ? a > b : a < b;
  return new Map(
    scored.map((row) => [
      row.id,
      scored.filter((other) => better(other.score, row.score)).length + 1,
    ]),
  );
}

/**
 * Each placed row's points: its Place's Placement Points, tied rows each
 * getting them in full (`pointsFor`, the Bracket and Games rule). An
 * unplaced row and a Place beyond the list earn nothing and are left out.
 */
export function placementPointsByRow(
  rows: { id: string; place: number | null }[],
  competition: Pick<Competition, "placementPoints">,
): { id: string; points: number }[] {
  return pointsFor(
    rows.flatMap((row) =>
      row.place === null ? [] : [{ entrantId: row.id, place: row.place }],
    ),
    competition,
  ).map(({ entrantId, points }) => ({ id: entrantId, points }));
}

/**
 * Why the sheet can't be Finalized, or null: a row with a Score and no
 * Place (naming each), or nobody placed at all.
 */
export function finalizePlacementError(
  rows: { name: string; place: number | null; score: number | null }[],
): string | null {
  const scoredUnplaced = rows.filter(
    (row) => row.place === null && row.score !== null,
  );
  if (scoredUnplaced.length > 0) {
    return `${SCORE_WITHOUT_PLACE} No Place: ${scoredUnplaced
      .map((row) => row.name)
      .join(", ")}.`;
  }
  if (!rows.some((row) => row.place !== null)) return NOBODY_PLACED;
  return null;
}
