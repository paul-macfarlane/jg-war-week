import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { generate } from "@/lib/bracket/engine";
import type { Entrant } from "@/lib/bracket/types";
import { nextHeatFor } from "@/lib/bracket/view";

import { BracketView, YourNextHeatCard } from "./bracket-view";

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

function card(options: { canReport: boolean; pickOnly: boolean }) {
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
    const html = card({ canReport: true, pickOnly: false });
    expect(html).toContain("vs Blue");
    expect(html).toMatch(/<button[^>]*>Report result<\/button>/);
  });

  it("tells someone known only by their pick how to report", () => {
    const html = card({ canReport: false, pickOnly: true });
    expect(html).toContain(
      "To report results, ask an Organizer to add your email to the roster.",
    );
    expect(html).not.toContain("Report result");
  });

  it("offers neither when self-report doesn't apply", () => {
    const html = card({ canReport: false, pickOnly: false });
    expect(html).not.toContain("Report result");
    expect(html).not.toContain("To report results");
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
});
