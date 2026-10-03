import { describe, expect, it } from "vitest";

import {
  type LedgerRow,
  buildCompetitionLedger,
  describeScoring,
  groupCompetitions,
  hasPlacementPoints,
  hostName,
  placementLabel,
  placementLimit,
  placementLimitRefusal,
  pointsForPlacement,
  setupHref,
  setupLinkLabel,
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

describe("buildCompetitionLedger", () => {
  const red = { name: "Red", color: "#ff3b3b" };
  const rows: LedgerRow[] = [
    {
      id: "e2",
      points: 1.5,
      note: null,
      enteredAt: new Date("2026-02-24T19:30:00-05:00"),
      team: null,
      participant: { displayName: "Neo", team: red },
    },
    {
      id: "e1",
      points: 3,
      note: "Won the final",
      enteredAt: new Date("2026-02-24T19:00:00-05:00"),
      team: red,
      participant: null,
    },
    {
      id: "e3",
      points: 1,
      note: null,
      enteredAt: new Date("2026-02-25T13:00:00-05:00"),
      team: null,
      participant: { displayName: "Trinity", team: null },
    },
  ];

  it("lists entries in the order they were entered, naming each target", () => {
    expect(buildCompetitionLedger({ rows })).toEqual({
      entries: [
        {
          id: "e1",
          target: { name: "Red", color: "#ff3b3b", team: null },
          points: 3,
          note: "Won the final",
        },
        {
          id: "e2",
          target: { name: "Neo", color: "#ff3b3b", team: "Red" },
          points: 1.5,
          note: null,
        },
        {
          id: "e3",
          target: { name: "Trinity", color: null, team: null },
          points: 1,
          note: null,
        },
      ],
    });
  });

  it("returns no entries for a Competition nobody has scored yet", () => {
    expect(buildCompetitionLedger({ rows: [] })).toEqual({ entries: [] });
  });

  it("keeps entries entered at the same moment in a stable order, by id", () => {
    const sameMoment = new Date("2026-02-24T19:00:00-05:00");
    const tied: LedgerRow[] = ["e-c", "e-a", "e-b"].map((id) => ({
      id,
      points: 1,
      note: null,
      enteredAt: sameMoment,
      team: red,
      participant: null,
    }));
    const order = (input: LedgerRow[]) =>
      buildCompetitionLedger({ rows: input }).entries.map((e) => e.id);

    expect(order(tied)).toEqual(["e-a", "e-b", "e-c"]);
    expect(order([...tied].reverse())).toEqual(["e-a", "e-b", "e-c"]);
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

describe("setupHref and setupLinkLabel", () => {
  it("point each Format at its own setup page", () => {
    expect(setupHref("head-to-head", "c1")).toBe(
      "/admin/competitions/c1/games",
    );
    expect(setupHref("best-score", "c1")).toBe("/admin/competitions/c1/games");
    expect(setupHref("participation", "c1")).toBe(
      "/admin/competitions/c1/participation",
    );
    expect(setupHref("heats", "c1")).toBe("/admin/competitions/c1/bracket");
    expect(setupHref("placement", "c1")).toBe("/admin/competitions/c1/bracket");
  });

  it("label the link by Format", () => {
    expect(setupLinkLabel("participation")).toBe("Who took part");
    expect(setupLinkLabel("head-to-head")).toBe("Entrants and Games");
    expect(setupLinkLabel("best-score")).toBe("Entrants and Games");
    expect(setupLinkLabel("placement")).toBe("Run as a Bracket");
    expect(setupLinkLabel("heats")).toBe("Bracket");
  });
});

describe("placementLimit and placementLimitRefusal", () => {
  const places = (n: number) => Array.from({ length: n }, (_, i) => n - i);

  it("limits Brackets to 5 places and every other Format to none", () => {
    expect(placementLimit("single-elimination")).toBe(5);
    expect(placementLimit("heats")).toBe(5);
    for (const format of [
      "placement",
      "head-to-head",
      "best-score",
      "participation",
    ] as const) {
      expect(placementLimit(format)).toBeNull();
    }
  });

  it("accepts 12 places for Placement and refuses 6 for a Bracket", () => {
    expect(placementLimitRefusal("placement", places(12))).toBeNull();
    expect(placementLimitRefusal("heats", places(5))).toBeNull();
    expect(placementLimitRefusal("heats", places(6))).toBe(
      "Placement Points cover at most 5 places for this Format.",
    );
    expect(placementLimitRefusal("single-elimination", places(6))).toMatch(
      /at most 5 places/,
    );
    expect(placementLimitRefusal("heats", null)).toBeNull();
  });
});
