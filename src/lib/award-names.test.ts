import { describe, expect, it } from "vitest";

import {
  FORMER_CATEGORY_NAMES,
  awardNameList,
  awardNameSlug,
  awardPresets,
} from "@/lib/award-names";

describe("awardNameSlug", () => {
  it.each([
    ["Billable Hours Champ", "billable-hours-champ"],
    ["War Week MVP", "war-week-mvp"],
    ["Super Smash Bros. Champion", "super-smash-bros-champion"],
    ["  Wizard's   Chess -- Champion! ", "wizard-s-chess-champion"],
    ["MVP 1st Place", "mvp-1st-place"],
    ["!!!", ""],
  ])("turns %j into %j", (name, slug) => {
    expect(awardNameSlug(name)).toBe(slug);
  });

  it("is the same for names that differ only in case", () => {
    expect(awardNameSlug("BILLABLE hours champ")).toBe(
      awardNameSlug("Billable Hours Champ"),
    );
  });
});

describe("awardPresets", () => {
  it("treats names that differ only in case or punctuation as one preset", () => {
    const presets = awardPresets([
      { name: "Best Dressed!", description: null },
      { name: "best-dressed", description: "Fashion" },
      { name: "Grow!", description: null },
    ]);
    expect(presets.filter((p) => /best/i.test(p.name))).toEqual([
      { name: "Best Dressed!", description: "Fashion" },
    ]);
    expect(presets.filter((p) => /^grow/i.test(p.name))).toEqual([
      { name: "Grow!", description: null },
    ]);
  });

  it("lists the seven former Category names with no Awards at all", () => {
    expect(awardPresets([]).map((p) => p.name)).toEqual([
      "Billable Hours Champ",
      "Black Midnight",
      "Grind",
      "Grow",
      "Inspire",
      "Serve",
      "War Week MVP",
    ]);
    expect(FORMER_CATEGORY_NAMES).toHaveLength(7);
  });

  it("adds past names once, case-insensitively, with the newest spelling and description", () => {
    const presets = awardPresets([
      { name: "Chess Tournament Champion", description: "Newest" },
      { name: "chess tournament champion", description: "Older" },
      { name: "Billable Hours Champ", description: null },
      { name: "billable hours champ", description: "Most hours" },
    ]);
    expect(presets).toContainEqual({
      name: "Chess Tournament Champion",
      description: "Newest",
    });
    expect(
      presets.filter(
        (p) => p.name.toLowerCase() === "chess tournament champion",
      ),
    ).toHaveLength(1);
    // The newest spelling wins; an empty newest description falls back to the
    // most recent one that has text.
    expect(
      presets.filter((p) => p.name.toLowerCase() === "billable hours champ"),
    ).toEqual([{ name: "Billable Hours Champ", description: "Most hours" }]);
  });
});

describe("awardNameList", () => {
  it("lists one entry per slug, by name, with the newest spelling", () => {
    expect(
      awardNameList([
        "Grow",
        "MVP 1st Place",
        "billable hours champ",
        "Billable Hours Champ",
        "grow",
        "!!!",
      ]),
    ).toEqual([
      { slug: "billable-hours-champ", name: "billable hours champ" },
      { slug: "grow", name: "Grow" },
      { slug: "mvp-1st-place", name: "MVP 1st Place" },
    ]);
  });
});
