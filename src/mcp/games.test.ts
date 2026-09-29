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
    gameType: "head-to-head",
    config: { drawsAllowed: false, bestOf: 5 },
    entrantsOpen: true,
    loggingClosesAt: null,
    closed: false,
    placementPoints: null,
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
      { name: "Trivia", scoring: "team", format: "points" },
      undefined,
      "Trivia",
    );

    expect(result).toEqual({
      found: true,
      competition: { name: "Trivia", scoring: "team", format: "points" },
      games: null,
      message: expect.stringContaining("isn't run as Games"),
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
          finishPoints: 0,
          name: "Ashley Schuliger",
          color: null,
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
          finishPoints: 0,
          name: "Sam Schantz",
          color: null,
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
      { name: "Bouncy Pong", scoring: "individual", format: "games" },
      view,
      "Bouncy Pong",
    );

    expect(result).toEqual({
      found: true,
      competition: {
        name: "Bouncy Pong",
        scoring: "individual",
        gameType: "head-to-head",
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
        gameType: "best-score",
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
          finishPoints: 0,
          name: "Alec Haring",
          color: null,
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
      { name: "Beer Pong", scoring: "individual", format: "games" },
      view,
      "Beer Pong",
    );

    expect(result.found).toBe(true);
    if (!result.found || result.games === null) throw new Error("unreachable");
    expect(result.competition.settings).toBe(
      "Best score · total · higher is better · trips",
    );
    expect(result.competition.entrants).toEqual(["Alec Haring"]);
    expect(result.leaderboard).toEqual([
      { rank: 1, name: "Alec Haring", played: 1, total: 42 },
    ]);
    expect(result.games[0].summary).toBe("Alec Haring · 42 trips");
  });

  it("serializes a ranked Competition with no configured Finish Points", () => {
    const view: GamesView = {
      competition: baseView({
        gameType: "ranked",
        config: { finishPoints: [] },
      }),
      leaderboard: [
        {
          id: "t1",
          rank: 1,
          played: 1,
          wins: 1,
          losses: 0,
          draws: 0,
          best: null,
          total: null,
          finishPoints: 2,
          name: "Red",
          color: "#f00",
        },
      ],
      games: [
        {
          id: "g1",
          loggedAt: LOGGED_AT,
          players: [
            { id: "t1", name: "Red", color: "#f00", place: 1, score: null },
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
      { name: "Trivia Scramble", scoring: "team", format: "games" },
      view,
      "Trivia Scramble",
    );

    expect(result.found).toBe(true);
    if (!result.found || result.games === null) throw new Error("unreachable");
    expect(result.competition.settings).toBe("Ranked · one per player beaten");
    expect(result.leaderboard).toEqual([
      { rank: 1, name: "Red", played: 1, wins: 1, finishPoints: 2 },
    ]);
  });

  it("serializes a ranked Competition's configured Finish Points", () => {
    const view: GamesView = {
      competition: baseView({
        gameType: "ranked",
        config: { finishPoints: [3, 2, 1] },
      }),
      leaderboard: [],
      games: [],
      linked: null,
      runs: false,
      viewerCanLog: false,
      loggingOpen: true,
      bestOfDecided: false,
      bestOfWinner: null,
      entrantOptions: [],
    };

    const result = toGamesResult(
      { name: "Board Games", scoring: "individual", format: "games" },
      view,
      "Board Games",
    );

    expect(result.found).toBe(true);
    if (!result.found || result.games === null) throw new Error("unreachable");
    expect(result.competition.settings).toBe("Ranked · Finish Points 3, 2, 1");
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
          finishPoints: 0,
          name: "Ashley Schuliger",
          color: null,
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
          finishPoints: 0,
          name: "Sam Schantz",
          color: null,
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
      { name: "Bouncy Pong", scoring: "individual", format: "games" },
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
