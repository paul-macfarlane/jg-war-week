import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { WarWeekSettingsInput } from "@/lib/setup";

import { WarWeekSettingsForm } from "./war-week-settings-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/setup", () => ({ updateWarWeekSettings: vi.fn() }));

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

  it("hides the fields in a free-for-all but still posts the saved values", () => {
    const html = render("free-for-all");
    expect(html).not.toContain(">Team Label</label>");
    expect(html).not.toContain(">Leader Title</label>");
    expect(html).toContain('type="hidden" name="teamLabel" value="House"');
    expect(html).toContain('type="hidden" name="leaderTitle" value="Captain"');
  });
});
