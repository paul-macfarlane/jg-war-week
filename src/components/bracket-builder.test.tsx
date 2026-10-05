import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";
import { generate } from "@/lib/bracket/formats";
import type { Bracket } from "@/lib/bracket/types";
import { LOCKED_BY_MATCH_RESULT } from "@/lib/competition-locks";
import type { BracketEntrant } from "@/queries/brackets";

import { BracketBuilder } from "./bracket-builder";

vi.mock("@/actions/setup", () => ({ saveCompetitionSetting: vi.fn() }));
vi.mock("@/actions/brackets", () => ({ deleteSquad: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const emptyBracket: Bracket = {
  config: DEFAULT_BRACKET_CONFIG,
  matches: [],
};

const baseProps = {
  competition: {
    id: "c1",
    name: "Tug of War",
    scoring: "team" as const,
  },
  entrants: [],
  bracket: emptyBracket,
  teams: [],
  participants: [],
  squads: [],
  teamLabel: "Team",
  entrantsLock: null,
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

const DISABLED = /\sdisabled=""/;

describe("BracketBuilder", () => {
  it("shows the Squad help text under the Squads heading", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain(
      "Squad: a pair or group from one Team, playing as one entrant",
    );
  });

  it("offers no seeding by Standings and no Time & place, only Random with Generate", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).not.toMatch(/standings/i);
    expect(html).not.toContain("Time &amp; place");
    expect(html).toContain("Generate");
  });

  it("holds none of the Bracket's settings: they're in the page's Settings", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).not.toContain("Entrants per Match");
    expect(html).not.toContain("Self-report");
    expect(html).not.toContain("Participants can enroll");
    expect(html).not.toContain(">Format<");
  });

  it("offers Re-roll once the Bracket is generated", () => {
    const html = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        entrants={savedEntrants(2)}
        bracket={generate(
          DEFAULT_BRACKET_CONFIG,
          savedEntrants(2),
          (round, position) => `r${round}h${position}`,
        )}
      />,
    );
    expect(html).toContain("Re-roll");
  });

  it("shows the lock reason and folds Entrants and Seed Positions into a closed trigger with the count once a Match has a result", () => {
    const html = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        entrants={savedEntrants(4)}
        entrantsLock={LOCKED_BY_MATCH_RESULT}
      />,
    );
    expect(html).toContain(LOCKED_BY_MATCH_RESULT);
    expect(html).toContain("Entrants and Seed Positions (4)");
    const trigger = html.match(
      /<button[^>]*>Entrants and Seed Positions \(4\)/,
    )![0];
    expect(trigger).toContain('aria-expanded="false"');
    expect(html).not.toContain("Seed Positions</h2>");
    expect(html).not.toContain("Generate");
  });

  it("shows Entrants and Seed Positions expanded, with no trigger, while unlocked", () => {
    const html = renderToStaticMarkup(
      <BracketBuilder {...baseProps} entrants={savedEntrants(4)} />,
    );
    expect(html).toContain("Seed Positions</h2>");
    expect(html).toContain("Generate");
    expect(html).not.toContain("Entrants and Seed Positions (");
  });

  it("has no Round 1 Preview", () => {
    const bracket = generate(
      DEFAULT_BRACKET_CONFIG,
      savedEntrants(4),
      (round, position) => `r${round}h${position}`,
    );
    const html = renderToStaticMarkup(
      <BracketBuilder
        {...baseProps}
        entrants={savedEntrants(4)}
        bracket={bracket}
      />,
    );
    expect(html).not.toContain("Preview");
  });
});
