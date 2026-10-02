import { formatDateValue } from "@/lib/date-value";

/**
 * Refuses War Week dates that would leave an existing Day outside them,
 * naming the earliest such Day. Shared by the settings save and the date
 * range picker, so both show the same text.
 */
export function dayOutsideRangeError(
  dayDates: string[],
  startDate: string,
  endDate: string,
): string | null {
  const outside = [...dayDates]
    .sort()
    .find((date) => date < startDate || date > endDate);
  if (outside) {
    return `The Day on ${outside} falls outside the new dates. Move or delete it first.`;
  }
  return null;
}

/** A range being picked, `YYYY-MM-DD`: just a start, or a refused range. */
export type PendingRange = { from: string; to?: string };

export type RangeSelection = {
  /** What stays on screen: a held start, a complete or refused range. */
  pending: PendingRange | null;
  /** Set when the tap finished a range that leaves a Day outside it. */
  error?: string;
};

/**
 * One tap on the War Week date range calendar. The first tap holds a start;
 * the second finishes the range (in date order, whichever came first) and
 * holds it on screen until Done, or refuses it with `dayOutsideRangeError`.
 * A tap after a complete or refused range starts over.
 */
export function nextRangeSelection(
  pending: PendingRange | null,
  tapped: string,
  days: string[],
): RangeSelection {
  if (!pending || pending.to) return { pending: { from: tapped } };
  const [start, end] =
    tapped < pending.from ? [tapped, pending.from] : [pending.from, tapped];
  const error = dayOutsideRangeError(days, start, end);
  if (error) return { pending: { from: start, to: end }, error };
  return { pending: { from: start, to: end } };
}

/**
 * What Done, an outside click or Escape saves: a complete range the Days
 * allow. A half-picked or refused range saves nothing.
 */
export function rangeToCommit(
  pending: PendingRange | null,
  days: string[],
): { start: string; end: string } | null {
  if (!pending?.to) return null;
  if (dayOutsideRangeError(days, pending.from, pending.to)) return null;
  return { start: pending.from, end: pending.to };
}

/**
 * The Day picker's disabled-date matcher: a date is refused when it falls
 * outside the War Week or already has a Day, except the edited Day's own
 * date. The server's duplicate-date error stays as the backstop.
 */
export function dayDateDisabled(
  startDate: string,
  endDate: string,
  dayDates: string[],
  ownDate?: string,
): (date: Date) => boolean {
  const taken = new Set(dayDates.filter((date) => date !== ownDate));
  return (date) => {
    const value = formatDateValue(date);
    return value < startDate || value > endDate || taken.has(value);
  };
}
