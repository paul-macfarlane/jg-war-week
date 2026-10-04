import { describe, expect, it } from "vitest";

import type { BestScoreConfig, HeadToHeadConfig } from "@/lib/games/config";
import {
  type GameFact,
  attemptsOf,
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

  it("ranks best, lower is better", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "lower",
      unit: "seconds",
    };
    const games: GameFact[] = [
      score("ashley", 30),
      score("ashley", 18),
      score("sam", 20),
    ];
    const rows = rankGames("best-score", config, games, null);
    expect(rows.map((r) => ({ id: r.id, best: r.best, rank: r.rank }))).toEqual(
      [
        { id: "ashley", best: 18, rank: 1 },
        { id: "sam", best: 20, rank: 2 },
      ],
    );
  });

  it("ranks total, higher is better", () => {
    const config: BestScoreConfig = {
      count: "total",
      betterIs: "higher",
      unit: "trips",
    };
    const games: GameFact[] = [
      score("ashley", 10),
      score("ashley", 5),
      score("sam", 12),
    ];
    const rows = rankGames("best-score", config, games, null);
    expect(
      rows.map((r) => ({ id: r.id, total: r.total, rank: r.rank })),
    ).toEqual([
      { id: "ashley", total: 15, rank: 1 },
      { id: "sam", total: 12, rank: 2 },
    ]);
  });

  it("shares the higher rank for a best-score tie", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "higher",
      unit: "",
    };
    const games: GameFact[] = [
      score("ashley", 25),
      score("sam", 25),
      score("kim", 10),
    ];
    const rows = rankGames("best-score", config, games, null);
    const rankOf = (id: string) => rows.find((r) => r.id === id)!.rank;
    expect(rankOf("ashley")).toBe(1);
    expect(rankOf("sam")).toBe(1);
    expect(rankOf("kim")).toBe(3);
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

describe("attemptsOf (spec R20, decision 4)", () => {
  function attempt(
    id: string,
    who: string,
    value: number,
    at: string,
  ): GameFact {
    return {
      id,
      loggedAt: new Date(at),
      players: [{ id: who, place: null, score: value }],
    };
  }
  // Ashley has three Attempts (12, 30, 18), Sam one (25); newest last here.
  const games: GameFact[] = [
    attempt("a1", "ashley", 12, "2027-02-20T10:00:00Z"),
    attempt("s1", "sam", 25, "2027-02-20T10:30:00Z"),
    attempt("a2", "ashley", 30, "2027-02-20T11:00:00Z"),
    attempt("a3", "ashley", 18, "2027-02-20T12:00:00Z"),
  ];

  it("a person with three Attempts holds one place: their best, the other two listed newest first", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "higher",
      unit: "",
    };
    const rows = rankGames("best-score", config, games, null);
    expect(rows.map((r) => [r.id, r.rank, r.best])).toEqual([
      ["ashley", 1, 30],
      ["sam", 2, 25],
    ]);
    const byPlayer = attemptsOf(config, games);
    expect(byPlayer.get("ashley")).toEqual({
      best: "a2",
      attempts: ["a3", "a2", "a1"],
    });
    expect(byPlayer.get("sam")).toEqual({ best: "s1", attempts: ["s1"] });
  });

  it("lower is better: the best is the lowest Score", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "lower",
      unit: "s",
    };
    expect(attemptsOf(config, games).get("ashley")?.best).toBe("a1");
  });

  it("a tie for best goes to the earlier Attempt", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "higher",
      unit: "",
    };
    const tied = [
      attempt("late", "kim", 40, "2027-02-21T09:00:00Z"),
      attempt("early", "kim", 40, "2027-02-20T09:00:00Z"),
    ];
    expect(attemptsOf(config, tied).get("kim")).toEqual({
      best: "early",
      attempts: ["late", "early"],
    });
  });

  it("total mode: the row is the sum (12 + 30 + 18 = 60) and every Attempt makes it up", () => {
    const config: BestScoreConfig = {
      count: "total",
      betterIs: "higher",
      unit: "",
    };
    const rows = rankGames("best-score", config, games, null);
    expect(rows.find((r) => r.id === "ashley")?.total).toBe(60);
    expect(rows.filter((r) => r.id === "ashley")).toHaveLength(1);
    expect(attemptsOf(config, games).get("ashley")?.attempts).toEqual([
      "a3",
      "a2",
      "a1",
    ]);
  });

  it("an Attempt with no Score is not one", () => {
    const config: BestScoreConfig = {
      count: "best",
      betterIs: "higher",
      unit: "",
    };
    const blank: GameFact = {
      id: "x",
      loggedAt: new Date("2027-02-20T13:00:00Z"),
      players: [{ id: "ashley", place: null, score: null }],
    };
    expect(
      attemptsOf(config, [...games, blank]).get("ashley")?.attempts,
    ).toEqual(["a3", "a2", "a1"]);
  });
});
