/**
 * The Placement Format's rules (CONTEXT.md, Placement): Places from Scores
 * by the Score direction, points by Place from the Placement Points, and
 * what Close refuses. Pure, so the sheet, Close, the seed loader and
 * the tests share one rule.
 */
import type { Competition, pointsEntry } from "@/db/schema";
import { pointsFor } from "@/lib/bracket/points";
import { generatedNote } from "@/lib/points-entry";
import { type RankingDirection, orderByScore } from "@/lib/scoring";

/** Close's refusal for a row with a Score and no Place. */
export const SCORE_WITHOUT_PLACE =
  "Give every row with a Score a Place, or clear its Score.";
/** Close's refusal for a sheet with nobody placed. */
export const NOBODY_PLACED = "Give someone a Place first.";

/**
 * The Places a Score direction gives the rows with a Score (`orderByScore`):
 * equal Scores share a place and the next is skipped (1, 1, 3). A row
 * without a Score isn't in the map, so its Place stays as typed.
 */
export function placesFromScores(
  rows: { id: string; score: number | null }[],
  direction: RankingDirection,
): Map<string, number> {
  return orderByScore(rows, direction);
}

/**
 * The Places to fill when Scores change from `before` to `after`: a row's
 * computed place, but only where it moved since `before` or the row's own
 * Score changed. A row whose computed place didn't move keeps the Place
 * already typed, so a manual tie-break survives an unrelated Score edit.
 */
export function refilledPlaces(
  before: { id: string; score: number | null }[],
  after: { id: string; score: number | null }[],
  direction: RankingDirection,
): Map<string, number> {
  const was = placesFromScores(before, direction);
  const scoreBefore = new Map(before.map((row) => [row.id, row.score]));
  const now = placesFromScores(after, direction);
  return new Map(
    after.flatMap((row) => {
      const place = now.get(row.id);
      if (place === undefined) return [];
      const moved = was.get(row.id) !== place;
      const rescored = scoreBefore.get(row.id) !== row.score;
      return moved || rescored ? [[row.id, place] as const] : [];
    }),
  );
}

/**
 * Rows in display order: placed rows by Place, ties by name, then
 * unplaced rows by name; the id breaks any remaining tie so the order is
 * stable.
 */
export function orderPlacementRows<
  T extends { id: string; name: string; place: number | null },
>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      (a.place ?? Infinity) - (b.place ?? Infinity) ||
      a.name.localeCompare(b.name) ||
      a.id.localeCompare(b.id),
  );
}

/**
 * Each placed row's points: its Place's Placement Points, tied rows each
 * getting them in full (`pointsFor`, the Bracket, Head-to-head and Best score rule). An
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
 * Why the sheet can't be Closed, or null: a row with a Score and no
 * Place (naming each), or nobody placed at all.
 */
export function closePlacementError(
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

/**
 * The generated Points Entries a Close writes for these rows: each
 * placed row's Placement Points (`placementPointsByRow`), to its Team or
 * Participant, noted "From placement". The seed loader passes the seeded
 * Close's time and a seed key per row.
 */
export function placementEntryValues(
  rows: {
    id: string;
    teamId: string | null;
    participantId: string | null;
    place: number | null;
  }[],
  found: Pick<Competition, "id" | "warWeekId" | "placementPoints">,
  by: {
    actorEmail: string;
    enteredAt?: Date;
    seedKeyOf?: (rowId: string) => string | null;
  },
): (typeof pointsEntry.$inferInsert)[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return placementPointsByRow(rows, found).map(({ id, points }) => ({
    warWeekId: found.warWeekId,
    competitionId: found.id,
    teamId: byId.get(id)!.teamId,
    participantId: byId.get(id)!.participantId,
    points,
    note: generatedNote("placement"),
    enteredByEmail: by.actorEmail,
    ...(by.enteredAt ? { enteredAt: by.enteredAt } : {}),
    seedKey: by.seedKeyOf?.(id) ?? null,
    generated: true,
  }));
}
