import { describe, expect, it } from "vitest";

import {
  competitionPageHref,
  describeScoring,
  groupCompetitions,
  hasPlacementPoints,
  hostName,
  placementLabel,
  placementLimit,
  placementLimitRefusal,
  pointsForPlacement,
} from "@/lib/competitions";

function competition(
  name: string,
  competitionGroup: string | null = null,
): { name: string; competitionGroup: string | null } {
  return { name, competitionGroup };
}

describe("groupCompetitions", () => {
  it("returns no groups and no ungrouped Competitions for an empty list", () => {
    expect(groupCompetitions([])).toEqual({ groups: [], ungrouped: [] });
  });

  it("groups by Competition Group, ordering groups and Competitions by name", () => {
    const result = groupCompetitions([
      competition("Cypher", "Night Games"),
      competition("HQ Attendance", "Before the Week"),
      competition("Black Midnight"),
      competition("Deja Vu", "Night Games"),
      competition("AI Survey Completion", "Before the Week"),
      competition("Beyblades"),
    ]);

    expect(result.groups).toEqual([
      {
        name: "Before the Week",
        competitions: [
          competition("AI Survey Completion", "Before the Week"),
          competition("HQ Attendance", "Before the Week"),
        ],
      },
      {
        name: "Night Games",
        competitions: [
          competition("Cypher", "Night Games"),
          competition("Deja Vu", "Night Games"),
        ],
      },
    ]);
    expect(result.ungrouped).toEqual([
      competition("Beyblades"),
      competition("Black Midnight"),
    ]);
  });

  it("lists every Competition as ungrouped when none has a group", () => {
    const result = groupCompetitions([
      competition("Pool"),
      competition("Chess"),
    ]);
    expect(result.groups).toEqual([]);
    expect(result.ungrouped.map((c) => c.name)).toEqual(["Chess", "Pool"]);
  });
});

describe("describeScoring", () => {
  it.each([
    [{ scoring: "team", countsTowardTeam: false }, "Team"],
    [{ scoring: "individual", countsTowardTeam: false }, "Individual"],
    [
      { scoring: "individual", countsTowardTeam: true },
      "Individual · counts toward House",
    ],
  ] as const)("describes %o as %s", (c, expected) => {
    expect(describeScoring(c, "House")).toBe(expected);
  });
});

describe("pointsForPlacement", () => {
  const cup = { placementPoints: [5, 3, 1] };

  it("returns the points for each place, 1st first", () => {
    expect(pointsForPlacement(cup, 1)).toBe(5);
    expect(pointsForPlacement(cup, 2)).toBe(3);
    expect(pointsForPlacement(cup, 3)).toBe(1);
  });

  it("returns null for a place past the presets", () => {
    expect(pointsForPlacement(cup, 4)).toBeNull();
  });

  it("returns null for a place below 1 or not a whole number", () => {
    expect(pointsForPlacement(cup, 0)).toBeNull();
    expect(pointsForPlacement(cup, 1.5)).toBeNull();
  });

  it("returns null when the Competition has no presets", () => {
    expect(pointsForPlacement({ placementPoints: null }, 1)).toBeNull();
  });
});

describe("hasPlacementPoints", () => {
  it("is true when at least one place has points", () => {
    expect(hasPlacementPoints([5, 3, 1])).toBe(true);
    expect(hasPlacementPoints([0])).toBe(true);
  });

  it("is false with no Placement Points or an empty list", () => {
    expect(hasPlacementPoints(null)).toBe(false);
    expect(hasPlacementPoints([])).toBe(false);
  });
});

describe("placementLabel", () => {
  it("names places as ordinals", () => {
    expect([1, 2, 3, 4, 5].map(placementLabel)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "5th",
    ]);
  });
});

describe("hostName", () => {
  const profiles = new Map([
    [
      "host@jahnelgroup.com",
      { profileName: "Hosty", profileImage: null, googleImage: null },
    ],
    [
      "plain@jahnelgroup.com",
      { profileName: null, profileImage: null, googleImage: null },
    ],
  ]);

  it("shows the Profile name, matching the email in any case", () => {
    expect(hostName("Host@JahnelGroup.com", profiles)).toBe("Hosty");
  });

  it("shows the email with no Profile name or no Profile", () => {
    expect(hostName("plain@jahnelgroup.com", profiles)).toBe(
      "plain@jahnelgroup.com",
    );
    expect(hostName("new@jahnelgroup.com", profiles)).toBe(
      "new@jahnelgroup.com",
    );
  });
});

describe("competitionPageHref", () => {
  it("opens the Competition's one admin page, whatever its Format", () => {
    expect(competitionPageHref("c1")).toBe("/admin/competitions/c1");
  });
});

describe("placementLimit and placementLimitRefusal", () => {
  const places = (n: number) => Array.from({ length: n }, (_, i) => n - i);

  it("limits Brackets to 4 places and every other Format to none", () => {
    expect(placementLimit("bracket")).toBe(4);
    for (const format of [
      "placement",
      "head-to-head",
      "best-score",
      "participation",
    ] as const) {
      expect(placementLimit(format)).toBeNull();
    }
  });

  it("accepts 12 places for Placement and refuses 5 for a Bracket", () => {
    expect(placementLimitRefusal("placement", places(12))).toBeNull();
    expect(placementLimitRefusal("bracket", places(4))).toBeNull();
    expect(placementLimitRefusal("bracket", places(5))).toBe(
      "Placement Points cover at most 4 places for this Format.",
    );
    expect(placementLimitRefusal("bracket", null)).toBeNull();
  });
});
