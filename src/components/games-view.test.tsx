import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GamesViewGame, GamesViewRow } from "@/queries/games";

import { GameLog, GamesView, type GamesViewProps } from "./games-view";

// The log's Delete confirm and the Game form read the router.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
}));
// Server actions can't load in a component test.
vi.mock("@/actions/games", () => ({
  logGame: vi.fn(),
  updateGame: vi.fn(),
  deleteGame: vi.fn(),
}));

const NOW = new Date("2027-02-24T15:00:00Z");

function row(
  id: string,
  name: string,
  rank: number | null,
  stats: Partial<GamesViewRow> = {},
): GamesViewRow {
  return {
    id,
    name,
    color: "#f00",
    rank,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    best: null,
    total: null,
    points: null,
    ...stats,
  };
}

function game(
  id: string,
  players: GamesViewGame["players"],
  allowed = false,
  loggedAt = new Date("2027-02-24T14:55:00Z"),
): GamesViewGame {
  return {
    id,
    loggedAt,
    players,
    canEdit: allowed,
    canDelete: allowed,
  };
}

const ashley = { id: "p-ashley", name: "Ashley", color: "#f00" };
const sam = { id: "p-sam", name: "Sam", color: "#00f" };
const kim = { id: "p-kim", name: "Kim", color: null };

const base: GamesViewProps = {
  competitionId: "c1",
  gameFormat: "head-to-head",
  config: { drawsAllowed: true, bestOf: null },
  scoring: "individual",
  closed: false,
  entrantsOpen: true,
  loggingOpen: true,
  leaderboard: [
    row(ashley.id, "Ashley", 1, { played: 2, wins: 2, points: 3 }),
    row(sam.id, "Sam", 2, { played: 2, losses: 1, draws: 1, points: 2 }),
    row(kim.id, "Kim", null),
  ],
  games: [
    game("g2", [
      { ...ashley, place: 1, score: null },
      { ...sam, place: 2, score: null },
    ]),
    game("g1", [
      { ...sam, place: 1, score: null },
      { ...kim, place: 1, score: null },
    ]),
  ],
  linked: null,
  runs: false,
  viewerCanLog: false,
  bestOfDecided: false,
  bestOfWinner: null,
  entrantOptions: [ashley, sam, kim],
  primaryColor: "#000",
  teamLabel: "House",
  now: NOW,
  openLog: false,
};

function render(props: Partial<GamesViewProps> = {}) {
  return renderToStaticMarkup(<GamesView {...base} {...props} />);
}

const text = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&#x27;", "'")
    .replace(/\s+/g, " ");

/** The text of every column header of the table named `label`, in order. */
function headers(html: string, label: string): string[] {
  const table = html.match(
    new RegExp(`<table[^>]*aria-label="${label}"[^>]*>(.*?)</table>`),
  )?.[1];
  const head = table?.match(/<thead[^>]*>(.*?)<\/thead>/)?.[1] ?? "";
  return [...head.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) =>
    text(m[1]).trim(),
  );
}

/** One results row's markup (its expansion row follows it, not inside). */
function resultsRow(html: string, name: string): string {
  const rows = html.match(/<tr[^>]*data-slot="results-row"[^>]*>.*?<\/tr>/g);
  const found = rows?.find((r) => r.includes(`>${name}<`));
  expect(found).toBeDefined();
  return found!;
}

describe("GamesView Head-to-head results table (other than two Entrants)", () => {
  it("is the results table: Rank, Participant, War Week points with Provisional; no Score column", () => {
    const html = render();
    expect(headers(html, "Head-to-head results")).toEqual([
      "Rank",
      "Participant War Week points Provisional",
      "War Week points Provisional",
    ]);
    expect(text(html)).not.toContain("Leaderboard");
  });

  it("shows each row's record in words and its Provisional points", () => {
    const ashleyRow = text(resultsRow(render(), "Ashley"));
    expect(ashleyRow).toContain("2 won · 0 lost · 0 drawn");
    expect(ashleyRow).toContain("Winner");
    expect(ashleyRow).toContain(" 3 ");
    expect(text(resultsRow(render(), "Sam"))).toContain(
      "0 won · 1 lost · 1 drawn",
    );
  });

  it("names the column by the Team Label in a team Competition", () => {
    expect(
      headers(render({ scoring: "team" }), "Head-to-head results")[1],
    ).toMatch(/^House /);
  });

  it("shows an unranked row's rank as – with no record", () => {
    const kimRow = resultsRow(render(), "Kim");
    expect(kimRow).toMatch(/<td[^>]*><span[^>]*>–<\/span><\/td>/);
    expect(text(kimRow)).not.toContain("won");
  });

  it("marks Your Team's row in a team Competition", () => {
    const html = render({
      scoring: "team",
      leaderboard: [row("t-red", "Red", 1, { played: 1, wins: 1 })],
      games: [],
      linked: { participantId: "p-ashley", teamId: "t-red" },
    });
    expect(html).toMatch(/<span data-you[^>]*>Your Team<\/span>/);
  });

  it("lists the Matches below the table", () => {
    const t = text(render());
    expect(t).toContain("Matches");
    expect(t.indexOf("Ashley beat Sam")).toBeGreaterThan(
      t.indexOf("War Week points"),
    );
  });

  it("keeps the table for an open Competition even with two players", () => {
    const html = render({
      leaderboard: base.leaderboard.slice(0, 2),
      entrantOptions: [ashley, sam],
    });
    expect(html).toContain('aria-label="Head-to-head results"');
    expect(html).not.toContain('aria-label="Series"');
  });
});

