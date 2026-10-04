import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { OrganizerGuide } from "./organizer-guide";

describe("OrganizerGuide", () => {
  const html = renderToStaticMarkup(
    <OrganizerGuide edition="xi" teamLabel="Squad" leaderTitle="Captain" />,
  );
  const text = html.replace(/<[^>]+>/g, " ");

  const topics = [
    "Finding your way",
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
    expect(html).toContain('href="/admin/settings"');
    expect(html).toContain('href="/admin/finale"');
    expect(html).toContain('href="/admin/organizers"');
    expect(html).toContain('href="/admin/competitions"');
  });

  it("says where You and Your Team show, and that Team standings aren't highlighted", () => {
    expect(text).toContain("Your Team");
    expect(text).toContain("Squad standings rows are not highlighted");
    expect(text).not.toMatch(/and their squad are highlighted/i);
  });

  it("runs a Bracket as R21 does: the kind toggle, Round edits, locks and corrections", () => {
    const flat = text.replace(/\s+/g, " ");
    expect(flat).toContain("Head-to-head or Group");
    expect(flat).toContain("3 to 8 Entrants per Match");
    expect(flat).toContain("Edit on each Round heading");
    expect(flat).toContain("A Round locks once it has a result");
    expect(flat).toContain("Change that Match first");
    expect(flat).toContain("Change that round first");
    expect(flat).toContain("clear results back from the latest one");
    expect(flat).not.toMatch(/resets the later Matches/);
  });

  it('says a Participant writes only with self-report on, and drops "enrolled"', () => {
    const flat = text.replace(/\s+/g, " ");
    expect(flat).not.toContain("enrolled");
    expect(flat).toMatch(
      /when &quot;Participants can log their own results&quot; is on/,
    );
  });

  it("never uses banned vocabulary", () => {
    expect(text).not.toMatch(
      /\b(event|tournament|member|league|heat|champion|game)s?\b/i,
    );
    expect(text).not.toMatch(/\b(un-?)?finali[sz]/i);
  });
});
