import { describe, expect, it } from "vitest";

import {
  dayDateDisabled,
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

describe("dayDateDisabled", () => {
  const disabled = dayDateDisabled("2026-02-22", "2026-02-27", days);
  const at = (value: string) => disabled(new Date(`${value}T12:00:00`));

  it("disables dates that already have a Day", () => {
    expect(at("2026-02-23")).toBe(true);
    expect(at("2026-02-25")).toBe(true);
  });

  it("disables dates outside the War Week", () => {
    expect(at("2026-02-21")).toBe(true);
    expect(at("2026-02-28")).toBe(true);
  });

  it("leaves free dates inside the War Week pickable", () => {
    expect(at("2026-02-22")).toBe(false);
    expect(at("2026-02-24")).toBe(false);
    expect(at("2026-02-27")).toBe(false);
  });

  it("does not disable the edited Day's own date", () => {
    const editing = dayDateDisabled(
      "2026-02-22",
      "2026-02-27",
      days,
      "2026-02-23",
    );
    expect(editing(new Date("2026-02-23T12:00:00"))).toBe(false);
    expect(editing(new Date("2026-02-25T12:00:00"))).toBe(true);
  });
});
