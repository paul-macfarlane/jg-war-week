import { describe, expect, it } from "vitest";

import {
  type CompetitionInput,
  type ParticipantInput,
  type WarWeekSettingsInput,
  competitionGuardError,
  dayDeleteGuardError,
  dayGuardError,
  dayOutsideRangeError,
  inUseError,
  parseCompetitionInput,
  parseDayInput,
  parseParticipantInput,
  parseTeamInput,
  parseWarWeekSettingsInput,
  participantGuardError,
  settingsGuardError,
  teamGuardError,
} from "@/lib/setup";

const input: WarWeekSettingsInput = {
  storyTheme: "  The Matrix ",
  startDate: "2026-02-22",
  endDate: "2026-02-27",
  mode: "teams",
  teamLabel: "Team",
  leaderTitle: "Captain",
  slackChannelUrl: "https://jahnelgroup.slack.com/archives/war-week-xi",
  wikiUrl: "",
  organizerEmails: "PMacfarlane@jahnelgroup.com\njason@jahnelgroup.com, ",
  primaryColor: "#00ff41",
  primaryForegroundColor: "#000000",
  accentColor: "#008f11",
  backgroundColor: "#000",
  foregroundColor: "#d1ffd6",
  logoUrl: "/themes/xi/logo.svg",
  bannerUrl: " ",
  fontPreset: "mono",
  winner: " ",
  highlights: "",
};

function parsed(overrides: Partial<WarWeekSettingsInput> = {}) {
  return parseWarWeekSettingsInput({ ...input, ...overrides });
}

describe("parseWarWeekSettingsInput", () => {
  it("trims text, blanks optional URLs to null and splits organizer emails", () => {
    expect(parsed()).toEqual({
      ok: true,
      value: {
        storyTheme: "The Matrix",
        startDate: "2026-02-22",
        endDate: "2026-02-27",
        mode: "teams",
        teamLabel: "Team",
        leaderTitle: "Captain",
        slackChannelUrl: "https://jahnelgroup.slack.com/archives/war-week-xi",
        wikiUrl: null,
        organizerEmails: [
          "pmacfarlane@jahnelgroup.com",
          "jason@jahnelgroup.com",
        ],
        primaryColor: "#00ff41",
        primaryForegroundColor: "#000000",
        accentColor: "#008f11",
        backgroundColor: "#000",
        foregroundColor: "#d1ffd6",
        logoUrl: "/themes/xi/logo.svg",
        bannerUrl: null,
        fontPreset: "mono",
        winner: null,
        highlights: [],
      },
    });
  });

  it("takes the Winner and one highlight per line, skipping blank lines", () => {
    const result = parsed({
      winner: " Red & Blue ",
      highlights: " Red won Captain Clash \n\n  Blue took the trivia crown\r\n",
    });
    expect(result.ok && [result.value.winner, result.value.highlights]).toEqual(
      ["Red & Blue", ["Red won Captain Clash", "Blue took the trivia crown"]],
    );
  });

  it("never carries a status, so a settings save can't change it", () => {
    const result = parseWarWeekSettingsInput({
      ...input,
      status: "complete",
    } as WarWeekSettingsInput);
    expect(result.ok && "status" in result.value).toBe(false);
  });

  it("drops duplicate organizer emails", () => {
    const result = parsed({
      organizerEmails: "a@jahnelgroup.com A@jahnelgroup.com",
    });
    expect(result.ok && result.value.organizerEmails).toEqual([
      "a@jahnelgroup.com",
    ]);
  });

  it.each<[Partial<WarWeekSettingsInput>, string]>([
    [{ storyTheme: " " }, "Story Theme must not be empty."],
    [
      { storyTheme: "x".repeat(121) },
      "Story Theme must be at most 120 characters.",
    ],
    [{ primaryColor: "green" }, "Primary color must be a hex color."],
    [{ backgroundColor: "#12345" }, "Background color must be a hex color."],
    [
      { slackChannelUrl: "http://slack.com/x" },
      "Slack URL must be an https URL.",
    ],
    [
      { logoUrl: "logo.svg" },
      "Logo URL must be a root-relative path or an https URL.",
    ],
    [{ startDate: "2026-02-30" }, "Start date must be a date."],
    [{ winner: "x".repeat(201) }, "Winner must be at most 200 characters."],
    [
      { highlights: `ok\n${"x".repeat(501)}` },
      "Highlights must be at most 500 characters.",
    ],
    [{ fontPreset: "comic" }, "Font must be one of sans, serif, mono."],
    [{ organizerEmails: " " }, "Add at least one organizer email."],
    [
      { organizerEmails: "a@jahnelgroup.com, not-an-email" },
      'Organizer email "not-an-email" must be an @jahnelgroup.com address.',
    ],
    [
      { organizerEmails: "a@jahnelgroup.com, someone@gmail.com" },
      'Organizer email "someone@gmail.com" must be an @jahnelgroup.com address.',
    ],
    [
      { startDate: "2026-02-28", endDate: "2026-02-27" },
      "Start date must not be after the end date.",
    ],
  ])("refuses %o", (overrides, error) => {
    expect(parsed(overrides)).toEqual({ ok: false, error });
  });

  it("accepts a mixed-case Jahnel Group organizer email", () => {
    const result = parsed({ organizerEmails: "A@JahnelGroup.Com" });
    expect(result.ok && result.value.organizerEmails).toEqual([
      "a@jahnelgroup.com",
    ]);
  });
});

