import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { generate } from "@/lib/bracket/engine";
import { heats } from "@/lib/bracket/heats";
import type { Entrant } from "@/lib/bracket/types";
import { nextHeatFor } from "@/lib/bracket/view";

import { BracketView, HeatRows, YourNextHeatCard } from "./bracket-view";

vi.mock("@/components/auto-refresh", () => ({
  AutoRefresh: () => <span data-auto-refresh />,
}));
// The report Sheet's form reads the router, which needs a mounted app router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));

const seeds: Entrant[] = ["Red", "Blue"].map((label, i) => ({
  id: `e${i + 1}`,
  seedPosition: i + 1,
  label,
}));
const bracket = generate(seeds);
const entrants = seeds.map((e) => ({
  id: e.id,
  label: e.label,
  color: "#f00",
  teamId: `t${e.id}`,
  participantId: null,
  squadId: null,
  participantNames: [],
}));
const entrantsById = new Map(entrants.map((e) => [e.id, e]));

function card(options: { canReport: boolean }) {
  return renderToStaticMarkup(
    <YourNextHeatCard
      next={nextHeatFor(bracket, "e1")!}
      bracket={bracket}
      entrantsById={entrantsById}
      when={null}
      onReport={() => {}}
      {...options}
    />,
  );
}

describe("YourNextHeatCard", () => {
  it("offers Report result when Your next Heat is reportable", () => {
    const html = card({ canReport: true });
    expect(html).toContain("vs Blue");
    expect(html).toMatch(/<button[^>]*>Report result<\/button>/);
  });

  it("offers neither when self-report doesn't apply", () => {
    const html = card({ canReport: false });
    expect(html).not.toContain("Report result");
  });
});

describe("BracketView", () => {
  const props = {
    competitionId: "c1",
    entrants,
    champion: null,
    scoring: "team" as const,
    primaryColor: "#000",
    participantTeams: {},
    participantSquads: {},
    days: [],
    finaleHref: null,
    selfReport: { on: true, linkedParticipantId: null, reportableHeatId: null },
  };

  it("refreshes live before the Bracket is drawn, so the draw appears", () => {
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={{ ...bracket, heats: [] }} />,
    );
    expect(html).toContain("The Bracket hasn&#x27;t been drawn yet.");
    expect(html).toContain("data-auto-refresh");
  });

  it("refreshes live while no report is open", () => {
    expect(
      renderToStaticMarkup(<BracketView {...props} bracket={bracket} />),
    ).toContain("data-auto-refresh");
  });

  it("shows the Bracket as a tree by default, with a List toggle", () => {
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={bracket} />,
    );
    expect(html).toContain("data-bracket-tree");
    expect(html).toMatch(/<button[^>]*role="tab"[^>]*>List<\/button>/);
  });

  it("shows a timed Heat's Day, time and place in the default tree", () => {
    const timed = {
      ...bracket,
      heats: bracket.heats.map((h, i) =>
        i === 0
          ? { ...h, dayId: "d1", startTime: "19:00:00", location: "Main room" }
          : h,
      ),
    };
    const html = renderToStaticMarkup(
      <BracketView
        {...props}
        days={[{ id: "d1", date: "2026-02-22" }]}
        bracket={timed}
      />,
    );
    expect(html).toContain("Sunday, Feb 22 · 7:00 PM ET · Main room");
  });

  it("explains Squads beside a Squads Bracket's Entrants", () => {
    const squads = entrants.map((e) => ({
      ...e,
      teamId: null,
      squadId: `s${e.id}`,
      participantNames: ["Ashley", "Sam"],
    }));
    const text = (html: string) => html.replace(/<[^>]+>/g, "");
    expect(
      text(
        renderToStaticMarkup(
          <BracketView {...props} entrants={squads} bracket={bracket} />,
        ),
      ),
    ).toContain("Squad: a pair or group from one Team, playing as one entrant");
    expect(
      text(
        renderToStaticMarkup(
          <BracketView
            {...props}
            entrants={squads}
            bracket={{ ...bracket, heats: [] }}
          />,
        ),
      ),
    ).toContain("a pair or group from one Team, playing as one entrant");
    expect(
      renderToStaticMarkup(<BracketView {...props} bracket={bracket} />),
    ).not.toContain("a pair or group");
  });
});

describe("HeatRows advancers", () => {
  const eight: Entrant[] = Array.from({ length: 8 }, (_, i) => ({
    id: `h${i + 1}`,
    seedPosition: i + 1,
    label: `Entrant ${i + 1}`,
  }));
  const heatEntrants = new Map(
    eight.map((e) => [
      e.id,
      {
        id: e.id,
        label: e.label,
        color: "#f00",
        teamId: `t${e.id}`,
        participantId: null,
        squadId: null,
        participantNames: [],
      },
    ]),
  );
  const newId = (round: number, position: number) => `r${round}h${position}`;

  function rows(bracket: ReturnType<typeof heats.generate>, heatId: string) {
    return renderToStaticMarkup(
      <HeatRows
        heat={bracket.heats.find((h) => h.id === heatId)!}
        bracket={bracket}
        entrantsById={heatEntrants}
        scoring="individual"
        primaryColor="#f00"
      />,
    );
  }

  /** The place numbers of the rows marked as advancing. */
  function advancingPlacesIn(html: string): string[] {
    return [
      ...html.matchAll(/data-advances[^>]*>.*?aria-label="Place (\d)"/g),
    ].map((m) => m[1]);
  }

  it("highlights places 1 and 2 of a Heat of 4 with 2 advancing", () => {
    let bracket = heats.generate(
      { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
      eight,
      newId,
    );
    const heat = bracket.heats.find((h) => h.id === "r1h1")!;
    const order = heat.slots.map((s) => s.entrantId!);
    bracket = heats.applyResult(bracket, "r1h1", { order, scores: {} });
    expect(advancingPlacesIn(rows(bracket, "r1h1"))).toEqual(["1", "2"]);

    const other = bracket.heats.find((h) => h.id === "r1h2")!;
    bracket = heats.applyResult(bracket, "r1h2", {
      order: other.slots.map((s) => s.entrantId!),
      scores: {},
    });
    const final = bracket.heats.find((h) => h.round === 2)!;
    bracket = heats.applyResult(bracket, final.id, {
      order: final.slots.map((s) => s.entrantId!),
      scores: {},
    });
    expect(advancingPlacesIn(rows(bracket, final.id))).toEqual(["1"]);
  });
});
