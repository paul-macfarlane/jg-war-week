import { describe, expect, it } from "vitest";

import type { WarWeek } from "@/db/schema";
import {
  type ArchiveDetail,
  awardRecipients,
  isArchived,
  isLinkOnly,
  selectArchive,
} from "@/lib/archive";

function warWeekFixture(overrides: Partial<WarWeek>): WarWeek {
  return {
    id: crypto.randomUUID(),
    edition: "i",
    editionNumber: 1,
    year: 2016,
    startDate: "2016-01-01",
    endDate: "2016-01-05",
    storyTheme: "Test Theme",
    status: "complete",
    mode: "teams",
    teamLabel: "Team",
    leaderTitle: "Captain",
    slackChannelUrl: "https://example.slack.com",
    primaryColor: "#000000",
    primaryForegroundColor: "#ffffff",
    accentColor: "#000000",
    backgroundColor: "#ffffff",
    foregroundColor: "#000000",
    overridePrimaryColor: null,
    overridePrimaryForegroundColor: null,
    overrideAccentColor: null,
    overrideBackgroundColor: null,
    overrideForegroundColor: null,
    logoUrl: null,
    bannerUrl: null,
    fontPreset: "sans",
    wikiUrl: null,
    winner: null,
    highlights: [],
    finaleAwardsLayout: "one-slide",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function detailFixture(overrides: Partial<ArchiveDetail>): ArchiveDetail {
  return {
    warWeek: warWeekFixture({}),
    teams: [],
    awards: [],
    ...overrides,
  };
}

describe("selectArchive", () => {
  it("keeps only complete War Weeks, newest year first", () => {
    const i = warWeekFixture({ edition: "i", year: 2016 });
    const viii = warWeekFixture({ edition: "viii", year: 2023 });
    const x = warWeekFixture({ edition: "x", year: 2025 });
    const xi = warWeekFixture({ edition: "xi", year: 2026, status: "live" });
    const xii = warWeekFixture({
      edition: "xii",
      year: 2027,
      status: "upcoming",
    });

    expect(selectArchive([i, xi, x, xii, viii])).toEqual([x, viii, i]);
  });

  it("returns an empty list when nothing is complete", () => {
    expect(selectArchive([warWeekFixture({ status: "live" })])).toEqual([]);
  });
});

describe("isArchived", () => {
  it("archives complete War Weeks only", () => {
    expect(isArchived({ status: "complete" })).toBe(true);
    expect(isArchived({ status: "live" })).toBe(false);
    expect(isArchived({ status: "upcoming" })).toBe(false);
  });
});

describe("isLinkOnly", () => {
  it("is link-only with no winner, Teams or Awards", () => {
    expect(
      isLinkOnly(
        detailFixture({
          warWeek: warWeekFixture({ highlights: ["The first War Week."] }),
        }),
      ),
    ).toBe(true);
  });

  it("is not link-only once a winner is stored", () => {
    expect(
      isLinkOnly(
        detailFixture({ warWeek: warWeekFixture({ winner: "Slytherin" }) }),
      ),
    ).toBe(false);
  });

  it("is not link-only with Teams", () => {
    expect(
      isLinkOnly(detailFixture({ teams: [{ name: "Red", color: "#f00" }] })),
    ).toBe(false);
  });

  it("is not link-only with Awards", () => {
    expect(
      isLinkOnly(
        detailFixture({
          awards: [
            { name: "MVP", description: null, team: null, participants: [] },
          ],
        }),
      ),
    ).toBe(false);
  });
});

describe("awardRecipients", () => {
  it("lists the Team first, then Participants", () => {
    expect(
      awardRecipients({
        name: "Beer Pong",
        description: null,
        team: "Slytherin",
        participants: ["Dom Favata", "Lucas Fernandes"],
      }),
    ).toBe("Slytherin · Dom Favata, Lucas Fernandes");
  });

  it("is empty when there are no recipients", () => {
    expect(
      awardRecipients({
        name: "Spirit",
        description: null,
        team: null,
        participants: [],
      }),
    ).toBe("");
  });
});
