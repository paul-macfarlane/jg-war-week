import { describe, expect, it } from "vitest";

import type {
  BestScoreConfig,
  HeadToHeadConfig,
  RankedConfig,
} from "@/lib/games/config";
import {
  parseGameInput,
  parseGamesSettingsInput,
  postedGamePlayerIds,
} from "@/lib/games/input";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

describe("parseGameInput head-to-head", () => {
  const config: HeadToHeadConfig = { drawsAllowed: false, bestOf: null };

  it("parses a win into places 1/2", () => {
    const result = parseGameInput("head-to-head", config, {
      playerA: A,
      playerB: B,
      outcome: "a",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: null },
          { id: B, place: 2, score: null },
        ],
      },
    });
  });

  it("parses the other side winning into places 2/1", () => {
    const result = parseGameInput("head-to-head", config, {
      playerA: A,
      playerB: B,
      outcome: "b",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 2, score: null },
          { id: B, place: 1, score: null },
        ],
      },
    });
  });

  it("refuses the same player twice", () => {
    const result = parseGameInput("head-to-head", config, {
      playerA: A,
      playerB: A,
      outcome: "a",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Choose two different players.");
  });

  it("refuses a draw when Draws aren't allowed", () => {
    const result = parseGameInput("head-to-head", config, {
      playerA: A,
      playerB: B,
      outcome: "draw",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Draws aren't allowed in this Competition.");
    }
  });

  it("parses a draw into places 1/1 when allowed", () => {
    const result = parseGameInput(
      "head-to-head",
      { drawsAllowed: true, bestOf: null },
      { playerA: A, playerB: B, outcome: "draw" },
    );
    expect(result).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: null },
          { id: B, place: 1, score: null },
        ],
      },
    });
  });
});

describe("parseGameInput best-score", () => {
  const config: BestScoreConfig = {
    count: "best",
    betterIs: "higher",
    unit: "trips",
  };

  it("parses a player and a score", () => {
    const result = parseGameInput("best-score", config, {
      player: A,
      score: 42,
    });
    expect(result).toEqual({
      ok: true,
      value: { players: [{ id: A, place: null, score: 42 }] },
    });
  });

  it("accepts a numeric string with 2 decimals", () => {
    const result = parseGameInput("best-score", config, {
      player: A,
      score: "42.42",
    });
    expect(result).toEqual({
      ok: true,
      value: { players: [{ id: A, place: null, score: 42.42 }] },
    });
  });

  it("refuses a missing score", () => {
    const result = parseGameInput("best-score", config, {
      player: A,
      score: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Enter a score.");
  });

  it("refuses more than 2 decimal places", () => {
    const result = parseGameInput("best-score", config, {
      player: A,
      score: "1.234",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("A score has at most 2 decimal places.");
    }
  });
});

describe("parseGameInput ranked", () => {
  const config: RankedConfig = { finishPoints: [] };

  it("normalizes places to standard competition ranking", () => {
    const result = parseGameInput("ranked", config, {
      order: [
        { id: A, place: 1 },
        { id: B, place: 1 },
        { id: C, place: 3 },
      ],
    });
    expect(result).toEqual({
      ok: true,
      value: {
        players: [
          { id: A, place: 1, score: null },
          { id: B, place: 1, score: null },
          { id: C, place: 3, score: null },
        ],
      },
    });
  });

  it("refuses fewer than two players", () => {
    const result = parseGameInput("ranked", config, {
      order: [{ id: A, place: 1 }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("List at least two players.");
  });

  it("refuses a repeated id", () => {
    const result = parseGameInput("ranked", config, {
      order: [
        { id: A, place: 1 },
        { id: A, place: 2 },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("List at least two players.");
  });
});

describe("parseGamesSettingsInput", () => {
  it("parses head-to-head settings with Best of and finish times", () => {
    const result = parseGamesSettingsInput({
      gameType: "head-to-head",
      drawsAllowed: true,
      bestOf: "5",
      entrantsOpen: true,
      loggingClosesAt: "2027-02-22T19:00:00.000Z",
      selfEnroll: false,
      entrantLimit: "",
      enrollClosesAt: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        gameConfig: { drawsAllowed: true, bestOf: 5 },
        entrantsOpen: true,
        loggingClosesAt: new Date("2027-02-22T19:00:00.000Z"),
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
    });
  });

  it("defaults Best of off and reads an empty finishPoints string as the default table", () => {
    const result = parseGamesSettingsInput({
      gameType: "ranked",
      finishPoints: "",
      entrantsOpen: false,
      loggingClosesAt: "",
      selfEnroll: true,
      entrantLimit: 4,
      enrollClosesAt: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        gameConfig: { finishPoints: [] },
        entrantsOpen: false,
        loggingClosesAt: null,
        selfEnroll: true,
        entrantLimit: 4,
        enrollClosesAt: null,
      },
    });
  });

  it("parses a comma/whitespace-separated Finish Points string", () => {
    const result = parseGamesSettingsInput({
      gameType: "ranked",
      finishPoints: "5, 3 1",
      entrantsOpen: true,
      loggingClosesAt: "",
      selfEnroll: false,
      entrantLimit: "",
      enrollClosesAt: "",
    });
    expect(result).toEqual({
      ok: true,
      value: {
        gameConfig: { finishPoints: [5, 3, 1] },
        entrantsOpen: true,
        loggingClosesAt: null,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
    });
  });

  it("refuses an Entrant limit of 1", () => {
    const result = parseGamesSettingsInput({
      gameType: "best-score",
      count: "best",
      betterIs: "higher",
      unit: "",
      entrantsOpen: true,
      loggingClosesAt: "",
      selfEnroll: true,
      entrantLimit: 1,
      enrollClosesAt: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.error).toBe("An Entrant limit is at least 2.");
  });

  it("refuses an unknown Game Type", () => {
    const result = parseGamesSettingsInput({ gameType: "not-a-type" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("Choose a Game Type.");
  });
});

describe("postedGamePlayerIds", () => {
  it("reads the player ids each Game Type's form posts, ignoring anything else", () => {
    expect(
      postedGamePlayerIds({ playerA: "a", playerB: "b", outcome: "a" }),
    ).toEqual(["a", "b"]);
    expect(postedGamePlayerIds({ player: "p", score: 4 })).toEqual(["p"]);
    expect(
      postedGamePlayerIds({ order: [{ id: "x", place: 1 }, { id: "y" }, 3] }),
    ).toEqual(["x", "y"]);
    expect(postedGamePlayerIds("junk")).toEqual([]);
    expect(postedGamePlayerIds({ playerA: 7, player: "" })).toEqual([]);
  });
});
