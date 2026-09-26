import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { startWarWeek } from "@/actions/war-week-lifecycle";

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
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("@/auth/actor", () => ({
  ADMIN_EDITION_COOKIE: "admin_edition",
  getActor: vi.fn(),
}));
vi.mock("@/auth/server", () => ({ getSessionEmail: vi.fn() }));
vi.mock("@/queries/war-weeks", () => ({
  getCurrentWarWeek: vi.fn(),
  getWarWeekByEdition: vi.fn(),
  getWarWeeks: vi.fn(async () => [
    {
      id: WAR_WEEK,
      edition: "xi",
      editionNumber: 11,
      status: "upcoming",
      startDate: "2027-02-22",
      endDate: "2027-02-26",
    },
  ]),
}));
vi.mock("@/mutations/war-week-lifecycle", () => ({
  startWarWeek: vi.fn(boom),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("War Week lifecycle actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(startWarWeek(WAR_WEEK)).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });
});
