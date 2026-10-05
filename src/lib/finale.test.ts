import { describe, expect, it } from "vitest";

import {
  FINALE_MAX_MS,
  countUpTotal,
  finaleDurationMs,
  finaleRows,
  finaleTopRows,
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

describe("finaleTopRows", () => {
  const rowsWith = (ranks: number[]) =>
    ranks.map((rank, i) => ({ id: `p${i}`, rank, total: 200 - rank }));
  const ranked = (n: number) =>
    rowsWith(Array.from({ length: n }, (_, i) => i + 1));

  it("shows everyone with fewer than 10 scorers and no more line", () => {
    const rows = ranked(7);
    expect(finaleTopRows(rows)).toEqual({ shown: rows, moreCount: 0 });
  });

  it("shows exactly 10 scorers with nothing left out", () => {
    const { shown, moreCount } = finaleTopRows(ranked(10));
    expect(shown).toHaveLength(10);
    expect(moreCount).toBe(0);
  });

  it("includes every row tied at 10th, past 10 rows", () => {
    const rows = rowsWith([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 10, 10, 13, 14]);
    const { shown, moreCount } = finaleTopRows(rows);
    expect(shown).toHaveLength(12);
    expect(moreCount).toBe(2);
  });

  it("cuts 100 scorers to 10 with 90 more", () => {
    const { shown, moreCount } = finaleTopRows(ranked(100));
    expect(shown).toHaveLength(10);
    expect(moreCount).toBe(90);
  });

  it("doesn't count left-out rows on 0 points as scorers", () => {
    const rows = [
      ...ranked(11),
      { id: "zero-a", rank: 12, total: 0 },
      { id: "zero-b", rank: 12, total: 0 },
    ];
    const { shown, moreCount } = finaleTopRows(rows);
    expect(shown).toHaveLength(10);
    expect(moreCount).toBe(1);
  });

  it("returns the input's first rows by identity and order", () => {
    const rows = ranked(30);
    const { shown } = finaleTopRows(rows);
    shown.forEach((row, i) => expect(row).toBe(rows[i]));
  });
});
