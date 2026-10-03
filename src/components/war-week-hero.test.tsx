import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { WarWeek } from "@/db/schema";

import { WarWeekHero } from "./war-week-hero";

const fakeWarWeek = {
  edition: "xii",
  status: "live",
  logoUrl: null,
  storyTheme: "Test theme",
  primaryColor: "#000",
  primaryForegroundColor: "#fff",
  accentColor: "#000",
  backgroundColor: "#fff",
  foregroundColor: "#000",
  fontPreset: "sans",
  year: 2027,
  startDate: "2027-02-01",
  endDate: "2027-02-05",
} as unknown as WarWeek;

describe("WarWeekHero", () => {
  it("names the War Week once and draws no banner when there is no Banner URL", () => {
    const html = renderToStaticMarkup(
      <WarWeekHero warWeek={{ ...fakeWarWeek, bannerUrl: null }} />,
    );

    const warWeekMatches = html.match(/War Week XII/g) ?? [];
    expect(warWeekMatches).toHaveLength(1);
    expect(html).not.toContain("<img");
  });

  it("draws the banner when the War Week has a Banner URL", () => {
    const html = renderToStaticMarkup(
      <WarWeekHero
        warWeek={{
          ...fakeWarWeek,
          bannerUrl: "https://example.com/banner.jpg",
        }}
      />,
    );

    expect(html).toContain("<img");
    expect(html).toContain('src="https://example.com/banner.jpg"');
    expect(html).toContain('alt="War Week XII banner"');
  });
});
