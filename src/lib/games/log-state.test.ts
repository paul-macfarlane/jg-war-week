import { describe, expect, it } from "vitest";

import type { GameFact } from "@/lib/games/leaderboard";
import { loggingStateOf } from "@/lib/games/log-state";

const CLOSES = new Date("2027-02-26T17:00:00Z");
const loggedAt = new Date("2027-02-22T12:00:00Z");

const win = (winner: string, loser: string, n: number): GameFact => ({
  id: `g${n}`,
  loggedAt,
  players: [
    { id: winner, place: 1, score: null },
    { id: loser, place: 2, score: null },
  ],
});

describe("loggingStateOf", () => {
  it("is open with no close time and no Best of", () => {
    expect(
      loggingStateOf({
        loggingClosesAt: null,
        bestOf: null,
        games: [],
        now: CLOSES,
      }),
    ).toEqual({ loggingOpen: true, bestOfDecided: false, winnerId: null });
  });

  it("is open just before the close time and closed at the instant", () => {
    const at = (now: Date) =>
      loggingStateOf({ loggingClosesAt: CLOSES, bestOf: null, games: [], now })
        .loggingOpen;
    expect(at(new Date("2027-02-26T16:59:59.999Z"))).toBe(true);
    expect(at(CLOSES)).toBe(false);
    expect(at(new Date("2027-02-26T17:00:00.001Z"))).toBe(false);
  });

  it("closes once a Best of is decided and names the winner", () => {
    const bestOf = { drawsAllowed: false, bestOf: 3 as const };
    expect(
      loggingStateOf({
        loggingClosesAt: null,
        bestOf,
        games: [win("ashley", "sam", 1)],
        now: loggedAt,
      }),
    ).toEqual({ loggingOpen: true, bestOfDecided: false, winnerId: null });
    expect(
      loggingStateOf({
        loggingClosesAt: null,
        bestOf,
        games: [win("ashley", "sam", 1), win("ashley", "sam", 2)],
        now: loggedAt,
      }),
    ).toEqual({ loggingOpen: false, bestOfDecided: true, winnerId: "ashley" });
  });
});
