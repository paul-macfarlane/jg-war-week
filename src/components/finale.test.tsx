import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { FinaleSlideData } from "@/lib/finale-slides";
import type { Standings } from "@/lib/standings";

import { FinaleSlideshow } from "./finale";

const standings: Standings = {
  main: "team",
  team: [
    { id: "t1", name: "Blue", color: "#00f", total: 12.5, rank: 1 },
    { id: "t2", name: "Red", color: "#f00", total: 11, rank: 2 },
  ],
  individual: [],
};

const standingsSlide: FinaleSlideData = {
  key: "standings",
  kind: "standings",
  name: "Standings countdown",
  standings,
  teamLabel: "Team",
  primaryColor: "#00ff41",
};

const defaultSlides: FinaleSlideData[] = [
  {
    key: "title",
    kind: "title",
    name: "Title",
    edition: "xi",
    year: 2026,
    storyTheme: "The Matrix",
    logoUrl: null,
    bannerUrl: null,
  },
  {
    key: "numbers",
    kind: "numbers",
    name: "By the numbers",
    figures: [{ label: "Points Entries", value: "2" }],
  },
  {
    key: "awards",
    kind: "awards",
    name: "Awards",
    heading: "Awards",
    primaryColor: "#00ff41",
    groups: [
      {
        key: "other",
        name: null,
        awards: [
          {
            id: "a1",
            name: "Catan Champion",
            description: null,
            team: { name: "Red", color: "#f00" },
            participants: [],
          },
        ],
      },
    ],
  },
  {
    key: "winners",
    kind: "winners",
    name: "Winners",
    primaryColor: "#00ff41",
    winners: [
      {
        competitionId: "c1",
        competition: "Pool",
        format: "head-to-head",
        label: "Winner",
        title: "Blue",
        winners: [{ id: "t1", name: "Blue", color: "#00f", kind: "team" }],
      },
    ],
  },
  standingsSlide,
  {
    key: "winner",
    kind: "winner",
    name: "Winner",
    title: "Blue",
    tie: false,
    primaryColor: "#00ff41",
    rows: [
      { id: "t1", name: "Blue", total: "12.5", color: "#00f", kind: "team" },
    ],
  },
];

function render(
  slides: FinaleSlideData[],
  { isOrganizer = false }: { isOrganizer?: boolean } = {},
) {
  const html = renderToStaticMarkup(
    <FinaleSlideshow
      slides={slides}
      edition="xi"
      storyTheme="The Matrix"
      isOrganizer={isOrganizer}
    />,
  );
  return { html, text: html.replace(/<[^>]+>/g, " ") };
}

describe("FinaleSlideshow", () => {
  it("opens on the first slide, with the slide count and the hint", () => {
    const { html, text } = render(defaultSlides);
    expect(html).toContain('data-finale-slide="title"');
    expect(html).toContain('data-finale-slide-index="0"');
    expect(html).toMatch(/<section[^>]*aria-label="Title"/);
    expect(text).toContain("Slide 1 of 6: Title");
    expect(text).toContain("War Week XI");
    expect(text).toContain("→ next · ← back");
    expect(html).toMatch(/<a[^>]*href="\/xi"[^>]*>[^<]*Exit/);
  });

  it("shows no Standings names or totals on the first slide, so nothing is spoiled", () => {
    const { html, text } = render(defaultSlides);
    expect(text).not.toContain("Blue");
    expect(text).not.toContain("Red");
    expect(text).not.toContain("12.5");
    expect(html).not.toContain("data-finale=");
    expect(html).not.toMatch(/<button[^>]*>[^<]*Start/);
  });

  it("plays the Standings countdown on arrival, with no Start button", () => {
    const { html, text } = render([
      standingsSlide,
      ...defaultSlides.slice(0, 1),
    ]);
    expect(html).toContain('data-finale-slide="standings"');
    expect(html).toContain('data-finale="playing"');
    expect(html).not.toContain('data-finale="ready"');
    expect(html).not.toMatch(/<button[^>]*>[^<]*Start/);
    expect(text).toContain("Team standings");
  });

  it("says there's nothing to show when every slide is hidden, linking an Organizer to set it up", () => {
    const participant = render([]);
    expect(participant.text).toContain("Nothing to show yet.");
    expect(participant.html).not.toContain("Set up the Finale");

    const organizer = render([], { isOrganizer: true });
    expect(organizer.html).toMatch(
      /<a[^>]*href="\/admin\/finale"[^>]*>Set up the Finale<\/a>/,
    );
  });

  it("renders a Custom slide's heading and body, escaped, on its background with readable text colors", () => {
    const { html } = render([
      {
        key: "c1",
        kind: "custom",
        name: "Thank you",
        heading: "Thank you",
        body: {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "See you <b>next year</b>" }],
            },
          ],
        },
        backgroundColor: "#101827",
        colors: {
          "--foreground": "#ffffff",
          "--muted-foreground": "#cccccc",
          "--primary-text": "#99bbff",
          "--link": "#99bbff",
        },
      },
    ]);
    expect(html).toContain('data-finale-slide="custom"');
    expect(html).toMatch(/<h1[^>]*>Thank you<\/h1>/);
    expect(html).toContain("See you &lt;b&gt;next year&lt;/b&gt;");
    expect(html).not.toContain("<b>next year");
    expect(html).toContain("background-color:#101827");
    expect(html).toContain("--foreground:#ffffff");
    expect(html).toContain("--muted-foreground:#cccccc");
  });

  it("leaves the stage on the theme's background for a Custom slide with none", () => {
    const { html } = render([
      {
        key: "c1",
        kind: "custom",
        name: "Hello",
        heading: "Hello",
        body: null,
        backgroundColor: null,
        colors: null,
      },
    ]);
    expect(html).not.toContain("background-color:");
    expect(html).toMatch(/<h1[^>]*>Hello<\/h1>/);
  });
});
