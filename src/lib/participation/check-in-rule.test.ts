import { describe, expect, it } from "vitest";

import { markError } from "@/lib/participation/check-in-rule";

describe("markError", () => {
  it("refuses a Participant on no Team in team scoring, naming the Team Label", () => {
    expect(
      markError({ scoring: "team", teamId: null, teamLabel: "Squad" }),
    ).toBe("Only Participants on a Squad can take part in a team Competition.");
  });

  it("allows a Participant on a Team, and anyone in individual scoring", () => {
    expect(
      markError({ scoring: "team", teamId: "t1", teamLabel: "Squad" }),
    ).toBeNull();
    expect(
      markError({ scoring: "individual", teamId: null, teamLabel: "Squad" }),
    ).toBeNull();
  });
});
