import { describe, expect, it } from "vitest";

import { toPlacementsResult } from "@/mcp/placements";
import type { PlacementsView } from "@/queries/placements";

const CLOSED = new Date("2027-02-24T21:30:00.000Z");

function view(
  overrides: Partial<PlacementsView["competition"]> = {},
): PlacementsView {
  const row = {
    teamId: null,
    image: null,
    color: "#f00",
    seedKey: null,
  };
  return {
    entryPoints: [],
    competition: {
      id: "c1",
      warWeekId: "w1",
      name: "Darts",
      scoring: "individual",
      countsTowardTeam: true,
      placementPoints: [10, 6, 3],
      scoreDirection: "higher",
      scoreUnit: null,
      closedAt: CLOSED,
      ...overrides,
    },
    rows: [
      {
        ...row,
        id: "r1",
        participantId: "p1",
        name: "Neo",
        image: "https://example.com/neo.png",
        team: "Red",
        place: 1,
        score: 30,
        points: 10,
      },
      {
        ...row,
        id: "r2",
        participantId: "p2",
        name: "Trinity",
        team: "Blue",
        place: 1,
        score: 30,
        points: 10,
      },
      {
        ...row,
        id: "r3",
        participantId: "p3",
        name: "Tank",
        team: null,
        place: null,
        score: null,
        points: null,
      },
    ],
  };
}

describe("toPlacementsResult", () => {
  it("returns found: false for an unknown Competition", () => {
    expect(toPlacementsResult(undefined, undefined, "Nope")).toEqual({
      found: false,
      message: expect.stringContaining('"Nope"'),
    });
  });

  it("points a Competition run another way elsewhere", () => {
    expect(
      toPlacementsResult(
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
      placements: null,
      message:
        "Bouncy Pong isn't run as Placement; call get_games, get_bracket, get_participation or get_leaderboard.",
    });
  });

  it("serializes each row's place, name, Team, Score and points, and whether it's Closed", () => {
    expect(
      toPlacementsResult(
        { name: "Darts", scoring: "individual", format: "placement" },
        view(),
        "darts",
      ),
    ).toEqual({
      found: true,
      competition: {
        name: "Darts",
        scoring: "individual",
        scoreDirection: "higher wins",
        scoreUnit: null,
        placementPoints: [10, 6, 3],
        closed: true,
        closedAt: "2027-02-24T21:30:00.000Z",
      },
      placements: [
        { place: 1, name: "Neo", team: "Red", score: 30, points: 10 },
        { place: 1, name: "Trinity", team: "Blue", score: 30, points: 10 },
        { place: null, name: "Tank", team: null, score: null, points: null },
      ],
    });
  });

  it("names the Score unit", () => {
    expect(
      toPlacementsResult(
        { name: "Darts", scoring: "individual", format: "placement" },
        view({ scoreUnit: "sec", scoreDirection: "lower" }),
        "Darts",
      ),
    ).toMatchObject({
      competition: { scoreDirection: "lower wins", scoreUnit: "sec" },
    });
  });

  it("an open sheet without a Score direction reads as such", () => {
    expect(
      toPlacementsResult(
        { name: "Darts", scoring: "individual", format: "placement" },
        view({ closedAt: null, scoreDirection: "none" }),
        "Darts",
      ),
    ).toMatchObject({
      competition: {
        scoreDirection: "none",
        closed: false,
        closedAt: null,
      },
    });
  });

  it("carries no email, id or picture", () => {
    const text = JSON.stringify(
      toPlacementsResult(
        { name: "Darts", scoring: "individual", format: "placement" },
        view(),
        "Darts",
      ),
    );
    expect(text).not.toContain("@");
    expect(text).not.toContain("p1");
    expect(text).not.toContain("example.com");
  });
});
