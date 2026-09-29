import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeek } from "@/db/schema";

vi.mock("./war-week", () => ({
  getWarWeekForEdition: vi.fn(async () => fakeWarWeek),
  getNavAccount: vi.fn(async () => ({
    email: "o@jahnelgroup.com",
    canOpenAdmin: false,
  })),
}));
vi.mock("@/queries/roster", () => ({
  getYouCandidates: vi.fn(async () => []),
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

describe("EditionLayout", () => {
  it("stacks the themed root as a flex column so the footer sits at the bottom on short pages", async () => {
    const { default: EditionLayout } = await import("./layout");

    const element = await EditionLayout({
      params: Promise.resolve({ edition: "xi" }),
      children: <main data-testid="content">short page</main>,
    });
    const html = renderToStaticMarkup(element);

    expect(html).toMatch(/class="[^"]*\bflex\b[^"]*\bflex-col\b[^"]*"/);
    expect(html).toContain('data-testid="content"');
  });
});
