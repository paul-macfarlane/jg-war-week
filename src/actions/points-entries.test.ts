import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPointsEntry } from "@/actions/points-entries";

// vi.mock factories are hoisted above the imports, so their values are too.
const { WAR_WEEK, ID, boom } = vi.hoisted(() => ({
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  ID: "22222222-2222-4222-8222-222222222222",
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
// A unique violation the mutation doesn't map surfaces as a thrown error.
vi.mock("@/mutations/points-entries", () => ({
  createPointsEntry: vi.fn(boom),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Points Entry actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(
      createPointsEntry({ competitionId: ID, targetId: ID, points: "5" }),
    ).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
