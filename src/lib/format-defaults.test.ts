import { describe, expect, it } from "vitest";

import { formatDefaults } from "@/lib/format-defaults";

describe("formatDefaults", () => {
  it("gives a Bracket the default match settings, or the one given, and keeps at most 4 Placement Points", () => {
    expect(
      formatDefaults("bracket", {
        scoring: "team",
        placementPoints: [10, 7, 5, 3, 1],
      }),
    ).toEqual({
      bracketConfig: {
        kind: "head-to-head" as const,
        entrantsPerMatch: 2,
        advancePerMatch: 1,
        thirdPlaceMatch: false,
        rounds: {},
      },
      seriesConfig: null,
      bestScoreConfig: null,
      leagueConfig: null,
      scoreDirection: "none",
      participationPoints: null,
      placementPoints: [10, 7, 5, 3],
    });
    const fours = {
      kind: "group" as const,
      entrantsPerMatch: 4,
      advancePerMatch: 2,
      thirdPlaceMatch: false,
      rounds: {},
    };
    expect(
      formatDefaults(
        "bracket",
        { scoring: "team", placementPoints: null },
        fours,
      ),
    ).toMatchObject({ bracketConfig: fours, placementPoints: null });
  });

  it("gives a Head-to-head Best of 3 and Best score a higher-is-better direction", () => {
    expect(
      formatDefaults("head-to-head", {
        scoring: "individual",
        placementPoints: [3, 2, 1],
      }),
    ).toEqual({
      bracketConfig: null,
      seriesConfig: { drawsAllowed: false, bestOf: 3 },
      bestScoreConfig: null,
      leagueConfig: null,
      scoreDirection: "none",
      participationPoints: null,
      placementPoints: [3, 2, 1],
    });
    expect(
      formatDefaults("best-score", {
        scoring: "individual",
        placementPoints: null,
      }),
    ).toMatchObject({
      seriesConfig: null,
      bestScoreConfig: { teamScore: "best-member" },
      scoreDirection: "higher",
    });
  });

  it("gives a team Participation Competition 3/2/1 when it has no Placement Points, and an individual one 1 point per Participant", () => {
    expect(
      formatDefaults("participation", {
        scoring: "team",
        placementPoints: null,
      }),
    ).toMatchObject({ participationPoints: null, placementPoints: [3, 2, 1] });
    expect(
      formatDefaults("participation", {
        scoring: "team",
        placementPoints: [5, 3],
      }),
    ).toMatchObject({ participationPoints: null, placementPoints: [5, 3] });
    expect(
      formatDefaults("participation", {
        scoring: "individual",
        placementPoints: [5, 3],
      }),
    ).toMatchObject({ participationPoints: 1, placementPoints: null });
  });

  it("gives a League a round robin with its rounds blank, keeping its Placement Points", () => {
    expect(
      formatDefaults("league", {
        scoring: "individual",
        placementPoints: [10, 7, 5, 3, 1],
      }),
    ).toEqual({
      bracketConfig: null,
      seriesConfig: null,
      bestScoreConfig: null,
      leagueConfig: { pairing: "round-robin", rounds: null },
      scoreDirection: "none",
      participationPoints: null,
      placementPoints: [10, 7, 5, 3, 1],
    });
  });

  it("keeps a Placement Competition's Placement Points", () => {
    expect(
      formatDefaults("placement", {
        scoring: "team",
        placementPoints: [9, 8, 7, 6, 5],
      }),
    ).toEqual({
      bracketConfig: null,
      seriesConfig: null,
      bestScoreConfig: null,
      leagueConfig: null,
      scoreDirection: "none",
      participationPoints: null,
      placementPoints: [9, 8, 7, 6, 5],
    });
  });
});
