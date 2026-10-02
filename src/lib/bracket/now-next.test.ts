import { describe, expect, it } from "vitest";

import { applyResult, generate } from "@/lib/bracket/engine";
import { type TimedHeatRow, heatEntries } from "@/lib/bracket/now-next";
import type { Bracket, Entrant } from "@/lib/bracket/types";
import { finalRoundOf } from "@/lib/bracket/view";
import {
  type ScheduleDay,
  type ScheduleEntry,
  computeNowNext,
  withHeats,
} from "@/lib/schedule";

const beyblades = {
  id: "c-beyblades",
  name: "Beyblades",
  format: "single-elimination" as const,
};

/** Entrants s1…sN at Seed Positions 1…N. */
function entrants(count: number): Entrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `s${i + 1}`,
    seedPosition: i + 1,
    label: `Seed Position ${i + 1}`,
  }));
}

const labels: Record<string, string> = {
  s1: "Ashley Schuliger",
  s2: "Blue",
  s3: "Gold",
  s4: "Sam Schantz",
  s5: "Green",
  s6: "Purple",
  s7: "Orange",
  s8: "Silver",
};

/** Sets the same Day and time on the Heats named, or every Heat. */
function timed(
  bracket: Bracket,
  when: { dayId: string | null; startTime: string | null },
  ids?: string[],
): Bracket {
  return {
    ...bracket,
    heats: bracket.heats.map((h) =>
      !ids || ids.includes(h.id) ? { ...h, ...when, location: null } : h,
    ),
  };
}

/** One row per Heat, as `getTimedHeats` would return them unfiltered. */
function rowsOf(bracket: Bracket): TimedHeatRow[] {
  return bracket.heats.map((heat) => ({
    competition: beyblades,
    finalRound: finalRoundOf(bracket),
    heat,
    labels,
  }));
}

/** An empty Sunday of War Week. */
const sunday: ScheduleDay[] = [
  {
    id: "d1",
    date: "2026-02-22",
    dayTheme: "Kickoff",
    description: null,
    items: [],
  },
];

/** An instant given as an ET wall-clock time in February (EST, UTC-5). */
function est(time: string): Date {
  return new Date(`2026-02-22T${time}-05:00`);
}

function nowNextAt(
  rows: TimedHeatRow[],
  time: string,
  days: ScheduleDay[] = sunday,
) {
  const { now, next } = computeNowNext(
    withHeats(days, heatEntries(rows)),
    est(time),
  );
  return {
    now: now.map((e) => e.title),
    next: next?.items.map((e) => e.title) ?? [],
  };
}

