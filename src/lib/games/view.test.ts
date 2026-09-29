import { describe, expect, it } from "vitest";

import {
  formatScore,
  gameSummary,
  isMine,
  leaderboardColumns,
  placementPointsList,
  recordLabel,
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

  it("ranked: Finish Points, Played, Wins", () => {
    expect(leaderboardColumns("ranked", { finishPoints: [] })).toEqual([
      { key: "finishPoints", label: "Finish Points" },
      { key: "played", label: "Played" },
      { key: "wins", label: "Wins" },
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

  it("ranked: '1. Red 2. Blue 3. Green'", () => {
    const summary = gameSummary("ranked", [
      { name: "Blue", place: 2, score: null },
      { name: "Green", place: 3, score: null },
      { name: "Red", place: 1, score: null },
    ]);
    expect(summary).toBe("1. Red 2. Blue 3. Green");
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
