import { describe, expect, it } from "vitest";

import {
  type ScheduleDay,
  type ScheduleEntry,
  computeNowNext,
  formatDayHeading,
  formatEtTime,
  formatTimeRange,
  groupSchedule,
  resolveClock,
  toEasternClock,
} from "@/lib/schedule";

function entry(
  startTime: string,
  title: string,
  endTime: string | null = null,
): ScheduleEntry {
  return {
    id: `${startTime}-${title}`,
    startTime,
    endTime,
    title,
    host: null,
    location: null,
    virtualLink: null,
    description: null,
    category: "social",
    competition: null,
  };
}

const week: ScheduleDay[] = [
  {
    id: "d1",
    date: "2026-02-23",
    dayTheme: "Competition Day",
    items: [
      entry("07:00:00", "Workout", "08:00:00"),
      entry("08:30:00", "Breakfast"),
      entry("12:00:00", "Chess", "14:00:00"),
      entry("12:00:00", "Lunch", "13:00:00"),
      entry("18:00:00", "Game Night", "22:00:00"),
    ],
  },
  {
    id: "d2",
    date: "2026-02-24",
    dayTheme: "Red vs. Blue",
    items: [entry("09:00:00", "Kickoff")],
  },
];

/** An instant given as an ET wall-clock time in February (EST, UTC-5). */
function est(date: string, time: string): Date {
  return new Date(`${date}T${time}-05:00`);
}

describe("toEasternClock", () => {
  it("converts an instant to the ET date and time in winter (EST)", () => {
    expect(toEasternClock(new Date("2026-02-24T03:30:00Z"))).toEqual({
      date: "2026-02-23",
      time: "22:30:00",
    });
  });

  it("converts an instant to the ET date and time in summer (EDT)", () => {
    expect(toEasternClock(new Date("2026-07-04T16:05:09Z"))).toEqual({
      date: "2026-07-04",
      time: "12:05:09",
    });
  });

  it("reports midnight as 00, not 24", () => {
    expect(toEasternClock(new Date("2026-02-23T05:00:00Z")).time).toBe(
      "00:00:00",
    );
  });
});

describe("groupSchedule", () => {
  it("orders Days by date and each Day's items by start time then title", () => {
    const grouped = groupSchedule(
      [
        { id: "d2", date: "2026-02-24", dayTheme: "Two" },
        { id: "d1", date: "2026-02-23", dayTheme: "One" },
      ],
      [
        { dayId: "d1", entry: entry("18:00:00", "Dinner") },
        { dayId: "d1", entry: entry("08:30:00", "Breakfast") },
        { dayId: "d1", entry: entry("12:00:00", "Lunch") },
        { dayId: "d1", entry: entry("12:00:00", "Chess") },
        { dayId: "d2", entry: entry("09:00:00", "Kickoff") },
      ],
    );

    expect(grouped.map((d) => d.date)).toEqual(["2026-02-23", "2026-02-24"]);
    expect(grouped[0].items.map((i) => i.title)).toEqual([
      "Breakfast",
      "Chess",
      "Lunch",
      "Dinner",
    ]);
    expect(grouped[1].items.map((i) => i.title)).toEqual(["Kickoff"]);
  });

  it("keeps a Day with no items", () => {
    expect(
      groupSchedule([{ id: "d1", date: "2026-02-23", dayTheme: "One" }], []),
    ).toEqual([{ id: "d1", date: "2026-02-23", dayTheme: "One", items: [] }]);
  });
});

