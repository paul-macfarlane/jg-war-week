import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { reportMatchResult } from "@/actions/match-reports";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, MATCH, WAR_WEEK, authorized } = vi.hoisted(() => {
  const WAR_WEEK = "11111111-1111-4111-8111-111111111111";
  return {
    ID: "22222222-2222-4222-8222-222222222222",
    MATCH: "33333333-3333-4333-8333-333333333333",
    WAR_WEEK,
    /** What the mocked `authorize` returns; each test sets it. */
    authorized: { current: {} as Record<string, unknown> },
  };
});

const OK = {
  ok: true,
  actor: { email: "tony@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
  ctx: { warWeekId: WAR_WEEK, actorEmail: "tony@jahnelgroup.com" },
};

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeMatchReport = vi.hoisted(() =>
  vi.fn(async () => authorized.current),
);
vi.mock("@/auth/authorize", () => ({ authorize, authorizeMatchReport }));
vi.mock("@/mutations/match-reports", () => ({
  submitMatchReport: vi.fn(async () => ({ ok: true, resetMatchIds: [] })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("reportMatchResult", () => {
  const REPORTER = {
    ...OK,
    actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
    ctx: { warWeekId: WAR_WEEK, actorEmail: "neo@jahnelgroup.com" },
    linked: { participantId: "p1", teamId: "t1", squadId: null },
  };

  it("authorizes the report before parsing; the refusal wins over malformed input", async () => {
    authorized.current = {
      ok: false,
      error: "Self-report is off for this Competition.",
    };
    const mutations = await import("@/mutations/match-reports");

    await expect(reportMatchResult(ID, MATCH, "junk")).resolves.toEqual({
      ok: false,
      error: "Self-report is off for this Competition.",
    });
    expect(authorizeMatchReport).toHaveBeenCalledWith(ID, MATCH);
    expect(mutations.submitMatchReport).not.toHaveBeenCalled();
  });

  it("refuses a malformed result once authorized", async () => {
    authorized.current = REPORTER;
    const mutations = await import("@/mutations/match-reports");

    const result = await reportMatchResult(ID, MATCH, { order: "Red" });
    expect(result.ok).toBe(false);
    expect(mutations.submitMatchReport).not.toHaveBeenCalled();
  });

  it("passes the parsed result and the reporter's context to the mutation", async () => {
    authorized.current = REPORTER;
    const mutations = await import("@/mutations/match-reports");
    const order = [
      "44444444-4444-4444-8444-444444444444",
      "55555555-5555-4555-8555-555555555555",
    ];

    await expect(reportMatchResult(ID, MATCH, { order })).resolves.toEqual({
      ok: true,
      resetMatchIds: [],
    });
    expect(mutations.submitMatchReport).toHaveBeenCalledWith(
      ID,
      MATCH,
      expect.objectContaining({ order }),
      REPORTER.ctx,
    );
  });
});
