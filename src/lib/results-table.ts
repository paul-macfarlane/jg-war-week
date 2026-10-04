/**
 * The results table's rules (spec R20, decisions 1 and 2): sorting by any
 * column with its `aria-sort` state, shared places for ties, who the
 * Winner is, and the points a Closed Competition's Points Entries give.
 * Pure, so the table, its views and the tests share one rule.
 */

export type ResultsColumn = "rank" | "name" | "score" | "points";
export type SortDirection = "ascending" | "descending";
export type ResultsSort = { column: ResultsColumn; direction: SortDirection };

/** The Provisional badge's tooltip (spec R20, decision 2). */
export const PROVISIONAL_TEXT =
  "Points become final when the Competition is Closed.";

/** Every results table starts sorted by Rank, best first. */
export const DEFAULT_RESULTS_SORT: ResultsSort = {
  column: "rank",
  direction: "ascending",
};

/** What a row needs to be sorted. A null rank, Score or points has none. */
export type SortableResult = {
  key: string;
  rank: number | null;
  name: string;
  score?: number | null;
  points: number | null;
};

const byName = (a: SortableResult, b: SortableResult) =>
  a.name.localeCompare(b.name) || a.key.localeCompare(b.key);

/** Missing values last whichever way the column sorts. */
function compareMaybe(
  a: number | null | undefined,
  b: number | null | undefined,
  direction: SortDirection,
): number {
  const aMissing = a === null || a === undefined;
  const bMissing = b === null || b === undefined;
  if (aMissing || bMissing) return Number(aMissing) - Number(bMissing);
  return direction === "ascending" ? a - b : b - a;
}

/**
 * The rows in `sort` order, as a new array. A row with no value in the
 * sorted column goes last either way; ties fall back to Rank (best first),
 * then name, then key, so the order is stable.
 */
export function sortResults<T extends SortableResult>(
  rows: T[],
  sort: ResultsSort,
): T[] {
  const byRank = (a: T, b: T) => compareMaybe(a.rank, b.rank, "ascending");
  const primary = (a: T, b: T): number => {
    switch (sort.column) {
      case "name": {
        const order = byName(a, b);
        return sort.direction === "ascending" ? order : -order;
      }
      case "rank":
        return compareMaybe(a.rank, b.rank, sort.direction);
      case "score":
        return compareMaybe(a.score, b.score, sort.direction);
      case "points":
        return compareMaybe(a.points, b.points, sort.direction);
    }
  };
  return [...rows].sort(
    (a, b) => primary(a, b) || byRank(a, b) || byName(a, b),
  );
}

/** A column header's `aria-sort`: the direction when sorted by it, else none. */
export function ariaSortFor(
  sort: ResultsSort,
  column: ResultsColumn,
): SortDirection | "none" {
  return sort.column === column ? sort.direction : "none";
}

/**
 * The sort after pressing `column`'s header: the sorted column flips; a
 * new column starts at its natural direction (Rank and name ascending,
 * Score and points most first).
 */
export function nextResultsSort(
  sort: ResultsSort,
  column: ResultsColumn,
): ResultsSort {
  if (sort.column === column) {
    return {
      column,
      direction: sort.direction === "ascending" ? "descending" : "ascending",
    };
  }
  return {
    column,
    direction:
      column === "rank" || column === "name" ? "ascending" : "descending",
  };
}

/**
 * Places by value, by standard competition ranking: equal values share a
 * place and the next is skipped (1, 1, 3). A row with no value is left out.
 */
export function sharedRanks(
  rows: { key: string; value: number | null }[],
  better: "higher" | "lower",
): Map<string, number> {
  const valued = rows.filter(
    (row): row is { key: string; value: number } => row.value !== null,
  );
  const beats = (a: number, b: number) => (better === "higher" ? a > b : a < b);
  return new Map(
    valued
      .map((row) => ({
        key: row.key,
        rank:
          valued.filter((other) => beats(other.value, row.value)).length + 1,
      }))
      .sort((a, b) => a.rank - b.rank)
      .map(({ key, rank }) => [key, rank]),
  );
}

/** The Winner rows: every row in first place, tied or not. */
export function winnerKeys(
  rows: { key: string; rank: number | null }[],
): Set<string> {
  return new Set(rows.filter((row) => row.rank === 1).map((row) => row.key));
}

/** Whether the table shows a Score column: only when some row has a Score. */
export function showsScore(rows: { score?: number | null }[]): boolean {
  return rows.some((row) => row.score !== null && row.score !== undefined);
}

/** A Points Entry's target and points, as a Closed Competition wrote it. */
export type EntryPoints = {
  teamId: string | null;
  participantId: string | null;
  points: number;
};

/**
 * What a Team's or Participant's Points Entries in a Competition add up
 * to, or null when it has none (so the table shows "–", not 0).
 */
export function entryPointsFor(
  entries: EntryPoints[],
  target: { teamId?: string | null; participantId?: string | null },
): number | null {
  const mine = entries.filter((entry) =>
    target.teamId
      ? entry.teamId === target.teamId
      : target.participantId
        ? entry.participantId === target.participantId
        : false,
  );
  if (mine.length === 0) return null;
  // In hundredths, as the Standings sum, so 0.1 + 0.2 comes out exact.
  return (
    mine.reduce((total, entry) => total + Math.round(entry.points * 100), 0) /
    100
  );
}
