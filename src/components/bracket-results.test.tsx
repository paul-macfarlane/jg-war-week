import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { generate } from "@/lib/bracket/engine";
import type { Bracket, Entrant } from "@/lib/bracket/types";

import { BracketResultsView } from "./bracket-results";

vi.mock("@/components/auto-refresh", () => ({
  AutoRefresh: () => <span data-auto-refresh />,
}));
// A Sheet's result form reads the router, which needs a mounted app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const seeds: Entrant[] = ["Red", "Blue", "Green"].map((label, i) => ({
  id: `e${i + 1}`,
  seedPosition: i + 1,
  label,
}));

// 3 Entrants: Semifinal 1 is Red's bye, Semifinal 2 is Blue v Green.
const generated = generate(seeds);
const bracket: Bracket = {
  ...generated,
  heats: generated.heats.map((h) =>
    h.id === "r1h2"
      ? { ...h, dayId: "d1", startTime: "19:00:00", location: "Main room" }
      : h,
  ),
};

const props = {
  competitionId: "c1",
  scoring: "team" as const,
  entrants: seeds.map((e) => ({
    id: e.id,
    label: e.label,
    color: "#f00",
    teamId: `t${e.id}`,
    participantId: null,
    squadId: null,
    participantNames: [],
  })),
  bracket,
  champion: null,
  finalized: false,
  finaleHref: null,
  primaryColor: "#000",
  days: [{ id: "d1", date: "2026-02-22" }],
  onOpenSheetChange: () => {},
};

function render(
  openSheet: Parameters<typeof BracketResultsView>[0]["openSheet"],
) {
  return renderToStaticMarkup(
    <BracketResultsView {...props} openSheet={openSheet} />,
  );
}

describe("BracketResultsView", () => {
  it("refreshes live while no Sheet is open", () => {
    expect(render(null)).toContain("data-auto-refresh");
  });

  it("stops refreshing while a Heat Result Sheet is open, so an unsaved result is kept", () => {
    expect(render({ kind: "result", heatId: "r1h2" })).not.toContain(
      "data-auto-refresh",
    );
  });

  it("stops refreshing while a Time & place Sheet is open", () => {
    expect(render({ kind: "schedule", heatId: "r1h2" })).not.toContain(
      "data-auto-refresh",
    );
  });

  it("offers Time & place on each Heat that is played, not on a bye", () => {
    const html = render(null);

    expect(html).toContain('aria-label="Time &amp; place for Semifinal 2"');
    expect(html).toContain('aria-label="Time &amp; place for Final"');
    expect(html).not.toContain('aria-label="Time &amp; place for Semifinal 1"');
  });

  it("shows a timed Heat's Day, time and place on its card", () => {
    expect(render(null)).toContain("Sunday, Feb 22 · 7:00 PM ET · Main room");
  });

  it("links a finalized Bracket's note to its Finale", () => {
    const html = renderToStaticMarkup(
      <BracketResultsView
        {...props}
        finalized
        finaleHref="/xi/finale/c1"
        openSheet={null}
      />,
    );
    expect(html).toMatch(/<a[^>]*href="\/xi\/finale\/c1"[^>]*>Play the Finale/);
  });
});
