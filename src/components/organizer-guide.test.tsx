import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrganizerGuide } from "./organizer-guide";

describe("OrganizerGuide", () => {
  const html = renderToStaticMarkup(
    <OrganizerGuide edition="xi" teamLabel="Squad" leaderTitle="Captain" />,
  );
  const text = html.replace(/<[^>]+>/g, " ");

  const topics = [
    "First-time setup order",
    "Organizers and Hosts",
    "What a Participant email does",
    "Discretionary points",
    "Placement Points",
    "Running a Bracket",
    "The Finale at closing ceremony",
    "Ending XI and starting the next War Week",
    "Announcements and Slack",
    "The seed warning",
  ];

  it("has an h2 for every guide topic", () => {
    for (const topic of topics) {
      expect(html).toMatch(new RegExp(`<h2[^>]*>${topic}`));
    }
  });

  it("uses the War Week's Team Label", () => {
    expect(text).toContain("Squad");
  });

  it("links to the setup, standings and Organizers admin pages", () => {
    expect(html).toContain('href="/admin/setup/war-week"');
    expect(html).toContain('href="/admin/standings"');
    expect(html).toContain('href="/admin/organizers"');
    expect(html).toContain('href="/admin/setup/competitions"');
  });

  it("never uses banned vocabulary", () => {
    expect(text).not.toMatch(/\b(event|tournament|member|match|league)s?\b/i);
  });
});
