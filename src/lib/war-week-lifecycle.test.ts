import { describe, expect, it } from "vitest";

import type { Standings } from "@/lib/standings";
import {
  STATUS_LABELS,
  defaultWinner,
  lifecycleActionError,
  nextEditionDefaults,
  parseClosingInput,
  parseNextWarWeekInput,
  toRoman,
  transitionError,
} from "@/lib/war-week-lifecycle";

type Status = "upcoming" | "live" | "complete";

describe("transitionError", () => {
  // Every from/to pair with no other War Week live.
  it.each<[Status, Status, string | null]>([
    ["upcoming", "live", null],
    ["live", "complete", null],
    ["complete", "live", null],
    ["upcoming", "upcoming", "This War Week is already upcoming."],
    ["live", "live", "This War Week is already live."],
    ["complete", "complete", "This War Week is already complete."],
    ["upcoming", "complete", "Start this War Week before ending it."],
    ["live", "upcoming", "A War Week can't go back to upcoming."],
    ["complete", "upcoming", "A War Week can't go back to upcoming."],
  ])("%s → %s with nothing else live: %j", (from, to, expected) => {
    expect(transitionError(from, to, { liveEdition: null })).toBe(expected);
  });

  it("refuses a second live War Week, naming the one to end", () => {
    expect(transitionError("upcoming", "live", { liveEdition: "xi" })).toBe(
      "End XI first.",
    );
    expect(transitionError("complete", "live", { liveEdition: "xii" })).toBe(
      "End XII first.",
    );
  });

  it("lets a War Week end while another is live", () => {
    expect(
      transitionError("live", "complete", { liveEdition: "xii" }),
    ).toBeNull();
  });
});

describe("toRoman", () => {
  it.each([
    [1, "i"],
    [4, "iv"],
    [9, "ix"],
    [11, "xi"],
    [12, "xii"],
    [14, "xiv"],
    [40, "xl"],
    [99, "xcix"],
  ])("%i is %s", (n, roman) => {
    expect(toRoman(n)).toBe(roman);
  });
});

describe("nextEditionDefaults", () => {
  it("follows the highest edition number and year", () => {
    expect(
      nextEditionDefaults(
        [
          { editionNumber: 10, year: 2025 },
          { editionNumber: 11, year: 2026 },
          { editionNumber: 1, year: 2016 },
        ],
        2031,
      ),
    ).toEqual({ edition: "xii", editionNumber: 12, year: 2027 });
  });

  it("starts at I in the given year when there is no War Week", () => {
    expect(nextEditionDefaults([], 2030)).toEqual({
      edition: "i",
      editionNumber: 1,
      year: 2030,
    });
  });
});

const team = (name: string, rank: number) => ({
  id: name,
  name,
  color: "#000",
  total: 10,
  rank,
});
const person = (name: string, rank: number) => ({
  id: name,
  name,
  team: null,
  total: 10,
  rank,
});

describe("defaultWinner", () => {
  it("is first place in Team Standings in teams mode", () => {
    const standings: Standings = {
      main: "team",
      team: [team("Red", 1), team("Blue", 2)],
      individual: [person("Alice", 1)],
    };
    expect(defaultWinner(standings)).toBe("Red");
  });

  it("joins tied first places with ' & '", () => {
    const standings: Standings = {
      main: "team",
      team: [team("Blue", 1), team("Red", 1), team("Green", 3)],
      individual: [],
    };
    expect(defaultWinner(standings)).toBe("Blue & Red");
  });

  it("is first place in individual Standings in free-for-all", () => {
    const standings: Standings = {
      main: "individual",
      team: [],
      individual: [person("Alice", 1), person("Bob", 2)],
    };
    expect(defaultWinner(standings)).toBe("Alice");
  });

  it("is blank with no Standings", () => {
    expect(defaultWinner({ main: "team", team: [], individual: [] })).toBe("");
  });
});