describe("GamesView Head-to-head series (exactly two Entrants)", () => {
  const at = (minute: number) => new Date(Date.UTC(2027, 1, 24, 14, minute));
  // Four Matches, newest first as the view gets them. Oldest first: Ashley
  // won 21–15, Sam won 21–18, a draw with no Scores, Ashley won 21–9.
  const matches = [
    game(
      "m4",
      [
        { ...ashley, place: 1, score: 21 },
        { ...sam, place: 2, score: 9 },
      ],
      false,
      at(40),
    ),
    game(
      "m3",
      [
        { ...ashley, place: 1, score: null },
        { ...sam, place: 1, score: null },
      ],
      false,
      at(30),
    ),
    game(
      "m2",
      [
        { ...ashley, place: 2, score: 18 },
        { ...sam, place: 1, score: 21 },
      ],
      false,
      at(20),
    ),
    game(
      "m1",
      [
        { ...ashley, place: 1, score: 21 },
        { ...sam, place: 2, score: 15 },
      ],
      false,
      at(10),
    ),
  ];
  const series: Partial<GamesViewProps> = {
    entrantsOpen: false,
    // Ranked, so the leader comes first; the series keeps the list's order.
    leaderboard: [
      row(sam.id, "Sam", 2, { played: 4, wins: 1, points: 2 }),
      row(ashley.id, "Ashley", 1, { played: 4, wins: 2, points: 3 }),
    ],
    entrantOptions: [ashley, sam],
    games: matches,
  };

  it("shows no leaderboard or results table", () => {
    const html = render(series);
    expect(html).not.toContain("<table");
    expect(text(html)).not.toContain("Leaderboard");
  });

  it("shows the series score 2–1 between the Entrants in the list's order", () => {
    const html = render(series);
    expect(html).toMatch(/data-slot="series-score"[^>]*>2–1</);
    const t = text(html);
    expect(t.indexOf("Ashley")).toBeLessThan(t.indexOf("Sam"));
    expect(t).toContain("1 draw");
  });

  it("lists the Matches oldest first with both Scores and each Winner or Draw", () => {
    const html = render(series);
    const scores = [
      ...html.matchAll(/data-slot="series-match-score"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(scores).toEqual(["21–15", "18–21", "vs", "21–9"]);
    const results = [
      ...html.matchAll(/data-slot="series-match-result"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(results).toEqual([
      "Winner: Ashley",
      "Winner: Sam",
      "Draw",
      "Winner: Ashley",
    ]);
  });

  it("has no series Winner until decided, then names it (no Best of: at Close)", () => {
    expect(render(series)).not.toContain('data-slot="series-winner"');
    expect(text(render(series))).toContain(
      "The series Winner is decided at Close.",
    );
    const closed = render({ ...series, closed: true });
    expect(text(closed)).toMatch(/Winner Ashley/);
    expect(closed).toContain('data-slot="series-winner"');
  });

  it("names a Best of's Winner the moment it is decided", () => {
    const html = render({
      ...series,
      config: { drawsAllowed: true, bestOf: 3 },
    });
    expect(html).toContain('data-slot="series-winner"');
  });

  it("shows each Entrant's Placement Points, Provisional until Closed", () => {
    const open = render(series);
    const points = [
      ...open.matchAll(/data-slot="series-points-value"[^>]*>([^<]*)</g),
    ].map((m) => m[1]);
    expect(points).toEqual(["3 points", "2 points"]);
    expect(open).toMatch(/<button[^>]*>Provisional<\/button>/);
    const closed = render({ ...series, closed: true });
    expect(closed).not.toContain(">Provisional<");
    expect(text(closed)).toContain("Closed");
  });

  it("offers Edit and Delete on a Match the viewer may change", () => {
    const html = render({
      ...series,
      games: matches.map((m) =>
        m.id === "m1" ? { ...m, canEdit: true, canDelete: true } : m,
      ),
    });
    expect(html).toContain(
      'aria-label="Edit Match: Match 1: Ashley 21 vs Sam 15"',
    );
    expect(html).toContain(
      'aria-label="Delete Match: Match 1: Ashley 21 vs Sam 15"',
    );
    expect(html.match(/aria-label="Edit Match/g)).toHaveLength(1);
  });
});

describe("GamesView Best score (one row per person)", () => {
  const at = (hour: number) => new Date(Date.UTC(2027, 1, 24, hour));
  // Ashley: 12, 30, 18 (best 30, total 60); Sam: one Attempt of 25.
  const attempts = (allowed = false) => [
    game("a3", [{ ...ashley, place: null, score: 18 }], allowed, at(12)),
    game("s1", [{ ...sam, place: null, score: 25 }], allowed, at(11)),
    game("a2", [{ ...ashley, place: null, score: 30 }], allowed, at(10)),
    game("a1", [{ ...ashley, place: null, score: 12 }], allowed, at(9)),
  ];
  const bestScore: Partial<GamesViewProps> = {
    gameFormat: "best-score",
    config: { count: "best", betterIs: "higher", unit: "trips" },
    leaderboard: [
      row(ashley.id, "Ashley", 1, {
        played: 3,
        best: 30,
        total: 60,
        points: 3,
      }),
      row(sam.id, "Sam", 2, { played: 1, best: 25, total: 25, points: 2 }),
    ],
    games: attempts(),
  };
  const expansionAfter = (html: string, name: string) => {
    const at = html.indexOf(resultsRow(html, name));
    return html
      .slice(at)
      .match(/<td[^>]*data-slot="results-expansion"[^>]*>(.*?)<\/td>/)?.[1];
  };

  it("gives a person with three Attempts one row, their best, with the unit in the Score header", () => {
    const html = render(bestScore);
    expect(headers(html, "Best score results")).toEqual([
      "Rank",
      "Participant War Week points Provisional",
      "Score (trips)",
      "War Week points Provisional",
    ]);
    expect(html.match(/data-slot="results-row"/g)).toHaveLength(2);
    const ashleyRow = resultsRow(html, "Ashley");
    expect(ashleyRow).toMatch(/<td[^>]*>30<\/td>/);
    expect(text(ashleyRow)).toContain("Winner");
  });

  it("expands to the other two Attempts, labelled 2 more attempts", () => {
    const html = render(bestScore);
    expect(text(resultsRow(html, "Ashley"))).toContain("2 more attempts");
    const expansion = text(expansionAfter(html, "Ashley") ?? "");
    expect(expansion).toContain("18 trips");
    expect(expansion).toContain("12 trips");
    expect(expansion).not.toContain("30 trips");
    // Sam has no other Attempt, and nothing to change: no toggle.
    expect(resultsRow(html, "Sam")).not.toContain("aria-expanded=");
  });

  it("in total mode shows the sum and lists every Attempt that makes it up", () => {
    const html = render({
      ...bestScore,
      config: { count: "total", betterIs: "higher", unit: "trips" },
    });
    expect(resultsRow(html, "Ashley")).toMatch(/<td[^>]*>60<\/td>/);
    expect(text(resultsRow(html, "Ashley"))).toContain("3 attempts");
    const expansion = text(expansionAfter(html, "Ashley") ?? "");
    for (const score of ["18 trips", "30 trips", "12 trips"]) {
      expect(expansion).toContain(score);
    }
    expect(text(resultsRow(html, "Sam"))).toContain("1 attempt");
  });

  it("shows Top finishers above the table, each with points", () => {
    const html = render(bestScore);
    const top = html.indexOf('aria-label="Top finishers"');
    expect(top).toBeGreaterThan(-1);
    expect(top).toBeLessThan(html.indexOf("<table"));
    expect(text(html)).toContain("3 points");
  });

  it("has no separate list of Attempts or Matches", () => {
    const t = text(render(bestScore));
    expect(t).not.toContain("Matches");
    expect(t).not.toContain("Ashley · 18 trips");
  });

  it("puts Edit and Delete of each Attempt the viewer may change in the expanded row, the best one marked Best", () => {
    const html = render({ ...bestScore, games: attempts(true) });
    const expansion = expansionAfter(html, "Ashley") ?? "";
    expect(expansion).toContain('aria-label="Edit Attempt: Ashley · 30 trips"');
    expect(expansion).toContain(
      'aria-label="Delete Attempt: Ashley · 18 trips"',
    );
    expect(text(expansion)).toContain("Best");
    // Sam's lone Attempt is reachable to change, too.
    expect(text(resultsRow(html, "Sam"))).toContain("1 attempt");
    expect(expansionAfter(html, "Sam")).toContain(
      'aria-label="Edit Attempt: Sam · 25 trips"',
    );
  });

  it("says so when there is no Attempt and no Entrant yet", () => {
    expect(
      text(render({ ...bestScore, leaderboard: [], games: [] })),
    ).toContain("No Attempts yet.");
  });
});

describe("GamesView Log a Match or Attempt and banners", () => {
  it("offers Log a Match only when the viewer may log", () => {
    expect(render({ viewerCanLog: true })).toMatch(
      /<button[^>]*>Log a Match<\/button>/,
    );
    expect(text(render({ viewerCanLog: false }))).not.toContain("Log a Match");
  });

  it("offers Log an Attempt on a Best score Competition", () => {
    expect(
      render({
        gameFormat: "best-score",
        config: { count: "best", betterIs: "higher", unit: "trips" },
        viewerCanLog: true,
      }),
    ).toMatch(/<button[^>]*>Log an Attempt<\/button>/);
  });

  it("says a closed Competition's points are in the Standings", () => {
    expect(text(render({ closed: true }))).toContain(
      "Closed — its Placement Points are in the Standings.",
    );
    expect(text(render())).not.toContain("Closed —");
  });

  it("tells whoever runs a decided Best of it is decided, with no Close link (Manage is on the page)", () => {
    const html = render({
      runs: true,
      bestOfDecided: true,
      bestOfWinner: "Ashley",
      loggingOpen: false,
    });
    expect(text(html)).toContain("Best of decided: Ashley");
    expect(html).not.toContain("Close it");
    expect(html).not.toContain("/admin/competitions/");
  });

  it("tells a Participant the Best of is decided, without the Close link", () => {
    const html = render({
      bestOfDecided: true,
      bestOfWinner: "Ashley",
      loggingOpen: false,
    });
    expect(text(html)).toContain("Best of decided: Ashley");
    expect(html).not.toContain("Close it");
  });

  it("never renders an email", () => {
    const html = render({
      viewerCanLog: true,
      runs: true,
      linked: { participantId: ashley.id, teamId: null },
      games: base.games.map((g) => ({ ...g, canEdit: true, canDelete: true })),
    });
    expect(html).not.toContain("@");
  });
});

describe("GameLog (Head-to-head Matches)", () => {
  const log = (props: Partial<Parameters<typeof GameLog>[0]> = {}) =>
    renderToStaticMarkup(
      <GameLog
        competitionId="c1"
        gameFormat="head-to-head"
        unit=""
        games={base.games}
        filter="all"
        linked={{ participantId: ashley.id, teamId: null }}
        now={NOW}
        onEdit={() => {}}
        {...props}
      />,
    );

  it("lists every Match newest first, with how long ago it was logged", () => {
    const t = text(log());
    expect(t.indexOf("Ashley beat Sam")).toBeLessThan(
      t.indexOf("Sam and Kim drew"),
    );
    expect(t).toContain("5 minutes ago");
  });

  it("shows only the viewer's Matches under Mine", () => {
    const t = text(log({ filter: "mine" }));
    expect(t).toContain("Ashley beat Sam");
    expect(t).not.toContain("Sam and Kim drew");
  });

  it("says so when the viewer has no Match under Mine", () => {
    const t = text(
      log({
        filter: "mine",
        linked: { participantId: "p-nobody", teamId: null },
      }),
    );
    expect(t).toContain("You haven't played a Match yet.");
  });

  it("offers Edit and Delete only on the Matches the viewer may change", () => {
    const html = log({
      games: [
        game(
          "g2",
          [
            { ...ashley, place: 1, score: null },
            { ...sam, place: 2, score: null },
          ],
          true,
        ),
        game("g1", [
          { ...sam, place: 1, score: null },
          { ...kim, place: 1, score: null },
        ]),
      ],
    });
    expect(html).toContain('aria-label="Edit Match: Ashley beat Sam"');
    expect(html).toContain('aria-label="Delete Match: Ashley beat Sam"');
    expect(html).not.toContain("Edit Match: Sam and Kim drew");
    expect(html).not.toContain("Delete Match: Sam and Kim drew");
  });

  it("says so when no Match is logged yet", () => {
    expect(text(log({ games: [] }))).toContain("No Matches yet.");
  });
});
