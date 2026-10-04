import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { GamesViewGame } from "@/queries/games";

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

const attempt: GamesViewGame = {
  id: "g1",
  loggedAt: new Date("2027-02-24T14:55:00Z"),
  players: [{ ...ashley, place: 1, score: 42 }],
  canEdit: true,
  canDelete: true,
};

const base: AdminGamesProps = {
  competitionId: "c1",
  gameFormat: "best-score",
  config: { count: "best", betterIs: "higher", unit: "laps" },
  scoring: "individual",
  viewerCanLog: true,
  games: [attempt],
  entrantOptions: [ashley],
  now: new Date("2027-02-24T15:00:00Z"),
};

const render = (props: Partial<AdminGamesProps> = {}) =>
  renderToStaticMarkup(<AdminGames {...base} {...props} />);

describe("AdminGames", () => {
  it("lists the Competition's Games with Edit and Delete and a Log a Game button", () => {
    const html = render();
    expect(html).toMatch(/<button[^>]*>Log a Game<\/button>/);
    expect(html).toContain("Ashley");
    expect(html).toMatch(/aria-label="Edit Game: [^"]*Ashley/);
    expect(html).toMatch(/aria-label="Delete Game: [^"]*Ashley/);
  });

  it("hides Log a Game when logging is refused (a Closed Competition)", () => {
    expect(render({ viewerCanLog: false })).not.toContain(
      "Log a Game</button>",
    );
  });

  it("says there are no Games yet", () => {
    expect(render({ games: [] })).toContain("No Games yet.");
  });
});
