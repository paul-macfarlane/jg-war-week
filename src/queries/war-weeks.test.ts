import { describe, expect, it } from "vitest";

import { WarWeek } from "@/db/schema";
import { selectCurrentWarWeek } from "@/queries/war-weeks";

function warWeekFixture(overrides: Partial<WarWeek>): WarWeek {
  return {
    id: overrides.id ?? crypto.randomUUID(),
    edition: overrides.edition ?? "i",
    editionNumber: overrides.editionNumber ?? 1,
    year: overrides.year ?? 2016,
    startDate: overrides.startDate ?? "2016-01-01",
    endDate: overrides.endDate ?? "2016-01-05",
    storyTheme: overrides.storyTheme ?? "Test Theme",
    status: overrides.status ?? "complete",
    mode: overrides.mode ?? "teams",
    teamLabel: overrides.teamLabel ?? "Team",
    leaderTitle: overrides.leaderTitle ?? "Captain",
    slackChannelUrl:
      overrides.slackChannelUrl ?? "https://example.slack.com/archives/x",
    primaryColor: overrides.primaryColor ?? "#000000",
    primaryForegroundColor: overrides.primaryForegroundColor ?? "#ffffff",
    accentColor: overrides.accentColor ?? "#000000",
    backgroundColor: overrides.backgroundColor ?? "#ffffff",
    foregroundColor: overrides.foregroundColor ?? "#000000",
    logoUrl: overrides.logoUrl ?? null,
    bannerUrl: overrides.bannerUrl ?? null,
    fontPreset: overrides.fontPreset ?? "sans",
    wikiUrl: overrides.wikiUrl ?? null,
    winner: overrides.winner ?? null,
    highlights: overrides.highlights ?? [],
    createdAt: overrides.createdAt ?? new Date(),
    updatedAt: overrides.updatedAt ?? new Date(),
  };
}

describe("selectCurrentWarWeek", () => {
  it("returns undefined for an empty list", () => {
    expect(selectCurrentWarWeek([])).toBeUndefined();
  });

  it("prefers a live War Week over anything else", () => {
    const live = warWeekFixture({
      edition: "xi",
      editionNumber: 11,
      status: "live",
      startDate: "2026-02-22",
    });
    const upcoming = warWeekFixture({
      edition: "xii",
      editionNumber: 12,
      status: "upcoming",
      startDate: "2027-02-22",
    });
    const complete = warWeekFixture({
      edition: "x",
      editionNumber: 10,
      status: "complete",
      startDate: "2025-02-22",
    });
    expect(selectCurrentWarWeek([complete, upcoming, live])).toEqual(live);
  });

  it("falls back to the next upcoming War Week (earliest start) when none is live", () => {
    const upcomingSoon = warWeekFixture({
      edition: "xi",
      editionNumber: 11,
      status: "upcoming",
      startDate: "2026-02-22",
    });
    const upcomingLater = warWeekFixture({
      edition: "xii",
      editionNumber: 12,
      status: "upcoming",
      startDate: "2027-02-22",
    });
    expect(selectCurrentWarWeek([upcomingLater, upcomingSoon])).toEqual(
      upcomingSoon,
    );
  });

  it("falls back to the most recent complete War Week when none is live or upcoming", () => {
    const older = warWeekFixture({
      edition: "ix",
      editionNumber: 9,
      status: "complete",
      startDate: "2024-02-22",
    });
    const newer = warWeekFixture({
      edition: "x",
      editionNumber: 10,
      status: "complete",
      startDate: "2025-02-22",
    });
    expect(selectCurrentWarWeek([older, newer])).toEqual(newer);
  });

  it("never lets a complete War Week newer by date beat an upcoming one", () => {
    const upcoming = warWeekFixture({
      edition: "xi",
      editionNumber: 11,
      status: "upcoming",
      startDate: "2026-02-22",
    });
    const completeButNewer = warWeekFixture({
      edition: "xii",
      editionNumber: 12,
      status: "complete",
      startDate: "2027-06-01",
    });
    expect(selectCurrentWarWeek([upcoming, completeButNewer])).toEqual(
      upcoming,
    );
  });

  it("breaks a complete startDate tie by the highest editionNumber", () => {
    const lowerEdition = warWeekFixture({
      edition: "x",
      editionNumber: 10,
      status: "complete",
      startDate: "2026-02-22",
    });
    const higherEdition = warWeekFixture({
      edition: "xi",
      editionNumber: 11,
      status: "complete",
      startDate: "2026-02-22",
    });
    expect(selectCurrentWarWeek([lowerEdition, higherEdition])).toEqual(
      higherEdition,
    );
  });

  it("breaks an upcoming startDate tie by the lowest editionNumber", () => {
    const lowerEdition = warWeekFixture({
      edition: "xii",
      editionNumber: 12,
      status: "upcoming",
      startDate: "2027-02-22",
    });
    const higherEdition = warWeekFixture({
      edition: "xiii",
      editionNumber: 13,
      status: "upcoming",
      startDate: "2027-02-22",
    });
    expect(selectCurrentWarWeek([higherEdition, lowerEdition])).toEqual(
      lowerEdition,
    );
  });

  it("never uses the clock: an old start date is still returned when it is the only War Week", () => {
    const ancient = warWeekFixture({
      edition: "i",
      editionNumber: 1,
      status: "upcoming",
      startDate: "2016-01-01",
    });
    expect(selectCurrentWarWeek([ancient])).toEqual(ancient);
  });
});
