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
 * `progress` runs 0 → 1 over the row's count-up. Given the whole Finale's
 * `durationMs` (when several lists share one clock), a shorter list starts
 * later so that it ends with the others: every list's first place lands at
 * the end.
 */
export function finaleRows(
  ranks: number[],
  elapsedMs: number,
  durationMs = finaleDurationMs(ranks),
): RowFinale[] {
  const order = stepRanks(ranks);
  const gap = stepMs(order.length);
  const delayMs = Math.max(0, durationMs - finaleDurationMs(ranks));
  return ranks.map((rank) => {
    const startMs = delayMs + order.indexOf(rank) * gap;
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
