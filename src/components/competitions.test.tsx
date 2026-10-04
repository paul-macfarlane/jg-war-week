import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompetitionListItem } from "@/lib/competitions";
import type { Content } from "@/lib/rich-text/content";

import { CompetitionFacts, CompetitionList } from "./competitions";

const competition: CompetitionListItem = {
  id: "c1",
  name: "Bouncy Pong",
  description: null,
  scoring: "individual",
  countsTowardTeam: false,
  competitionGroup: null,
  format: "head-to-head",
};

describe("CompetitionFacts", () => {
  it("names a Head-to-head Competition's Format", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts competition={competition} teamLabel="House" />,
    );
    expect(html).toContain("Head-to-head");
  });

  it("names a Best score Competition's Format", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts
        competition={{ ...competition, format: "best-score" }}
        teamLabel="House"
      />,
    );
    expect(html).toContain("Best score");
  });

  it("shows only the scoring and Format badges, with no points-cap badge", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts competition={competition} teamLabel="House" />,
    );
    expect(html).not.toMatch(/\bpts?\b|\bcap\b|\bmax\b/i);
    expect(html.match(/<span/g)).toHaveLength(2);
  });

  it("shows no Games Format badge for another Format", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts
        competition={{ ...competition, format: "placement" }}
        teamLabel="House"
      />,
    );
    expect(html).not.toMatch(/Head-to-head|Best score|Games/);
  });
});

describe("CompetitionList", () => {
  const description: Content = {
    type: "doc",
    content: [
      {
        type: "heading",
        attrs: { level: 2 },
        content: [{ type: "text", text: "Rules" }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Best of three, table 2." }],
      },
    ],
  };

  it("shows the name, status and a two-line plain-text preview", () => {
    const html = renderToStaticMarkup(
      <CompetitionList
        competitions={[
          {
            ...competition,
            description,
            status: {
              kind: "underway",
              label: "Underway",
              detail: "Round 2 of 4",
            },
          },
        ]}
        edition="xi"
        teamLabel="House"
      />,
    );
    expect(html).toContain("Bouncy Pong");
    expect(html).toContain("Underway · Round 2 of 4");
    expect(html).toMatch(
      /<p class="[^"]*line-clamp-2[^"]*">Rules\nBest of three, table 2\.<\/p>/,
    );
  });

  it("shows no preview for an empty description", () => {
    const html = renderToStaticMarkup(
      <CompetitionList
        competitions={[
          {
            ...competition,
            status: { kind: "not-started", label: "Not started", detail: null },
          },
        ]}
        edition="xi"
        teamLabel="House"
      />,
    );
    expect(html).toContain("Not started");
    expect(html).not.toContain("<p");
  });
});
