import { describe, expect, it } from "vitest";

import { toLoggedResultsAnswer } from "@/mcp/logged-results";
import type { LoggedResultsView } from "@/queries/logged-results";

function baseView(
  overrides: Partial<LoggedResultsView["competition"]>,
): LoggedResultsView["competition"] {
  return {
    id: "c1",
    warWeekId: "w1",
    name: "Bouncy Pong",
    scoring: "individual",
    format: "head-to-head",
    config: { drawsAllowed: false, bestOf: 5 },
    scoringConfig: { direction: "none", unit: null },
    selfReport: false,
    maxAttempts: null,
    closed: false,
    placementPoints: null,
    ...overrides,
  };
}

const LOGGED_AT = new Date("2026-02-24T18:30:00.000Z");

describe("toLoggedResultsAnswer", () => {
  it("returns found: false for an unknown Competition", () => {
    const result = toLoggedResultsAnswer(undefined, undefined, "Nonexistent");

    expect(result).toEqual({
      found: false,
      message: expect.stringContaining("Nonexistent"),
    });
  });

  it("returns matches: null and attempts: null with a message for a Competition run another way", () => {
    const result = toLoggedResultsAnswer(
      { name: "Trivia", scoring: "team", format: "placement" },
      undefined,
      "Trivia",
    );

    expect(result).toEqual({
      found: true,
      competition: { name: "Trivia", scoring: "team", format: "placement" },
      matches: null,
      attempts: null,
      message: expect.stringContaining(
        "isn't run as Head-to-head or Best score",
      ),
    });
  });

  it("points a participation Competition to get_participation", () => {
    expect(
      toLoggedResultsAnswer(
        { name: "Workout", scoring: "team", format: "participation" },
        undefined,
        "Workout",
      ),
    ).toMatchObject({
      found: true,
      matches: null,
      attempts: null,
      message:
        "Workout isn't run as Head-to-head or Best score; it's run as Participation. Call get_participation instead.",
    });
  });

  it("serializes a Head-to-head's settings, its two Entrants, standings and Matches", () => {
    const view: LoggedResultsView = {
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
      results: [
        {
          id: "g1",
          recordedAt: LOGGED_AT,
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
          creditedTo: null,
          canEdit: true,
          canDelete: true,
        },
      ],
      linked: null,
      runs: false,
      viewerCanLog: false,
      logOffer: null,
      attemptCounts: {},
      decided: false,
      seriesWinner: null,
      playerOptions: [
        { id: "p1", name: "Ashley Schuliger", color: null },
        { id: "p2", name: "Sam Schantz", color: null },
      ],
    };

    const result = toLoggedResultsAnswer(
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
        entrants: ["Ashley Schuliger", "Sam Schantz"],
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
      matches: [
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

  it("serializes a team Best score Competition's Sum of members, with no Best / Total count", () => {
    const view: LoggedResultsView = {
      competition: baseView({
        name: "Tuesday Stairs",
        scoring: "team",
        format: "best-score",
        config: {
          betterIs: "higher",
          unit: "trips",
          teamScore: "sum-of-members",
        },
      }),
      leaderboard: [
        {
          id: "t1",
          rank: 1,
          played: 2,
          wins: 0,
          losses: 0,
          draws: 0,
          best: null,
          total: 42,
          name: "Red",
          color: null,
          points: null,
        },
      ],
      results: [
        {
          id: "a1",
          recordedAt: LOGGED_AT,
          players: [
            {
              id: "p1",
              name: "Alec Haring",
              color: null,
              place: null,
              score: 42,
            },
          ],
          creditedTo: "t1",
          canEdit: false,
          canDelete: false,
        },
      ],
      linked: null,
      runs: false,
      viewerCanLog: false,
      logOffer: null,
      attemptCounts: {},
      decided: false,
      seriesWinner: null,
      playerOptions: [{ id: "p1", name: "Alec Haring", color: null }],
    };

    const result = toLoggedResultsAnswer(
      { name: "Tuesday Stairs", scoring: "team", format: "best-score" },
      view,
      "Tuesday Stairs",
    );

    expect(result.found).toBe(true);
    if (!result.found || !("attempts" in result) || result.attempts === null)
      throw new Error("unreachable");
    expect(result).not.toHaveProperty("matches");
    expect(result.competition).toMatchObject({ format: "best-score" });
    expect(result.competition.settings).toBe(
      "Best score · higher is better · trips · Team score: Sum of members",
    );
    expect(result.competition.entrants).toBe("open to everyone");
    expect(result.leaderboard).toEqual([
      { rank: 1, name: "Red", played: 2, total: 42 },
    ]);
    expect(result.attempts[0].summary).toBe("Alec Haring · 42 trips");
    expect(JSON.stringify(result)).not.toMatch(/"count"|best \/ total/i);
  });

  it("serializes an individual Best score's best Attempt", () => {
    const result = toLoggedResultsAnswer(
      { name: "Darts", scoring: "individual", format: "best-score" },
      {
        competition: baseView({
          name: "Darts",
          format: "best-score",
          config: { betterIs: "lower", unit: "", teamScore: "best-member" },
        }),
        leaderboard: [
          {
            id: "p1",
            rank: 1,
            played: 3,
            wins: 0,
            losses: 0,
            draws: 0,
            best: 7,
            total: null,
            name: "Ana",
            color: null,
            points: 5,
          },
        ],
        results: [],
        linked: null,
        runs: false,
        viewerCanLog: false,
        logOffer: null,
        attemptCounts: {},
        decided: false,
        seriesWinner: null,
        playerOptions: [],
      },
      "Darts",
    );
    if (!result.found || !("attempts" in result) || result.attempts === null)
      throw new Error("unreachable");
    expect(result.competition.settings).toBe("Best score · lower is better");
    expect(result.leaderboard).toEqual([
      { rank: 1, name: "Ana", played: 3, best: 7 },
    ]);
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
      results: [
        {
          id: "g1",
          recordedAt: LOGGED_AT,
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
          creditedTo: null,
          canEdit: true,
          canDelete: true,
        },
      ],
      linked: null,
      runs: true,
      viewerCanLog: true,
      logOffer: null,
      attemptCounts: {},
      decided: false,
      seriesWinner: null,
      playerOptions: [
        { id: "p1", name: "Ashley Schuliger", color: null },
        { id: "p2", name: "Sam Schantz", color: null },
      ],
    } as unknown as LoggedResultsView;

    const result = toLoggedResultsAnswer(
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
