import { describe, expect, it } from "vitest";

import { groupTabSlug, resolveGroupTab } from "./competition-group-tab";

describe("groupTabSlug", () => {
  it("lowercases and hyphenates a Group name", () => {
    expect(groupTabSlug("Other Competitions")).toBe("other-competitions");
    expect(groupTabSlug("  Board & Card Games! ")).toBe("board-card-games");
  });
});

describe("resolveGroupTab", () => {
  const slugs = ["trivia-night", "outdoor", "other-competitions"];

  it("opens the tab the ?group value names", () => {
    expect(resolveGroupTab(slugs, "outdoor")).toBe("outdoor");
  });

  it("opens the first tab for an unknown or missing value", () => {
    expect(resolveGroupTab(slugs, "nope")).toBe("trivia-night");
    expect(resolveGroupTab(slugs, undefined)).toBe("trivia-night");
    expect(resolveGroupTab(slugs, ["outdoor", "x"])).toBe("trivia-night");
  });
});
