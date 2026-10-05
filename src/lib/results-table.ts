/**
 * The results table's rules (spec R20, decisions 1 and 2): sorting by any
 * column with its `aria-sort` state, who the Winner is, and the points a
 * Closed Competition's Points Entries give. Pure, so the table, its views
 * and the tests share one rule.
 */

export type ResultsColumn =
  "rank" | "name" | "score" | "points" | `stat:${string}`;
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
  /** Extra stat columns (a League's W, D, L...), by stat id. */
  stats?: Record<string, number | string | null>;
};

/** A stat column's numeric value on a row; text or a missing value is none. */
function statValue(row: SortableResult, id: string): number | null {
  const value = row.stats?.[id];
  return typeof value === "number" ? value : null;
}

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
      default: {
        const id = sort.column.slice("stat:".length);
        return compareMaybe(statValue(a, id), statValue(b, id), sort.direction);
      }
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
 * Score, points and every stat most first).
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
 * The Winner rows: every row in first place, tied or not, once something
 * decides first place. Nobody is the Winner while no row has points or a
 * Score (a leaderboard with every Team at 0), or when every row ties.
 */
export function winnerKeys(
  rows: {
    key: string;
    rank: number | null;
    score?: number | null;
    points: number | null;
  }[],
): Set<string> {
  const hasResult = rows.some(
    (row) =>
      (row.points !== null && row.points !== 0) ||
      (row.score !== null && row.score !== undefined),
  );
  const first = rows.filter((row) => row.rank === 1);
  if (!hasResult || (rows.length > 1 && first.length === rows.length)) {
    return new Set();
  }
  return new Set(first.map((row) => row.key));
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

/** A stat column a results table adds (a League's W, D, L, Match points...). */
export type ResultsStat = {
  id: string;
  /** The column header. */
  header: string;
  /** What the folded line calls it ("W", "SB"). */
  label: string;
  /** Below `sm` it folds into the line under the name; false stays a column. */
  fold: boolean;
  /** The label follows the value ("2 W") rather than leads it ("SB 4.5"). */
  labelAfter?: boolean;
  /** How a value reads in a cell and the folded line; default `String`. */
  format?: (value: number | string) => string;
};

/** A stat's value as a cell reads it: "–" for none. */
export function statText(
  stat: Pick<ResultsStat, "format">,
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined) return "–";
  return stat.format ? stat.format(value) : String(value);
}

/**
 * The line under a name below `sm`: every folding stat that has a value,
 * "2 W · 1 D · 0 L · SB 4.5". Empty when none has one.
 */
export function foldedStatsText(
  stats: ResultsStat[],
  values: Record<string, number | string | null> | undefined,
): string {
  return stats
    .filter((stat) => stat.fold)
    .flatMap((stat) => {
      const value = values?.[stat.id];
      if (value === null || value === undefined) return [];
      const text = statText(stat, value);
      return [
        stat.labelAfter ? `${text} ${stat.label}` : `${stat.label} ${text}`,
      ];
    })
    .join(" · ");
}
