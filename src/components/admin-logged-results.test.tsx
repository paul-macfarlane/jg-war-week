import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type {
  LoggedResultView,
  LoggedResultsRow,
} from "@/queries/logged-results";

import {
  AdminLoggedResults,
  type AdminLoggedResultsProps,
} from "./admin-logged-results";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
vi.mock("@/actions/logged-results", () => ({
  logResult: vi.fn(),
  updateResult: vi.fn(),
  deleteResult: vi.fn(),
}));

const ashley = { id: "p-ashley", name: "Ashley", color: "#f00" };
const sam = { id: "p-sam", name: "Sam", color: "#00f" };

function attempt(id: string, score: number, hour: number): LoggedResultView {
  return {
    id,
    recordedAt: new Date(Date.UTC(2027, 1, 24, hour)),
    players: [{ ...ashley, place: null, score }],
    creditedTo: ashley.id,
    canEdit: true,
    canDelete: true,
  };
}

const ashleyRow: LoggedResultsRow = {
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

const base: AdminLoggedResultsProps = {
  competitionId: "c1",
  format: "best-score",
  config: { betterIs: "higher", unit: "laps", teamScore: "best-member" },
  scoring: "individual",
  closed: false,
  viewerCanLog: true,
  logOffer: {
    label: "Log an Attempt",
    disabledReason: null,
    attemptsLeft: null,
  },
  scoringConfig: { direction: "higher", unit: "laps" },
  maxAttempts: null,
  attemptCounts: {},
  leaderboard: [ashleyRow],
  results: [attempt("g2", 30, 14), attempt("g1", 42, 13)],
  playerOptions: [ashley],
  primaryColor: "#000",
  teamLabel: "House",
  now: new Date("2027-02-24T15:00:00Z"),
};

const render = (props: Partial<AdminLoggedResultsProps> = {}) =>
  renderToStaticMarkup(<AdminLoggedResults {...base} {...props} />);

const text = (html: string) => html.replace(/<[^>]+>/g, " ");

describe("AdminLoggedResults, Best score", () => {
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
    expect(
      render({ viewerCanLog: false, logOffer: null, closed: true }),
    ).not.toContain("Log an Attempt</button>");
  });

  it("says there are no Attempts yet", () => {
    expect(render({ leaderboard: [], results: [] })).toContain(
      "No Attempts yet.",
    );
  });
});

describe("AdminLoggedResults, Head-to-head", () => {
  const match: LoggedResultView = {
    id: "m1",
    recordedAt: new Date("2027-02-24T14:55:00Z"),
    players: [
      { ...ashley, place: 1, score: null },
      { ...sam, place: 2, score: null },
    ],
    creditedTo: null,
    canEdit: true,
    canDelete: true,
  };
  const h2h: Partial<AdminLoggedResultsProps> = {
    format: "head-to-head",
    config: { drawsAllowed: false, bestOf: 3 },
    results: [match],
    playerOptions: [ashley, sam],
  };

  it("keeps its list of Matches with Edit and Delete", () => {
    const html = render(h2h);
    expect(html).toContain('aria-label="Matches"');
    expect(html).toContain('aria-label="Edit Match: Ashley beat Sam"');
    expect(html).toContain('aria-label="Delete Match: Ashley beat Sam"');
    expect(html).not.toContain("<table");
  });

  it("says there are no Matches yet", () => {
    expect(render({ ...h2h, results: [] })).toContain("No Matches yet.");
  });
});
