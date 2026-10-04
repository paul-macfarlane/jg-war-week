import { describe, expect, it } from "vitest";

import type { GameFact } from "@/lib/games/leaderboard";
import {
  type Series,
  attemptsLabel,
  formatScore,
  gameSummary,
  isMine,
  leaderboardColumns,
  placementPointsList,
  recordLabel,
  seriesNote,
  seriesOf,
} from "@/lib/games/view";

describe("leaderboardColumns", () => {
  it("head-to-head: Played, W, L, D", () => {
    expect(
      leaderboardColumns("head-to-head", { drawsAllowed: false, bestOf: null }),
    ).toEqual([
      { key: "played", label: "Played" },
      { key: "wins", label: "W" },
      { key: "losses", label: "L" },
      { key: "draws", label: "D" },
    ]);
  });

  it("best-score: Best (unit), Played", () => {
    expect(
      leaderboardColumns("best-score", {
        count: "best",
        betterIs: "higher",
        unit: "trips",
      }),
    ).toEqual([
      { key: "best", label: "Best (trips)" },
      { key: "played", label: "Played" },
    ]);
  });

  it("best-score: Total with no unit label when none is set", () => {
    expect(
      leaderboardColumns("best-score", {
        count: "total",
        betterIs: "lower",
        unit: "",
      }),
    ).toEqual([
      { key: "total", label: "Total" },
      { key: "played", label: "Played" },
    ]);
  });
});

describe("recordLabel", () => {
  it("formats wins-losses-draws like 3-1-0", () => {
    expect(recordLabel({ wins: 3, losses: 1, draws: 0 })).toBe("3–1–0");
  });
});

describe("formatScore", () => {
  it("appends the unit", () => {
    expect(formatScore(42, "trips")).toBe("42 trips");
  });

  it("omits the unit when there is none", () => {
    expect(formatScore(42, "")).toBe("42");
  });

  it("shows an em dash for no score", () => {
    expect(formatScore(null, "trips")).toBe("—");
  });
});

describe("gameSummary", () => {
  it("head-to-head: 'Ashley beat Sam'", () => {
    const summary = gameSummary("head-to-head", [
      { name: "Ashley", place: 1, score: null },
      { name: "Sam", place: 2, score: null },
    ]);
    expect(summary).toBe("Ashley beat Sam");
  });

  it("head-to-head: a draw", () => {
    const summary = gameSummary("head-to-head", [
      { name: "Ashley", place: 1, score: null },
      { name: "Sam", place: 1, score: null },
    ]);
    expect(summary).toBe("Ashley and Sam drew");
  });

  it("best-score: 'Ashley · 42 trips'", () => {
    const summary = gameSummary(
      "best-score",
      [{ name: "Ashley", place: null, score: 42 }],
      "trips",
    );
    expect(summary).toBe("Ashley · 42 trips");
  });
});

describe("isMine", () => {
  const linked = { participantId: "p1", teamId: "t1" };

  it("matches a player by Participant id", () => {
    expect(isMine([{ id: "p1" }, { id: "other" }], linked)).toBe(true);
  });

  it("matches a player by Team id", () => {
    expect(isMine([{ id: "t1" }], linked)).toBe(true);
  });

  it("is false when neither id appears", () => {
    expect(isMine([{ id: "other" }], linked)).toBe(false);
  });

  it("does not match a Team id when the linked Participant has none", () => {
    expect(isMine([{ id: "t1" }], { participantId: "p1", teamId: null })).toBe(
      false,
    );
  });
});

describe("placementPointsList", () => {
  it("lists the Placement Points in order", () => {
    expect(placementPointsList([3, 2, 1])).toBe("3, 2, 1");
  });

  it("says none set when there are none", () => {
    expect(placementPointsList(null)).toBe("none set");
    expect(placementPointsList([])).toBe("none set");
  });
});

