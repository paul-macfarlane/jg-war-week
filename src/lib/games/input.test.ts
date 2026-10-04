import { describe, expect, it } from "vitest";

import type { BestScoreConfig, HeadToHeadConfig } from "@/lib/games/config";
import { parseGameInput, postedGamePlayerIds } from "@/lib/games/input";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";

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

describe("postedGamePlayerIds", () => {
  it("reads only the player ids the Format's form posts", () => {
    expect(
      postedGamePlayerIds("head-to-head", {
        playerA: "a",
        playerB: "b",
        outcome: "a",
      }),
    ).toEqual(["a", "b"]);
    expect(
      postedGamePlayerIds("best-score", { player: "p", score: 4 }),
    ).toEqual(["p"]);
  });

  it("ignores another Format's keys", () => {
    expect(
      postedGamePlayerIds("head-to-head", {
        playerA: "a",
        playerB: "b",
        player: "me",
        order: [{ id: "me", place: 1 }],
      }),
    ).toEqual(["a", "b"]);
    expect(
      postedGamePlayerIds("best-score", { player: "p", playerA: "me" }),
    ).toEqual(["p"]);
  });

  it("ignores junk", () => {
    expect(postedGamePlayerIds("head-to-head", "junk")).toEqual([]);
    expect(
      postedGamePlayerIds("head-to-head", { playerA: 7, playerB: "" }),
    ).toEqual([]);
  });
});
