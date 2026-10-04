import { describe, expect, it } from "vitest";

import type { Parsed } from "@/lib/result";
import type { Standings } from "@/lib/standings";
import {
  STATUS_LABELS,
  defaultWinner,
  lifecycleActionError,
  nextEditionDefaults,
  parseClosingInput,
  parseNextWarWeekInput,
  tieTitle,
  toRoman,
  transitionError,
  unstartError,
} from "@/lib/war-week-lifecycle";

/** Refused with `error`, which also shows under the field it names. */
function expectRefused(result: Parsed<unknown>, error: string) {
  expect(result).toMatchObject({ ok: false, error });
  expect(Object.values((!result.ok && result.fieldErrors) || {})).toContain(
    error,
  );
}

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
    ["live", "upcoming", null],
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

describe("tieTitle", () => {
  it("is the one name, or 'Tie: A & B & C' for more", () => {
    expect(tieTitle(["Red"])).toBe("Red");
    expect(tieTitle(["Red", "Blue"])).toBe("Tie: Red & Blue");
    expect(tieTitle(["Red", "Blue", "Green"])).toBe("Tie: Red & Blue & Green");
    expect(tieTitle([])).toBe("");
  });
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

  it("formats a tie of two shared first places as 'Tie: A & B'", () => {
    const standings: Standings = {
      main: "team",
      team: [team("Blue", 1), team("Red", 1), team("Green", 3)],
      individual: [],
    };
    expect(defaultWinner(standings)).toBe("Tie: Blue & Red");
  });

  it("formats a tie of three shared first places as 'Tie: A & B & C'", () => {
    const standings: Standings = {
      main: "team",
      team: [team("Blue", 1), team("Green", 1), team("Red", 1)],
      individual: [],
    };
    expect(defaultWinner(standings)).toBe("Tie: Blue & Green & Red");
  });

  it("is first place in individual Standings in free-for-all", () => {
    const standings: Standings = {
      main: "individual",
      team: [],
      individual: [person("Alice", 1), person("Bob", 2)],
    };
    expect(defaultWinner(standings)).toBe("Alice");
  });

  it("formats a tied first place in free-for-all the same way", () => {
    const standings: Standings = {
      main: "individual",
      team: [],
      individual: [person("Alice", 1), person("Bob", 1)],
    };
    expect(defaultWinner(standings)).toBe("Tie: Alice & Bob");
  });

  it("is blank when nobody has points", () => {
    expect(defaultWinner({ main: "team", team: [], individual: [] })).toBe("");
  });

  it("is blank when every Team is on 0 points (all share rank 1)", () => {
    const standings: Standings = {
      main: "team",
      team: [
        { ...team("Blue", 1), total: 0 },
        { ...team("Red", 1), total: 0 },
      ],
      individual: [],
    };
    expect(defaultWinner(standings)).toBe("");
  });

  it("a unique rank 1 with a non-positive total still wins when others are lower (0 vs -3)", () => {
    const standings: Standings = {
      main: "team",
      team: [
        { ...team("Blue", 1), total: 0 },
        { ...team("Red", 2), total: -3 },
      ],
      individual: [],
    };
    expect(defaultWinner(standings)).toBe("Blue");
  });
});

