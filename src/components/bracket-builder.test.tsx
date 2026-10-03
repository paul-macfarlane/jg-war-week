import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import type { Bracket } from "@/lib/bracket/types";

import { BracketBuilder } from "./bracket-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const emptyBracket: Bracket = {
  config: DEFAULT_BRACKET_CONFIG,
  heats: [],
};

const baseProps = {
  competition: {
    id: "c1",
    name: "Tug of War",
    scoring: "team" as const,
    format: "bracket" as const,
    finalized: false,
    selfReport: false,
    selfEnroll: false,
    entrantLimit: null,
    enrollClosesAt: null,
  },
  entrants: [],
  bracket: emptyBracket,
  teams: [],
  participants: [],
  squads: [],
  teamLabel: "Team",
};

describe("BracketBuilder", () => {
  it("shows the Squad help text under the Squads heading", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain(
      "Squad: a pair or group from one Team, playing as one entrant",
    );
  });

  it("doesn't describe Points as if it were the chosen Format", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain(
      "A Format can&#x27;t change while the Competition has Entrants.",
    );
    expect(html).not.toContain("Points is Points Entries only");
  });

  it("offers one Bracket Format option, with the head-to-head preset", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain("Head-to-head (single elimination)");
    expect(html).toContain("Entrants per Heat");
    expect(html).toContain("How many advance");
    expect(html).not.toContain("Single elimination</");
    expect(html).not.toMatch(/>Heats</);
  });

  it("shows the Format as Bracket, and no heat settings for a Placement", () => {
    const placement = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        competition={{ ...baseProps.competition, format: "placement" }}
      />,
    );
    expect(placement).not.toContain("Head-to-head (single elimination)");
  });

  it("offers no seeding by Standings and no Time & place, only Random with Re-roll", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).not.toMatch(/standings/i);
    expect(html).not.toContain("Time &amp; place");
    expect(html).toContain("Generate");
  });

  it("shows the Participants can enroll switch", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain("Participants can enroll");
  });
});
