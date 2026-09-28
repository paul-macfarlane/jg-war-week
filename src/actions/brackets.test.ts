import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  finalizeBracket,
  generateBracket,
  setHeatSchedule,
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
  setHeatSchedule: vi.fn(async () => ({ ok: true })),
  generateBracket: vi.fn(async () => ({ ok: true })),
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

describe("generateBracket", () => {
  it('passes seeding: "standings" through to the mutation', async () => {
    authorized.current = { ...AUTHORIZED_OK };
    const mutations = await import("@/mutations/brackets");

    await expect(
      generateBracket(ID, { seeding: "standings" }),
    ).resolves.toEqual({ ok: true });

    expect(mutations.generateBracket).toHaveBeenCalledWith(
      ID,
      { force: undefined, seeding: "standings" },
      (authorized.current as { ctx: unknown }).ctx,
    );
  });
});

describe("setHeatSchedule", () => {
  it("authorizes before parsing malformed input; the refusal wins", async () => {
    authorized.current = {
      ok: false,
      error: "You're not a Host of that Competition.",
    };
    const mutations = await import("@/mutations/brackets");
    // A Day with no start time (the form's zod refine would refuse this),
    // and a Heat id that isn't a UUID: neither ever gets checked.
    const formData = new FormData();
    formData.set("dayId", "11111111-1111-4111-8111-111111111111");
    formData.set("startTime", "");
    formData.set("location", "");

    await expect(
      setHeatSchedule(ID, "not-a-uuid", null, formData),
    ).resolves.toEqual({
      ok: false,
      error: "You're not a Host of that Competition.",
    });
    expect(authorize).toHaveBeenCalledWith(
      "bracket.heat-schedule",
      "competition",
      ID,
    );
    expect(mutations.setHeatSchedule).not.toHaveBeenCalled();
  });
});
