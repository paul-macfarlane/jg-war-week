import { describe, expect, it } from "vitest";

import {
  DRAW_LOGGED,
  loggedMatchesSettingsError,
} from "@/lib/series/settings-rule";

const played = (a: number, b: number) => ({
  players: [
    { id: "ana", place: a, score: null },
    { id: "ben", place: b, score: null },
  ],
});

describe("loggedMatchesSettingsError", () => {
  it("fits a Best of at least as long as the Matches", () => {
    const matches = [played(1, 2), played(2, 1), played(1, 2)];
    expect(
      loggedMatchesSettingsError({ drawsAllowed: false, bestOf: 3 }, matches),
    ).toBeNull();
    expect(
      loggedMatchesSettingsError({ drawsAllowed: false, bestOf: 1 }, matches),
    ).toBe("These Matches don't fit a Best of 1.");
  });

  it("keeps draws on while a Match is a Draw", () => {
    const matches = [played(1, 1)];
    expect(
      loggedMatchesSettingsError({ drawsAllowed: false, bestOf: 3 }, matches),
    ).toBe(DRAW_LOGGED);
    expect(
      loggedMatchesSettingsError({ drawsAllowed: true, bestOf: 3 }, matches),
    ).toBeNull();
  });
});
