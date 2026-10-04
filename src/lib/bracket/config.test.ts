import { describe, expect, it } from "vitest";

import {
  ADVANCE_PER_MATCH_OPTIONS,
  DEFAULT_BRACKET_CONFIG,
  ENTRANTS_PER_MATCH_OPTIONS,
  advancePerMatchLabel,
  bracketConfigSchema,
  configOf,
  entrantsPerMatchLabel,
  isHeadToHead,
} from "@/lib/bracket/config";

function messages(input: unknown): string[] {
  const result = bracketConfigSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

const full = (entrantsPerHeat: number, advancePerHeat: number) => ({
  entrantsPerHeat,
  advancePerHeat,
  thirdPlaceGame: false,
});

describe("bracketConfigSchema", () => {
  it("accepts 2 to 8 per Match with fewer advancing than play", () => {
    expect(messages(full(4, 2))).toEqual([]);
    expect(messages(full(2, 1))).toEqual([]);
    expect(messages(full(8, 7))).toEqual([]);
  });

  it("refuses Matches outside 2 to 8 Entrants", () => {
    expect(messages(full(1, 1))).not.toEqual([]);
    expect(messages(full(9, 2))).not.toEqual([]);
    expect(messages(full(3.5, 1))).not.toEqual([]);
  });

  it("refuses advancing none, or as many as play", () => {
    expect(messages(full(4, 0))).not.toEqual([]);
    expect(messages(full(4, 4))).toEqual([
      "Fewer must advance than play in a Match.",
    ]);
    expect(messages(full(3, 5))).toEqual([
      "Fewer must advance than play in a Match.",
    ]);
  });

  it("needs the 3rd place Match as a boolean, and a config at all", () => {
    expect(messages({ entrantsPerHeat: 4, advancePerHeat: 2 })).not.toEqual([]);
    expect(messages({ ...full(4, 2), thirdPlaceGame: "yes" })).not.toEqual([]);
    expect(messages({ ...full(4, 2), thirdPlaceGame: true })).toEqual([]);
    expect(messages(null)).not.toEqual([]);
  });
});

describe("DEFAULT_BRACKET_CONFIG", () => {
  it("is head-to-head with no 3rd place Match", () => {
    expect(DEFAULT_BRACKET_CONFIG).toEqual(full(2, 1));
  });
});

describe("isHeadToHead", () => {
  it("is true for 2 per Match with 1 advancing only", () => {
    expect(isHeadToHead(full(2, 1))).toBe(true);
    expect(isHeadToHead(full(3, 1))).toBe(false);
    expect(isHeadToHead(full(4, 2))).toBe(false);
    expect(isHeadToHead(full(8, 1))).toBe(false);
  });
});

describe("configOf", () => {
  it("reads a valid saved config", () => {
    expect(
      configOf({
        bracketConfig: {
          entrantsPerHeat: 6,
          advancePerHeat: 3,
          thirdPlaceGame: true,
        },
      }),
    ).toEqual({ entrantsPerHeat: 6, advancePerHeat: 3, thirdPlaceGame: true });
  });

  it("falls back to 2 per Match, 1 advancing when none is saved or it doesn't parse", () => {
    expect(configOf({ bracketConfig: null })).toEqual(full(2, 1));
    expect(configOf({ bracketConfig: full(3, 3) })).toEqual(full(2, 1));
    expect(configOf({ bracketConfig: "garbage" })).toEqual(full(2, 1));
    expect(
      configOf({ bracketConfig: { entrantsPerHeat: 4, advancePerHeat: 2 } }),
    ).toEqual(full(2, 1));
  });
});

describe("builder options", () => {
  it("lists 2 to 8 per Match and 1 to 7 advancing", () => {
    expect(ENTRANTS_PER_MATCH_OPTIONS).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(ADVANCE_PER_MATCH_OPTIONS).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("labels them for Organizers", () => {
    expect(entrantsPerMatchLabel(4)).toBe("4 per Match");
    expect(advancePerMatchLabel(2)).toBe("Top 2 advance");
    expect(advancePerMatchLabel(1)).toBe("Top 1 advances");
  });
});
