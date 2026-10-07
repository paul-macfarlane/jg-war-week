import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { LoggedResultsBuilder } from "./logged-results-builder";

vi.mock("@/actions/setup", () => ({ saveCompetitionSetting: vi.fn() }));
vi.mock("@/actions/logged-results", () => ({
  closeLoggedResults: vi.fn(),
  reopenLoggedResults: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

type Props = Parameters<typeof LoggedResultsBuilder>[0];

function competition(over: Partial<Props["competition"]> = {}) {
  return {
    id: "c1",
    scoring: "individual" as const,
    format: "head-to-head" as const,
    closed: false,
    placementPoints: [3, 2, 1],
    decided: false,
    seriesWinner: null,
    closeError: null,
    ...over,
  };
}

function render(over: Partial<Props["competition"]> = {}) {
  return renderToStaticMarkup(
    <LoggedResultsBuilder
      competition={competition(over)}
      entrants={[]}
      teams={[]}
      participants={[]}
      entrantsLock={null}
    />,
  );
}

describe("LoggedResultsBuilder", () => {
  it("picks a Head-to-head's 2 Entrants, and gives Best score no Entrant list", () => {
    const headToHead = render({ format: "head-to-head" });
    expect(headToHead).toContain("Participant A");
    expect(headToHead).toContain("Participant B");
    expect(headToHead).not.toContain("Save Entrants");
    const bestScore = render({ format: "best-score" });
    expect(bestScore).not.toContain("Participant A");
    expect(bestScore).toContain("any Participant may log");
    expect(bestScore).toContain("an Attempt.");
  });

  it("holds none of the Format's settings: they're in the page's Settings", () => {
    const html = render();
    expect(html).not.toContain("Best of</");
    expect(html).not.toContain("closes");
    expect(html).not.toContain("Participants can enroll");
    expect(html).not.toContain("Save settings");
  });

  it("prominently prompts Close when the series is decided", () => {
    const html = render({ decided: true, seriesWinner: "Ashley" });
    expect(html).toContain("Best of decided: Ashley — Close it.");
  });

  it("disables Close with the server's reason while the series is undecided (SC1)", () => {
    const html = render({ closeError: "Finish the series before closing." });
    expect(html).toContain("Finish the series before closing.");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Close<\/button>/);
    expect(render()).not.toContain("Finish the series before closing.");
  });

  it("shows Reopen, not Close, once the Competition is closed", () => {
    const html = render({ closed: true });
    expect(html).toContain("Reopen");
    expect(html).not.toContain(">Close<");
  });

  it("says a closed Competition's Points Entries are in the Standings, with Placement Points", () => {
    expect(render({ closed: true })).toContain(
      "Closed: its Points Entries are in the Standings.",
    );
  });

  it("claims no Points Entries for a closed Competition without Placement Points", () => {
    const html = render({ closed: true, placementPoints: null });
    expect(html).toContain("it made no Points Entries");
    expect(html).not.toContain("Points Entries are in the Standings");
  });

  it("offers a Close button, not yet confirmed, when open", () => {
    const html = render();
    expect(html).toContain(">Close<");
    expect(html).not.toContain("Reopen");
  });
});
