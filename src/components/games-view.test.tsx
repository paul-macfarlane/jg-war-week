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
    finishPoints: 0,
    ...stats,
  };
}

function game(
  id: string,
  players: GamesViewGame["players"],
  allowed = false,
): GamesViewGame {
  return {
    id,
    loggedAt: new Date("2027-02-24T14:55:00Z"),
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
  gameType: "head-to-head",
  config: { drawsAllowed: true, bestOf: null },
  scoring: "individual",
  closed: false,
  loggingOpen: true,
  leaderboard: [
    row(ashley.id, "Ashley", 1, { played: 2, wins: 2 }),
    row(sam.id, "Sam", 2, { played: 2, losses: 1, draws: 1 }),
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
  now: NOW,
  openLog: false,
};

function render(props: Partial<GamesViewProps> = {}) {
  return renderToStaticMarkup(<GamesView {...base} {...props} />);
}

/** The text of every column header in the leaderboard, in order. */
function headers(html: string): string[] {
  const head = html.match(/<thead>(.*?)<\/thead>/)?.[1] ?? "";
  return [...head.matchAll(/<th[^>]*>(.*?)<\/th>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ""),
  );
}

const text = (html: string) =>
  html.replace(/<[^>]+>/g, " ").replaceAll("&#x27;", "'");

describe("GamesView leaderboard", () => {
  it("shows Played, W, L, D for head-to-head", () => {
    expect(headers(render())).toEqual([
      "Rank",
      "Player",
      "Played",
      "W",
      "L",
      "D",
    ]);
  });

  it("shows the counted score with its unit, then Played, for best-score", () => {
    const html = render({
      gameType: "best-score",
      config: { count: "best", betterIs: "higher", unit: "trips" },
      leaderboard: [row(ashley.id, "Ashley", 1, { played: 3, best: 42 })],
      games: [],
    });
    expect(headers(html)).toEqual(["Rank", "Player", "Best (trips)", "Played"]);
    expect(html).toMatch(/<td[^>]*>42<\/td>/);
  });

  it("shows Finish Points, Played and Wins for ranked", () => {
    const html = render({
      gameType: "ranked",
      config: { finishPoints: [] },
      games: [],
    });
    expect(headers(html)).toEqual([
      "Rank",
      "Player",
      "Finish Points",
      "Played",
      "Wins",
    ]);
  });

  it("names the column Team in a team Competition", () => {
    expect(headers(render({ scoring: "team" }))[1]).toBe("Team");
  });

  it("shows an unranked row's rank and stats as —", () => {
    const html = render();
    const kimRow = html.match(
      /<tr[^>]*>(?:(?!<\/tr>).)*Kim(?:(?!<\/tr>).)*<\/tr>/,
    );
    expect(kimRow).not.toBeNull();
    const cells = [...kimRow![0].matchAll(/<td[^>]*>(.*?)<\/td>/g)].map(
      (m) => m[1],
    );
    expect(cells.filter((c) => c === "—")).toHaveLength(5);
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
});

describe("GamesView Log a Game", () => {
  it("offers Log a Game only when the viewer may log", () => {
    expect(render({ viewerCanLog: true })).toMatch(
      /<button[^>]*>Log a Game<\/button>/,
    );
    expect(text(render({ viewerCanLog: false }))).not.toContain("Log a Game");
  });

  it("says a closed Competition's points are in the Standings", () => {
    expect(text(render({ closed: true }))).toContain(
      "Closed — the leaderboard's Placement Points are in the Standings.",
    );
    expect(text(render())).not.toContain("Closed —");
  });

  it("prompts whoever runs a decided Best of to close it", () => {
    const html = render({
      runs: true,
      bestOfDecided: true,
      bestOfWinner: "Ashley",
      loggingOpen: false,
    });
    expect(text(html)).toContain("Best of decided: Ashley —");
    expect(html).toMatch(
      /<a[^>]*href="\/admin\/competitions\/c1\/games"[^>]*>Close it<\/a>/,
    );
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

describe("GameLog", () => {
  const log = (props: Partial<Parameters<typeof GameLog>[0]> = {}) =>
    renderToStaticMarkup(
      <GameLog
        competitionId="c1"
        gameType="head-to-head"
        unit=""
        games={base.games}
        filter="all"
        linked={{ participantId: ashley.id, teamId: null }}
        now={NOW}
        onEdit={() => {}}
        {...props}
      />,
    );

  it("lists every Game newest first, with how long ago it was logged", () => {
    const t = text(log());
    expect(t.indexOf("Ashley beat Sam")).toBeLessThan(
      t.indexOf("Sam and Kim drew"),
    );
    expect(t).toContain("5 minutes ago");
  });

  it("shows only the viewer's Games under Mine", () => {
    const t = text(log({ filter: "mine" }));
    expect(t).toContain("Ashley beat Sam");
    expect(t).not.toContain("Sam and Kim drew");
  });

  it("says so when the viewer has no Game under Mine", () => {
    const t = text(
      log({
        filter: "mine",
        linked: { participantId: "p-nobody", teamId: null },
      }),
    );
    expect(t).toContain("You haven't played a Game yet.");
  });

  it("offers Edit and Delete only on the Games the viewer may change", () => {
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
    expect(html).toContain('aria-label="Edit Game: Ashley beat Sam"');
    expect(html).toContain('aria-label="Delete Game: Ashley beat Sam"');
    expect(html).not.toContain("Edit Game: Sam and Kim drew");
    expect(html).not.toContain("Delete Game: Sam and Kim drew");
  });

  it("says so when no Game is logged yet", () => {
    expect(text(log({ games: [] }))).toContain("No Games yet.");
  });
});