describe("dayOutsideRangeError", () => {
  const dayDates = ["2026-02-27", "2026-02-22", "2026-02-24"];

  it("allows dates that keep every Day inside", () => {
    expect(
      dayOutsideRangeError(dayDates, "2026-02-22", "2026-02-27"),
    ).toBeNull();
    expect(dayOutsideRangeError([], "2026-03-01", "2026-03-02")).toBeNull();
  });

  it("names the earliest Day the new dates would leave outside", () => {
    expect(dayOutsideRangeError(dayDates, "2026-02-25", "2026-02-26")).toBe(
      "The Day on 2026-02-22 falls outside the new dates. Move or delete it first.",
    );
    expect(dayOutsideRangeError(dayDates, "2026-02-22", "2026-02-26")).toBe(
      "The Day on 2026-02-27 falls outside the new dates. Move or delete it first.",
    );
  });
});

describe("settingsGuardError", () => {
  const value = (overrides: Partial<WarWeekSettingsInput> = {}) => {
    const result = parsed(overrides);
    if (!result.ok) throw new Error(result.error);
    return result.value;
  };
  const ctx = {
    actorEmail: "pmacfarlane@jahnelgroup.com",
    teamCount: 0,
    dayDates: ["2026-02-22", "2026-02-27"],
  };

  it("allows a save that keeps the Organizer, Teams and Days consistent", () => {
    expect(settingsGuardError(value(), ctx)).toBeNull();
    expect(settingsGuardError(value({ mode: "free-for-all" }), ctx)).toBeNull();
    expect(settingsGuardError(value({ winner: "Red" }), ctx)).toBeNull();
  });

  it("refuses switching to free-for-all while Teams exist", () => {
    expect(
      settingsGuardError(value({ mode: "free-for-all" }), {
        ...ctx,
        teamCount: 4,
      }),
    ).toBe(
      "This War Week has 4 Teams. Delete them before switching to free-for-all.",
    );
  });

  it("allows staying in teams mode with Teams", () => {
    expect(settingsGuardError(value(), { ...ctx, teamCount: 4 })).toBeNull();
  });

  it("refuses dates that would leave a Day outside the War Week", () => {
    expect(settingsGuardError(value({ endDate: "2026-02-26" }), ctx)).toBe(
      "The Day on 2026-02-27 falls outside the new dates. Move or delete it first.",
    );
  });

  it("refuses an Organizer removing their own email", () => {
    expect(
      settingsGuardError(value({ organizerEmails: "jason@jahnelgroup.com" }), {
        ...ctx,
        actorEmail: "PMacfarlane@jahnelgroup.com",
      }),
    ).toBe("You can't remove your own email from the organizer emails.");
  });
});

