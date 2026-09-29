import { describe, expect, it } from "vitest";

import type {
  BestScoreConfig,
  HeadToHeadConfig,
  RankedConfig,
} from "@/lib/games/config";
import {
  type GameFact,
  bestOfWinner,
  isBestOfDecided,
  placingsOf,
  rankGames,
} from "@/lib/games/leaderboard";

const loggedAt = new Date("2027-02-20T12:00:00Z");

function h2h(a: string, aPlace: 1 | 2, b: string, bPlace: 1 | 2): GameFact {
  return {
    id: `${a}-${b}-${aPlace}-${bPlace}`,
    loggedAt,
    players: [
      { id: a, place: aPlace, score: null },
      { id: b, place: bPlace, score: null },
    ],
  };
}

describe("rankGames head-to-head", () => {
  const config: HeadToHeadConfig = { drawsAllowed: true, bestOf: null };

  it("ranks by most wins, ties sharing the higher rank; ticket 17 AC-1 (3-1-0 record)", () => {
    // Ashley: 3 wins, 1 loss, 0 draws against Sam.
    const games: GameFact[] = [
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 2, "sam", 1),
    ];
    const rows = rankGames("head-to-head", config, games, null);
    const ashley = rows.find((r) => r.id === "ashley")!;
    expect(ashley).toEqual({
      id: "ashley",
      rank: 1,
      played: 4,
      wins: 3,
      losses: 1,
      draws: 0,
      best: null,
      total: null,
      finishPoints: 0,
    });
    const sam = rows.find((r) => r.id === "sam")!;
    expect(sam.wins).toBe(1);
    expect(sam.losses).toBe(3);
    expect(sam.rank).toBe(2);
  });

  it("counts a draw as place 1 for both players and shares the rank", () => {
    const games: GameFact[] = [
      h2h("ashley", 1, "sam", 1),
      h2h("ashley", 1, "sam", 1),
    ];
    const rows = rankGames("head-to-head", config, games, null);
    const ashley = rows.find((r) => r.id === "ashley")!;
    const sam = rows.find((r) => r.id === "sam")!;
    expect(ashley.draws).toBe(2);
    expect(sam.draws).toBe(2);
    expect(ashley.wins).toBe(0);
    expect(ashley.rank).toBe(1);
    expect(sam.rank).toBe(1);
  });

  it("lists a fixed Entrant with no Game last, unranked", () => {
    const games: GameFact[] = [h2h("ashley", 1, "sam", 2)];
    const rows = rankGames("head-to-head", config, games, [
      "ashley",
      "sam",
      "casey",
    ]);
    expect(rows.map((r) => r.id)).toEqual(["ashley", "sam", "casey"]);
    const casey = rows.find((r) => r.id === "casey")!;
    expect(casey.rank).toBeNull();
    expect(casey.played).toBe(0);
  });
});

describe("rankGames best-score", () => {
  function score(id: string, value: number): GameFact {
    return {
      id: `${id}-${value}`,
      loggedAt,
      players: [{ id, place: null, score: value }],
    };
  }

  it("ranks best, higher is better", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "higher",
      unit: "",
    };
    const games: GameFact[] = [
      score("ashley", 10),
      score("ashley", 25),
      score("sam", 20),
    ];
    const rows = rankGames("best-score", config, games, null);
    const ashley = rows.find((r) => r.id === "ashley")!;
    expect(ashley.best).toBe(25);
    expect(ashley.rank).toBe(1);
    const sam = rows.find((r) => r.id === "sam")!;
    expect(sam.rank).toBe(2);
  });

  it("ranks total, lower is better", () => {
    const config: BestScoreConfig = {
      count: "total",
      betterIs: "lower",
      unit: "seconds",
    };
    const games: GameFact[] = [
      score("ashley", 10),
      score("ashley", 5),
      score("sam", 12),
    ];
    const rows = rankGames("best-score", config, games, null);
    const ashley = rows.find((r) => r.id === "ashley")!;
    expect(ashley.total).toBe(15);
    const sam = rows.find((r) => r.id === "sam")!;
    expect(sam.total).toBe(12);
    // Sam's lone total (12) beats Ashley's summed total (15) under "lower is better".
    expect(sam.rank).toBe(1);
    expect(ashley.rank).toBe(2);
  });
});

