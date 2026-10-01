import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { Bracket } from "@/lib/bracket/types";

import { BracketBuilder, forceableConfirmCopy } from "./bracket-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const TITLE = "Clear every Heat Result and draw again?";

const emptyBracket: Bracket = {
  format: "single-elimination",
  config: null,
  heats: [],
};

const baseProps = {
  competition: {
    id: "c1",
    name: "Tug of War",
    scoring: "team" as const,
    format: "single-elimination" as const,
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

  it("shows the Participants can enroll switch", () => {
    const html = renderToStaticMarkup(<BracketBuilder {...baseProps} />);
    expect(html).toContain("Participants can enroll");
  });
});

describe("forceableConfirmCopy", () => {
  it("returns null when no Heat is timed", () => {
    expect(forceableConfirmCopy(0, false, TITLE)).toBeNull();
    expect(forceableConfirmCopy(0, true, TITLE)).toBeNull();
  });

  it("warns about clearing times only, singular, when there are no Heat Results", () => {
    expect(forceableConfirmCopy(1, false, TITLE)).toEqual({
      title: "Draw again?",
      description: "This clears 1 Heat time.",
      confirmLabel: "Clear times",
    });
  });

  it("warns about clearing every Heat Result and the Heat times, plural", () => {
    expect(forceableConfirmCopy(3, true, TITLE)).toEqual({
      title: TITLE,
      description: "This clears every Heat Result and 3 Heat times.",
      confirmLabel: "Clear results",
    });
  });
});
