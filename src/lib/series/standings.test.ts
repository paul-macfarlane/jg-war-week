import { describe, expect, it } from "vitest";

import type { ResultFact } from "@/lib/logged-results";
import {
  bestOfWinner,
  matchSummary,
  rankSeries,
  recordLabel,
  seriesDrawn,
  seriesNote,
  seriesOf,
} from "@/lib/series/standings";

const at = (minute: number) => new Date(Date.UTC(2027, 1, 22, 12, minute));

let n = 0;
function match(
  first: [string, number],
  second: [string, number],
  minute = n,
): ResultFact {
  n += 1;
  return {
    id: `m${n}`,
    recordedAt: at(minute),
    players: [
      { id: first[0], place: first[1], score: null },
      { id: second[0], place: second[1], score: null },
    ],
  };
}
const beat = (winner: string, loser: string, minute?: number) =>
  match([winner, 1], [loser, 2], minute);
const drew = (a: string, b: string, minute?: number) =>
  match([a, 1], [b, 1], minute);

const bestOf3 = { drawsAllowed: true, bestOf: 3 } as const;

describe("rankSeries", () => {
  it("ranks the two Entrants by Matches won, with their records", () => {
    const rows = rankSeries(
      { drawsAllowed: true, bestOf: 5 },
      [
        beat("ana", "ben"),
        beat("ben", "ana"),
        beat("ana", "ben"),
        drew("ana", "ben"),
      ],
      ["ben", "ana"],
    );
    expect(rows.map((r) => [r.id, r.rank, recordLabel(r)])).toEqual([
      ["ana", 1, "2–1–1"],
      ["ben", 2, "1–2–1"],
    ]);
  });

  it("leaves an Entrant with no Match unranked", () => {
    expect(rankSeries(bestOf3, [], ["ana", "ben"]).map((r) => r.rank)).toEqual([
      null,
      null,
    ]);
  });

  it("ties a level series at the higher rank", () => {
    const rows = rankSeries(
      bestOf3,
      [beat("ana", "ben"), beat("ben", "ana")],
      ["ana", "ben"],
    );
    expect(rows.map((r) => r.rank)).toEqual([1, 1]);
  });

  it("ranks both Entrants 1st when the series is drawn, even with uneven wins", () => {
    // Best of 3 with draws: Ana wins, Draw, Draw. Every Match is played
    // and nobody has 2 wins: drawn.
    const rows = rankSeries(
      bestOf3,
      [beat("ana", "ben"), drew("ana", "ben"), drew("ana", "ben")],
      ["ana", "ben"],
    );
    expect(rows.map((r) => [r.id, r.rank, recordLabel(r)])).toEqual([
      ["ana", 1, "1–0–2"],
      ["ben", 1, "0–1–2"],
    ]);
  });

  it("still ranks the leader alone while the series has Matches to play", () => {
    const rows = rankSeries(
      bestOf3,
      [beat("ana", "ben"), drew("ana", "ben")],
      ["ana", "ben"],
    );
    expect(rows.map((r) => [r.id, r.rank])).toEqual([
      ["ana", 1],
      ["ben", 2],
    ]);
  });
});

describe("bestOfWinner", () => {
  it("names the Entrant with a majority; a Draw counts for nobody", () => {
    expect(
      bestOfWinner(bestOf3, [beat("ana", "ben"), drew("ana", "ben")]),
    ).toBe(null);
    expect(
      bestOfWinner(bestOf3, [
        beat("ana", "ben"),
        drew("ana", "ben"),
        beat("ana", "ben"),
      ]),
    ).toBe("ana");
  });

  it("decides a Best of 1 on its one Match", () => {
    expect(
      bestOfWinner({ drawsAllowed: false, bestOf: 1 }, [beat("ben", "ana")]),
    ).toBe("ben");
  });
});

describe("seriesDrawn", () => {
  it("is drawn once every Match is played with no majority", () => {
    expect(
      seriesDrawn(bestOf3, [
        beat("ana", "ben"),
        drew("ana", "ben"),
        drew("ana", "ben"),
      ]),
    ).toBe(true);
    expect(seriesDrawn(bestOf3, [beat("ana", "ben"), drew("ana", "ben")])).toBe(
      false,
    );
    expect(
      seriesDrawn(bestOf3, [
        beat("ana", "ben"),
        drew("ana", "ben"),
        beat("ana", "ben"),
      ]),
    ).toBe(false);
  });
});

describe("seriesOf and seriesNote", () => {
  it("lists the Matches oldest first with the score and the Winner once decided", () => {
    const series = seriesOf(
      bestOf3,
      [beat("ana", "ben", 30), beat("ben", "ana", 10), beat("ana", "ben", 20)],
      ["ana", "ben"],
      false,
    );
    expect(series.matches.map((m) => m.winner)).toEqual(["ben", "ana", "ana"]);
    expect(series.score).toBe("2–1");
    expect(series.winner).toBe("ana");
    expect(seriesNote(bestOf3, series, false)).toBeNull();
  });

  it("says the Best of's target while open, and Closed level after", () => {
    const open = seriesOf(bestOf3, [beat("ana", "ben")], ["ana", "ben"], false);
    expect(seriesNote(bestOf3, open, false)).toBe(
      "Best of 3: first to 2 wins.",
    );
    const level = seriesOf(
      bestOf3,
      [beat("ana", "ben"), beat("ben", "ana")],
      ["ana", "ben"],
      true,
    );
    expect(level.winner).toBeNull();
    expect(seriesNote(bestOf3, level, true)).toBe(
      "Closed level: no series Winner.",
    );
  });

  it("names no Winner for a drawn series with uneven wins, open or Closed", () => {
    const played = [beat("ana", "ben"), drew("ana", "ben"), drew("ana", "ben")];
    for (const closed of [false, true]) {
      const series = seriesOf(bestOf3, played, ["ana", "ben"], closed);
      expect(series.score).toBe("1–0");
      expect(series.drawn).toBe(true);
      expect(series.winner).toBeNull();
      expect(seriesNote(bestOf3, series, closed)).toBe(
        "Drawn: every Match is played with no majority, so no series Winner.",
      );
    }
  });

  it("gives the leader the series once Closed short of a majority", () => {
    const config = { drawsAllowed: false, bestOf: 5 } as const;
    const series = seriesOf(config, [beat("ben", "ana")], ["ana", "ben"], true);
    expect(series.winner).toBe("ben");
  });
});

describe("matchSummary", () => {
  it("reads a win, a Draw, or the two names", () => {
    expect(
      matchSummary([
        { name: "Sam", place: 2 },
        { name: "Ashley", place: 1 },
      ]),
    ).toBe("Ashley beat Sam");
    expect(
      matchSummary([
        { name: "Ashley", place: 1 },
        { name: "Sam", place: 1 },
      ]),
    ).toBe("Ashley and Sam drew");
    expect(
      matchSummary([
        { name: "Ashley", place: null },
        { name: "Sam", place: null },
      ]),
    ).toBe("Ashley vs Sam");
  });
});
