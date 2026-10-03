import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { generate } from "@/lib/bracket/engine";
import type { Bracket, Entrant } from "@/lib/bracket/types";

import { BracketResultsView, finalizeCopy } from "./bracket-results";

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
      ? { ...h, status: "played", recordedAt: new Date("2026-02-22T00:05:00Z") }
      : h,
  ),
};

const props = {
  competitionId: "c1",
  placementPoints: [5, 3, 1] as number[] | null,
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

  it("offers no time and place on any Heat", () => {
    expect(render(null)).not.toContain("Time &amp; place");
  });

  it("shows when a played Heat was recorded, in ET, on its card", () => {
    expect(render(null)).toContain("Recorded Sat 7:05 PM ET");
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

  it("says a finalized Bracket's Points Entries are in the ledger with Placement Points", () => {
    const html = renderToStaticMarkup(
      <BracketResultsView {...props} finalized openSheet={null} />,
    );
    expect(html).toContain("Finalized: its Points Entries are in the ledger.");
  });

  it("claims no Points Entries for a finalized Bracket without Placement Points", () => {
    const html = renderToStaticMarkup(
      <BracketResultsView
        {...props}
        placementPoints={null}
        finalized
        openSheet={null}
      />,
    );
    expect(html).toContain("it made no Points Entries");
    expect(html).not.toContain("Points Entries are in the ledger");
  });

  it("words the Finalize confirm by whether Placement Points exist", () => {
    expect(finalizeCopy([5, 3, 1]).confirmTitle).toBe(
      "Create Points Entries from the final placings?",
    );
    expect(finalizeCopy(null).confirmTitle).toBe(
      "Finalize the Bracket? It has no Placement Points, so no Points Entries are created.",
    );
    expect(finalizeCopy([]).confirmTitle).toBe(finalizeCopy(null).confirmTitle);
  });

  it("names who self-reported a Heat's result on its card", () => {
    const html = renderToStaticMarkup(
      <BracketResultsView
        {...props}
        reporters={{ r1h2: "Ashley Schuliger" }}
        openSheet={null}
      />,
    );
    expect(html).toContain("Reported by Ashley Schuliger");
  });

  it("shows no reporter on a Heat the Host entered", () => {
    expect(render(null)).not.toContain("Reported by");
  });
});