describe("heatEntries", () => {
  // 4 Entrants: r1h1 is s1 v s4 (Semifinal 1), r1h2 s2 v s3, r2h1 the Final.
  const fourUp = generate(entrants(4));

  it("turns a timed ready Heat into a Now/Next entry named for its Competition", () => {
    const bracket = timed(fourUp, { dayId: "d1", startTime: "19:00:00" }, [
      "r1h1",
    ]);
    const rows = rowsOf(bracket).map((row) =>
      row.heat.id === "r1h1"
        ? { ...row, heat: { ...row.heat, location: "Main room" } }
        : row,
    );

    expect(heatEntries(rows)).toEqual([
      {
        dayId: "d1",
        entry: {
          id: "r1h1",
          kind: "heat",
          title: "Beyblades · Semifinal 1",
          entrants: "Ashley Schuliger vs Sam Schantz",
          startTime: "19:00:00",
          endTime: null,
          host: null,
          location: "Main room",
          virtualLink: null,
          description: null,
          category: "competition",
          competition: { id: "c-beyblades", name: "Beyblades" },
        } satisfies ScheduleEntry,
      },
    ]);
  });

  it("is up next before its start, on now for 60 minutes, then gone", () => {
    const rows = rowsOf(
      timed(fourUp, { dayId: "d1", startTime: "19:00:00" }, ["r1h1"]),
    );

    expect(nowNextAt(rows, "18:59:00")).toEqual({
      now: [],
      next: ["Beyblades · Semifinal 1"],
    });
    expect(nowNextAt(rows, "19:00:00")).toEqual({
      now: ["Beyblades · Semifinal 1"],
      next: [],
    });
    expect(nowNextAt(rows, "19:59:59")).toEqual({
      now: ["Beyblades · Semifinal 1"],
      next: [],
    });
    expect(nowNextAt(rows, "20:00:00")).toEqual({ now: [], next: [] });
  });

  it("never shows a Heat with no Day or no start time", () => {
    const noDay = rowsOf(
      timed(fourUp, { dayId: null, startTime: "19:00:00" }, ["r1h1"]),
    );
    const noTime = rowsOf(
      timed(fourUp, { dayId: "d1", startTime: null }, ["r1h1"]),
    );

    expect(heatEntries(noDay)).toEqual([]);
    expect(heatEntries(noTime)).toEqual([]);
    expect(nowNextAt(noDay, "18:00:00")).toEqual({ now: [], next: [] });
    expect(nowNextAt(noTime, "18:00:00")).toEqual({ now: [], next: [] });
  });

  it("shows a Heat and a Schedule Item on the same Competition, both", () => {
    const rows = rowsOf(
      timed(fourUp, { dayId: "d1", startTime: "19:00:00" }, ["r1h1"]),
    );
    const withItem: ScheduleDay[] = [
      {
        ...sunday[0],
        items: [
          {
            id: "item-1",
            startTime: "19:00:00",
            endTime: "21:00:00",
            title: "Beyblades",
            host: null,
            location: "Main room",
            virtualLink: null,
            description: null,
            category: "competition",
            competition: { id: "c-beyblades", name: "Beyblades" },
          },
        ],
      },
    ];

    expect(nowNextAt(rows, "18:30:00", withItem)).toEqual({
      now: [],
      next: ["Beyblades", "Beyblades · Semifinal 1"],
    });
    expect(nowNextAt(rows, "19:30:00", withItem)).toEqual({
      now: ["Beyblades", "Beyblades · Semifinal 1"],
      next: [],
    });
  });

  it("hides a played and a forfeit Heat", () => {
    let bracket = applyResult(fourUp, "r1h1", { order: ["s1", "s4"] });
    bracket = applyResult(bracket, "r1h2", {
      order: ["s2", "s3"],
      forfeits: ["s3"],
    });
    const rows = rowsOf(
      timed(bracket, { dayId: "d1", startTime: "19:00:00" }, ["r1h1", "r1h2"]),
    );

    expect(rows.map((r) => r.heat.status)).toEqual([
      "played",
      "forfeit",
      "ready",
    ]);
    expect(nowNextAt(rows, "19:30:00")).toEqual({ now: [], next: [] });
  });

  it("hides a bye", () => {
    // 3 Entrants: r1h1 is s1's bye.
    const bracket = timed(
      generate(entrants(3)),
      { dayId: "d1", startTime: "19:00:00" },
      ["r1h1"],
    );

    expect(bracket.heats[0].slots.map((s) => s.entrantId)).toEqual([
      "s1",
      null,
    ]);
    expect(nowNextAt(rowsOf(bracket), "19:30:00")).toEqual({
      now: [],
      next: [],
    });
  });

  it("shows the Semifinal a re-recorded Quarterfinal refills, not the reset Final", () => {
    // 8 Entrants, every Heat played by the higher Seed Position.
    let bracket = generate(entrants(8));
    for (const [heatId, order] of [
      ["r1h1", ["s1", "s8"]],
      ["r1h2", ["s4", "s5"]],
      ["r1h3", ["s2", "s7"]],
      ["r1h4", ["s3", "s6"]],
      ["r2h1", ["s1", "s4"]],
      ["r2h2", ["s2", "s3"]],
      ["r3h1", ["s1", "s2"]],
    ] as const) {
      bracket = applyResult(bracket, heatId, { order: [...order] });
    }
    // The first Quarterfinal goes to s8 instead.
    bracket = applyResult(bracket, "r1h1", { order: ["s8", "s1"] });
    const rows = rowsOf(timed(bracket, { dayId: "d1", startTime: "19:00:00" }));

    expect(
      rows
        .filter((r) => r.heat.round > 1)
        .map((r) => [r.heat.id, r.heat.status]),
    ).toEqual([
      ["r2h1", "ready"],
      ["r2h2", "played"],
      ["r3h1", "pending"],
    ]);
    expect(nowNextAt(rows, "19:30:00")).toEqual({
      now: ["Beyblades · Semifinal 1"],
      next: [],
    });
    expect(heatEntries(rows).map((e) => e.entry.entrants)).toEqual([
      "Silver vs Sam Schantz",
    ]);
  });
});
