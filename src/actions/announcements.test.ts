import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { deleteAnnouncement } from "@/actions/announcements";

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
vi.mock("@/mutations/announcements", () => ({
  deleteAnnouncement: vi.fn(boom),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("Announcement actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(deleteAnnouncement(ID)).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
