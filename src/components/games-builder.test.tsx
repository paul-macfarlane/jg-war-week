import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { GamesBuilder } from "./games-builder";

vi.mock("@/actions/setup", () => ({ saveCompetitionSetting: vi.fn() }));
vi.mock("@/actions/games", () => ({
  closeGames: vi.fn(),
  reopenGames: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

type Props = Parameters<typeof GamesBuilder>[0];

function competition(over: Partial<Props["competition"]> = {}) {
  return {
    id: "c1",
    scoring: "individual" as const,
    entrantsOpen: true,
    closed: false,
    placementPoints: [3, 2, 1],
    bestOfDecided: false,
    bestOfWinner: null,
    ...over,
  };
}

function render(over: Partial<Props["competition"]> = {}) {
  return renderToStaticMarkup(
    <GamesBuilder
      competition={competition(over)}
      entrants={[]}
      teams={[]}
      participants={[]}
      entrantsLock={null}
    />,
  );
}

describe("GamesBuilder", () => {
  it("shows the fixed-list Entrants picker only when the list is fixed", () => {
    expect(render({ entrantsOpen: true })).not.toContain("Pick Participants");
    expect(render({ entrantsOpen: false })).toContain("Pick Participants");
  });

  it("holds none of the Format's settings: they're in the page's Settings", () => {
    const html = render({ entrantsOpen: false });
    expect(html).not.toContain("Best of</");
    expect(html).not.toContain("Logging closes");
    expect(html).not.toContain("Participants can enroll");
    expect(html).not.toContain("Save settings");
  });

  it("prominently prompts Close when a Best of is decided", () => {
    const html = render({
      entrantsOpen: false,
      bestOfDecided: true,
      bestOfWinner: "Ashley",
    });
    expect(html).toContain("Best of decided: Ashley — Close it.");
  });

  it("shows Reopen, not Close, once the Competition is closed", () => {
    const html = render({ closed: true });
    expect(html).toContain("Reopen");
    expect(html).not.toContain(">Close<");
  });

  it("says a closed Competition's Points Entries are in the ledger, with Placement Points", () => {
    expect(render({ closed: true })).toContain(
      "Closed: its Points Entries are in the ledger.",
    );
  });

  it("claims no Points Entries for a closed Competition without Placement Points", () => {
    const html = render({ closed: true, placementPoints: null });
    expect(html).toContain("it made no Points Entries");
    expect(html).not.toContain("Points Entries are in the ledger");
  });

  it("offers a Close button, not yet confirmed, when open", () => {
    const html = render();
    expect(html).toContain(">Close<");
    expect(html).not.toContain("Reopen");
  });
});
