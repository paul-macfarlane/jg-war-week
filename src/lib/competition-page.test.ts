import { describe, expect, it } from "vitest";

import {
  CLOCK_HALF_SET,
  type CompetitionSettingsSource,
  HOST_NOT_ON_ROSTER,
  hostNameOnPage,
  settingChangeOf,
  settingsValuesOf,
  shownSettings,
} from "./competition-page";

const PLACEMENT: CompetitionSettingsSource = {
  name: "Darts",
  description: null,
  competitionGroup: "Bar games",
  hosts: ["ana@jahnelgroup.com"],
  placementPoints: [10, 7, 5],
  participationPoints: null,
  format: "placement",
  scoring: "individual",
  countsTowardTeam: true,
  scoreDirection: "higher",
  gameConfig: null,
  entrantsOpen: true,
  bracketConfig: null,
  selfEnroll: false,
  entrantLimit: null,
  enrollClosesAt: null,
  loggingClosesAt: null,
  selfReport: false,
  selfCheckIn: false,
  checkInClosesAt: null,
};

describe("settingsValuesOf", () => {
  it("seeds the form from the stored Competition, blanks for none", () => {
    const values = settingsValuesOf(PLACEMENT);
    expect(values.name).toBe("Darts");
    expect(values.description).toEqual({ type: "doc", content: [] });
    expect(values.group).toBe("Bar games");
    expect(values.placementPoints).toBe("10, 7, 5");
    expect(values.participationPoints).toBe("");
    expect(values.entrantLimit).toBe("");
    expect(values.enrollClosesAt).toEqual({ date: "", time: "" });
    expect(values.gameConfig).toBeNull();
    expect(values.bracketConfig).toBeNull();
  });

  it("gives a Bracket its config and a Games Format its Format's config", () => {
    expect(
      settingsValuesOf({ ...PLACEMENT, format: "bracket", bracketConfig: null })
        .bracketConfig,
    ).toEqual({ entrantsPerHeat: 2, advancePerHeat: 1, thirdPlaceGame: false });
    expect(
      settingsValuesOf({ ...PLACEMENT, format: "best-score", gameConfig: null })
        .gameConfig,
    ).toEqual({ count: "best", betterIs: "higher", unit: "" });
  });

  it("shows a close time as its ET date and time", () => {
    // 17:30 UTC on 1 March 2027 is 12:30 in New York (EST).
    const values = settingsValuesOf({
      ...PLACEMENT,
      enrollClosesAt: new Date("2027-03-01T17:30:00Z"),
    });
    expect(values.enrollClosesAt).toEqual({
      date: "2027-03-01",
      time: "12:30",
    });
  });
});

describe("settingChangeOf", () => {
  const values = settingsValuesOf(PLACEMENT);

  it("posts text, booleans and the Placement Points text as typed", () => {
    expect(settingChangeOf("name", "Darts II")).toEqual({
      ok: true,
      change: { field: "name", value: "Darts II" },
    });
    expect(settingChangeOf("countsTowardTeam", false)).toEqual({
      ok: true,
      change: { field: "countsTowardTeam", value: false },
    });
    expect(settingChangeOf("placementPoints", "5, 3")).toEqual({
      ok: true,
      change: { field: "placementPoints", value: "5, 3" },
    });
  });

  it("posts a close time as the instant, or null when both are blank", () => {
    expect(
      settingChangeOf("loggingClosesAt", { date: "2027-03-01", time: "12:30" }),
    ).toEqual({
      ok: true,
      change: {
        field: "loggingClosesAt",
        value: "2027-03-01T17:30:00.000Z",
      },
    });
    expect(settingChangeOf("loggingClosesAt", values.loggingClosesAt)).toEqual({
      ok: true,
      change: { field: "loggingClosesAt", value: null },
    });
  });

  it("refuses a close time with only a date or only a time", () => {
    expect(
      settingChangeOf("checkInClosesAt", { date: "2027-03-01", time: "" }),
    ).toEqual({ ok: false, error: CLOCK_HALF_SET });
  });
});

