import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GamesViewGame, GamesViewRow } from "@/queries/games";

import { AdminGames, type AdminGamesProps } from "./admin-games";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/games", () => ({
  logGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
}));

const ashley = { id: "p-ashley", name: "Ashley", color: "#f00" };
const sam = { id: "p-sam", name: "Sam", color: "#00f" };

function attempt(id: string, score: number, hour: number): GamesViewGame {
  return {
    id,
    loggedAt: new Date(Date.UTC(2027, 1, 24, hour)),
    players: [{ ...ashley, place: null, score }],
    canEdit: true,
    canDelete: true,
  };
}

const ashleyRow: GamesViewRow = {
  ...ashley,
  rank: 1,
  played: 2,
  wins: 0,
  losses: 0,
  draws: 0,
  best: 42,
  total: 72,
  points: 3,
};

const base: AdminGamesProps = {
  competitionId: "c1",
  gameFormat: "best-score",
  config: { count: "best", betterIs: "higher", unit: "laps" },
  scoring: "individual",
  closed: false,
  viewerCanLog: true,
  leaderboard: [ashleyRow],
  games: [attempt("g2", 30, 14), attempt("g1", 42, 13)],
  entrantOptions: [ashley],
  primaryColor: "#000",
  teamLabel: "House",
  now: new Date("2027-02-24T15:00:00Z"),
};

const render = (props: Partial<AdminGamesProps> = {}) =>
  renderToStaticMarkup(<AdminGames {...base} {...props} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("AdminGames, Best score", () => {
  it("shows the per-person table with Log an Attempt, and no separate list of Attempts", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*>Log an Attempt<\/button>/);
    expect(html).toContain('aria-label="Best score results"');
    expect(html.match(/data-slot="results-row"/g)).toHaveLength(1);
    // Every Attempt shows only inside the person's expanded row.
    const expansion =
      html.match(/data-slot="results-expansion"[^>]*>(.*?)<\/td>/)?.[1] ?? "";
    for (const score of ["42 laps", "30 laps"]) {
      expect(expansion).toContain(score);
      expect(html.split(score).length).toBe(expansion.split(score).length);
    }
  });

  it("puts Edit and Delete of every Attempt in the person's expanded row", () => {
    const html = render();
    const expansion =
      html.match(/data-slot="results-expansion"[^>]*>(.*?)<\/td>/)?.[1] ?? "";
    expect(text(html)).toContain("1 more attempt");
    expect(expansion).toContain('aria-label="Edit Attempt: Ashley · 42 laps"');
    expect(expansion).toContain(
      'aria-label="Delete Attempt: Ashley · 42 laps"',
    );
    expect(expansion).toContain('aria-label="Edit Attempt: Ashley · 30 laps"');
    expect(expansion).toContain(
      'aria-label="Delete Attempt: Ashley · 30 laps"',
    );
  });

  it("hides Log an Attempt when logging is refused (a Closed Competition)", () => {
    expect(render({ viewerCanLog: false, closed: true })).not.toContain(
      "Log an Attempt</button>",
    );
  });

  it("says there are no Attempts yet", () => {
    expect(render({ leaderboard: [], games: [] })).toContain(
      "No Attempts yet.",
    );
  });
});

describe("AdminGames, Head-to-head", () => {
  const match: GamesViewGame = {
    id: "m1",
    loggedAt: new Date("2027-02-24T14:55:00Z"),
    players: [
      { ...ashley, place: 1, score: null },
      { ...sam, place: 2, score: null },
    ],
    canEdit: true,
    canDelete: true,
  };
  const h2h: Partial<AdminGamesProps> = {
    gameFormat: "head-to-head",
    config: { drawsAllowed: false, bestOf: null },
    games: [match],
    entrantOptions: [ashley, sam],
  };

  it("keeps its list of Matches with Edit and Delete", () => {
    const html = render(h2h);
    expect(html).toContain('aria-label="Matches"');
    expect(html).toContain('aria-label="Edit Match: Ashley beat Sam"');
    expect(html).toContain('aria-label="Delete Match: Ashley beat Sam"');
    expect(html).not.toContain("<table");
  });

  it("says there are no Matches yet", () => {
    expect(render({ ...h2h, games: [] })).toContain("No Matches yet.");
  });
});