describe("rankGames ranked", () => {
  function ranked(players: { id: string; place: number }[]): GameFact {
    return {
      id: players.map((p) => p.id).join("-"),
      loggedAt,
      players: players.map((p) => ({ id: p.id, place: p.place, score: null })),
    };
  }

  it("sums Finish Points by the default table (one point per player beaten)", () => {
    const config: RankedConfig = { finishPoints: [] };
    const games: GameFact[] = [
      ranked([
        { id: "red", place: 1 },
        { id: "blue", place: 2 },
        { id: "green", place: 3 },
      ]),
    ];
    const rows = rankGames("ranked", config, games, null);
    const red = rows.find((r) => r.id === "red")!;
    expect(red.finishPoints).toBe(2);
    expect(red.wins).toBe(1);
    const green = rows.find((r) => r.id === "green")!;
    expect(green.finishPoints).toBe(0);
    expect(red.rank).toBe(1);
  });

  it("shares the higher finish for a tie within a Game (1, 1, 3)", () => {
    const config: RankedConfig = { finishPoints: [3, 2, 1] };
    const games: GameFact[] = [
      ranked([
        { id: "red", place: 1 },
        { id: "blue", place: 1 },
        { id: "green", place: 3 },
      ]),
    ];
    const rows = rankGames("ranked", config, games, null);
    const red = rows.find((r) => r.id === "red")!;
    const blue = rows.find((r) => r.id === "blue")!;
    const green = rows.find((r) => r.id === "green")!;
    expect(red.finishPoints).toBe(3);
    expect(blue.finishPoints).toBe(3);
    expect(green.finishPoints).toBe(1);
    expect(red.rank).toBe(1);
    expect(blue.rank).toBe(1);
    // Standard competition ranking: two tied for 1st, the next is 3rd, not 2nd.
    expect(green.rank).toBe(3);
  });
});

describe("placingsOf", () => {
  it("converts ranked rows to Placings, omitting unranked rows", () => {
    const rows = rankGames(
      "head-to-head",
      { drawsAllowed: false, bestOf: null } satisfies HeadToHeadConfig,
      [h2h("ashley", 1, "sam", 2)],
      ["ashley", "sam", "casey"],
    );
    expect(placingsOf(rows)).toEqual([
      { entrantId: "ashley", place: 1 },
      { entrantId: "sam", place: 2 },
    ]);
  });
});

describe("bestOfWinner / isBestOfDecided", () => {
  it("is null when Best of is off", () => {
    const config: HeadToHeadConfig = { drawsAllowed: false, bestOf: null };
    const games: GameFact[] = [h2h("ashley", 1, "sam", 2)];
    expect(bestOfWinner(config, games)).toBeNull();
    expect(isBestOfDecided(config, games)).toBe(false);
  });

  it("is undecided at 2-2 in a Best of 5 (majority is 3)", () => {
    const config: HeadToHeadConfig = { drawsAllowed: true, bestOf: 5 };
    const games: GameFact[] = [
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 2, "sam", 1),
      h2h("ashley", 2, "sam", 1),
    ];
    expect(bestOfWinner(config, games)).toBeNull();
    expect(isBestOfDecided(config, games)).toBe(false);
  });

  it("is decided the moment a side reaches a majority (3rd win of 5)", () => {
    const config: HeadToHeadConfig = { drawsAllowed: false, bestOf: 5 };
    const games: GameFact[] = [
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 1, "sam", 2),
      h2h("ashley", 1, "sam", 2),
    ];
    expect(bestOfWinner(config, games)).toBe("ashley");
    expect(isBestOfDecided(config, games)).toBe(true);
  });

  it("a draw counts for nobody", () => {
    const config: HeadToHeadConfig = { drawsAllowed: true, bestOf: 3 };
    const games: GameFact[] = [
      h2h("ashley", 1, "sam", 1),
      h2h("ashley", 1, "sam", 1),
    ];
    expect(bestOfWinner(config, games)).toBeNull();
    expect(isBestOfDecided(config, games)).toBe(false);
  });
});
