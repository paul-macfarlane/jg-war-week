import { notFound, redirect } from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAward } from "@/actions/awards";
import * as mutations from "@/mutations/awards";

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
vi.mock("@/mutations/awards", () => ({ createAward: vi.fn() }));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

const award = {
  name: "MVP",
  description: null,
  teamId: null,
  participantIds: [ID],
};

describe("Award actions", () => {
  it("return the generic error when the mutation throws", async () => {
    vi.mocked(mutations.createAward).mockImplementationOnce(boom);
    await expect(createAward(WAR_WEEK, award)).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("let a redirect propagate", async () => {
    vi.mocked(mutations.createAward).mockImplementationOnce(async () =>
      redirect("/sign-in"),
    );
    await expect(createAward(WAR_WEEK, award)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT"),
    });
  });

  it("let a not-found propagate", async () => {
    vi.mocked(mutations.createAward).mockImplementationOnce(async () =>
      notFound(),
    );
    await expect(createAward(WAR_WEEK, award)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_HTTP_ERROR_FALLBACK;404"),
    });
  });
});