describe("shownSettings", () => {
  it("shows a Placement Competition's Score direction and no Bracket or Games settings", () => {
    const shown = shownSettings(settingsValuesOf(PLACEMENT), "teams");
    expect(shown).toContain("scoreDirection");
    expect(shown).toContain("placementPoints");
    expect(shown).toContain("countsTowardTeam");
    expect(shown).not.toContain("bracketConfig");
    expect(shown).not.toContain("gameConfig");
    expect(shown).not.toContain("selfEnroll");
  });

  it("shows a Bracket's match settings, self-report and enrollment", () => {
    const shown = shownSettings(
      settingsValuesOf({ ...PLACEMENT, format: "bracket", selfEnroll: true }),
      "teams",
    );
    expect(shown).toEqual(
      expect.arrayContaining([
        "bracketConfig",
        "selfReport",
        "selfEnroll",
        "entrantLimit",
        "enrollClosesAt",
      ]),
    );
    expect(shown).not.toContain("scoreDirection");
  });

  it("hides the Scoring choice in a free-for-all War Week unless the Competition is Team", () => {
    const individual = settingsValuesOf(PLACEMENT);
    expect(shownSettings(individual, "free-for-all")).not.toContain("scoring");
    expect(shownSettings(individual, "teams")).toContain("scoring");
    const team = settingsValuesOf({ ...PLACEMENT, scoring: "team" });
    expect(shownSettings(team, "free-for-all")).toContain("scoring");
  });

  it("offers a Games Competition enrollment only with a fixed list and no Best of", () => {
    const open = settingsValuesOf({ ...PLACEMENT, format: "head-to-head" });
    expect(shownSettings(open, "teams")).not.toContain("selfEnroll");
    const fixed = { ...open, entrantsOpen: false };
    expect(shownSettings(fixed, "teams")).toContain("selfEnroll");
    const bestOf = {
      ...fixed,
      gameConfig: { drawsAllowed: false, bestOf: 3 as const },
    };
    expect(shownSettings(bestOf, "teams")).not.toContain("selfEnroll");
    expect(shownSettings(open, "teams")).toEqual(
      expect.arrayContaining(["gameConfig", "entrantsOpen", "loggingClosesAt"]),
    );
  });

  it("gives an individual Participation Competition points per Participant, not Placement Points", () => {
    const individual = settingsValuesOf({
      ...PLACEMENT,
      format: "participation",
      participationPoints: 2,
    });
    const shown = shownSettings(individual, "teams");
    expect(shown).toContain("participationPoints");
    expect(shown).not.toContain("placementPoints");
    expect(shown).toContain("selfCheckIn");
    expect(shown).not.toContain("checkInClosesAt");
    expect(
      shownSettings({ ...individual, selfCheckIn: true }, "teams"),
    ).toContain("checkInClosesAt");
  });

  it("hides counts toward the Team in a free-for-all", () => {
    expect(
      shownSettings(settingsValuesOf(PLACEMENT), "free-for-all"),
    ).not.toContain("countsTowardTeam");
  });
});

describe("hostNameOnPage", () => {
  const profiles = new Map([
    [
      "ana@jahnelgroup.com",
      { profileName: "Ana P", profileImage: null, googleImage: null },
    ],
  ]);
  const rosterNames = new Map([
    ["ana@jahnelgroup.com", "Ana Pereira"],
    ["bo.k@jahnelgroup.com", "Bo Kim"],
  ]);

  it("names a Host by Profile name, else roster name, whatever the email's case", () => {
    expect(hostNameOnPage("Ana@jahnelgroup.com", profiles, rosterNames)).toBe(
      "Ana P",
    );
    expect(hostNameOnPage("BO.K@jahnelgroup.com", profiles, rosterNames)).toBe(
      "Bo Kim",
    );
  });

  it("calls a Host with neither name a Host not on the roster, never by their email", () => {
    const name = hostNameOnPage("cy.l@jahnelgroup.com", profiles, rosterNames);
    expect(name).toBe("A Host not on the roster");
    expect(name).toBe(HOST_NOT_ON_ROSTER);
    expect(name).not.toContain("cy");
  });
});
