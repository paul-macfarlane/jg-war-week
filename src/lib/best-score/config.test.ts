import { describe, expect, it } from "vitest";

import {
  bestScoreConfigSchema,
  bestScoreSettingsOf,
  teamScoreLabel,
} from "@/lib/best-score/config";

describe("best score config", () => {
  it("takes Team score only: Best member or Sum of members", () => {
    expect(teamScoreLabel("best-member")).toBe("Best member");
    expect(teamScoreLabel("sum-of-members")).toBe("Sum of members");
    expect(
      bestScoreConfigSchema.safeParse({ teamScore: "sum-of-members" }).success,
    ).toBe(true);
  });

  it("has no Best / Total count", () => {
    expect(
      bestScoreConfigSchema.safeParse({
        teamScore: "best-member",
        count: "total",
      }).success,
    ).toBe(false);
  });

  it("reads direction and unit from the scoring columns", () => {
    expect(
      bestScoreSettingsOf({
        scoreDirection: "lower",
        scoreUnit: "sec",
        bestScoreConfig: null,
      }),
    ).toEqual({ betterIs: "lower", unit: "sec", teamScore: "best-member" });
    expect(
      bestScoreSettingsOf({
        scoreDirection: "higher",
        scoreUnit: null,
        bestScoreConfig: { teamScore: "sum-of-members" },
      }),
    ).toEqual({ betterIs: "higher", unit: "", teamScore: "sum-of-members" });
  });
});
