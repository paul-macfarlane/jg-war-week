import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";
import { ABOUT_FALLBACK_THEME } from "@/lib/about";
import { warWeekThemeStyle } from "@/lib/theme";

const { getCurrentWarWeek } = vi.hoisted(() => ({
  getCurrentWarWeek: vi.fn(),
}));
vi.mock("@/queries/war-weeks", () => ({ getCurrentWarWeek }));

function warWeekFixture(): WarWeek {
  return {
    id: "ww-1",
    edition: "xii",
    editionNumber: 12,
    year: 2027,
    startDate: "2027-02-22",
    endDate: "2027-02-26",
    storyTheme: "Test Theme",
    status: "live",
    mode: "teams",
    teamLabel: "Team",
    leaderTitle: "Captain",
    slackChannelUrl: "https://example.slack.com/archives/x",
    primaryColor: "#123456",
    primaryForegroundColor: "#fedcba",
    accentColor: "#abcdef",
    backgroundColor: "#0f0f0f",
    foregroundColor: "#f0f0f0",
    logoUrl: null,
    bannerUrl: null,
    fontPreset: "serif",
    overridePrimaryColor: null,
    overridePrimaryForegroundColor: null,
    overrideAccentColor: null,
    overrideBackgroundColor: null,
    overrideForegroundColor: null,
    wikiUrl: null,
    winner: null,
    highlights: [],
    finaleAwardsLayout: "one-slide",
    createdAt: new Date(),
    updatedAt: new Date(),
  } as WarWeek;
}

/** The inline style the page's themed root carries, as serialized HTML. */
function styleAttr(style: object): string {
  return renderToStaticMarkup(<div style={style} />).match(
    /style="([^"]*)"/,
  )![1];
}

async function render() {
  const { default: Page } = await import("./page");
  const html = renderToStaticMarkup(await Page());
  return { html, text: html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") };
}

describe("PrivacyPage", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("wears the current War Week's Appearance Theme", async () => {
    const current = warWeekFixture();
    getCurrentWarWeek.mockResolvedValue(current);
    const { html } = await render();
    expect(html).toContain(styleAttr(warWeekThemeStyle(current)));
  });

  it("with no War Week, wears the neutral fallback theme", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { html } = await render();
    expect(html).toContain(styleAttr(warWeekThemeStyle(ABOUT_FALLBACK_THEME)));
  });

  it("names the Jahnel Group admins as the contact", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { text } = await render();
    expect(text).toContain("contact the Jahnel Group admins.");
    expect(text).toContain("delete your own account from your Profile page");
    expect(text).not.toContain("War Week Organizers or Jahnel Group");
    expect(text).toContain("Last updated: October 2, 2026");
  });

  it("mentions the key data inventory", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { text } = await render();
    expect(text).toMatch(/profile picture/i);
    expect(text).toMatch(/IP address/i);
    expect(text).toMatch(/Company Tag/i);
    expect(text).toMatch(/Vercel/i);
    expect(text).toMatch(/Neon/i);
  });

  it("says who sees the emails of whoever did what", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { text } = await render();
    expect(text).toMatch(
      /Organizer email list is kept once, for every War Week/,
    );
    expect(text).toMatch(
      /Points Entry is shown in Admin to Organizers and to that Competition.{1,6}s Hosts/,
    );
    expect(text).toMatch(
      /log Matches and Attempts, and report Bracket Matches/,
    );
    expect(text).toMatch(/kept for audit and never shown/);
  });

  it("says there is no analytics and shows no email address", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { html, text } = await render();
    expect(text).not.toMatch(/post(s|ed|ing)? to Slack/i);
    expect(text).toMatch(/no analytics/i);
    expect(text.match(/analytics/gi)).toHaveLength(1);
    expect(html).not.toContain("mailto:");
  });

  it("is dynamic and mentions no banned terms", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);
    const { text } = await render();
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(text).not.toMatch(
      /\b(event|tournament|member|league|heat|champion|game)s?\b/i,
    );
    expect(text).not.toMatch(/\b(un-?)?finali[sz]/i);
  });
});
