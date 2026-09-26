import { describe, expect, it } from "vitest";

import {
  FINALE_MAX_MS,
  countUpTotal,
  finaleDurationMs,
  finaleRows,
} from "@/lib/finale";

describe("countUpTotal", () => {
  it.each([
    [42.5, 0, 0],
    [42.5, 1, 42.5],
    [42.5, 1.5, 42.5],
    [42.5, -1, 0],
    [0, 0.5, 0],
  ])("counts %d at progress %d to %d", (total, progress, expected) => {
    expect(countUpTotal(total, progress)).toBe(expected);
  });

  it("eases out: past halfway at the midpoint, never above the total", () => {
    const mid = countUpTotal(100, 0.5);
    expect(mid).toBeGreaterThan(50);
    expect(mid).toBeLessThan(100);
  });

  it("rounds to hundredths and counts negative totals down from 0", () => {
    const value = countUpTotal(1 / 3, 0.37);
    expect(Math.round(value * 100)).toBe(value * 100);
    expect(countUpTotal(-10, 0.5)).toBeLessThan(0);
    expect(countUpTotal(-10, 0.5)).toBeGreaterThan(-10);
  });

  it("never decreases as progress grows", () => {
    let previous = 0;
    for (let p = 0; p <= 1; p += 0.05) {
      const value = countUpTotal(97.25, p);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe("finaleRows", () => {
  it("shows nothing at time 0 except the last-ranked row starting", () => {
    const rows = finaleRows([1, 2, 3], 0);
    expect(rows.map((r) => r.shown)).toEqual([false, false, true]);
    expect(rows[2].progress).toBe(0);
  });

  it("shows rows in reverse rank order: last place first, first place last", () => {
    const ranks = [1, 2, 3, 4];
    const startOf = (index: number) => {
      for (let t = 0; t <= FINALE_MAX_MS; t += 10) {
        if (finaleRows(ranks, t)[index].shown) return t;
      }
      return Infinity;
    };
    const starts = ranks.map((_, i) => startOf(i));
    expect(starts[3]).toBeLessThan(starts[2]);
    expect(starts[2]).toBeLessThan(starts[1]);
    expect(starts[1]).toBeLessThan(starts[0]);
  });

  it("shows tied rows together", () => {
    const ranks = [1, 2, 2, 4];
    for (let t = 0; t <= FINALE_MAX_MS; t += 50) {
      const rows = finaleRows(ranks, t);
      expect(rows[1]).toEqual(rows[2]);
    }
    // The tie is one step, so first place starts one step after it.
    const firstStart = [...Array(FINALE_MAX_MS / 10).keys()]
      .map((i) => i * 10)
      .find((t) => finaleRows(ranks, t)[0].shown)!;
    const tieStart = [...Array(FINALE_MAX_MS / 10).keys()]
      .map((i) => i * 10)
      .find((t) => finaleRows(ranks, t)[1].shown)!;
    const lastStart = 0;
    expect(firstStart - tieStart).toBe(tieStart - lastStart);
  });

  it("has every row shown and fully counted once the duration has passed", () => {
    const ranks = [1, 2, 3, 4, 5];
    const rows = finaleRows(ranks, finaleDurationMs(ranks));
    expect(rows.every((r) => r.shown && r.progress === 1)).toBe(true);
  });

  it("delays a shorter list so every list's first place lands at the end", () => {
    const short = [1, 2];
    const long = [1, 2, 3, 4, 5, 6];
    const duration = Math.max(finaleDurationMs(short), finaleDurationMs(long));
    const firstStart = (ranks: number[]) =>
      [...Array(duration + 1).keys()].find(
        (t) => finaleRows(ranks, t, duration)[0].shown,
      );
    expect(firstStart(short)).toBe(firstStart(long));
    expect(finaleRows(short, 0, duration)[1].shown).toBe(false);
    expect(
      finaleRows(short, duration, duration).every((r) => r.progress === 1),
    ).toBe(true);
  });

  it("returns an empty list for no rows", () => {
    expect(finaleRows([], 500)).toEqual([]);
  });
});

describe("finaleDurationMs", () => {
  it("is 0 for no rows", () => {
    expect(finaleDurationMs([])).toBe(0);
  });

  it("stays under the cap for a long list, so a 10 s poll never lands mid-Finale twice", () => {
    const ranks = Array.from({ length: 80 }, (_, i) => i + 1);
    expect(finaleDurationMs(ranks)).toBeLessThanOrEqual(FINALE_MAX_MS);
    expect(FINALE_MAX_MS).toBeLessThan(10_000);
  });

  it("grows with the number of distinct ranks", () => {
    const short = [1, 2];
    const long = [1, 2, 3, 4, 5, 6];
    expect(finaleDurationMs(long)).toBeGreaterThan(finaleDurationMs(short));
  });
});
