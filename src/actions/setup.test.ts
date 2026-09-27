import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTeam } from "@/actions/setup";

// vi.mock factories are hoisted above the imports, so their values are too.
const { WAR_WEEK, boom } = vi.hoisted(() => ({
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  boom: async () => {
    throw new Error("boom");
  },
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorize", () => ({
  authorize: vi.fn(async () => ({
    ok: true,
    actor: { email: "organizer@jahnelgroup.com", isOrganizer: true, hosts: [] },
    warWeek: { id: WAR_WEEK, edition: "xi" },
    target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
    ctx: { warWeekId: WAR_WEEK, actorEmail: "organizer@jahnelgroup.com" },
  })),
  postedCompetitionId: () => null,
}));
vi.mock("@/mutations/setup", () => ({ createTeam: vi.fn(boom) }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("setup actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(
      createTeam(WAR_WEEK, { name: "Red", color: "#ff0000", logoUrl: "" }),
    ).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