describe("attemptsLabel (spec R20, decision 4)", () => {
  it("best mode counts the other Attempts", () => {
    expect(attemptsLabel(2, "best")).toBe("2 more attempts");
    expect(attemptsLabel(1, "best")).toBe("1 more attempt");
  });

  it("total mode counts every Attempt", () => {
    expect(attemptsLabel(3, "total")).toBe("3 attempts");
    expect(attemptsLabel(1, "total")).toBe("1 attempt");
  });
});

describe("seriesOf (spec R20, decision 7)", () => {
  let minute = 0;
  function match(
    id: string,
    a: { place: number; score?: number },
    b: { place: number; score?: number },
  ): GameFact {
    minute += 1;
    return {
      id,
      loggedAt: new Date(Date.UTC(2027, 1, 20, 12, minute)),
      players: [
        { id: "ashley", place: a.place, score: a.score ?? null },
        { id: "sam", place: b.place, score: b.score ?? null },
      ],
    };
  }
  const m1 = match("m1", { place: 1, score: 21 }, { place: 2, score: 15 });
  const m2 = match("m2", { place: 2, score: 18 }, { place: 1, score: 21 });
  const m3 = match("m3", { place: 1 }, { place: 1 });
  const m4 = match("m4", { place: 1, score: 21 }, { place: 2, score: 9 });
  const pair: [string, string] = ["ashley", "sam"];

  it("lists the Matches oldest first, each with its Winner or a draw, and the score 2–1", () => {
    const series = seriesOf(
      { drawsAllowed: true, bestOf: null },
      [m4, m3, m2, m1],
      pair,
      false,
    );
    expect(series.matches).toEqual([
      { id: "m1", winner: "ashley" },
      { id: "m2", winner: "sam" },
      { id: "m3", winner: "draw" },
      { id: "m4", winner: "ashley" },
    ]);
    expect(series.wins).toEqual([2, 1]);
    expect(series.draws).toBe(1);
    expect(series.score).toBe("2–1");
    // No Best of and not Closed: nobody has won the series yet.
    expect(series.winner).toBeNull();
  });

  it("a Best of 3 has its Winner the moment one side has 2 wins", () => {
    const config = { drawsAllowed: false, bestOf: 3 } as const;
    expect(seriesOf(config, [m1, m2], pair, false).winner).toBeNull();
    expect(seriesOf(config, [m1, m2, m4], pair, false).winner).toBe("ashley");
  });

  it("once Closed the side with more wins is the Winner; level is no Winner", () => {
    const config = { drawsAllowed: true, bestOf: null } as const;
    expect(seriesOf(config, [m1, m2, m4], pair, true).winner).toBe("ashley");
    expect(seriesOf(config, [m1, m2], pair, true).winner).toBeNull();
  });

  it("with no Match the score is 0–0", () => {
    const series = seriesOf(
      { drawsAllowed: false, bestOf: 3 },
      [],
      pair,
      false,
    );
    expect(series).toEqual({
      matches: [],
      wins: [0, 0],
      draws: 0,
      score: "0–0",
      winner: null,
    });
  });
});

describe("seriesNote (spec R20, decision 7)", () => {
  const series: Series = {
    matches: [],
    wins: [1, 1],
    draws: 0,
    score: "1–1",
    winner: null,
  };

  it("says nothing once the series has a Winner", () => {
    expect(
      seriesNote(
        { drawsAllowed: false, bestOf: 3 },
        { ...series, winner: "ashley" },
        false,
      ),
    ).toBeNull();
  });

  it("names the Best of while it is open", () => {
    expect(seriesNote({ drawsAllowed: false, bestOf: 3 }, series, false)).toBe(
      "Best of 3: first to 2 wins.",
    );
  });

  it("with no Best of, the Winner is decided at Close", () => {
    expect(
      seriesNote({ drawsAllowed: true, bestOf: null }, series, false),
    ).toBe("The series Winner is decided at Close.");
  });

  it("Closed level, with or without a Best of, has no series Winner", () => {
    expect(seriesNote({ drawsAllowed: true, bestOf: null }, series, true)).toBe(
      "Closed level: no series Winner.",
    );
    expect(seriesNote({ drawsAllowed: false, bestOf: 5 }, series, true)).toBe(
      "Closed level: no series Winner.",
    );
  });
});
