import { describe, expect, it } from "vitest";

import {
  BEST_OF_OPTIONS,
  DEFAULT_SERIES_CONFIG,
  bestOfLabel,
  seriesConfigOf,
  seriesConfigSchema,
} from "@/lib/series/config";

describe("series config", () => {
  it("offers Best of 1, 3, 5 and 7, labelled", () => {
    expect(BEST_OF_OPTIONS).toEqual([1, 3, 5, 7]);
    expect(bestOfLabel(5)).toBe("Best of 5");
  });

  it("defaults a new Head-to-head to no draws, Best of 3", () => {
    expect(DEFAULT_SERIES_CONFIG).toEqual({ drawsAllowed: false, bestOf: 3 });
    expect(seriesConfigOf({ seriesConfig: null })).toEqual({
      drawsAllowed: false,
      bestOf: 3,
    });
  });

  it("requires a Best of: there's no 'no Best of' option", () => {
    const refused = (input: unknown) =>
      seriesConfigSchema.safeParse(input).error?.issues[0].message;
    expect(refused({ drawsAllowed: false, bestOf: null })).toBe(
      "Best of is 1, 3, 5 or 7.",
    );
    expect(refused({ drawsAllowed: false })).toBe("Best of is 1, 3, 5 or 7.");
    expect(refused({ drawsAllowed: false, bestOf: 2 })).toBe(
      "Best of is 1, 3, 5 or 7.",
    );
    expect(
      seriesConfigSchema.safeParse({ drawsAllowed: true, bestOf: 1 }).success,
    ).toBe(true);
  });
});
