import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  deleteAnnouncement,
  updateAnnouncement,
} from "@/actions/announcements";
import * as mutations from "@/mutations/announcements";

// vi.mock factories are hoisted above the imports, so their values are too.
const { WAR_WEEK, ID, HOST, boom, authorized } = vi.hoisted(() => {
  const WAR_WEEK = "11111111-1111-4111-8111-111111111111";
  const COMPETITION = "33333333-3333-4333-8333-333333333333";
  return {
    WAR_WEEK,
    ID: "22222222-2222-4222-8222-222222222222",
    COMPETITION,
    HOST: {
      email: "host@jahnelgroup.com",
      isOrganizer: false,
      hosts: [{ competitionId: COMPETITION, warWeekId: WAR_WEEK }],
    },
    boom: async () => {
      throw new Error("boom");
    },
    /** What the mocked `authorize` returns; each test sets its actor. */
    authorized: {
      current: {} as Record<string, unknown>,
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorize", () => ({
  authorize: vi.fn(async () => authorized.current),
  postedCompetitionId: () => null,
}));
vi.mock("@/mutations/announcements", () => ({
  deleteAnnouncement: vi.fn(boom),
  updateAnnouncement: vi.fn(async () => ({ ok: true })),
}));

function authorizeAs(
  actor: { email: string; isOrganizer: boolean; hosts: unknown[] },
  target: Record<string, unknown> = {},
) {
  authorized.current = {
    ok: true,
    actor,
    warWeek: { id: WAR_WEEK, edition: "xi" },
    target: { warWeek: { id: WAR_WEEK, edition: "xi" }, ...target },
    ctx: { warWeekId: WAR_WEEK, actorEmail: actor.email },
  };
}

const EDIT = {
  title: "Kickoff moved",
  body: { type: "doc", content: [] },
  videoUrls: [],
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  authorizeAs({
    email: "organizer@jahnelgroup.com",
    isOrganizer: true,
    hosts: [],
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(mutations.updateAnnouncement).mockClear();
});

describe("Announcement actions", () => {
  it("return the generic error when the mutation throws", async () => {
    await expect(deleteAnnouncement(ID)).resolves.toEqual({
      ok: false,
      error: "Something went wrong. Try again.",
    });
    expect(console.error).toHaveBeenCalled();
  });

  it("keep a Host's own pinned Announcement pinned when the edit omits pinned", async () => {
    authorizeAs(HOST, { authorEmail: HOST.email, pinned: true });

    // Posted without `pinned`, as an older form or a hand-made request would.
    await expect(
      updateAnnouncement(
        ID,
        EDIT as unknown as Parameters<typeof updateAnnouncement>[1],
      ),
    ).resolves.toEqual({ ok: true });

    expect(mutations.updateAnnouncement).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ title: "Kickoff moved", pinned: true }),
      expect.anything(),
    );
  });

  it("refuse a Host's edit that unpins their own pinned Announcement", async () => {
    authorizeAs(HOST, { authorEmail: HOST.email, pinned: true });

    await expect(
      updateAnnouncement(ID, { ...EDIT, pinned: false }),
    ).resolves.toEqual({
      ok: false,
      error: "Only an Organizer can unpin Announcements.",
    });
    expect(mutations.updateAnnouncement).not.toHaveBeenCalled();
  });

  it("let a Host edit their own unpinned Announcement without pinned", async () => {
    authorizeAs(HOST, { authorEmail: HOST.email, pinned: false });

    await expect(
      updateAnnouncement(
        ID,
        EDIT as unknown as Parameters<typeof updateAnnouncement>[1],
      ),
    ).resolves.toEqual({ ok: true });
    expect(mutations.updateAnnouncement).toHaveBeenCalledWith(
      ID,
      expect.objectContaining({ pinned: false }),
      expect.anything(),
    );
  });
});
