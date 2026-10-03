import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompetitionListItem } from "@/lib/competitions";

import { CompetitionFacts } from "./competitions";

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
