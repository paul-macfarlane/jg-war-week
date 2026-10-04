import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { generate } from "@/lib/bracket/engine";
import type { PodiumPlace } from "@/lib/bracket/podium";
import type { Entrant } from "@/lib/bracket/types";
import { nextHeatFor } from "@/lib/bracket/view";

import { BracketView, YourNextHeatCard } from "./bracket-view";
import { YouProvider } from "./you";

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
      onReport={() => {}}
      {...options}
    />,
  );
}

describe("YourNextHeatCard", () => {
  it("offers Report result when Your next Match is reportable", () => {
    const html = card({ canReport: true });
    expect(html).toContain("Your next Match");
    expect(html).not.toContain("Your next Heat");
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
    podium: [] as PodiumPlace[],
    closed: false,
    scoring: "team" as const,
    primaryColor: "#000",
    participantTeams: {},
    participantSquads: {},
    selfReport: { on: true, linkedParticipantId: null, reportableHeatId: null },
  };

  it("refreshes live before the Bracket is drawn, so the draw appears", () => {
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={{ ...bracket, heats: [] }} />,
    );
    expect(html).toContain("The Bracket hasn&#x27;t been drawn yet.");
    expect(html).toContain("data-auto-refresh");
  });

  it("shows the decided places as Top finishers with their points, 1st the Winner, and no Finale link", () => {
    const podium: PodiumPlace[] = [
      { entrantId: "e2", place: 1, points: 5 },
      { entrantId: "e1", place: 2, points: 3 },
    ];
    const text = (html: string) => html.replace(/<[^>]+>/g, " ");
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={bracket} podium={podium} />,
    );
    expect(html).toContain('aria-label="Top finishers"');
    expect(html).toMatch(/data-winner="true"[\s\S]*?Blue[\s\S]*?Winner/);
    expect(text(html)).toMatch(/2nd[\s\S]*Red[\s\S]*3 points/);
    expect(text(html)).toContain("5 points");
    expect(html).toContain("Provisional");
    expect(html).not.toContain("Champion");
    expect(html).not.toMatch(/play the finale/i);
    const closed = renderToStaticMarkup(
      <BracketView {...props} bracket={bracket} podium={podium} closed />,
    );
    expect(closed).not.toContain("Provisional");
    expect(closed).not.toMatch(/play the finale/i);
  });

  it("shows no Top finishers before any place is decided", () => {
    expect(
      renderToStaticMarkup(<BracketView {...props} bracket={bracket} />),
    ).not.toContain("Top finishers");
  });

  it("refreshes live while no report is open", () => {
    expect(
      renderToStaticMarkup(<BracketView {...props} bracket={bracket} />),
    ).toContain("data-auto-refresh");
  });

  it("shows the Bracket as the tree alone, with no List toggle", () => {
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={bracket} />,
    );
    expect(html).toContain("data-bracket-tree");
    expect(html).not.toContain('role="tab"');
    expect(html).not.toContain(">List<");
  });

  it("shows when a played Heat was recorded, in the default tree", () => {
    const played = {
      ...bracket,
      heats: bracket.heats.map((h, i) =>
        i === 0
          ? {
              ...h,
              status: "played" as const,
              recordedAt: new Date("2026-02-22T00:05:00Z"),
            }
          : h,
      ),
    };
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={played} />,
    );
    expect(html).toContain("Recorded Sat 7:05 PM ET");
  });

  it("shows no time on Heats that aren't played", () => {
    const html = renderToStaticMarkup(
      <BracketView {...props} bracket={bracket} />,
    );
    expect(html).not.toContain("Recorded");
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

describe("BracketView's Record result in the tree", () => {
  // An individual Bracket: Neo (p1) v Trinity (p2); Morpheus (p3) isn't in it.
  const people = entrants.map((e, i) => ({
    ...e,
    teamId: null,
    participantId: `p${i + 1}`,
    label: ["Neo", "Trinity"][i],
  }));
  const heatId = bracket.heats[0].id;
  const view = (
    linkedId: string | null,
    selfReport: {
      on: boolean;
      linkedParticipantId: string | null;
      reportableHeatId: string | null;
    },
  ) =>
    renderToStaticMarkup(
      <YouProvider linkedId={linkedId}>
        <BracketView
          competitionId="c1"
          entrants={people}
          bracket={bracket}
          podium={[]}
          closed={false}
          scoring="individual"
          primaryColor="#000"
          participantTeams={{}}
          participantSquads={{}}
          selfReport={selfReport}
        />
      </YouProvider>,
    );
  const recordButtons = (html: string) =>
    [...html.matchAll(/aria-label="(Record result for [^"]*)"/g)].map(
      (m) => m[1],
    );

  it("a self-reporting Participant sees Record result on their own Heat", () => {
    const html = view("p1", {
      on: true,
      linkedParticipantId: "p1",
      reportableHeatId: heatId,
    });
    expect(recordButtons(html)).toEqual(["Record result for Final"]);
  });

  it("a Participant not in the Heat sees no Record result", () => {
    const html = view("p3", {
      on: true,
      linkedParticipantId: "p3",
      reportableHeatId: null,
    });
    expect(recordButtons(html)).toEqual([]);
  });

  it("with self-report off, a Participant in the Heat sees no Record result", () => {
    const html = view("p1", {
      on: false,
      linkedParticipantId: "p1",
      reportableHeatId: heatId,
    });
    expect(recordButtons(html)).toEqual([]);
    expect(html).not.toContain("Report result");
  });
});