describe("parseClosingInput", () => {
  it("trims the Winner and keeps one highlight per non-blank line", () => {
    expect(
      parseClosingInput({ winner: " Red ", highlights: "a\n\n b \n" }),
    ).toEqual({ ok: true, value: { winner: "Red", highlights: ["a", "b"] } });
  });

  it("allows no Winner", () => {
    expect(parseClosingInput({ winner: "  ", highlights: "" })).toEqual({
      ok: true,
      value: { winner: null, highlights: [] },
    });
  });

  it("refuses an over-long Winner or highlight", () => {
    expect(
      parseClosingInput({ winner: "x".repeat(201), highlights: "" }),
    ).toEqual({ ok: false, error: "Winner must be at most 200 characters." });
    expect(
      parseClosingInput({ winner: "Red", highlights: "y".repeat(501) }),
    ).toEqual({
      ok: false,
      error: "Highlights must be at most 500 characters.",
    });
  });
});

describe("parseNextWarWeekInput", () => {
  const input = {
    edition: " XII ",
    editionNumber: "12",
    year: "2027",
    startDate: "2027-02-21",
    endDate: "2027-02-26",
    storyTheme: " Dune ",
  };

  it("lowercases the edition, reads numbers and defaults the copy options", () => {
    expect(parseNextWarWeekInput(input)).toEqual({
      ok: true,
      value: {
        edition: "xii",
        editionNumber: 12,
        year: 2027,
        startDate: "2027-02-21",
        endDate: "2027-02-26",
        storyTheme: "Dune",
        copySettings: true,
        copyCompetitions: false,
        copyFaq: false,
      },
    });
  });

  it.each([
    [{ edition: "12" }, "Edition must be a Roman numeral like XII."],
    [{ editionNumber: "0" }, "Edition number must be at least 1."],
    [{ storyTheme: " " }, "Story Theme must not be empty."],
    [{ startDate: "2027-03-01" }, "Start date must not be after the end date."],
  ])("refuses %j", (overrides, error) => {
    expect(parseNextWarWeekInput({ ...input, ...overrides })).toEqual({
      ok: false,
      error,
    });
  });
});

