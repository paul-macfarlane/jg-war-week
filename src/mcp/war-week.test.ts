import { describe, expect, it } from "vitest";

import { WarWeek } from "@/db/schema";
import { toCurrentWarWeekResult } from "@/mcp/war-week";

function warWeekFixture(overrides: Partial<WarWeek>): WarWeek {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    edition: overrides.edition ?? "xi",
    editionNumber: overrides.editionNumber ?? 11,
    year: overrides.year ?? 2026,
    startDate: overrides.startDate ?? "2026-09-21",
    endDate: overrides.endDate ?? "2026-09-25",
    storyTheme: overrides.storyTheme ?? "The Matrix",
    status: overrides.status ?? "live",
    mode: overrides.mode ?? "teams",
    teamLabel: overrides.teamLabel ?? "Team",
    leaderTitle: overrides.leaderTitle ?? "Captain",
    slackChannelUrl:
      overrides.slackChannelUrl ??
      "https://jahnelgroup.slack.com/archives/war-week-xi",
    primaryColor: overrides.primaryColor ?? "#00ff41",
    primaryForegroundColor: overrides.primaryForegroundColor ?? "#000000",
    accentColor: overrides.accentColor ?? "#00ff41",
    backgroundColor: overrides.backgroundColor ?? "#000000",
    foregroundColor: overrides.foregroundColor ?? "#00ff41",
    overridePrimaryColor: null,
    overridePrimaryForegroundColor: null,
    overrideAccentColor: null,
    overrideBackgroundColor: null,
    overrideForegroundColor: null,
    logoUrl: overrides.logoUrl ?? null,
    bannerUrl: overrides.bannerUrl ?? null,
    fontPreset: overrides.fontPreset ?? "mono",
    wikiUrl: overrides.wikiUrl ?? null,
    winner: overrides.winner ?? null,
    highlights: overrides.highlights ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

describe("toCurrentWarWeekResult", () => {
  it("serializes a War Week into the MCP tool payload shape", () => {
    const warWeek = warWeekFixture({});

    const result = toCurrentWarWeekResult(warWeek);

    expect(result).toEqual({
      edition: "xi",
      editionNumber: 11,
      year: 2026,
      startDate: "2026-09-21",
      endDate: "2026-09-25",
      storyTheme: "The Matrix",
      status: "live",
      mode: "teams",
      teamLabel: "Team",
      leaderTitle: "Captain",
      slackChannelUrl: "https://jahnelgroup.slack.com/archives/war-week-xi",
    });
  });

  it("returns { warWeek: null } when there is no current War Week", () => {
    const result = toCurrentWarWeekResult(undefined);

    expect(result).toEqual({ warWeek: null });
  });
});
