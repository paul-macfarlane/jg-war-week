import { describe, expect, it } from "vitest";

import { toParticipationResult } from "@/mcp/participation";
import type { ParticipationView } from "@/queries/participation";

const CLOSES = new Date("2027-02-26T22:00:00.000Z");

function view(
  overrides: Partial<ParticipationView["competition"]> = {},
): ParticipationView {
  return {
    entryPoints: [],
    competition: {
      id: "c1",
      warWeekId: "w1",
      name: "Daily Workout Check-in",
      scoring: "team",
      placementPoints: [5, 3, 1],
      participationPoints: null,
      selfCheckIn: true,
      checkInClosesAt: CLOSES,
      closed: false,
      ...overrides,
    },
    tookPart: [
      {
        participantId: "p1",
        name: "Neo",
        image: "https://example.com/neo.png",
        teamId: "t-red",
        team: "Red",
        teamColor: "#f00",
        checkedIn: true,
      },
      {
        participantId: "p2",
        name: "Trinity",
        image: null,
        teamId: "t-blue",
        team: "Blue",
        teamColor: "#00f",
        checkedIn: false,
      },
    ],
    teamCounts: [
      { teamId: "t-blue", name: "Blue", color: "#00f", count: 1, place: 1 },
      { teamId: "t-red", name: "Red", color: "#f00", count: 1, place: 1 },
    ],
  };
}

describe("toParticipationResult", () => {
  it("returns found: false for an unknown Competition", () => {
    expect(toParticipationResult(undefined, undefined, "Nope")).toEqual({
      found: false,
      message: expect.stringContaining('"Nope"'),
    });
  });

  it("points a Competition run another way elsewhere", () => {
    expect(
      toParticipationResult(
        { name: "Bouncy Pong", scoring: "individual", format: "head-to-head" },
        undefined,
        "Bouncy Pong",
      ),
    ).toEqual({
      found: true,
      competition: {
        name: "Bouncy Pong",
        scoring: "individual",
        format: "head-to-head",
      },
      participation: null,
      message:
        "Bouncy Pong isn't run as Participation; call get_games, get_bracket or get_leaderboard.",
    });
  });

  it("serializes the settings, who took part and the team counts, by name", () => {
    expect(
      toParticipationResult(
        {
          name: "Daily Workout Check-in",
          scoring: "team",
          format: "participation",
        },
        view(),
        "daily workout check-in",
      ),
    ).toEqual({
      found: true,
      competition: {
        name: "Daily Workout Check-in",
        scoring: "team",
        teamScoring: "ranked by headcount",
        pointsPerParticipant: null,
        placementPoints: [5, 3, 1],
        selfCheckIn: true,
        checkInClosesAt: "2027-02-26T22:00:00.000Z",
        closed: false,
      },
      tookPart: [
        { name: "Neo", team: "Red", checkedIn: true },
        { name: "Trinity", team: "Blue", checkedIn: false },
      ],
      teamCounts: [
        { team: "Blue", count: 1, place: 1 },
        { team: "Red", count: 1, place: 1 },
      ],
    });
  });

  it("serializes an individual Competition without team counts", () => {
    const result = toParticipationResult(
      { name: "Spirit", scoring: "individual", format: "participation" },
      {
        ...view({
          name: "Spirit",
          scoring: "individual",
          participationPoints: 2,
          placementPoints: null,
          checkInClosesAt: null,
          closed: true,
        }),
        teamCounts: [],
      },
      "Spirit",
    );
    expect(result).toMatchObject({
      competition: {
        teamScoring: null,
        checkInClosesAt: null,
        closed: true,
      },
      teamCounts: [],
    });
  });

  it("never carries an email, an image or an id", () => {
    const text = JSON.stringify(
      toParticipationResult(
        {
          name: "Daily Workout Check-in",
          scoring: "team",
          format: "participation",
        },
        view(),
        "Daily Workout Check-in",
      ),
    );
    expect(text).not.toContain("@");
    expect(text).not.toContain("example.com");
    expect(text).not.toContain("p1");
    expect(text).not.toContain("t-red");
  });
});
