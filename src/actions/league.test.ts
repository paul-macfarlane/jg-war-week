import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearLeagueResult,
  clearPairings,
  closeLeague,
  pairLeague,
  pairNextRound,
  recordLeagueResult,
  reopenLeague,
  swapPairing,
} from "@/actions/league";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, MATCH, WAR_WEEK, X, Y, authorized } = vi.hoisted(() => ({
  ID: "22222222-2222-4222-8222-222222222222",
  MATCH: "33333333-3333-4333-8333-333333333333",
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  X: "44444444-4444-4444-8444-444444444444",
  Y: "55555555-5555-4555-8555-555555555555",
  /** What the mocked authorize steps return; each test sets it. */
  authorized: { current: {} as Record<string, unknown> },
}));

const CTX = { warWeekId: WAR_WEEK, actorEmail: "neo@jahnelgroup.com" };
const OK = {
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
  ctx: CTX,
  competition: { scoreDirection: "higher" },
};
const REFUSED = { ok: false, error: "You're not a player in this Match." };

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeLeagueRecord = vi.hoisted(() =>
  vi.fn(async () => authorized.current),
);
vi.mock("@/auth/authorize", () => ({ authorize, authorizeLeagueRecord }));
vi.mock("@/mutations/league", () => ({
  pairLeague: vi.fn(async () => ({ ok: true })),
  pairNextRound: vi.fn(async () => ({ ok: true })),
  swapPairing: vi.fn(async () => ({ ok: true })),
  clearPairings: vi.fn(async () => ({ ok: true })),
  recordLeagueResult: vi.fn(async () => ({ ok: true })),
  clearLeagueResult: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/mutations/close", () => ({
  closeCompetition: vi.fn(async () => ({ ok: true })),
  reopenCompetition: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("League pairing actions", () => {
  it('pair, pair next, swap and clear pairings run through "league.pair", then revalidate', async () => {
    authorized.current = OK;
    const league = await import("@/mutations/league");
    await expect(pairLeague(ID)).resolves.toEqual({ ok: true });
    await expect(pairNextRound(ID)).resolves.toEqual({ ok: true });
    await expect(swapPairing(ID, { round: 1, x: X, y: Y })).resolves.toEqual({
      ok: true,
    });
    await expect(clearPairings(ID)).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledTimes(4);
    for (const call of authorize.mock.calls as unknown[][]) {
      expect(call).toEqual(["league.pair", "competition", ID]);
    }
    expect(league.pairLeague).toHaveBeenCalledWith(ID, {}, CTX);
    expect(league.swapPairing).toHaveBeenCalledWith(
      ID,
      { round: 1, x: X, y: Y },
      CTX,
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("refuses before parsing: the refusal wins over a malformed swap", async () => {
    authorized.current = REFUSED;
    const league = await import("@/mutations/league");
    await expect(swapPairing(ID, { round: "x" })).resolves.toEqual(REFUSED);
    expect(league.swapPairing).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("refuses a malformed swap once authorized", async () => {
    authorized.current = OK;
    const league = await import("@/mutations/league");
    await expect(swapPairing(ID, { round: 0, x: X, y: Y })).resolves.toEqual({
      ok: false,
      error: "Choose two Entrants of this round.",
    });
    expect(league.swapPairing).not.toHaveBeenCalled();
  });

  it('closes through "results.close" and reopens through "results.reopen"', async () => {
    authorized.current = OK;
    const close = await import("@/mutations/close");
    await closeLeague(ID);
    await reopenLeague(ID);
    expect(authorize).toHaveBeenNthCalledWith(
      1,
      "results.close",
      "competition",
      ID,
    );
    expect(authorize).toHaveBeenNthCalledWith(
      2,
      "results.reopen",
      "competition",
      ID,
    );
    expect(close.closeCompetition).toHaveBeenCalledWith(ID, CTX);
    expect(close.reopenCompetition).toHaveBeenCalledWith(ID, CTX);
  });
});

describe("League result actions", () => {
  it("authorizes the Match before parsing: the refusal wins over malformed input", async () => {
    authorized.current = REFUSED;
    const league = await import("@/mutations/league");
    await expect(
      recordLeagueResult(ID, MATCH, { result: "sideways" }),
    ).resolves.toEqual(REFUSED);
    expect(authorizeLeagueRecord).toHaveBeenCalledWith(
      "league.record",
      ID,
      MATCH,
    );
    expect(league.recordLeagueResult).not.toHaveBeenCalled();
  });

  it("parses with the League's Score direction: the Scores decide, and a posted result against them is refused (R2)", async () => {
    authorized.current = OK;
    const league = await import("@/mutations/league");
    await expect(
      recordLeagueResult(ID, MATCH, { scoreA: "3", scoreB: "5", result: "a" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "The Scores decide this result: change a Score.",
    });
    await expect(
      recordLeagueResult(ID, MATCH, { scoreA: "3", scoreB: "3" }),
    ).resolves.toEqual({ ok: true });
    expect(league.recordLeagueResult).toHaveBeenCalledWith(
      ID,
      MATCH,
      { result: "draw", scoreA: 3, scoreB: 3 },
      CTX,
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it('clears through "league.clear"', async () => {
    authorized.current = OK;
    const league = await import("@/mutations/league");
    await expect(clearLeagueResult(ID, MATCH)).resolves.toEqual({ ok: true });
    expect(authorizeLeagueRecord).toHaveBeenCalledWith(
      "league.clear",
      ID,
      MATCH,
    );
    expect(league.clearLeagueResult).toHaveBeenCalledWith(ID, MATCH, CTX);
  });
});
