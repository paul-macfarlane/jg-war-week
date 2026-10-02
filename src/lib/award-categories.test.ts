import { describe, expect, it } from "vitest";

import { categoryKeyForAwardName } from "@/lib/award-categories";

describe("categoryKeyForAwardName", () => {
  it.each([
    ["War Week MVP", "war-week-mvp"],
    ["MVP", "war-week-mvp"],
    ["MVP 1st Place", "war-week-mvp"],
    ["Billable Hours Champ", "billable-hours-champ"],
    ["Billing Hours Champ", "billable-hours-champ"],
    ["Black Midnight", "black-midnight"],
    ["Midnight Club Winning House", "black-midnight"],
    ["Midnight Club", "black-midnight"],
    ["Grow", "grow"],
    ["Grind", "grind"],
    ["Serve", "serve"],
    ["Inspire", "inspire"],
  ])("tags %j as %s", (name, key) => {
    expect(categoryKeyForAwardName(name)).toBe(key);
  });

  it("ignores case and surrounding or repeated space", () => {
    expect(categoryKeyForAwardName("  mvp 1ST place ")).toBe("war-week-mvp");
    expect(categoryKeyForAwardName("INSPIRE")).toBe("inspire");
    expect(categoryKeyForAwardName("Black   Midnight")).toBe("black-midnight");
  });

  it.each([
    "MVP 2nd Place",
    "MVP 3rd Place",
    "Hours Champ",
    "Top Billers",
    "Grow Your Own",
    "Midnight Clubhouse",
    "Settlers of Catan",
    "",
  ])("leaves %j untagged", (name) => {
    expect(categoryKeyForAwardName(name)).toBeNull();
  });
});
