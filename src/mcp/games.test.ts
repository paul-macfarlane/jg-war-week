import { describe, expect, it } from "vitest";

import { toGamesResult } from "@/mcp/games";
import type { GamesView } from "@/queries/games";

function baseView(
  overrides: Partial<GamesView["competition"]>,
): GamesView["competition"] {
  return {
    id: "c1",
    warWeekId: "w1",
    name: "Bouncy Pong",
    scoring: "individual",
    gameFormat: "head-to-head",
    config: { drawsAllowed: false, bestOf: 5 },
    entrantsOpen: true,
    loggingClosesAt: null,
    closed: false,
    placementPoints: null,
    selfEnroll: false,
    entrantLimit: null,
    enrollClosesAt: null,
    ...overrides,
  };
}

const LOGGED_AT = new Date("2026-02-24T18:30:00.000Z");

describe("toGamesResult", () => {
  it("returns found: false for an unknown Competition", () => {
    const result = toGamesResult(undefined, undefined, "Nonexistent");

    expect(result).toEqual({
      found: false,
      message: expect.stringContaining("Nonexistent"),
    });
  });

  it("returns games: null with a message for a non-games Competition", () => {
    const result = toGamesResult(
      { name: "Trivia", scoring: "team", format: "placement" },
      undefined,
      "Trivia",
    );

    expect(result).toEqual({
      found: true,
      competition: { name: "Trivia", scoring: "team", format: "placement" },
      games: null,
      message: expect.stringContaining(
        "isn't run as Head-to-head or Best score",
      ),
    });
  });

  it("points a participation Competition to get_participation", () => {
    expect(
      toGamesResult(
        { name: "Workout", scoring: "team", format: "participation" },
        undefined,
        "Workout",
      ),
    ).toMatchObject({
      found: true,
      games: null,
      message:
        "Workout isn't run as Head-to-head or Best score; it's run as Participation. Call get_participation instead.",
    });
  });

  it("serializes a head-to-head Competition's settings, leaderboard and Games", () => {
    const view: GamesView = {
      competition: baseView({ scoring: "individual" }),
      leaderboard: [
        {
          id: "p1",
          rank: 1,
          played: 2,
          wins: 2,
          losses: 0,
          draws: 0,
          best: null,
          total: null,
          name: "Ashley Schuliger",
          color: null,
          points: null,
        },
        {
          id: "p2",
          rank: 2,
          played: 2,
          wins: 0,
          losses: 2,
          draws: 0,
          best: null,
          total: null,
          name: "Sam Schantz",
          color: null,
          points: null,
        },
      ],
      games: [
        {
          id: "g1",
          loggedAt: LOGGED_AT,
          players: [
            {
              id: "p1",
              name: "Ashley Schuliger",
              color: null,
              place: 1,
              score: null,
            },
            {
              id: "p2",
              name: "Sam Schantz",
              color: null,
              place: 2,
              score: null,
            },
          ],
          canEdit: true,
          canDelete: true,
        },
      ],
      linked: null,
      runs: false,
      viewerCanLog: false,
      loggingOpen: true,
      bestOfDecided: false,
      bestOfWinner: null,
      entrantOptions: [],
    };

    const result = toGamesResult(
      { name: "Bouncy Pong", scoring: "individual", format: "head-to-head" },
      view,
      "Bouncy Pong",
    );

    expect(result).toEqual({
      found: true,
      competition: {
        name: "Bouncy Pong",
        scoring: "individual",
        format: "head-to-head",
        settings: "Head-to-head · draws off · Best of 5",
        entrants: "open to everyone",
        closed: false,
      },
      leaderboard: [
        {
          rank: 1,
          name: "Ashley Schuliger",
          played: 2,
          wins: 2,
          losses: 0,
          draws: 0,
        },
        {
          rank: 2,
          name: "Sam Schantz",
          played: 2,
          wins: 0,
          losses: 2,
          draws: 0,
        },
      ],
      games: [
        {
          loggedAt: LOGGED_AT.toISOString(),
          summary: "Ashley Schuliger beat Sam Schantz",
          players: [
            { name: "Ashley Schuliger", place: 1, score: null },
            { name: "Sam Schantz", place: 2, score: null },
          ],
        },
      ],
    });
  });

  it("serializes a best-score Competition counting the total, with a fixed Entrant list", () => {
    const view: GamesView = {
      competition: baseView({
        gameFormat: "best-score",
        config: { count: "total", betterIs: "higher", unit: "trips" },
        entrantsOpen: false,
      }),
      leaderboard: [
        {
          id: "p1",
          rank: 1,
          played: 1,
          wins: 0,
          losses: 0,
          draws: 0,
          best: 42,
          total: 42,
          name: "Alec Haring",
          color: null,
          points: null,
        },
      ],
      games: [
        {
          id: "g1",
          loggedAt: LOGGED_AT,
          players: [
            { id: "p1", name: "Alec Haring", color: null, place: 1, score: 42 },
          ],
          canEdit: false,
          canDelete: false,
        },
      ],
      linked: null,
      runs: false,
      viewerCanLog: false,
      loggingOpen: true,
      bestOfDecided: false,
      bestOfWinner: null,
      entrantOptions: [{ id: "p1", name: "Alec Haring", color: null }],
    };

    const result = toGamesResult(
      { name: "Beer Pong", scoring: "individual", format: "head-to-head" },
      view,
      "Beer Pong",
    );

    expect(result.found).toBe(true);
    if (!result.found || result.games === null) throw new Error("unreachable");
    expect(result.competition).toMatchObject({ format: "best-score" });
    expect(result.competition).not.toHaveProperty("gameFormat");
    expect(result.competition.settings).toBe(
      "Best score · total · higher is better · trips",
    );
    expect(result.competition.entrants).toEqual(["Alec Haring"]);
    expect(result.leaderboard).toEqual([
      { rank: 1, name: "Alec Haring", played: 1, total: 42 },
    ]);
    expect(result.games[0].summary).toBe("Alec Haring · 42 trips");
  });

  it("serializes only whitelisted keys, even when the view carries an email, loggedBy and canEdit", () => {
    const view = {
      competition: baseView({}),
      leaderboard: [
        {
          id: "p1",
          rank: 1,
          played: 1,
          wins: 1,
          losses: 0,
          draws: 0,
          best: null,
          total: null,
          name: "Ashley Schuliger",
          color: null,
          points: null,
        },
        {
          id: "p2",
          rank: 2,
          played: 1,
          wins: 0,
          losses: 1,
          draws: 0,
          best: null,
          total: null,
          name: "Sam Schantz",
          color: null,
          points: null,
        },
      ],
      games: [
        {
          id: "g1",
          loggedAt: LOGGED_AT,
          loggedByParticipantId: "p-reporter",
          loggedByEmail: "reporter@jahnelgroup.com",
          players: [
            {
              id: "p1",
              name: "Ashley Schuliger",
              color: null,
              place: 1,
              score: null,
              email: "ashley@jahnelgroup.com",
            },
            {
              id: "p2",
              name: "Sam Schantz",
              color: null,
              place: 2,
              score: null,
            },
          ],
          canEdit: true,
          canDelete: true,
        },
      ],
      linked: null,
      runs: true,
      viewerCanLog: true,
      loggingOpen: true,
      bestOfDecided: false,
      bestOfWinner: null,
      entrantOptions: [],
    } as unknown as GamesView;

    const result = toGamesResult(
      { name: "Bouncy Pong", scoring: "individual", format: "head-to-head" },
      view,
      "Bouncy Pong",
    );
    const serialized = JSON.stringify(result);

    expect(serialized).not.toContain("@");
    expect(serialized.toLowerCase()).not.toContain("email");
    expect(serialized.toLowerCase()).not.toContain("loggedby");
    expect(serialized.toLowerCase()).not.toContain("canedit");
    expect(serialized).not.toContain("reporter@jahnelgroup.com");
  });
});
