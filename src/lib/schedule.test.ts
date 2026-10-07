import { describe, expect, it } from "vitest";

import {
  type ScheduleDay,
  type ScheduleEntry,
  computeNowNext,
  filterScheduleByDay,
  formatDayHeading,
  formatEtTime,
  formatTimeRange,
  fromEasternClock,
  groupSchedule,
  resolveClock,
  toEasternClock,
} from "@/lib/schedule";

function entry(
  startTime: string | null,
  title: string,
  endTime: string | null = null,
): ScheduleEntry {
  return {
    id: `${startTime}-${title}`,
    startTime,
    endTime,
    title,
    hosts: [],
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
    description: null,
    items: [
      entry("07:00:00", "Workout", "08:00:00"),
      entry("08:30:00", "Breakfast"),
      entry("12:00:00", "Chess", "14:00:00"),
      entry("12:00:00", "Lunch", "13:00:00"),
      entry("18:00:00", "Quiz Night", "22:00:00"),
    ],
  },
  {
    id: "d2",
    date: "2026-02-24",
    dayTheme: "Red vs. Blue",
    description: null,
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

describe("fromEasternClock", () => {
  it("reads an ET date and time in winter (EST) as that instant", () => {
    expect(fromEasternClock("2026-02-23", "22:30")).toEqual(
      new Date("2026-02-24T03:30:00Z"),
    );
  });

  it("reads an ET date and time in summer (EDT) as that instant", () => {
    expect(fromEasternClock("2026-07-04", "12:05")).toEqual(
      new Date("2026-07-04T16:05:00Z"),
    );
  });

  it("round-trips through toEasternClock", () => {
    const instant = fromEasternClock("2026-02-23", "22:30")!;
    expect(toEasternClock(instant)).toEqual({
      date: "2026-02-23",
      time: "22:30:00",
    });
  });

  it("is null for a blank date or time", () => {
    expect(fromEasternClock("", "22:30")).toBeNull();
    expect(fromEasternClock("2026-02-23", "")).toBeNull();
  });

  it("is null for an unparseable date or time", () => {
    expect(fromEasternClock("2026-02-30", "22:30")).toBeNull();
    expect(fromEasternClock("2026-02-23", "not-a-time")).toBeNull();
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
    ).toEqual([
      {
        id: "d1",
        date: "2026-02-23",
        dayTheme: "One",
        description: null,
        items: [],
      },
    ]);
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
      next: ["Quiz Night"],
      nextDate: "2026-02-23",
    },
    {
      name: "the start time is inclusive",
      at: est("2026-02-23", "18:00:00"),
      today: "Competition Day",
      now: ["Quiz Night"],
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
      description: null,
      items: [entry("22:00:00", "Late Show", "01:00:00")],
    },
    {
      id: "mon",
      date: "2026-02-23",
      dayTheme: "Monday",
      description: null,
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

describe("an untimed item (no start time)", () => {
  const untimedWeek: ScheduleDay[] = groupSchedule(
    [{ id: "d1", date: "2026-02-23", dayTheme: "Competition Day" }],
    [
      entry("07:00:00", "Workout", "08:00:00"),
      entry(null, "Step Challenge"),
      entry("12:00:00", "Lunch", "13:00:00"),
      entry(null, "Drop-in Lego"),
    ].map((e) => ({ dayId: "d1", entry: e })),
  );

  it('reads "Any time"', () => {
    expect(formatTimeRange({ startTime: null, endTime: null })).toBe(
      "Any time",
    );
  });

  it("sorts first in its Day, then by title", () => {
    expect(untimedWeek[0].items.map((item) => item.title)).toEqual([
      "Drop-in Lego",
      "Step Challenge",
      "Workout",
      "Lunch",
    ]);
  });

  it("is never Now or Next, at any hour of its Day or the day before", () => {
    for (const [date, time] of [
      ["2026-02-22", "12:00:00"],
      ["2026-02-23", "00:00:00"],
      ["2026-02-23", "07:30:00"],
      ["2026-02-23", "12:30:00"],
      ["2026-02-23", "23:59:00"],
    ]) {
      const { now, next } = computeNowNext(untimedWeek, est(date, time));
      const titles = [...now, ...(next?.items ?? [])].map((i) => i.title);
      expect(titles).not.toContain("Step Challenge");
      expect(titles).not.toContain("Drop-in Lego");
    }
    // The first timed item is still Next before the Day starts.
    expect(
      computeNowNext(untimedWeek, est("2026-02-22", "12:00:00")).next,
    ).toEqual({
      date: "2026-02-23",
      items: [expect.objectContaining({ title: "Workout" })],
    });
    expect(
      computeNowNext(untimedWeek, est("2026-02-23", "12:30:00")).now,
    ).toEqual([expect.objectContaining({ title: "Lunch" })]);
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

describe("filterScheduleByDay", () => {
  it("returns every Day, unselected, when day is missing", () => {
    expect(filterScheduleByDay(week, undefined)).toEqual({
      selected: null,
      days: week,
    });
  });

  it("filters to the matching Day when day is a valid date", () => {
    expect(filterScheduleByDay(week, "2026-02-24")).toEqual({
      selected: "2026-02-24",
      days: [week[1]],
    });
  });

  it.each(["2026-02-25", "not-a-date", ["2026-02-23"] as unknown as string[]])(
    "falls back to All for an unknown or invalid day %s",
    (day) => {
      expect(filterScheduleByDay(week, day)).toEqual({
        selected: null,
        days: week,
      });
    },
  );
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
