import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";
import { ABOUT_FALLBACK_THEME, ABOUT_FEATURES } from "@/lib/about";

const { getCurrentWarWeek } = vi.hoisted(() => ({
  getCurrentWarWeek: vi.fn(),
}));
vi.mock("@/queries/war-weeks", () => ({ getCurrentWarWeek }));

function warWeekFixture(overrides: Partial<WarWeek> = {}): WarWeek {
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
    primaryColor: "#00ff41",
    primaryForegroundColor: "#000000",
    accentColor: "#008f11",
    backgroundColor: "#000000",
    foregroundColor: "#d1ffd6",
    logoUrl: null,
    bannerUrl: null,
    fontPreset: "mono",
    wikiUrl: null,
    winner: null,
    highlights: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as WarWeek;
}

async function renderAbout() {
  const { default: AboutPage } = await import("./page");
  const element = await AboutPage();
  const html = renderToStaticMarkup(element);
  return {
    html,
    text: html.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'"),
  };
}

describe("AboutPage", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("with a live War Week, wears its Appearance Theme and links its button to it", async () => {
    const live = warWeekFixture({ edition: "xii", status: "live" });
    getCurrentWarWeek.mockResolvedValue(live);

    const { html, text } = await renderAbout();

    expect(html).toContain('href="/xii"');
    expect(text).toContain("Open War Week XII");
    expect(html).toContain(live.primaryColor);
    expect(html).toContain(live.backgroundColor);
  });

  it("with none live, falls back to the resolution getCurrentWarWeek already applies (next upcoming, else latest completed)", async () => {
    const upcoming = warWeekFixture({ edition: "xiii", status: "upcoming" });
    getCurrentWarWeek.mockResolvedValue(upcoming);

    const { html, text } = await renderAbout();

    expect(html).toContain('href="/xiii"');
    expect(text).toContain("Open War Week XIII");
  });

  it("with no War Week at all, falls back to a neutral theme and drops the Open War Week button", async () => {
    getCurrentWarWeek.mockResolvedValue(undefined);

    const { html, text } = await renderAbout();

    expect(html).not.toContain('href="/undefined"');
    expect(text).not.toContain("Open War Week");
    expect(text).toContain("No War Week yet");
    expect(html).toContain(ABOUT_FALLBACK_THEME.primaryColor);
  });

  it("shows the Finale as a still lower down the page, not the hero", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html } = await renderAbout();

    expect(html).toContain('src="/about/finale-poster.png"');
    expect(html).toContain('src="/about/finale-poster-dark.png"');
    expect(html).not.toContain("finale.mp4");
    expect(html).not.toMatch(/<video/i);
  });

  it("shows the Standings-moving-after-Discretionary-points stepper in the hero", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html, text } = await renderAbout();

    expect(html).toContain('src="/about/standings-before.png"');
    expect(html).toContain('src="/about/standings-entry.png"');
    expect(html).toContain('src="/about/standings-after.png"');
    expect(html).toContain('src="/about/standings-before-dark.png"');
    expect(html).toContain('src="/about/standings-entry-dark.png"');
    expect(html).toContain('src="/about/standings-after-dark.png"');
    expect(text).toContain("Discretionary points");
    // Accessible alt text on every step.
    expect(html).toMatch(/alt="[^"]*Standings[^"]*"/);
  });

  it("has a feature card for every entry in ABOUT_FEATURES", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html, text } = await renderAbout();

    for (const feature of ABOUT_FEATURES) {
      expect(html).toContain(`data-feature="${feature.slug}"`);
      expect(html).toContain(`src="/about/${feature.slug}.png"`);
      expect(html).toContain(`src="/about/${feature.slug}-dark.png"`);
      expect(text).toContain(feature.title);
    }
  });

  it("pairs every About still with a dark one, tagged by scheme for the viewer's Display to pick", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html } = await renderAbout();
    const imgs = html.match(/<img [^>]*>/g) ?? [];
    const stills = imgs.filter((img) => img.includes('src="/about/'));

    // 7 feature cards, 3 Standings steps and the Finale poster, each twice.
    expect(stills).toHaveLength(22);
    const light = stills.filter((img) =>
      img.includes('data-still-scheme="light"'),
    );
    const dark = stills.filter((img) =>
      img.includes('data-still-scheme="dark"'),
    );
    expect(light).toHaveLength(11);
    expect(dark).toHaveLength(11);
    for (const img of dark) {
      expect(img).toMatch(/src="\/about\/[a-z-]+-dark\.png"/);
      expect(img).toMatch(/alt="[^"]+"/);
      expect(img).toContain('loading="lazy"');
    }
    for (const img of light) expect(img).not.toContain("-dark.png");
  });

  it("says what the app is: approved headline, hero and one Why we built this", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { text } = await renderAbout();
    const flat = text.replace(/\s+/g, " ").replace(/ ([.,])/g, "$1");

    expect(flat).toContain("Everything War Week, in one place.");
    expect(flat).toContain(
      "The JG War Week app is where Jahnel Group runs War Week: the Story Theme, the schedule, the players, the Competitions, the points and the Finale, on every phone in the building.",
    );
    expect(flat).toContain(
      "War Week has run at Jahnel Group every year since 2016. Each year, the schedule, the Teams, the rules and the points were spread across a wiki page, Slack and a scoring tool, and Organizers spent the week answering what's on, where, and who's winning.",
    );
    expect(flat).toContain(
      "The JG War Week app is the one place for all of it. Organizers and Hosts run the week here, everyone else follows along from their phone, and past War Weeks are a tap away.",
    );
    expect(text.match(/Why we built this/g)).toHaveLength(1);
    expect(text).toContain("Jahnel Group War Week · since 2016");
    expect(text).toContain("Install app");
    expect(text).toContain(
      "Sign-in is Google, @jahnelgroup.com accounts only.",
    );
  });

  it("drops the removed copy and the maintainer pitch", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html, text } = await renderAbout();

    for (const phrase of [
      "no code",
      "light and dark",
      "Competiscore",
      "spreadsheets",
      "The history is back",
      "maintainer's guide",
      "Every still below",
      "Why it exists",
      "source is on",
    ]) {
      expect(text).not.toContain(phrase);
    }
    expect(html).not.toContain("maintainers-guide");
    expect(text).not.toMatch(/your team/i);
  });

  it("renders exactly the seven feature cards, in order", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { html } = await renderAbout();

    const slugs = [...html.matchAll(/data-feature="([^"]+)"/g)].map(
      (m) => m[1],
    );
    expect(slugs).toEqual([
      "organizer-admin",
      "schedule",
      "points",
      "announcements",
      "competitions",
      "league",
      "archive",
    ]);
    const titles = ABOUT_FEATURES.map((f) => f.title);
    expect(titles).toEqual([
      "Organizer and Host admin",
      "Schedule, Now and Next",
      "Points and Standings",
      "Announcements",
      "Competitions: Placements, Brackets, Head-to-head, Best score and Participation",
      "League: round robin and Swiss",
      "The Archive",
    ]);
  });

  it("mentions no build tooling and no banned terms", async () => {
    getCurrentWarWeek.mockResolvedValue(warWeekFixture());
    const { text } = await renderAbout();

    expect(text).not.toMatch(/claude code/i);
    expect(text).not.toMatch(/atlas/i);
    expect(text).not.toMatch(/\bagents?\b/i);
    expect(text).not.toMatch(
      /\b(event|tournament|member|heat|champion|game)s?\b/i,
    );
    expect(text).not.toMatch(/\b(un-?)?finali[sz]/i);
  });

  it("is dynamic, not statically prerendered with a stale War Week", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toMatch(/@\/queries\/war-weeks/);
  });
});
