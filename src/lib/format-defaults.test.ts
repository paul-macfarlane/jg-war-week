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
        entrantsPerHeat: 2,
        advancePerHeat: 1,
        thirdPlaceGame: false,
      },
      gameConfig: null,
      entrantsOpen: false,
      participationPoints: null,
      placementPoints: [10, 7, 5, 3],
    });
    const fours = {
      entrantsPerHeat: 4,
      advancePerHeat: 2,
      thirdPlaceGame: false,
    };
    expect(
      formatDefaults(
        "bracket",
        { scoring: "team", placementPoints: null },
        fours,
      ),
    ).toMatchObject({ bracketConfig: fours, placementPoints: null });
  });

  it("opens a Head-to-head or Best score Competition to everyone with its default settings", () => {
    expect(
      formatDefaults("head-to-head", {
        scoring: "individual",
        placementPoints: [3, 2, 1],
      }),
    ).toEqual({
      bracketConfig: null,
      gameConfig: { drawsAllowed: false, bestOf: null },
      entrantsOpen: true,
      participationPoints: null,
      placementPoints: [3, 2, 1],
    });
    expect(
      formatDefaults("best-score", {
        scoring: "individual",
        placementPoints: null,
      }),
    ).toMatchObject({
      gameConfig: { count: "best", betterIs: "higher", unit: "" },
      entrantsOpen: true,
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

  it("keeps a Placement Competition's Placement Points", () => {
    expect(
      formatDefaults("placement", {
        scoring: "team",
        placementPoints: [9, 8, 7, 6, 5],
      }),
    ).toEqual({
      bracketConfig: null,
      gameConfig: null,
      entrantsOpen: false,
      participationPoints: null,
      placementPoints: [9, 8, 7, 6, 5],
    });
  });
});
