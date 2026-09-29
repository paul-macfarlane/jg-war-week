import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { CompetitionListItem } from "@/lib/competitions";

import { CompetitionFacts } from "./competitions";

const competition: CompetitionListItem = {
  id: "c1",
  name: "Bouncy Pong",
  description: null,
  maxPoints: 10,
  scoring: "individual",
  countsTowardTeam: false,
  competitionGroup: null,
  format: "games",
  gameType: "head-to-head",
};

describe("CompetitionFacts", () => {
  it("names a games Competition's Game Type", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts competition={competition} teamLabel="House" />,
    );
    expect(html).toContain("Games · Head-to-head");
  });

  it("shows no Games badge for another Format", () => {
    const html = renderToStaticMarkup(
      <CompetitionFacts
        competition={{ ...competition, format: "points", gameType: null }}
        teamLabel="House"
      />,
    );
    expect(html).not.toContain("Games ·");
  });
});