describe("parseDayInput", () => {
  it("trims the Day Theme", () => {
    expect(
      parseDayInput({ date: "2026-02-23", dayTheme: " Red pill " }),
    ).toEqual({
      ok: true,
      value: { date: "2026-02-23", dayTheme: "Red pill" },
    });
  });

  it.each([
    [{ date: "", dayTheme: "x" }, "Date must be a date."],
    [{ date: "2026-02-23", dayTheme: "" }, "Day Theme must not be empty."],
    [
      { date: "2026-02-23", dayTheme: "x".repeat(121) },
      "Day Theme must be at most 120 characters.",
    ],
  ])("refuses %o", (day, error) => {
    expect(parseDayInput(day)).toEqual({ ok: false, error });
  });
});

describe("dayGuardError", () => {
  const ctx = {
    startDate: "2026-02-22",
    endDate: "2026-02-27",
    otherDayDates: ["2026-02-22"],
  };

  it("allows a free date within the War Week", () => {
    expect(
      dayGuardError({ date: "2026-02-27", dayTheme: "x" }, ctx),
    ).toBeNull();
  });

  it("refuses a date outside the War Week", () => {
    expect(dayGuardError({ date: "2026-02-28", dayTheme: "x" }, ctx)).toBe(
      "A Day must fall within the War Week (2026-02-22 to 2026-02-27).",
    );
  });

  it("refuses a second Day on the same date", () => {
    expect(dayGuardError({ date: "2026-02-22", dayTheme: "x" }, ctx)).toBe(
      "There's already a Day on 2026-02-22.",
    );
  });
});

describe("dayDeleteGuardError", () => {
  it("allows deleting a Day with no Schedule Items", () => {
    expect(dayDeleteGuardError(0)).toBeNull();
  });

  it("refuses deleting a Day that has Schedule Items", () => {
    expect(dayDeleteGuardError(1)).toBe(
      "This Day has 1 Schedule Item. Delete or move it first.",
    );
    expect(dayDeleteGuardError(3)).toBe(
      "This Day has 3 Schedule Items. Delete or move them first.",
    );
  });
});

describe("parseTeamInput", () => {
  it("trims the name and color and blanks the logo URL to null", () => {
    expect(
      parseTeamInput({ name: " Zion ", color: " #0f0 ", logoUrl: " " }),
    ).toEqual({
      ok: true,
      value: { name: "Zion", color: "#0f0", logoUrl: null },
    });
  });

  it.each([
    [{ name: "", color: "#0f0", logoUrl: "" }, "Name must not be empty."],
    [
      { name: "Zion", color: "green", logoUrl: "" },
      "Color must be a hex color.",
    ],
    [
      { name: "Zion", color: "#0f0", logoUrl: "http://x.test/a.png" },
      "Logo URL must be a root-relative path or an https URL.",
    ],
  ])("refuses %o", (input, error) => {
    expect(parseTeamInput(input)).toEqual({ ok: false, error });
  });
});

describe("parseParticipantInput", () => {
  const teamId = "00000000-0000-4000-8000-000000000001";
  const participant: ParticipantInput = {
    displayName: " Neo ",
    companyTag: " ",
    email: " Neo@JahnelGroup.com ",
    teamId,
    isLeader: true,
  };

  it("trims, lowercases the email and blanks optional fields to null", () => {
    expect(parseParticipantInput(participant)).toEqual({
      ok: true,
      value: {
        displayName: "Neo",
        companyTag: null,
        email: "neo@jahnelgroup.com",
        teamId,
        isLeader: true,
      },
    });
    expect(
      parseParticipantInput({
        ...participant,
        email: "",
        teamId: "",
        isLeader: false,
      }),
    ).toMatchObject({ ok: true, value: { email: null, teamId: null } });
  });

  it.each([
    [{ displayName: "  " }, "Display name must not be empty."],
    [{ email: "neo" }, "Email must be a valid email."],
    [{ teamId: "nope" }, "Choose a Team."],
    [{ teamId: "" }, "A Leader needs a Team."],
  ])("refuses %o", (overrides, error) => {
    expect(parseParticipantInput({ ...participant, ...overrides })).toEqual({
      ok: false,
      error,
    });
  });
});

