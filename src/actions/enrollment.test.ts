import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  enroll,
  joinSquad,
  leaveSquad,
  setSelfEnroll,
  withdraw,
} from "@/actions/enrollment";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, SQUAD, WAR_WEEK, authorized } = vi.hoisted(() => {
  const WAR_WEEK = "11111111-1111-4111-8111-111111111111";
  return {
    ID: "22222222-2222-4222-8222-222222222222",
    SQUAD: "33333333-3333-4333-8333-333333333333",
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

const ENROLLER = {
  ok: true,
  actor: { email: "neo@jahnelgroup.com", isOrganizer: false, hosts: [] },
  warWeek: { id: WAR_WEEK, edition: "xi" },
  ctx: { warWeekId: WAR_WEEK, actorEmail: "neo@jahnelgroup.com" },
  linked: { participantId: "p1", teamId: "t1", squadId: null },
};

const { revalidatePath } = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
const authorizeEnroll = vi.hoisted(() => vi.fn(async () => authorized.current));
vi.mock("@/auth/authorize", () => ({ authorize, authorizeEnroll }));
vi.mock("@/mutations/enrollment", () => ({
  setSelfEnroll: vi.fn(async () => ({ ok: true })),
  enroll: vi.fn(async () => ({ ok: true })),
  withdraw: vi.fn(async () => ({ ok: true })),
  joinSquad: vi.fn(async () => ({ ok: true })),
  leaveSquad: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("setSelfEnroll", () => {
  it('authorizes "competition.self-enroll" before parsing; the refusal wins over malformed input', async () => {
    authorized.current = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };
    const mutations = await import("@/mutations/enrollment");

    await expect(setSelfEnroll(ID, "junk")).resolves.toEqual({
      ok: false,
      error: "You're not a Host of that Competition.",
    });
    expect(authorize).toHaveBeenCalledWith(
      "competition.self-enroll",
      "competition",
      ID,
    );
    expect(mutations.setSelfEnroll).not.toHaveBeenCalled();
  });

  it("refuses malformed input once authorized", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/enrollment");

    await expect(
      setSelfEnroll(ID, { on: "yes", entrantLimit: "", enrollClosesAt: "" }),
    ).resolves.toEqual({ ok: false, error: "Turn enrollment on or off." });
    await expect(
      setSelfEnroll(ID, { on: true, entrantLimit: "1", enrollClosesAt: "" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "An Entrant limit is at least 2.",
    });
    await expect(
      setSelfEnroll(ID, { on: true, entrantLimit: "", enrollClosesAt: "soon" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "Enter the close time as a date and time.",
    });
    expect(mutations.setSelfEnroll).not.toHaveBeenCalled();
  });

  it("passes the parsed values and the authorized context, then revalidates", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/enrollment");

    await expect(
      setSelfEnroll(ID, {
        on: true,
        entrantLimit: "8",
        enrollClosesAt: "2027-02-22T17:00:00.000Z",
      }),
    ).resolves.toEqual({ ok: true });
    expect(mutations.setSelfEnroll).toHaveBeenCalledWith(
      ID,
      {
        on: true,
        entrantLimit: 8,
        enrollClosesAt: new Date("2027-02-22T17:00:00.000Z"),
      },
      OK.ctx,
    );
    expect(revalidatePath).toHaveBeenCalled();
  });

  it("reads a blank limit and close time as none", async () => {
    authorized.current = OK;
    const mutations = await import("@/mutations/enrollment");

    await setSelfEnroll(ID, {
      on: false,
      entrantLimit: "",
      enrollClosesAt: "",
    });
    expect(mutations.setSelfEnroll).toHaveBeenCalledWith(
      ID,
      { on: false, entrantLimit: null, enrollClosesAt: null },
      OK.ctx,
    );
  });
});

describe("enroll and withdraw", () => {
  it("authorize the enrollment first; a refusal never reaches the mutation", async () => {
    authorized.current = {
      ok: false,
      error: "Enrollment is off for this Competition.",
    };
    const mutations = await import("@/mutations/enrollment");

    await expect(enroll(ID)).resolves.toEqual({
      ok: false,
      error: "Enrollment is off for this Competition.",
    });
    await expect(withdraw(ID)).resolves.toEqual({
      ok: false,
      error: "Enrollment is off for this Competition.",
    });
    expect(authorizeEnroll).toHaveBeenCalledWith("competition.enroll", ID);
    expect(authorizeEnroll).toHaveBeenCalledWith("competition.withdraw", ID);
    expect(mutations.enroll).not.toHaveBeenCalled();
    expect(mutations.withdraw).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("pass the enroller's context to the mutation and revalidate", async () => {
    authorized.current = ENROLLER;
    const mutations = await import("@/mutations/enrollment");

    await expect(enroll(ID)).resolves.toEqual({ ok: true });
    await expect(withdraw(ID)).resolves.toEqual({ ok: true });
    expect(mutations.enroll).toHaveBeenCalledWith(ID, ENROLLER.ctx);
    expect(mutations.withdraw).toHaveBeenCalledWith(ID, ENROLLER.ctx);
    expect(revalidatePath).toHaveBeenCalled();
  });
});

describe("joinSquad and leaveSquad", () => {
  it("authorize with the Squad; a refusal never reaches the mutation", async () => {
    authorized.current = { ok: false, error: "That Squad isn't your Team's." };
    const mutations = await import("@/mutations/enrollment");

    await expect(joinSquad(ID, SQUAD)).resolves.toEqual({
      ok: false,
      error: "That Squad isn't your Team's.",
    });
    expect(authorizeEnroll).toHaveBeenCalledWith(
      "competition.enroll",
      ID,
      SQUAD,
    );
    expect(mutations.joinSquad).not.toHaveBeenCalled();
  });

  it("pass the Squad and the enroller's context to the mutation", async () => {
    authorized.current = ENROLLER;
    const mutations = await import("@/mutations/enrollment");

    await expect(joinSquad(ID, SQUAD)).resolves.toEqual({ ok: true });
    await expect(leaveSquad(ID, SQUAD)).resolves.toEqual({ ok: true });
    expect(authorizeEnroll).toHaveBeenCalledWith(
      "competition.withdraw",
      ID,
      SQUAD,
    );
    expect(mutations.joinSquad).toHaveBeenCalledWith(ID, SQUAD, ENROLLER.ctx);
    expect(mutations.leaveSquad).toHaveBeenCalledWith(ID, SQUAD, ENROLLER.ctx);
  });
});
