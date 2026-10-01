import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GameType } from "@/lib/enums";
import type { GamesConfig } from "@/lib/games/config";

import { GamesBuilder } from "./games-builder";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

function competition(
  gameType: GameType,
  config: GamesConfig,
  over: Partial<Parameters<typeof GamesBuilder>[0]["competition"]> = {},
): Parameters<typeof GamesBuilder>[0]["competition"] {
  return {
    id: "c1",
    name: "Bouncy Pong",
    scoring: "individual",
    gameType,
    config,
    entrantsOpen: true,
    loggingClosesAt: null,
    closed: false,
    placementPoints: [3, 2, 1],
    bestOfDecided: false,
    bestOfWinner: null,
    ...over,
  };
}

const noEntrants: { teamId: string | null; participantId: string | null }[] =
  [];

function render(
  props: Partial<Parameters<typeof GamesBuilder>[0]> &
    Pick<Parameters<typeof GamesBuilder>[0], "competition">,
) {
  return renderToStaticMarkup(
    <GamesBuilder
      entrants={noEntrants}
      teams={[]}
      participants={[]}
      enroll={{ selfEnroll: false, entrantLimit: null, enrollClosesAt: null }}
      {...props}
    />,
  );
}

describe("GamesBuilder", () => {
  it("shows the Best of select only for head-to-head", () => {
    const html = render({
      competition: competition("head-to-head", {
        drawsAllowed: false,
        bestOf: null,
      }),
    });
    expect(html).toContain("Best of");
    expect(html).toContain("Draws allowed");
  });

  it("shows best-score settings, not Best of, for a best-score Competition", () => {
    const html = render({
      competition: competition("best-score", {
        count: "best",
        betterIs: "higher",
        unit: "trips",
      }),
    });
    expect(html).toContain("Count");
    expect(html).toContain("Better is");
    expect(html).not.toContain("Best of");
    expect(html).not.toContain("Draws allowed");
  });

  it("shows the Finish Points field, with its blank-default help, for ranked", () => {
    const html = render({
      competition: competition("ranked", { finishPoints: [] }),
    });
    expect(html).toContain("Finish Points");
    expect(html).toContain("Blank: one point per player beaten.");
    expect(html).not.toContain("Best of");
  });

  it("hides the enroll switch once a fixed list has a Best of set", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: 3 },
        { entrantsOpen: false },
      ),
    });
    expect(html).not.toContain("Participants can enroll");
  });

  it("shows the enroll switch on a fixed list with Best of off", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { entrantsOpen: false },
      ),
    });
    expect(html).toContain("Participants can enroll");
  });

  it("shows the fixed-list Entrants picker only when the list is fixed", () => {
    const open = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { entrantsOpen: true },
      ),
    });
    expect(open).not.toContain("Pick Participants");

    const fixed = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { entrantsOpen: false },
      ),
    });
    expect(fixed).toContain("Pick Participants");
  });

  it("prominently prompts Close when a Best of is decided", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: 3 },
        { entrantsOpen: false, bestOfDecided: true, bestOfWinner: "Ashley" },
      ),
    });
    expect(html).toContain("Best of decided: Ashley — Close it.");
  });

  it("shows Reopen, not Close, once the Competition is closed", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { closed: true },
      ),
    });
    expect(html).toContain("Reopen");
    expect(html).not.toContain(">Close<");
  });

  it("says a closed Competition's Points Entries are in the ledger, with Placement Points", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { closed: true },
      ),
    });
    expect(html).toContain("Closed: its Points Entries are in the ledger.");
  });

  it("claims no Points Entries for a closed Competition without Placement Points", () => {
    const html = render({
      competition: competition(
        "head-to-head",
        { drawsAllowed: false, bestOf: null },
        { closed: true, placementPoints: null },
      ),
    });
    expect(html).toContain("it made no Points Entries");
    expect(html).not.toContain("Points Entries are in the ledger");
  });

  it("offers a Close button, not yet confirmed, when open", () => {
    const html = render({
      competition: competition("head-to-head", {
        drawsAllowed: false,
        bestOf: null,
      }),
    });
    expect(html).toContain(">Close<");
    expect(html).not.toContain("Reopen");
  });
});