describe("parseClosingInput", () => {
  it("keeps one highlight per non-blank line", () => {
    expect(parseClosingInput({ highlights: "a\n\n b \n" })).toEqual({
      ok: true,
      value: { highlights: ["a", "b"] },
    });
  });

  it("allows no highlights", () => {
    expect(parseClosingInput({ highlights: "" })).toEqual({
      ok: true,
      value: { highlights: [] },
    });
  });

  it("refuses an over-long highlight", () => {
    expect(parseClosingInput({ highlights: "y".repeat(501) })).toMatchObject({
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
    expectRefused(parseNextWarWeekInput({ ...input, ...overrides }), error);
  });
});

describe("unstartError", () => {
  const none = { pointsEntries: 0, matchResults: 0, logged: 0 };

  it.each<[string, Parameters<typeof unstartError>[0], string | null]>([
    [
      "a live edition never ended, nothing scored",
      { status: "live", winner: null, scored: none },
      null,
    ],
    [
      "not live comes first",
      { status: "upcoming", winner: "Red", scored: { ...none, logged: 1 } },
      "Only a live War Week can be unstarted.",
    ],
    [
      "ended before comes before anything scored",
      { status: "live", winner: "Red", scored: { ...none, pointsEntries: 1 } },
      "This War Week has been ended; Unstart isn't available.",
    ],
    [
      "then Points, Match results and logged Matches or Attempts, in that order",
      {
        status: "live",
        winner: null,
        scored: { pointsEntries: 0, matchResults: 1, logged: 1 },
      },
      "A Match has a result; Unstart isn't available.",
    ],
  ])("%s", (_, input, expected) => {
    expect(unstartError(input)).toBe(expected);
  });
});

describe("lifecycleActionError", () => {
  // Who may run a lifecycle action is `can` (Organizers only); this is only
  // the status rules.
  type Edition = {
    id: string;
    edition: string;
    editionNumber: number;
    status: Status;
    startDate: string;
    winner: string | null;
  };
  const edition = (n: number, roman: string, status: Status): Edition => ({
    id: roman,
    edition: roman,
    editionNumber: n,
    status,
    startDate: `20${n + 15}-02-21`,
    winner: status === "complete" ? "Red" : null,
  });

  // X and XI are over; XII is live.
  const x = edition(10, "x", "complete");
  const xi = edition(11, "xi", "complete");
  const xiiLive = edition(12, "xii", "live");
  const liveWeeks = [x, xi, xiiLive];

  // XI ended and XII is upcoming.
  const xiiUpcoming = edition(12, "xii", "upcoming");
  const upcomingWeeks = [x, xi, xiiUpcoming];

  const none = { pointsEntries: 0, matchResults: 0, logged: 0 };

  it.each<[string, Parameters<typeof lifecycleActionError>[0], string | null]>([
    [
      "Start runs on an upcoming edition",
      { action: "start", target: xiiUpcoming, warWeeks: upcomingWeeks },
      null,
    ],
    [
      "Start on an ended edition says to reopen it",
      { action: "start", target: x, warWeeks: liveWeeks },
      "This War Week has ended. Reopen it instead.",
    ],
    [
      "Reopen on an upcoming edition says to start it",
      { action: "reopen", target: xiiUpcoming, warWeeks: upcomingWeeks },
      "This War Week hasn't started. Start it instead.",
    ],
    [
      "Reopen runs on the most recently ended edition (the one-live guard decides next)",
      { action: "reopen", target: xi, warWeeks: liveWeeks },
      null,
    ],
    [
      "Reopen refuses an older ended edition",
      { action: "reopen", target: x, warWeeks: liveWeeks },
      "Only War Week XI, the most recently ended War Week, can be reopened.",
    ],
    [
      "Reopen isn't available while a later edition is upcoming",
      { action: "reopen", target: xi, warWeeks: upcomingWeeks },
      "War Week XII is next; reopen isn't available.",
    ],
    [
      "Reopen runs when every edition has ended",
      { action: "reopen", target: xi, warWeeks: [x, xi] },
      null,
    ],
    [
      "Unstart runs on a live edition with nothing scored",
      { action: "unstart", target: xiiLive, warWeeks: liveWeeks },
      null,
    ],
    [
      "Unstart runs when every count is zero",
      { action: "unstart", target: xiiLive, warWeeks: liveWeeks, scored: none },
      null,
    ],
    [
      "Unstart refuses once a Points Entry exists",
      {
        action: "unstart",
        target: xiiLive,
        warWeeks: liveWeeks,
        scored: { ...none, pointsEntries: 1 },
      },
      "Points have been entered; Unstart isn't available.",
    ],
    [
      "Unstart refuses once a Match has a result",
      {
        action: "unstart",
        target: xiiLive,
        warWeeks: liveWeeks,
        scored: { ...none, matchResults: 2 },
      },
      "A Match has a result; Unstart isn't available.",
    ],
    [
      "Unstart refuses once a Match or Attempt is logged",
      {
        action: "unstart",
        target: xiiLive,
        warWeeks: liveWeeks,
        scored: { ...none, logged: 1 },
      },
      "A Match or Attempt has been logged; Unstart isn't available.",
    ],
    [
      "Unstart names the Points Entry first when several apply",
      {
        action: "unstart",
        target: xiiLive,
        warWeeks: liveWeeks,
        scored: { pointsEntries: 1, matchResults: 1, logged: 1 },
      },
      "Points have been entered; Unstart isn't available.",
    ],
    [
      "Unstart refuses an upcoming edition",
      { action: "unstart", target: xiiUpcoming, warWeeks: upcomingWeeks },
      "Only a live War Week can be unstarted.",
    ],
    [
      "Unstart refuses an ended edition",
      { action: "unstart", target: xi, warWeeks: liveWeeks },
      "Only a live War Week can be unstarted.",
    ],
    [
      "Unstart refuses a reopened edition, which has been ended before",
      {
        action: "unstart",
        target: { ...xi, status: "live" },
        warWeeks: [x, { ...xi, status: "live" }],
        scored: { pointsEntries: 1, matchResults: 0, logged: 0 },
      },
      "This War Week has been ended; Unstart isn't available.",
    ],
    [
      "End leaves the live check to the transition",
      { action: "end", target: xiiLive, warWeeks: liveWeeks },
      null,
    ],
    [
      "Create next War Week runs from any edition, even a past one",
      { action: "create-next", target: x, warWeeks: liveWeeks },
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

describe("lifecycle parsers given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];

  it.each(MALFORMED)(
    "parseClosingInput returns an error for %s",
    (label, value) => {
      // {} and undefined are no highlights: valid.
      if (label === "{}") return;
      expect(parseClosingInput(value as never)).toMatchObject({ ok: false });
    },
  );

  it.each(MALFORMED)(
    "parseNextWarWeekInput returns an error for %s",
    (_label, value) => {
      expect(parseNextWarWeekInput(value as never)).toMatchObject({
        ok: false,
      });
    },
  );

  it.each<[string, Record<string, unknown>]>([
    ["highlights: 5", { highlights: 5 }],
  ])("parseClosingInput returns an error for %s", (_label, value) => {
    expect(parseClosingInput(value as never)).toMatchObject({ ok: false });
  });
});

describe("lifecycle parsers' field errors", () => {
  it("names the refused End War Week field", () => {
    expect(parseClosingInput({ highlights: "y".repeat(501) })).toEqual({
      ok: false,
      error: "Highlights must be at most 500 characters.",
      fieldErrors: { highlights: "Highlights must be at most 500 characters." },
    });
  });

  it("names each refused Create next War Week field", () => {
    expect(
      parseNextWarWeekInput({
        edition: "12",
        editionNumber: "0",
        year: "2027",
        startDate: "2027-02-21",
        endDate: "2027-02-26",
        storyTheme: "Dune",
      }),
    ).toEqual({
      ok: false,
      error: "Edition must be a Roman numeral like XII.",
      fieldErrors: {
        edition: "Edition must be a Roman numeral like XII.",
        editionNumber: "Edition number must be at least 1.",
      },
    });
  });
});