describe("parseCompetitionInput", () => {
  const competition: CompetitionInput = {
    name: " Catan ",
    description: " ",
    scoring: "individual",
    maxPoints: " 10 ",
    placementPoints: "5, 3 1",
    countsTowardTeam: true,
    group: " Board games ",
  };

  it("parses numbers, the Placement Points list and blank fields", () => {
    expect(parseCompetitionInput(competition)).toEqual({
      ok: true,
      value: {
        name: "Catan",
        description: null,
        scoring: "individual",
        maxPoints: 10,
        placementPoints: [5, 3, 1],
        countsTowardTeam: true,
        competitionGroup: "Board games",
      },
    });
    expect(
      parseCompetitionInput({
        ...competition,
        maxPoints: "",
        placementPoints: " ",
        group: "",
      }),
    ).toMatchObject({
      ok: true,
      value: { maxPoints: null, placementPoints: null, competitionGroup: null },
    });
  });

  it.each([
    [{ name: "" }, "Name must not be empty."],
    [{ scoring: "both" }, "Scoring must be one of team, individual."],
    [{ maxPoints: "ten" }, "Max points must be a number."],
    [{ maxPoints: "0" }, "Max points must be more than 0."],
    [
      { placementPoints: "5, three" },
      "Placement Points must be numbers separated by commas, 1st place first.",
    ],
    [{ placementPoints: "5, -1" }, "Placement Points must be at least 0."],
    [
      { placementPoints: "3, 5" },
      "Each place's Placement Points must be no more than the place above it.",
    ],
    [
      { placementPoints: "6, 5, 4, 3, 2, 1" },
      "Placement Points cover at most 5 places.",
    ],
    [
      { placementPoints: "12, 3" },
      "1st place's Placement Points can't be more than Max points.",
    ],
    [
      { scoring: "team" },
      "Only an individual Competition can count toward the Team.",
    ],
  ])("refuses %o", (overrides, error) => {
    expect(parseCompetitionInput({ ...competition, ...overrides })).toEqual({
      ok: false,
      error,
    });
  });
});

describe("teamGuardError", () => {
  it("allows a new name in teams mode", () => {
    expect(
      teamGuardError({ name: "Zion" }, { mode: "teams", nameTaken: false }),
    ).toBeNull();
  });

  it("refuses Teams in a free-for-all and a duplicate name", () => {
    expect(
      teamGuardError(
        { name: "Zion" },
        { mode: "free-for-all", nameTaken: false },
      ),
    ).toBe(
      "A free-for-all War Week has no Teams. Switch the mode to teams first.",
    );
    expect(
      teamGuardError({ name: "Zion" }, { mode: "teams", nameTaken: true }),
    ).toBe('There\'s already a Team named "Zion".');
  });
});

describe("participantGuardError", () => {
  const values = {
    displayName: "Neo",
    email: "neo@jahnelgroup.com",
    teamId: "t1",
  };
  const ctx = {
    mode: "teams" as const,
    teamExists: true,
    nameTaken: false,
    emailTakenBy: null,
  };

  it("allows a unique Participant on a Team of this War Week", () => {
    expect(participantGuardError(values, ctx)).toBeNull();
    expect(
      participantGuardError(
        { ...values, teamId: null },
        { ...ctx, teamExists: false },
      ),
    ).toBeNull();
  });

  it.each([
    [
      { emailTakenBy: "Trinity" },
      "neo@jahnelgroup.com is already Trinity's email.",
    ],
    [{ nameTaken: true }, 'There\'s already a Participant named "Neo".'],
    [{ teamExists: false }, "That Team no longer exists."],
    [
      { mode: "free-for-all" as const },
      "A free-for-all War Week has no Teams.",
    ],
  ])("refuses %o", (overrides, error) => {
    expect(participantGuardError(values, { ...ctx, ...overrides })).toBe(error);
  });
});