describe("computeNowNext", () => {
  const cases: {
    name: string;
    at: Date;
    today: string | null;
    now: string[];
    next: string[];
    nextDate: string | null;
  }[] = [
    {
      name: "before the War Week: no today, next is the first item",
      at: est("2026-02-20", "10:00:00"),
      today: null,
      now: [],
      next: ["Workout"],
      nextDate: "2026-02-23",
    },
    {
      name: "early morning of a Day: today's theme, nothing on yet",
      at: est("2026-02-23", "06:00:00"),
      today: "Competition Day",
      now: [],
      next: ["Workout"],
      nextDate: "2026-02-23",
    },
    {
      name: "during an item with an end time",
      at: est("2026-02-23", "07:30:00"),
      today: "Competition Day",
      now: ["Workout"],
      next: ["Breakfast"],
      nextDate: "2026-02-23",
    },
    {
      name: "the end time is exclusive",
      at: est("2026-02-23", "08:00:00"),
      today: "Competition Day",
      now: [],
      next: ["Breakfast"],
      nextDate: "2026-02-23",
    },
    {
      name: "an item with no end time lasts an hour",
      at: est("2026-02-23", "09:15:00"),
      today: "Competition Day",
      now: ["Breakfast"],
      next: ["Chess", "Lunch"],
      nextDate: "2026-02-23",
    },
    {
      name: "an item with no end time is over after an hour",
      at: est("2026-02-23", "09:30:00"),
      today: "Competition Day",
      now: [],
      next: ["Chess", "Lunch"],
      nextDate: "2026-02-23",
    },
    {
      name: "overlapping items are all on now; next is everything at the next start time",
      at: est("2026-02-23", "12:30:00"),
      today: "Competition Day",
      now: ["Chess", "Lunch"],
      next: ["Game Night"],
      nextDate: "2026-02-23",
    },
    {
      name: "the start time is inclusive",
      at: est("2026-02-23", "18:00:00"),
      today: "Competition Day",
      now: ["Game Night"],
      next: ["Kickoff"],
      nextDate: "2026-02-24",
    },
    {
      name: "late evening: next rolls over to tomorrow",
      at: est("2026-02-23", "23:00:00"),
      today: "Competition Day",
      now: [],
      next: ["Kickoff"],
      nextDate: "2026-02-24",
    },
    {
      name: "a UTC clock already on the next day still reads today in ET",
      at: new Date("2026-02-24T03:30:00Z"),
      today: "Competition Day",
      now: [],
      next: ["Kickoff"],
      nextDate: "2026-02-24",
    },
    {
      name: "after the War Week: nothing",
      at: est("2026-03-01", "12:00:00"),
      today: null,
      now: [],
      next: [],
      nextDate: null,
    },
  ];

  it.each(cases)("$name", ({ at, today, now, next, nextDate }) => {
    const result = computeNowNext(week, at);

    expect(result.today?.dayTheme ?? null).toBe(today);
    expect(result.now.map((i) => i.title)).toEqual(now);
    expect(result.next?.items.map((i) => i.title) ?? []).toEqual(next);
    expect(result.next?.date ?? null).toBe(nextDate);
  });
});

describe("computeNowNext edge cases", () => {
  const gapWeek: ScheduleDay[] = [
    {
      id: "fri",
      date: "2026-02-20",
      dayTheme: "Friday",
      items: [entry("22:00:00", "Late Show", "01:00:00")],
    },
    {
      id: "mon",
      date: "2026-02-23",
      dayTheme: "Monday",
      items: [entry("09:00:00", "Kickoff")],
    },
  ];

  it("keeps an item that runs past midnight on now the next morning", () => {
    const result = computeNowNext(gapWeek, est("2026-02-21", "00:30:00"));

    expect(result.today).toBeNull();
    expect(result.now.map((i) => i.title)).toEqual(["Late Show"]);
  });

  it("shows an item that runs past midnight on its own evening", () => {
    const result = computeNowNext(gapWeek, est("2026-02-20", "23:00:00"));

    expect(result.now.map((i) => i.title)).toEqual(["Late Show"]);
  });

  it("ends an item that runs past midnight at its end time", () => {
    expect(computeNowNext(gapWeek, est("2026-02-21", "01:00:00")).now).toEqual(
      [],
    );
  });

  it("marks only dates before the first Day as before the start", () => {
    expect(
      computeNowNext(gapWeek, est("2026-02-19", "12:00:00")).beforeStart,
    ).toBe(true);
    const gap = computeNowNext(gapWeek, est("2026-02-22", "12:00:00"));
    expect(gap.beforeStart).toBe(false);
    expect(gap.today).toBeNull();
    expect(gap.next?.date).toBe("2026-02-23");
  });
});

describe("formatTimeRange", () => {
  it("shows the start alone, or start to end, in ET", () => {
    expect(formatTimeRange({ startTime: "07:00:00", endTime: null })).toBe(
      "7:00 AM ET",
    );
    expect(
      formatTimeRange({ startTime: "18:00:00", endTime: "22:00:00" }),
    ).toBe("6:00 PM – 10:00 PM ET");
  });
});

describe("formatEtTime", () => {
  it.each([
    ["00:00:00", "12:00 AM"],
    ["07:05:00", "7:05 AM"],
    ["12:00:00", "12:00 PM"],
    ["18:30", "6:30 PM"],
  ])("formats %s as %s", (input, expected) => {
    expect(formatEtTime(input)).toBe(expected);
  });
});

describe("formatDayHeading", () => {
  it("formats a Day date without shifting it by the viewer's timezone", () => {
    expect(formatDayHeading("2026-02-23")).toBe("Monday, Feb 23");
  });
});

describe("resolveClock", () => {
  const now = new Date("2026-02-24T09:00:00-05:00");

  it("uses a parseable ?at= instant", () => {
    expect(resolveClock("2026-02-23T12:30:00-05:00", now).toISOString()).toBe(
      "2026-02-23T17:30:00.000Z",
    );
  });

  it.each([undefined, "not a date", ["2026-02-23T12:30:00Z"]])(
    "falls back to the given current time for %s",
    (at) => {
      expect(resolveClock(at, now).toISOString()).toBe(
        "2026-02-24T14:00:00.000Z",
      );
    },
  );
});
