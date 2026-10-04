import { describe, expect, it } from "vitest";

import {
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
  competitionGroup: "Bar contests",
  hosts: ["ana@jahnelgroup.com"],
  placementPoints: [10, 7, 5],
  participationPoints: null,
  format: "placement",
  scoring: "individual",
  countsTowardTeam: true,
  scoreDirection: "higher",
  scoreUnit: null,
  seriesConfig: null,
  bestScoreConfig: null,
  bracketConfig: null,
  selfEnroll: false,
  entrantLimit: null,
  selfReport: false,
  selfCheckIn: false,
  maxAttempts: null,
};

describe("settingsValuesOf", () => {
  it("seeds the form from the stored Competition, blanks for none", () => {
    const values = settingsValuesOf(PLACEMENT);
    expect(values.name).toBe("Darts");
    expect(values.description).toEqual({ type: "doc", content: [] });
    expect(values.group).toBe("Bar contests");
    expect(values.placementPoints).toBe("10, 7, 5");
    expect(values.participationPoints).toBe("");
    expect(values.entrantLimit).toBe("");
    expect(values.scoreUnit).toBe("");
    expect(values.seriesConfig).toBeNull();
    expect(values.bestScoreConfig).toBeNull();
    expect(values.bracketConfig).toBeNull();
  });

  it("gives a Bracket, a Head-to-head and a Best score Competition their configs", () => {
    expect(
      settingsValuesOf({ ...PLACEMENT, format: "bracket", bracketConfig: null })
        .bracketConfig,
    ).toEqual({
      kind: "head-to-head" as const,
      entrantsPerMatch: 2,
      advancePerMatch: 1,
      thirdPlaceMatch: false,
      rounds: {},
    });
    expect(
      settingsValuesOf({ ...PLACEMENT, format: "head-to-head" }).seriesConfig,
    ).toEqual({ drawsAllowed: false, bestOf: 3 });
    expect(
      settingsValuesOf({
        ...PLACEMENT,
        format: "best-score",
        scoreUnit: "sec",
      }),
    ).toMatchObject({
      bestScoreConfig: { teamScore: "best-member" },
      scoreUnit: "sec",
    });
  });
});

describe("settingChangeOf", () => {
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
});

describe("shownSettings", () => {
  it("shows a Placement Competition's Score direction and no other Format's settings", () => {
    const shown = shownSettings(settingsValuesOf(PLACEMENT), "teams");
    expect(shown).toContain("scoreDirection");
    expect(shown).toContain("placementPoints");
    expect(shown).toContain("countsTowardTeam");
    expect(shown).not.toContain("bracketConfig");
    expect(shown).not.toContain("seriesConfig");
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
      ]),
    );
    expect(shown).toEqual(
      expect.arrayContaining(["scoreDirection", "scoreUnit"]),
    );
  });

  it("shows no Score direction or unit for Participation", () => {
    const shown = shownSettings(
      settingsValuesOf({ ...PLACEMENT, format: "participation" }),
      "teams",
    );
    expect(shown).not.toContain("scoreDirection");
    expect(shown).not.toContain("scoreUnit");
  });

  it("hides the Scoring choice in a free-for-all War Week unless the Competition is Team", () => {
    const individual = settingsValuesOf(PLACEMENT);
    expect(shownSettings(individual, "free-for-all")).not.toContain("scoring");
    expect(shownSettings(individual, "teams")).toContain("scoring");
    const team = settingsValuesOf({ ...PLACEMENT, scoring: "team" });
    expect(shownSettings(team, "free-for-all")).toContain("scoring");
  });

  it("offers self-report on a Bracket, Head-to-head and Best score, never Placement or Participation (AC 3)", () => {
    for (const [format, shows] of [
      ["bracket", true],
      ["head-to-head", true],
      ["best-score", true],
      ["placement", false],
      ["participation", false],
    ] as const) {
      const values = settingsValuesOf({ ...PLACEMENT, format });
      expect(
        shownSettings(values, "teams").includes("selfReport"),
        format,
      ).toBe(shows);
    }
  });

  it("offers Max attempts per person on Best score only", () => {
    for (const format of [
      "placement",
      "bracket",
      "head-to-head",
      "best-score",
      "participation",
    ] as const) {
      const values = settingsValuesOf({ ...PLACEMENT, format });
      expect(
        shownSettings(values, "teams").includes("maxAttempts"),
        format,
      ).toBe(format === "best-score");
    }
    expect(
      settingsValuesOf({ ...PLACEMENT, format: "best-score", maxAttempts: 3 })
        .maxAttempts,
    ).toBe("3");
  });

  it("offers enrollment only on a Bracket", () => {
    for (const format of [
      "placement",
      "head-to-head",
      "best-score",
      "participation",
    ] as const) {
      const values = settingsValuesOf({ ...PLACEMENT, format });
      expect(shownSettings(values, "teams"), format).not.toContain(
        "selfEnroll",
      );
    }
  });

  it("shows no close time on any Format", () => {
    for (const format of [
      "placement",
      "bracket",
      "head-to-head",
      "best-score",
      "participation",
    ] as const) {
      const values = settingsValuesOf({
        ...PLACEMENT,
        format,
        selfEnroll: true,
        selfCheckIn: true,
      });
      expect(
        shownSettings(values, "teams").filter((f) => /ClosesAt$/.test(f)),
        format,
      ).toEqual([]);
    }
  });

  it("shows a Head-to-head its series settings, and Best score its direction, unit and, in team scoring, Team score", () => {
    expect(
      shownSettings(
        settingsValuesOf({ ...PLACEMENT, format: "head-to-head" }),
        "teams",
      ),
    ).toContain("seriesConfig");
    const individual = shownSettings(
      settingsValuesOf({ ...PLACEMENT, format: "best-score" }),
      "teams",
    );
    expect(individual).toEqual(
      expect.arrayContaining(["scoreDirection", "scoreUnit"]),
    );
    expect(individual).not.toContain("bestScoreConfig");
    expect(
      shownSettings(
        settingsValuesOf({
          ...PLACEMENT,
          format: "best-score",
          scoring: "team",
        }),
        "teams",
      ),
    ).toContain("bestScoreConfig");
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
