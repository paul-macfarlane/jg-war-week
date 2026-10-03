import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";

vi.mock("@/app/[edition]/war-week", () => ({
  getNavAccount: vi.fn(async () => ({
    email: "o@jahnelgroup.com",
    name: "o",
    canOpenAdmin: false,
  })),
}));
vi.mock("@/queries/roster", () => ({
  getYouCandidates: vi.fn(async () => []),
}));
vi.mock("@/queries/profile-join", () => ({
  getProfilesByEmail: vi.fn(async () => new Map()),
}));
vi.mock("@/components/primary-nav", () => ({
  TopNav: () => null,
  BottomTabBar: () => null,
}));

const fakeWarWeek = {
  edition: "xi",
  storyTheme: "Test theme",
  mode: "teams",
  teamLabel: "Team",
  status: "live",
  primaryColor: "#000",
  primaryForegroundColor: "#fff",
  accentColor: "#000",
  backgroundColor: "#fff",
  foregroundColor: "#000",
  fontPreset: "sans",
} as unknown as WarWeek;

describe("WarWeekChrome", () => {
  it("stacks the themed root as a flex column so the footer sits at the bottom on short pages", async () => {
    const { WarWeekChrome } = await import("./war-week-chrome");

    const element = await WarWeekChrome({
      warWeek: fakeWarWeek,
      children: <main data-testid="content">short page</main>,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toMatch(/class="[^"]*\bflex\b[^"]*\bflex-col\b[^"]*"/);
    expect(html).toContain('data-testid="content"');
  });

  it("wraps children in a plain block flex-1 div so page content can stretch to its own max-width instead of shrinking to content width", async () => {
    const { WarWeekChrome } = await import("./war-week-chrome");

    const element = await WarWeekChrome({
      warWeek: fakeWarWeek,
      children: <main data-testid="content">short page</main>,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toMatch(/<div class="flex-1"><main data-testid="content">/);
  });
});
