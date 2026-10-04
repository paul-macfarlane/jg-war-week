import { describe, expect, it } from "vitest";

import type { WarWeek } from "@/db/schema";
import type { ArchiveDetail } from "@/lib/archive";
import { toHistoryListResult, toHistoryResult } from "@/mcp/history";

function warWeekFixture(overrides: Partial<WarWeek>): WarWeek {
  return {
    id: crypto.randomUUID(),
    edition: "viii",
    editionNumber: 8,
    year: 2023,
    startDate: "2023-02-26",
    endDate: "2023-03-03",
    storyTheme: "Harry Potter",
    status: "complete",
    mode: "teams",
    teamLabel: "House",
    leaderTitle: "Head of House",
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
    fontPreset: "serif",
    wikiUrl: "https://wiki.example/war-week-2023",
    winner: "Slytherin",
    highlights: ["Slytherin won the House Cup."],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("toHistoryListResult", () => {
  it("summarizes each past War Week in the order given", () => {
    const viii = warWeekFixture({});
    const i = warWeekFixture({
      edition: "i",
      editionNumber: 1,
      year: 2016,
      storyTheme: "War Week 2016",
      winner: null,
      highlights: [],
      wikiUrl: null,
    });

    expect(toHistoryListResult([viii, i])).toEqual({
      warWeeks: [
        {
          edition: "viii",
          year: 2023,
          startDate: "2023-02-26",
          endDate: "2023-03-03",
          storyTheme: "Harry Potter",
          winner: "Slytherin",
          wikiUrl: "https://wiki.example/war-week-2023",
        },
        {
          edition: "i",
          year: 2016,
          startDate: "2023-02-26",
          endDate: "2023-03-03",
          storyTheme: "War Week 2016",
          winner: null,
          wikiUrl: null,
        },
      ],
    });
  });
});

describe("toHistoryResult", () => {
  it("returns the full detail with Teams, Awards and highlights", () => {
    const detail: ArchiveDetail = {
      warWeek: warWeekFixture({}),
      teams: [{ name: "Slytherin", color: "#1a472a" }],
      awards: [
        {
          name: "House Cup",
          description: "Highest total.",
          team: "Slytherin",
          participants: [],
        },
      ],
    };

    expect(toHistoryResult(2023, detail)).toEqual({
      found: true,
      edition: "viii",
      editionNumber: 8,
      year: 2023,
      startDate: "2023-02-26",
      endDate: "2023-03-03",
      storyTheme: "Harry Potter",
      mode: "teams",
      teamLabel: "House",
      winner: "Slytherin",
      teams: [{ name: "Slytherin", color: "#1a472a" }],
      awards: [
        {
          name: "House Cup",
          description: "Highest total.",
          team: "Slytherin",
          participants: [],
        },
      ],
      highlights: ["Slytherin won the House Cup."],
      wikiUrl: "https://wiki.example/war-week-2023",
    });
  });

  it("does not leak organizer emails or theme internals", () => {
    const result = toHistoryResult(2023, {
      warWeek: warWeekFixture({}),
      teams: [],
      awards: [],
    });
    expect(JSON.stringify(result)).not.toContain("organizer@");
    expect(result).not.toHaveProperty("primaryColor");
  });

  it("returns a clear not-found result for an unknown year", () => {
    expect(toHistoryResult(2030, undefined)).toEqual({
      found: false,
      year: 2030,
      message:
        "No past War Week found for 2030. The Archive holds complete War Weeks only: call list_history for its years, or get_current_war_week for the live or upcoming one.",
    });
  });
});
