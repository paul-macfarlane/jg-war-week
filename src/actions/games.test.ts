import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeGames,
  deleteGame,
  logGame,
  reopenGames,
  setGamesEntrants,
  setGamesSettings,
  updateGame,
} from "@/actions/games";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, GAME, WAR_WEEK, A, B, authorized } = vi.hoisted(() => ({
  ID: "22222222-2222-4222-8222-222222222222",
  GAME: "33333333-3333-4333-8333-333333333333",
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  A: "44444444-4444-4444-8444-444444444444",
  B: "55555555-5555-4555-8555-555555555555",
  /** What the mocked authorize steps return; each test sets it. */
  authorized: { current: {} as Record<string, unknown> },
}));

const CTX = { warWeekId: WAR_WEEK, actorEmail: "neo@jahnelgroup.com" };
const HOST_OK = {
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
  ctx: CTX,
};
const PLAYER_OK = {
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  ctx: CTX,
  competition: {
    gameType: "head-to-head",
    config: { drawsAllowed: false, bestOf: null },
  },
};
const REFUSED = { ok: false, error: "You're not a player in this Game." };

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeGameWrite = vi.hoisted(() =>
  vi.fn(async () => authorized.current),
);
vi.mock("@/auth/authorize", () => ({ authorize, authorizeGameWrite }));
vi.mock("@/mutations/games", () => ({
  logGame: vi.fn(async () => ({ ok: true, gameId: GAME })),
  updateGame: vi.fn(async () => ({ ok: true })),
  deleteGame: vi.fn(async () => ({ ok: true })),
  setGamesSettings: vi.fn(async () => ({ ok: true })),
  closeGames: vi.fn(async () => ({ ok: true })),
  reopenGames: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/mutations/brackets", () => ({
  replaceEntrants: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

const win = { playerA: A, playerB: B, outcome: "a" };
const parsedWin = {
  players: [
    { id: A, place: 1, score: null },
    { id: B, place: 2, score: null },
  ],
};

describe("logGame", () => {
  it("authorizes with the posted players before parsing; the refusal wins over malformed input", async () => {
    authorized.current = REFUSED;
    const mutations = await import("@/mutations/games");

    await expect(
      logGame(ID, { playerA: A, playerB: B, outcome: "sideways" }),
    ).resolves.toEqual(REFUSED);
    expect(authorizeGameWrite).toHaveBeenCalledWith("games.log", ID, null, [
      A,
      B,
    ]);
    expect(mutations.logGame).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("parses by the Competition's Game Type once authorized", async () => {
    authorized.current = PLAYER_OK;
    const mutations = await import("@/mutations/games");

    await expect(logGame(ID, { ...win, outcome: "draw" })).resolves.toEqual({
      ok: false,
      error: "Draws aren't allowed in this Competition.",
      fieldErrors: { outcome: "Draws aren't allowed in this Competition." },
    });
    expect(mutations.logGame).not.toHaveBeenCalled();
  });

  it("passes the parsed Game and the authorized context, then revalidates", async () => {
    authorized.current = PLAYER_OK;
    const mutations = await import("@/mutations/games");

    await expect(logGame(ID, win)).resolves.toEqual({
      ok: true,
      gameId: GAME,
    });
    expect(mutations.logGame).toHaveBeenCalledWith(ID, parsedWin, CTX);
    expect(revalidatePath).toHaveBeenCalledWith("/xi", "layout");
  });
});

describe("updateGame and deleteGame", () => {
  it("authorizes an edit with the Game and its posted players", async () => {
    authorized.current = PLAYER_OK;
    const mutations = await import("@/mutations/games");

    await expect(updateGame(ID, GAME, win)).resolves.toEqual({ ok: true });
    expect(authorizeGameWrite).toHaveBeenCalledWith("games.edit", ID, GAME, [
      A,
      B,
    ]);
    expect(mutations.updateGame).toHaveBeenCalledWith(ID, GAME, parsedWin, CTX);
  });

  it("authorizes a delete with no players, and stops on a refusal", async () => {
    authorized.current = REFUSED;
    const mutations = await import("@/mutations/games");

    await expect(deleteGame(ID, GAME)).resolves.toEqual(REFUSED);
    expect(authorizeGameWrite).toHaveBeenCalledWith(
      "games.delete",
      ID,
      GAME,
      [],
    );
    expect(mutations.deleteGame).not.toHaveBeenCalled();

    authorized.current = PLAYER_OK;
    await expect(deleteGame(ID, GAME)).resolves.toEqual({ ok: true });
    expect(mutations.deleteGame).toHaveBeenCalledWith(ID, GAME, CTX);
  });
});

describe("Host and Organizer Games writes", () => {
  const settings = {
    gameType: "head-to-head",
    drawsAllowed: true,
    bestOf: "off",
    entrantsOpen: true,
    selfEnroll: false,
  };

  it('authorizes "games.settings" before parsing, then saves the parsed settings', async () => {
    authorized.current = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };
    const mutations = await import("@/mutations/games");
    await expect(setGamesSettings(ID, "junk")).resolves.toEqual(
      authorized.current,
    );
    expect(authorize).toHaveBeenCalledWith("games.settings", "competition", ID);
    expect(mutations.setGamesSettings).not.toHaveBeenCalled();

    authorized.current = HOST_OK;
    await expect(setGamesSettings(ID, settings)).resolves.toEqual({ ok: true });
    expect(mutations.setGamesSettings).toHaveBeenCalledWith(
      ID,
      {
        gameConfig: { drawsAllowed: true, bestOf: null },
        entrantsOpen: true,
        loggingClosesAt: null,
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      },
      CTX,
    );
  });

  it('sets a fixed Entrant list through "games.entrants"', async () => {
    authorized.current = HOST_OK;
    const brackets = await import("@/mutations/brackets");

    await expect(setGamesEntrants(ID, { targetIds: [A, B] })).resolves.toEqual({
      ok: true,
    });
    expect(authorize).toHaveBeenCalledWith("games.entrants", "competition", ID);
    expect(brackets.replaceEntrants).toHaveBeenCalledWith(
      ID,
      { targetIds: [A, B] },
      CTX,
    );
  });

  it('closes through "games.close" and reopens through "games.reopen"', async () => {
    authorized.current = HOST_OK;
    const mutations = await import("@/mutations/games");

    await expect(closeGames(ID)).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledWith("games.close", "competition", ID);
    expect(mutations.closeGames).toHaveBeenCalledWith(ID, CTX);

    await expect(reopenGames(ID)).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledWith("games.reopen", "competition", ID);
    expect(mutations.reopenGames).toHaveBeenCalledWith(ID, CTX);
  });

  it("returns the refusal and never writes when not authorized", async () => {
    authorized.current = { ok: false, error: "Sign in to continue." };
    const mutations = await import("@/mutations/games");

    await expect(closeGames(ID)).resolves.toEqual(authorized.current);
    await expect(reopenGames(ID)).resolves.toEqual(authorized.current);
    expect(mutations.closeGames).not.toHaveBeenCalled();
    expect(mutations.reopenGames).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
