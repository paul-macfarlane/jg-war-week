import { describe, expect, it } from "vitest";

import {
  ADVANCE_PER_HEAT_OPTIONS,
  ENTRANTS_PER_HEAT_OPTIONS,
  advancePerHeatLabel,
  bracketConfigSchema,
  configOf,
  defaultConfig,
  entrantsPerHeatLabel,
  heatsConfigSchema,
} from "@/lib/bracket/config";

function messages(input: unknown): string[] {
  const result = heatsConfigSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe("heatsConfigSchema", () => {
  it("accepts 2 to 8 per Heat with fewer advancing than play", () => {
    expect(messages({ entrantsPerHeat: 4, advancePerHeat: 2 })).toEqual([]);
    expect(messages({ entrantsPerHeat: 2, advancePerHeat: 1 })).toEqual([]);
    expect(messages({ entrantsPerHeat: 8, advancePerHeat: 7 })).toEqual([]);
  });

  it("refuses Heats outside 2 to 8 Entrants", () => {
    expect(messages({ entrantsPerHeat: 1, advancePerHeat: 1 })).not.toEqual([]);
    expect(messages({ entrantsPerHeat: 9, advancePerHeat: 2 })).not.toEqual([]);
    expect(messages({ entrantsPerHeat: 3.5, advancePerHeat: 1 })).not.toEqual(
      [],
    );
  });

  it("refuses advancing none, or as many as play", () => {
    expect(messages({ entrantsPerHeat: 4, advancePerHeat: 0 })).not.toEqual([]);
    expect(messages({ entrantsPerHeat: 4, advancePerHeat: 4 })).toEqual([
      "Fewer must advance than play in a Heat.",
    ]);
    expect(messages({ entrantsPerHeat: 3, advancePerHeat: 5 })).toEqual([
      "Fewer must advance than play in a Heat.",
    ]);
  });
});

describe("bracketConfigSchema", () => {
  it("takes a Heats config for heats", () => {
    expect(
      bracketConfigSchema("heats").safeParse({
        entrantsPerHeat: 5,
        advancePerHeat: 2,
      }).success,
    ).toBe(true);
    expect(bracketConfigSchema("heats").safeParse(null).success).toBe(false);
  });

  it("takes no config for single elimination or points", () => {
    for (const format of ["single-elimination", "points"] as const) {
      expect(bracketConfigSchema(format).safeParse(null).success).toBe(true);
      expect(bracketConfigSchema(format).safeParse(undefined).success).toBe(
        true,
      );
      expect(
        bracketConfigSchema(format).safeParse({
          entrantsPerHeat: 4,
          advancePerHeat: 2,
        }).success,
      ).toBe(false);
    }
  });
});

describe("defaultConfig", () => {
  it("is 4 per Heat, top 2 advance, for heats", () => {
    expect(defaultConfig("heats")).toEqual({
      entrantsPerHeat: 4,
      advancePerHeat: 2,
    });
  });

  it("is null otherwise", () => {
    expect(defaultConfig("single-elimination")).toBeNull();
    expect(defaultConfig("points")).toBeNull();
  });
});

describe("configOf", () => {
  it("reads a valid saved config", () => {
    expect(
      configOf({
        format: "heats",
        bracketConfig: { entrantsPerHeat: 6, advancePerHeat: 3 },
      }),
    ).toEqual({ entrantsPerHeat: 6, advancePerHeat: 3 });
  });

  it("falls back to the default when none is saved", () => {
    expect(configOf({ format: "heats", bracketConfig: null })).toEqual({
      entrantsPerHeat: 4,
      advancePerHeat: 2,
    });
    expect(
      configOf({ format: "single-elimination", bracketConfig: null }),
    ).toBeNull();
  });

  it("falls back to the default on a config that doesn't parse", () => {
    expect(
      configOf({
        format: "heats",
        bracketConfig: { entrantsPerHeat: 3, advancePerHeat: 3 },
      }),
    ).toEqual({ entrantsPerHeat: 4, advancePerHeat: 2 });
    expect(configOf({ format: "heats", bracketConfig: "garbage" })).toEqual({
      entrantsPerHeat: 4,
      advancePerHeat: 2,
    });
    expect(
      configOf({
        format: "single-elimination",
        bracketConfig: { entrantsPerHeat: 4, advancePerHeat: 2 },
      }),
    ).toBeNull();
  });
});

describe("builder options", () => {
  it("lists 2 to 8 per Heat and 1 to 7 advancing", () => {
    expect(ENTRANTS_PER_HEAT_OPTIONS).toEqual([2, 3, 4, 5, 6, 7, 8]);
    expect(ADVANCE_PER_HEAT_OPTIONS).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("labels them for Organizers", () => {
    expect(entrantsPerHeatLabel(4)).toBe("4 per Heat");
    expect(advancePerHeatLabel(2)).toBe("Top 2 advance");
    expect(advancePerHeatLabel(1)).toBe("Top 1 advances");
  });
});
