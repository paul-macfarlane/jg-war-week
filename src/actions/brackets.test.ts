import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createSquad,
  deleteSquad,
  finalizeBracket,
  updateSquad,
} from "@/actions/brackets";

// vi.mock factories are hoisted above the imports, so their values are too.
const { ID, boom, authorized } = vi.hoisted(() => {
  const WAR_WEEK = "11111111-1111-4111-8111-111111111111";
  return {
    ID: "22222222-2222-4222-8222-222222222222",
    boom: async () => {
      throw new Error("boom");
    },
    /** What the mocked `authorize` returns; each test sets it. */
    authorized: {
      current: {
        ok: true,
        actor: {
          email: "organizer@jahnelgroup.com",
          isOrganizer: true,
          hosts: [],
        },
        warWeek: { id: WAR_WEEK, edition: "xi" },
        target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
        ctx: { warWeekId: WAR_WEEK, actorEmail: "organizer@jahnelgroup.com" },
      } as Record<string, unknown>,
    },
  };
});

/** `authorized.current`'s original ok value, so a test can restore it. */
const AUTHORIZED_OK = { ...authorized.current };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const authorize = vi.hoisted(() => vi.fn(async () => authorized.current));
vi.mock("@/auth/authorize", () => ({
  authorize,
  postedCompetitionId: () => null,
}));
vi.mock("@/mutations/brackets", () => ({
  finalizeBracket: vi.fn(boom),
  createSquad: vi.fn(async () => ({ ok: true })),
  updateSquad: vi.fn(async () => ({ ok: true })),
  deleteSquad: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Bracket actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(finalizeBracket(ID)).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe("Squad actions", () => {
  const TEAM = "33333333-3333-4333-8333-333333333333";
  const PERSON = "44444444-4444-4444-8444-444444444444";
  const SQUAD = "55555555-5555-4555-8555-555555555555";

  it("authorize with bracket.squads before parsing; the refusal wins over malformed input", async () => {
    authorized.current = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };
    const mutations = await import("@/mutations/brackets");
    const refusal = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };

    await expect(createSquad(ID, "junk")).resolves.toEqual(refusal);
    await expect(updateSquad(ID, "not-a-uuid", "junk")).resolves.toEqual(
      refusal,
    );
    await expect(deleteSquad(ID, "not-a-uuid")).resolves.toEqual(refusal);
    for (const call of authorize.mock.calls.slice(-3)) {
      expect(call).toEqual(["bracket.squads", "competition", ID]);
    }
    expect(mutations.createSquad).not.toHaveBeenCalled();
    expect(mutations.updateSquad).not.toHaveBeenCalled();
    expect(mutations.deleteSquad).not.toHaveBeenCalled();
  });

  it("returns a malformed field's error under its name, and never writes", async () => {
    authorized.current = { ...AUTHORIZED_OK };
    const mutations = await import("@/mutations/brackets");

    await expect(
      createSquad(ID, {
        name: "Red Alpha",
        teamId: "nope",
        participantIds: [],
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Choose a Team.",
      fieldErrors: { teamId: "Choose a Team." },
    });
    await expect(
      updateSquad(ID, "not-a-uuid", {
        name: "Red Alpha",
        teamId: TEAM,
        participantIds: [PERSON],
      }),
    ).resolves.toEqual({ ok: false, error: "That Squad no longer exists." });
    await expect(deleteSquad(ID, "not-a-uuid")).resolves.toEqual({
      ok: false,
      error: "That Squad no longer exists.",
    });
    expect(mutations.createSquad).not.toHaveBeenCalled();
    expect(mutations.updateSquad).not.toHaveBeenCalled();
    expect(mutations.deleteSquad).not.toHaveBeenCalled();
  });

  it("passes the parsed Squad through to the mutation", async () => {
    authorized.current = { ...AUTHORIZED_OK };
    const mutations = await import("@/mutations/brackets");
    const ctx = (authorized.current as { ctx: unknown }).ctx;

    await expect(
      createSquad(ID, {
        name: " Red Alpha ",
        teamId: TEAM,
        participantIds: [PERSON],
      }),
    ).resolves.toEqual({ ok: true });
    expect(mutations.createSquad).toHaveBeenCalledWith(
      ID,
      { name: "Red Alpha", teamId: TEAM, participantIds: [PERSON] },
      ctx,
    );
    await expect(
      updateSquad(ID, SQUAD, { name: "Red", teamId: TEAM, participantIds: [] }),
    ).resolves.toEqual({ ok: true });
    expect(mutations.updateSquad).toHaveBeenCalledWith(
      ID,
      SQUAD,
      { name: "Red", teamId: TEAM, participantIds: [] },
      ctx,
    );
    await expect(deleteSquad(ID, SQUAD)).resolves.toEqual({ ok: true });
    expect(mutations.deleteSquad).toHaveBeenCalledWith(ID, SQUAD, ctx);
  });
});
