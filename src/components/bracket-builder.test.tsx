import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { applyResult, generate } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import type { BracketEntrant } from "@/queries/brackets";

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

/** `count` saved Entrants E1…EN, by Seed Position. */
function savedEntrants(count: number): BracketEntrant[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `e${i + 1}`,
    seedPosition: i + 1,
    label: `E${i + 1}`,
    teamId: `t${i + 1}`,
    participantId: null,
    squadId: null,
    participantNames: [],
    pointsTeamId: `t${i + 1}`,
    color: null,
    teamName: null,
  }));
}

const withGame = { ...DEFAULT_BRACKET_CONFIG, thirdPlaceGame: true };

/** The 3rd place game switch's checkbox (it carries the id) in `html`. */
function thirdPlaceSwitch(html: string): string {
  return html.match(/<input[^>]*id="bracket-third-place"[^>]*>/)![0];
}

const CHECKED = /\schecked=""/;
const DISABLED = /\sdisabled=""/;

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

  it("shows the 3rd place game switch at head-to-head, off and disabled with its reason under 4 Entrants", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain("3rd place game");
    expect(html).toContain("A 3rd place game needs at least 4 Entrants.");
    const control = thirdPlaceSwitch(html);
    expect(control).toMatch(DISABLED);
    expect(control).not.toMatch(CHECKED);
  });

  it("shows a saved 3rd place game as on under 4 Entrants, and lets it be turned off", () => {
    const html = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        entrants={savedEntrants(3)}
        bracket={{ config: withGame, heats: [] }}
      />,
    );
    const control = thirdPlaceSwitch(html);
    expect(control).toMatch(CHECKED);
    expect(control).not.toMatch(DISABLED);
    expect(html).toContain(
      "A 3rd place game needs at least 4 Entrants. Turn it off, or enter 4, to generate.",
    );
  });

  it("locks the 3rd place game once the Bracket has a Heat Result", () => {
    const entrants = savedEntrants(4);
    const generated = generate(
      withGame,
      entrants,
      (round, position) => `r${round}h${position}`,
    );
    const started = applyResult(generated, "r1h1", {
      order: generated.heats[0].slots.map((s) => s.entrantId!),
    });
    const html = renderToStaticMarkup(
      <BracketBuilder {...baseProps} entrants={entrants} bracket={started} />,
    );
    const control = thirdPlaceSwitch(html);
    expect(control).toMatch(CHECKED);
    expect(control).toMatch(DISABLED);
    expect(html).toContain(
      "The 3rd place game can&#x27;t be changed once a Heat Result exists.",
    );
  });

  it("offers no 3rd place game at another Heat size", () => {
    const html = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        bracket={{
          config: {
            entrantsPerHeat: 4,
            advancePerHeat: 2,
            thirdPlaceGame: false,
          },
          heats: [],
        }}
      />,
    );
    expect(html).not.toContain("3rd place game");
  });
});
