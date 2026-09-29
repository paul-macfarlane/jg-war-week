import { TZDate } from "@date-fns/tz";
import { format, isValid, parse, parseISO, subDays } from "date-fns";

import type { Day, ScheduleItem } from "@/db/schema";

export const WAR_WEEK_TIME_ZONE = "America/New_York";

/**
 * How long a Schedule Item with no end time counts as "on now". Items are
 * stored without a duration, so this is a display rule only (see
 * CONTEXT.md, Schedule display rules).
 */
const DEFAULT_DURATION_SECONDS = 60 * 60;

const SECONDS_PER_DAY = 24 * 60 * 60;

export type ScheduleEntry = Pick<
  ScheduleItem,
  | "id"
  | "startTime"
  | "endTime"
  | "title"
  | "host"
  | "location"
  | "virtualLink"
  | "description"
  | "category"
> & {
  competition: { id: string; name: string } | null;
  /** Set on a timed Heat's entry (Now/Next only); unset on a Schedule Item. */
  kind?: "heat";
  /** A Heat's Entrants line, like "Red vs Blue". */
  entrants?: string;
};

export type ScheduleDay = Pick<Day, "id" | "date" | "dayTheme"> & {
  items: ScheduleEntry[];
};

/** An ET wall-clock reading: `YYYY-MM-DD` and `HH:MM:SS`. */
export type EasternClock = { date: string; time: string };

export type NowNext = {
  /** The Day whose date is today in ET, if today is in the War Week. */
  today: ScheduleDay | null;
  /** True until the first Day's date arrives in ET. */
  beforeStart: boolean;
  /** Items on right now, in time order. */
  now: ScheduleEntry[];
  /** Every item sharing the earliest start after now, on whichever Day. */
  next: { date: string; items: ScheduleEntry[] } | null;
};

/** Reads an instant on the ET wall clock, whatever the host's timezone. */
export function toEasternClock(instant: Date): EasternClock {
  const et = new TZDate(instant, WAR_WEEK_TIME_ZONE);
  return { date: format(et, "yyyy-MM-dd"), time: format(et, "HH:mm:ss") };
}

function compareItems(a: ScheduleEntry, b: ScheduleEntry): number {
  return (
    a.startTime.localeCompare(b.startTime) || a.title.localeCompare(b.title)
  );
}

/**
 * Groups Schedule Items under their Days: Days by date, each Day's items by
 * start time then title.
 */
export function groupSchedule(
  days: Pick<Day, "id" | "date" | "dayTheme">[],
  items: { dayId: string; entry: ScheduleEntry }[],
): ScheduleDay[] {
  return [...days]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((day) => ({
      id: day.id,
      date: day.date,
      dayTheme: day.dayTheme,
      items: items
        .filter((item) => item.dayId === day.id)
        .map((item) => item.entry)
        .sort(compareItems),
    }));
}

/**
 * Adds entries (timed Heats, for Now/Next) to a grouped schedule under
 * their Days, keeping each Day's start time then title order. An entry
 * whose Day isn't in `days` is dropped. `days` is left unchanged.
 */
export function withHeats(
  days: ScheduleDay[],
  entries: { dayId: string; entry: ScheduleEntry }[],
): ScheduleDay[] {
  return days.map((day) => {
    const added = entries
      .filter((item) => item.dayId === day.id)
      .map((item) => item.entry);
    return added.length === 0
      ? day
      : { ...day, items: [...day.items, ...added].sort(compareItems) };
  });
}

/** `HH:MM[:SS]` to seconds since midnight. */
function toSeconds(time: string): number {
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * An item's span in seconds from its Day's midnight. An end time at or
 * before the start time runs past midnight into the next calendar day.
 */
function span(item: ScheduleEntry): { start: number; end: number } {
  const start = toSeconds(item.startTime);
  if (!item.endTime) return { start, end: start + DEFAULT_DURATION_SECONDS };
  const end = toSeconds(item.endTime);
  return { start, end: end <= start ? end + SECONDS_PER_DAY : end };
}

/** The `YYYY-MM-DD` date before `date`. */
function previousDate(date: string): string {
  return format(subDays(parseISO(date), 1), "yyyy-MM-dd");
}

function isOnAt(item: ScheduleEntry, seconds: number): boolean {
  const { start, end } = span(item);
  return start <= seconds && seconds < end;
}

/**
 * Works out today's Day and what's on now and next, all on the ET wall
 * clock. `days` must be in the order `groupSchedule` returns.
 */
export function computeNowNext(days: ScheduleDay[], at: Date): NowNext {
  const clock = toEasternClock(at);
  const nowSeconds = toSeconds(clock.time);
  const today = days.find((day) => day.date === clock.date) ?? null;
  const yesterday = days.find((day) => day.date === previousDate(clock.date));

  // Yesterday's items that run past midnight are still on; measure them
  // from yesterday's midnight.
  const now = [
    ...(yesterday?.items ?? []).filter((item) =>
      isOnAt(item, nowSeconds + SECONDS_PER_DAY),
    ),
    ...(today?.items ?? []).filter((item) => isOnAt(item, nowSeconds)),
  ];

  let next: NowNext["next"] = null;
  for (const day of days) {
    if (day.date < clock.date) continue;
    const upcoming = day.items.filter(
      (item) => day.date > clock.date || toSeconds(item.startTime) > nowSeconds,
    );
    if (upcoming.length > 0) {
      const start = upcoming[0].startTime;
      next = {
        date: day.date,
        items: upcoming.filter((item) => item.startTime === start),
      };
      break;
    }
  }

  const beforeStart = days.length > 0 && clock.date < days[0].date;
  return { today, beforeStart, now, next };
}

/** `HH:MM[:SS]` (an ET wall-clock time) as `7:05 AM`. */
export function formatEtTime(time: string): string {
  return format(parse(time.slice(0, 5), "HH:mm", new Date()), "h:mm a");
}

/** An item's times as `7:00 AM ET` or `6:00 PM – 10:00 PM ET`. */
export function formatTimeRange(
  item: Pick<ScheduleEntry, "startTime" | "endTime">,
): string {
  const start = formatEtTime(item.startTime);
  return item.endTime
    ? `${start} – ${formatEtTime(item.endTime)} ET`
    : `${start} ET`;
}

/** A Day's `YYYY-MM-DD` date as `Monday, Feb 23`. */
export function formatDayHeading(date: string): string {
  return format(parseISO(date), "EEEE, MMM d");
}

/**
 * The Schedule page's `?day=` filter: picks the Day matching a `YYYY-MM-DD`
 * search param and filters `days` down to it, or leaves `days` unchanged
 * (the "All" view) when `day` is missing, not a string, or doesn't match any
 * Day in the War Week.
 */
export function filterScheduleByDay(
  days: ScheduleDay[],
  day: string | string[] | undefined,
): { selected: string | null; days: ScheduleDay[] } {
  const selected =
    typeof day === "string" && days.some((d) => d.date === day) ? day : null;
  return {
    selected,
    days: selected === null ? days : days.filter((d) => d.date === selected),
  };
}

/**
 * The clock pages compute now/next from: the `?at=` search param when it is
 * a valid ISO 8601 instant (for demos of a War Week that isn't on right now),
 * otherwise `now`, the real time the page read (lib never reads the clock).
 */
export function resolveClock(
  at: string | string[] | undefined,
  now: Date,
): Date {
  if (typeof at === "string") {
    const parsed = parseISO(at);
    if (isValid(parsed)) return parsed;
  }
  return now;
}
