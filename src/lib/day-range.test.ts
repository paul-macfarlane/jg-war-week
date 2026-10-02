import { describe, expect, it } from "vitest";

import {
  dayOutsideRangeError,
  nextRangeSelection,
  rangeToCommit,
} from "@/lib/day-range";

const days = ["2026-02-23", "2026-02-25"];

describe("nextRangeSelection", () => {
  it("holds the first tap as the start and commits nothing", () => {
    expect(nextRangeSelection(null, "2026-02-22", days)).toEqual({
      pending: { from: "2026-02-22" },
    });
  });

  it("holds the range on the second tap without committing", () => {
    expect(
      nextRangeSelection({ from: "2026-02-22" }, "2026-02-27", days),
    ).toEqual({ pending: { from: "2026-02-22", to: "2026-02-27" } });
  });

  it("puts a second tap earlier than the first at the start", () => {
    expect(
      nextRangeSelection({ from: "2026-02-27" }, "2026-02-22", days),
    ).toEqual({ pending: { from: "2026-02-22", to: "2026-02-27" } });
  });

  it("holds a one-day range when the same date is tapped twice", () => {
    expect(
      nextRangeSelection({ from: "2026-03-02" }, "2026-03-02", []),
    ).toEqual({ pending: { from: "2026-03-02", to: "2026-03-02" } });
  });

  it("starts a new range on the third tap after a complete range", () => {
    expect(
      nextRangeSelection(
        { from: "2026-02-22", to: "2026-02-27" },
        "2026-02-24",
        days,
      ),
    ).toEqual({ pending: { from: "2026-02-24" } });
  });

  it("refuses a range that leaves a Day outside it and keeps it on screen", () => {
    expect(
      nextRangeSelection({ from: "2026-02-24" }, "2026-02-27", days),
    ).toEqual({
      pending: { from: "2026-02-24", to: "2026-02-27" },
      error:
        "The Day on 2026-02-23 falls outside the new dates. Move or delete it first.",
    });
  });

  it("starts over from the next tap after a refused range", () => {
    expect(
      nextRangeSelection(
        { from: "2026-02-24", to: "2026-02-27" },
        "2026-02-20",
        days,
      ),
    ).toEqual({ pending: { from: "2026-02-20" } });
  });
});

describe("rangeToCommit", () => {
  it("commits a complete range the Days allow", () => {
    expect(
      rangeToCommit({ from: "2026-02-22", to: "2026-02-27" }, days),
    ).toEqual({ start: "2026-02-22", end: "2026-02-27" });
  });

  it("discards a half-picked range", () => {
    expect(rangeToCommit({ from: "2026-02-22" }, days)).toBeNull();
    expect(rangeToCommit(null, days)).toBeNull();
  });

  it("refuses a range that leaves a Day outside it", () => {
    expect(
      rangeToCommit({ from: "2026-02-24", to: "2026-02-27" }, days),
    ).toBeNull();
  });
});

describe("dayOutsideRangeError", () => {
  it("names the earliest Day outside the dates", () => {
    expect(
      dayOutsideRangeError(
        ["2026-02-28", "2026-02-20"],
        "2026-02-22",
        "2026-02-26",
      ),
    ).toBe(
      "The Day on 2026-02-20 falls outside the new dates. Move or delete it first.",
    );
  });

  it("allows dates that keep every Day inside", () => {
    expect(dayOutsideRangeError(days, "2026-02-23", "2026-02-25")).toBeNull();
  });
});
