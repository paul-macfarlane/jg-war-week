import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { applyResult, generate } from "@/lib/bracket/engine";
import type { PodiumPlace } from "@/lib/bracket/podium";
import type { Bracket, Entrant } from "@/lib/bracket/types";

import { BracketAdminView, closeCopy } from "./bracket-admin";

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
  winner: null as string | null,
  podium: [] as PodiumPlace[],
  finalized: false,
  primaryColor: "#000",
  onOpenHeatChange: () => {},
};

function render(openHeatId: string | null) {
  return renderToStaticMarkup(
    <BracketAdminView {...props} openHeatId={openHeatId} />,
  );
}

/** Every Record result / Edit button's accessible name. */
function recordButtons(html: string): string[] {
  return [
    ...html.matchAll(/aria-label="((?:Record result for|Edit) [^"]*)"/g),
  ].map((m) => m[1]);
}

describe("BracketAdminView", () => {
  it("shows the Bracket as the shared tree, with no round cards", () => {
    const html = render(null);
    expect(html).toContain("data-bracket-tree");
    expect(html).not.toMatch(/<section[^>]*aria-label="Semifinal"/);
  });

  it("offers Record result or Edit on every Match the Host can record, none on a bye or a Match still waiting", () => {
    // Semifinal 1 is a bye; Semifinal 2 is played; the Final waits for Blue
    // or Green, so it's not recordable yet.
    expect(recordButtons(render(null))).toEqual(["Edit Semifinal 2"]);
    const both = applyResult(generate(seeds), "r1h2", { order: ["e2", "e3"] });
    expect(
      recordButtons(
        renderToStaticMarkup(
          <BracketAdminView {...props} bracket={both} openHeatId={null} />,
        ),
      ),
    ).toEqual(["Edit Semifinal 2", "Record result for Final"]);
  });

  it("offers no Record result or Edit while the Bracket is closed", () => {
    expect(
      recordButtons(
        renderToStaticMarkup(
          <BracketAdminView {...props} finalized openHeatId={null} />,
        ),
      ),
    ).toEqual([]);
  });

  it("refreshes live while no Sheet is open", () => {
    expect(render(null)).toContain("data-auto-refresh");
  });

  it("stops refreshing while a Match Result Sheet is open, so an unsaved result is kept", () => {
    expect(render("r1h2")).not.toContain("data-auto-refresh");
  });

  it("offers no time and place on any Match", () => {
    expect(render(null)).not.toContain("Time &amp; place");
  });

  it("shows when a played Match was recorded, in ET, in its box", () => {
    expect(render(null)).toContain("Recorded Sat 7:05 PM ET");
  });

  it("offers no way to play the Finale from a Closed Bracket", () => {
    const html = renderToStaticMarkup(
      <BracketAdminView {...props} finalized openHeatId={null} />,
    );
    expect(html).not.toMatch(/play the finale/i);
    expect(html).not.toContain("/finale/");
    expect(html).toContain(">Reopen<");
  });

  it("shows the decided places as Top finishers, 1st the Winner, Provisional until Closed", () => {
    const podium: PodiumPlace[] = [
      { entrantId: "e2", place: 1, points: 5 },
      { entrantId: "e3", place: 2, points: 3 },
    ];
    const text = (html: string) => html.replace(/<[^>]+>/g, " ");
    const open = renderToStaticMarkup(
      <BracketAdminView
        {...props}
        winner="e2"
        podium={podium}
        openHeatId={null}
      />,
    );
    expect(open).toContain('aria-label="Top finishers"');
    expect(open).toMatch(/data-winner="true"[\s\S]*?Blue[\s\S]*?Winner/);
    expect(text(open)).toContain("5 points");
    expect(text(open)).toContain("3 points");
    expect(open).toContain("Provisional");
    expect(open).not.toContain("Champion");
    const closed = renderToStaticMarkup(
      <BracketAdminView
        {...props}
        winner="e2"
        podium={podium}
        finalized
        openHeatId={null}
      />,
    );
    expect(closed).toContain('aria-label="Top finishers"');
    expect(closed).not.toContain("Provisional");
  });

  it("says a closed Bracket's Points Entries are in the ledger with Placement Points", () => {
    const html = renderToStaticMarkup(
      <BracketAdminView {...props} finalized openHeatId={null} />,
    );
    expect(html).toContain("Closed: its Points Entries are in the ledger.");
  });

  it("claims no Points Entries for a closed Bracket without Placement Points", () => {
    const html = renderToStaticMarkup(
      <BracketAdminView
        {...props}
        placementPoints={null}
        finalized
        openHeatId={null}
      />,
    );
    expect(html).toContain("it made no Points Entries");
    expect(html).not.toContain("Points Entries are in the ledger");
  });

  it("words the Close confirm by whether Placement Points exist", () => {
    expect(closeCopy([5, 3, 1]).confirmTitle).toBe(
      "Create Points Entries from the final placings?",
    );
    expect(closeCopy(null).confirmTitle).toBe(
      "Close the Bracket? It has no Placement Points, so no Points Entries are created.",
    );
    expect(closeCopy([]).confirmTitle).toBe(closeCopy(null).confirmTitle);
  });

  it("names who self-reported a Match's result in its box", () => {
    const html = renderToStaticMarkup(
      <BracketAdminView
        {...props}
        reporters={{ r1h2: "Ashley Schuliger" }}
        openHeatId={null}
      />,
    );
    expect(html).toContain("Reported by Ashley Schuliger");
  });

  it("shows no reporter on a Match the Host entered", () => {
    expect(render(null)).not.toContain("Reported by");
  });

  it("keeps Close off until the 3rd place Match is recorded, though the Winner is known", () => {
    const four: Entrant[] = ["Red", "Blue", "Green", "Gold"].map(
      (label, i) => ({ id: `e${i + 1}`, seedPosition: i + 1, label }),
    );
    const config = {
      entrantsPerHeat: 2,
      advancePerHeat: 1,
      thirdPlaceGame: true,
    };
    let played = generate(four, undefined, config);
    played = applyResult(played, "r1h1", { order: ["e1", "e4"] });
    played = applyResult(played, "r1h2", { order: ["e2", "e3"] });
    played = applyResult(played, "r2h1", { order: ["e1", "e2"] });
    const entrants = four.map((e) => ({
      ...props.entrants[0],
      id: e.id,
      label: e.label,
    }));
    const view = (b: Bracket) =>
      renderToStaticMarkup(
        <BracketAdminView
          {...props}
          entrants={entrants}
          bracket={b}
          winner="e1"
          openHeatId={null}
        />,
      );

    const before = view(played);
    expect(before).toContain("Finish every Match to close.");
    expect(before).toContain("3rd place Match");
    const after = view(applyResult(played, "r2h2", { order: ["e3", "e4"] }));
    expect(after).not.toContain("Finish every Match to close.");
  });
});
