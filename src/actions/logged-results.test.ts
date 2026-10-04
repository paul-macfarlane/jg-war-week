import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  closeLoggedResults,
  deleteResult,
  logResult,
  reopenLoggedResults,
  updateResult,
} from "@/actions/logged-results";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, RESULT, WAR_WEEK, A, B, authorized } = vi.hoisted(() => ({
  ID: "22222222-2222-4222-8222-222222222222",
  RESULT: "33333333-3333-4333-8333-333333333333",
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
const authorizedFor = (format: "head-to-head" | "best-score") => ({
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  ctx: CTX,
  competition: {
    format,
    config:
      format === "head-to-head"
        ? { drawsAllowed: false, bestOf: 3 }
        : { betterIs: "higher", unit: "", teamScore: "best-member" },
  },
});
const REFUSED = { ok: false, error: "You're not a player in this Match." };

const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock("next/cache", () => ({ revalidatePath }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeResultWrite = vi.hoisted(() =>
  vi.fn(async () => authorized.current),
);
vi.mock("@/auth/authorize", () => ({ authorize, authorizeResultWrite }));
vi.mock("@/mutations/series", () => ({
  logMatch: vi.fn(async () => ({ ok: true, resultId: RESULT })),
  updateMatch: vi.fn(async () => ({ ok: true })),
  deleteMatch: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/mutations/attempts", () => ({
  logAttempt: vi.fn(async () => ({ ok: true, resultId: RESULT })),
  updateAttempt: vi.fn(async () => ({ ok: true })),
  deleteAttempt: vi.fn(async () => ({ ok: true })),
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

const win = { playerA: A, playerB: B, outcome: "a" };
const parsedWin = {
  players: [
    { id: A, place: 1, score: null },
    { id: B, place: 2, score: null },
  ],
};

describe("logResult", () => {
  it("authorizes with the posted input before parsing; the refusal wins over malformed input", async () => {
    authorized.current = REFUSED;
    const series = await import("@/mutations/series");

    await expect(
      logResult(ID, { playerA: A, playerB: B, outcome: "sideways" }),
    ).resolves.toEqual(REFUSED);
    expect(authorizeResultWrite).toHaveBeenCalledWith("log", ID, null, {
      playerA: A,
      playerB: B,
      outcome: "sideways",
    });
    expect(series.logMatch).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("parses by the Competition's Format once authorized", async () => {
    authorized.current = authorizedFor("head-to-head");
    const series = await import("@/mutations/series");

    await expect(logResult(ID, { ...win, outcome: "draw" })).resolves.toEqual({
      ok: false,
      error: "Draws aren't allowed in this Competition.",
      fieldErrors: { outcome: "Draws aren't allowed in this Competition." },
    });
    expect(series.logMatch).not.toHaveBeenCalled();
  });

  it("logs a Match, then revalidates", async () => {
    authorized.current = authorizedFor("head-to-head");
    const series = await import("@/mutations/series");

    await expect(logResult(ID, win)).resolves.toEqual({
      ok: true,
      resultId: RESULT,
    });
    expect(series.logMatch).toHaveBeenCalledWith(ID, parsedWin, CTX);
    expect(revalidatePath).toHaveBeenCalledWith("/xi", "layout");
  });

  it("logs an Attempt for a Best score Competition", async () => {
    authorized.current = authorizedFor("best-score");
    const attempts = await import("@/mutations/attempts");

    await expect(logResult(ID, { player: A, score: "12.5" })).resolves.toEqual({
      ok: true,
      resultId: RESULT,
    });
    expect(attempts.logAttempt).toHaveBeenCalledWith(
      ID,
      { participantId: A, score: 12.5 },
      CTX,
    );
  });
});

describe("updateResult and deleteResult", () => {
  it("authorizes an edit with the result and its posted input", async () => {
    authorized.current = authorizedFor("head-to-head");
    const series = await import("@/mutations/series");

    await expect(updateResult(ID, RESULT, win)).resolves.toEqual({ ok: true });
    expect(authorizeResultWrite).toHaveBeenCalledWith("edit", ID, RESULT, win);
    expect(series.updateMatch).toHaveBeenCalledWith(ID, RESULT, parsedWin, CTX);
  });

  it("authorizes a delete with no input, stops on a refusal, and deletes by Format", async () => {
    authorized.current = REFUSED;
    const series = await import("@/mutations/series");
    const attempts = await import("@/mutations/attempts");

    await expect(deleteResult(ID, RESULT)).resolves.toEqual(REFUSED);
    expect(authorizeResultWrite).toHaveBeenCalledWith("delete", ID, RESULT);
    expect(series.deleteMatch).not.toHaveBeenCalled();

    authorized.current = authorizedFor("head-to-head");
    await expect(deleteResult(ID, RESULT)).resolves.toEqual({ ok: true });
    expect(series.deleteMatch).toHaveBeenCalledWith(ID, RESULT, CTX);

    authorized.current = authorizedFor("best-score");
    await expect(deleteResult(ID, RESULT)).resolves.toEqual({ ok: true });
    expect(attempts.deleteAttempt).toHaveBeenCalledWith(ID, RESULT, CTX);
  });
});

describe("Host and Organizer Close and Reopen", () => {
  it('closes through "results.close" and reopens through "results.reopen"', async () => {
    authorized.current = HOST_OK;
    const logged = await import("@/mutations/close");

    await expect(closeLoggedResults(ID)).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledWith("results.close", "competition", ID);
    expect(logged.closeCompetition).toHaveBeenCalledWith(ID, CTX);

    await expect(reopenLoggedResults(ID)).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledWith("results.reopen", "competition", ID);
    expect(logged.reopenCompetition).toHaveBeenCalledWith(ID, CTX);
  });

  it("returns the refusal and never writes when not authorized", async () => {
    authorized.current = { ok: false, error: "Sign in to continue." };
    const logged = await import("@/mutations/close");

    await expect(closeLoggedResults(ID)).resolves.toEqual(authorized.current);
    await expect(reopenLoggedResults(ID)).resolves.toEqual(authorized.current);
    expect(logged.closeCompetition).not.toHaveBeenCalled();
    expect(logged.reopenCompetition).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
