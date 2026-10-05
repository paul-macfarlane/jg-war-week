/**
 * Timing for the Finale countdown (the closing-ceremony screen at
 * `/<edition>/finale`): rows appear from last place up to first while their
 * totals count up. Pure functions of elapsed time; the component owns the
 * clock. Timing only: the rows and their order come from Standings as is.
 */

/** The whole Finale finishes within this. */
export const FINALE_MAX_MS = 8_000;
/** How long one row's total takes to count up. */
const COUNT_UP_MS = 1_500;
/** The longest gap between one rank appearing and the next. */
const MAX_STEP_MS = 1_200;

/** The Standings countdown shows and counts down ranks up to this one. */
const FINALE_TOP_RANK = 10;

/**
 * The rows the Standings countdown plays: those ranked 10th or better, every
 * row tied at 10th included, exactly as given (same objects, same order;
 * nothing is reordered or recomputed). `moreCount` is how many of the rows
 * left out scored (a Team on 0 points is listed but didn't score).
 */
export function finaleTopRows<T extends { rank: number; total: number }>(
  rows: T[],
): { shown: T[]; moreCount: number } {
  const shown = rows.filter((row) => row.rank <= FINALE_TOP_RANK);
  // "Scored" means a total above 0, for individuals and Teams alike; a row
  // listed at 0 or below is left out of the count.
  const moreCount = rows.filter(
    (row) => row.rank > FINALE_TOP_RANK && row.total > 0,
  ).length;
  return { shown, moreCount };
}

export type RowFinale = { shown: boolean; progress: number };

/** The distinct ranks in a list, from last place to first. */
function stepRanks(ranks: number[]): number[] {
  return [...new Set(ranks)].sort((a, b) => b - a);
}

function stepMs(stepCount: number): number {
  if (stepCount <= 1) return 0;
  return Math.min(MAX_STEP_MS, (FINALE_MAX_MS - COUNT_UP_MS) / (stepCount - 1));
}

/** How long the Finale runs for these ranks. */
export function finaleDurationMs(ranks: number[]): number {
  const steps = stepRanks(ranks).length;
  return steps === 0 ? 0 : (steps - 1) * stepMs(steps) + COUNT_UP_MS;
}

/**
 * Each row's state `elapsedMs` into the Finale. Rows sharing a rank appear
 * together, one step per distinct rank, starting with the last-ranked.
 * `progress` runs 0 → 1 over the row's count-up.
 */
export function finaleRows(ranks: number[], elapsedMs: number): RowFinale[] {
  const order = stepRanks(ranks);
  const gap = stepMs(order.length);
  return ranks.map((rank) => {
    const startMs = order.indexOf(rank) * gap;
    if (elapsedMs < startMs) return { shown: false, progress: 0 };
    return {
      shown: true,
      progress: Math.min(1, (elapsedMs - startMs) / COUNT_UP_MS),
    };
  });
}

/**
 * A total counted up from 0 at `progress` (0 → 1), easing out so it slows
 * as it lands. Rounded to hundredths, like stored points, and exact at 1.
 */
export function countUpTotal(total: number, progress: number): number {
  if (progress >= 1) return total;
  if (progress <= 0) return 0;
  const eased = 1 - (1 - progress) ** 3;
  return Math.round(total * eased * 100) / 100;
}
