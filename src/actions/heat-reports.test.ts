import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setSelfReport } from "@/actions/heat-reports";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, WAR_WEEK, authorized } = vi.hoisted(() => {
  const WAR_WEEK = "11111111-1111-4111-8111-111111111111";
  return {
    ID: "22222222-2222-4222-8222-222222222222",
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
vi.mock("@/auth/authorize", () => ({ authorize }));
vi.mock("@/mutations/heat-reports", () => ({
  setSelfReport: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("setSelfReport", () => {
  it('authorizes "competition.self-report" before parsing; the refusal wins over malformed input', async () => {
    authorized.current = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };
    const mutations = await import("@/mutations/heat-reports");

    await expect(setSelfReport(ID, "junk")).resolves.toEqual({
      ok: false,
      error: "You're not a Host of that Competition.",
    });
    expect(authorize).toHaveBeenCalledWith(
      "competition.self-report",
      "competition",
      ID,
    );
    expect(mutations.setSelfReport).not.toHaveBeenCalled();
  });

  it("refuses malformed input once authorized", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/heat-reports");

    await expect(setSelfReport(ID, { on: "yes" })).resolves.toEqual({
      ok: false,
      error: "Turn self-report on or off.",
    });
    expect(mutations.setSelfReport).not.toHaveBeenCalled();
  });

  it("passes the parsed toggle and the authorized context to the mutation", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/heat-reports");

    await expect(setSelfReport(ID, { on: true })).resolves.toEqual({
      ok: true,
    });
    expect(mutations.setSelfReport).toHaveBeenCalledWith(
      ID,
      { on: true },
      OK.ctx,
    );
  });
});