describe("lifecycleActionError", () => {
  const lead = "lead@jahnelgroup.com";
  const pastOnly = "past@jahnelgroup.com";
  const nextOnly = "next@jahnelgroup.com";
  const stranger = "someone@jahnelgroup.com";

  type Edition = {
    id: string;
    edition: string;
    editionNumber: number;
    status: Status;
    startDate: string;
    organizerEmails: string[];
  };
  const edition = (
    n: number,
    roman: string,
    status: Status,
    organizerEmails: string[],
  ): Edition => ({
    id: roman,
    edition: roman,
    editionNumber: n,
    status,
    startDate: `20${n + 15}-02-21`,
    organizerEmails,
  });

  // X is over; XI ended; XII is live and run by `lead`.
  const x = edition(10, "x", "complete", [pastOnly]);
  const xi = edition(11, "xi", "complete", [pastOnly, lead]);
  const xiiLive = edition(12, "xii", "live", [lead]);
  const liveWeeks = [x, xi, xiiLive];

  // XI ended and XII is upcoming (so XII is current).
  const xiiUpcoming = edition(12, "xii", "upcoming", [lead, nextOnly]);
  const upcomingWeeks = [x, xi, xiiUpcoming];

  // Everything ended: XI is current.
  const allOver = [x, xi];

  it.each<[string, Parameters<typeof lifecycleActionError>[0], string | null]>([
    [
      "a past-only Organizer can't reopen their edition while XII is live",
      {
        action: "reopen",
        target: xi,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: pastOnly,
      },
      "Only an Organizer of War Week XII, the current War Week, can reopen a War Week.",
    ],
    [
      "a past-only Organizer can't reopen an older edition once everything has ended",
      {
        action: "reopen",
        target: x,
        current: { ...xi, organizerEmails: [lead] },
        warWeeks: [x, { ...xi, organizerEmails: [lead] }],
        email: pastOnly,
      },
      "Only an Organizer of War Week XI, the current War Week, can reopen a War Week.",
    ],
    [
      "a past-only Organizer can't use Start to reopen their edition",
      {
        action: "start",
        target: x,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: pastOnly,
      },
      "This War Week has ended. Reopen it instead.",
    ],
    [
      "a past-only Organizer can't create the next War Week from their edition",
      {
        action: "create-next",
        target: x,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: pastOnly,
      },
      "Only an Organizer of War Week XII, the current War Week, can create the next War Week.",
    ],
    [
      "a past-only Organizer can't start the upcoming edition",
      {
        action: "start",
        target: xiiUpcoming,
        current: xiiUpcoming,
        warWeeks: upcomingWeeks,
        email: pastOnly,
      },
      "You're not an Organizer for War Week XII.",
    ],
    [
      "a non-Organizer can't reopen, even with a forged id",
      {
        action: "reopen",
        target: x,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: stranger,
      },
      "You're not an Organizer for War Week X.",
    ],
    [
      "a non-Organizer can't start",
      {
        action: "start",
        target: xiiUpcoming,
        current: xiiUpcoming,
        warWeeks: upcomingWeeks,
        email: stranger,
      },
      "You're not an Organizer for War Week XII.",
    ],
    [
      "a non-Organizer can't end",
      {
        action: "end",
        target: xiiLive,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: stranger,
      },
      "You're not an Organizer for War Week XII.",
    ],
    [
      "a non-Organizer can't create the next War Week",
      {
        action: "create-next",
        target: xiiLive,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: stranger,
      },
      "You're not an Organizer for War Week XII.",
    ],
    [
      "nobody signed in can't do anything",
      {
        action: "end",
        target: xiiLive,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: null,
      },
      "You're not an Organizer for War Week XII.",
    ],
    [
      "a current Organizer can reopen the latest ended edition (the one-live guard decides next)",
      {
        action: "reopen",
        target: xi,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: lead,
      },
      null,
    ],
    [
      "a current Organizer can't reopen an older ended edition",
      {
        action: "reopen",
        target: x,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: lead,
      },
      "Only War Week XI, the most recently ended War Week, can be reopened.",
    ],
    [
      "reopen isn't available while a later edition is upcoming",
      {
        action: "reopen",
        target: xi,
        current: xiiUpcoming,
        warWeeks: upcomingWeeks,
        email: lead,
      },
      "War Week XII is next; reopen isn't available.",
    ],
    [
      "the current Organizer of an all-ended site can reopen it",
      {
        action: "reopen",
        target: xi,
        current: xi,
        warWeeks: allOver,
        email: lead,
      },
      null,
    ],
    [
      "an Organizer of only the upcoming edition can start it",
      {
        action: "start",
        target: xiiUpcoming,
        current: xiiUpcoming,
        warWeeks: upcomingWeeks,
        email: nextOnly,
      },
      null,
    ],
    [
      "a current Organizer can start a later upcoming edition they don't organize",
      {
        action: "start",
        target: edition(13, "xiii", "upcoming", [nextOnly]),
        current: xiiUpcoming,
        warWeeks: [...upcomingWeeks, edition(13, "xiii", "upcoming", [])],
        email: lead,
      },
      null,
    ],
    [
      "Reopen on an upcoming edition says to start it",
      {
        action: "reopen",
        target: xiiUpcoming,
        current: xiiUpcoming,
        warWeeks: upcomingWeeks,
        email: lead,
      },
      "This War Week hasn't started. Start it instead.",
    ],
    [
      "a current Organizer can end the live edition",
      {
        action: "end",
        target: xiiLive,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: lead,
      },
      null,
    ],
    [
      "a current Organizer can create the next War Week from a past edition",
      {
        action: "create-next",
        target: x,
        current: xiiLive,
        warWeeks: liveWeeks,
        email: lead,
      },
      null,
    ],
  ])("%s", (_, input, expected) => {
    expect(lifecycleActionError(input)).toBe(expected);
  });
});

describe("STATUS_LABELS", () => {
  it("names each status the way the admin shows it", () => {
    expect(STATUS_LABELS).toEqual({
      upcoming: "Upcoming",
      live: "Live",
      complete: "Archive",
    });
  });
});
