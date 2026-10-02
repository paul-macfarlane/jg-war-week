import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeekSettingsInput } from "@/lib/setup";

import { WarWeekSettingsForm } from "./war-week-settings-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/setup", () => ({ updateWarWeekSettingsFields: vi.fn() }));

const initial: WarWeekSettingsInput = {
  storyTheme: "Space",
  startDate: "2027-02-22",
  endDate: "2027-02-26",
  mode: "teams",
  teamLabel: "House",
  leaderTitle: "Captain",
  slackChannelUrl: "https://example.slack.com/archives/C1",
  wikiUrl: "",
  primaryColor: "#112233",
  primaryForegroundColor: "#ffffff",
  accentColor: "#445566",
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  overridePrimaryColor: "",
  overridePrimaryForegroundColor: "",
  overrideAccentColor: "",
  overrideBackgroundColor: "",
  overrideForegroundColor: "",
  logoUrl: "",
  bannerUrl: "",
  fontPreset: "sans",
  winner: "",
  highlights: "",
};

function render(mode: string) {
  return renderToStaticMarkup(
    <WarWeekSettingsForm
      warWeekId="ww"
      headingId="war-week-settings-heading"
      initial={{ ...initial, mode }}
      dayDates={[]}
      teamSwatches={[]}
    />,
  );
}

describe("WarWeekSettingsForm Team Label and Leader Title", () => {
  it("shows both fields with their saved values in a teams War Week", () => {
    const html = render("teams");
    expect(html).toContain(">Team Label</label>");
    expect(html).toContain(">Leader Title</label>");
    expect(html).toContain('value="House"');
    expect(html).toContain('value="Captain"');
  });

  it("hides the fields in a free-for-all", () => {
    const html = render("free-for-all");
    expect(html).not.toContain(">Team Label</label>");
    expect(html).not.toContain(">Leader Title</label>");
  });
});

describe("WarWeekSettingsForm autosave", () => {
  it("has no Save button and says changes save themselves", () => {
    const html = render("teams");
    expect(html).not.toContain("Save settings");
    expect(html).not.toContain('type="submit"');
    expect(html).toMatch(
      /<p[^>]*role="status"[^>]*data-slot="autosave-status"[^>]*>Changes save automatically<\/p>/,
    );
  });

  it("puts the save status beside the War Week settings heading", () => {
    const html = render("teams");
    expect(html).toMatch(
      /<h2 id="war-week-settings-heading"[^>]*>War Week settings<\/h2><p[^>]*data-slot="autosave-status"/,
    );
  });
});