describe("competitionGuardError", () => {
  const values = {
    name: "Catan",
    scoring: "team" as const,
    placementPoints: [5, 3, 1],
  };
  const ctx = { mode: "teams" as const, nameTaken: false, existing: null };
  const existingBase = {
    scoring: "team" as const,
    placementPoints: [5, 3, 1] as number[] | null,
    pointsEntryCount: 0,
    finalizedAt: null as Date | null,
  };

  it("allows a new Competition and a scoring change with no Points Entries", () => {
    expect(competitionGuardError(values, ctx)).toBeNull();
    expect(
      competitionGuardError(values, {
        ...ctx,
        existing: { ...existingBase, scoring: "individual" },
      }),
    ).toBeNull();
  });

  it("refuses a duplicate name, a team Competition in a free-for-all and changing scoring under Points Entries", () => {
    expect(competitionGuardError(values, { ...ctx, nameTaken: true })).toBe(
      'There\'s already a Competition named "Catan".',
    );
    expect(
      competitionGuardError(values, { ...ctx, mode: "free-for-all" }),
    ).toBe(
      "A free-for-all War Week has no Teams, so its Competitions are individual.",
    );
    expect(
      competitionGuardError(values, {
        ...ctx,
        existing: {
          ...existingBase,
          scoring: "individual",
          pointsEntryCount: 2,
        },
      }),
    ).toBe(
      "This Competition has 2 Points Entries, so its scoring can't change. Delete them first.",
    );
  });

  it("refuses a scoring or Placement Points change while the Bracket is finalized, but allows an unchanged save", () => {
    const finalized = { ...existingBase, finalizedAt: new Date() };
    expect(
      competitionGuardError(values, {
        ...ctx,
        existing: { ...finalized, scoring: "individual" },
      }),
    ).toBe(
      "This Competition's Bracket is finalized. Un-finalize the Bracket first.",
    );
    expect(
      competitionGuardError(
        { ...values, placementPoints: [10, 5] },
        { ...ctx, existing: finalized },
      ),
    ).toBe(
      "This Competition's Bracket is finalized. Un-finalize the Bracket first.",
    );
    expect(
      competitionGuardError(values, { ...ctx, existing: finalized }),
    ).toBeNull();
    expect(
      competitionGuardError(
        { ...values, placementPoints: null },
        { ...ctx, existing: { ...finalized, placementPoints: [] } },
      ),
    ).toBeNull();
  });
});

describe("inUseError", () => {
  it("is null when nothing refers to the record", () => {
    expect(
      inUseError(
        "Team",
        [[0, "Points Entry", "Points Entries"]],
        "Delete them first.",
      ),
    ).toBeNull();
  });

  it("names every count that blocks the delete", () => {
    expect(
      inUseError(
        "Team",
        [
          [3, "Participant", "Participants"],
          [1, "Points Entry", "Points Entries"],
          [0, "Award", "Awards"],
        ],
        "Move or delete them first.",
      ),
    ).toBe(
      "This Team has 3 Participants and 1 Points Entry. Move or delete them first.",
    );
    expect(
      inUseError(
        "Participant",
        [
          [2, "Points Entry", "Points Entries"],
          [1, "Award", "Awards"],
          [1, "Thing", "Things"],
        ],
        "Delete them first.",
      ),
    ).toBe(
      "This Participant has 2 Points Entries, 1 Award and 1 Thing. Delete them first.",
    );
  });
});
