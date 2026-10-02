import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { moveFinaleSlide, setFinaleSlideHidden } from "@/actions/finale-slides";
import * as mutations from "@/mutations/finale-slides";

// vi.mock factories are hoisted above the imports, so their values are too.
const { WAR_WEEK, CUSTOM } = vi.hoisted(() => ({
  WAR_WEEK: "11111111-1111-4111-8111-111111111111",
  CUSTOM: "22222222-2222-4222-8222-222222222222",
}));

const ctx = { warWeekId: WAR_WEEK, actorEmail: "organizer@jahnelgroup.com" };

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorize", () => ({
  authorize: vi.fn(async () => ({
    ok: true,
    actor: { email: "organizer@jahnelgroup.com", isOrganizer: true, hosts: [] },
    warWeek: { id: WAR_WEEK, edition: "xi" },
    target: { warWeek: { id: WAR_WEEK, edition: "xi" } },
    ctx: {
      warWeekId: "11111111-1111-4111-8111-111111111111",
      actorEmail: "organizer@jahnelgroup.com",
    },
  })),
}));
vi.mock("@/mutations/finale-slides", () => ({
  moveFinaleSlide: vi.fn(async () => ({ ok: true })),
  setFinaleSlideHidden: vi.fn(async () => ({ ok: true })),
}));

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("Finale slide actions", () => {
  it("move a built-in by kind or a Custom slide by id to an index", async () => {
    await expect(
      moveFinaleSlide(WAR_WEEK, { slide: { kind: "standings" }, toIndex: 0 }),
    ).resolves.toEqual({ ok: true });
    await expect(
      moveFinaleSlide(WAR_WEEK, { slide: { id: CUSTOM }, toIndex: 3 }),
    ).resolves.toEqual({ ok: true });
    expect(mutations.moveFinaleSlide).toHaveBeenNthCalledWith(
      1,
      { kind: "standings" },
      0,
      ctx,
    );
    expect(mutations.moveFinaleSlide).toHaveBeenNthCalledWith(
      2,
      { id: CUSTOM },
      3,
      ctx,
    );
  });

  it("hide and show a slide", async () => {
    await setFinaleSlideHidden(WAR_WEEK, {
      slide: { kind: "numbers" },
      hidden: true,
    });
    await setFinaleSlideHidden(WAR_WEEK, {
      slide: { kind: "numbers" },
      hidden: false,
    });
    expect(mutations.setFinaleSlideHidden).toHaveBeenNthCalledWith(
      1,
      { kind: "numbers" },
      true,
      ctx,
    );
    expect(mutations.setFinaleSlideHidden).toHaveBeenNthCalledWith(
      2,
      { kind: "numbers" },
      false,
      ctx,
    );
  });

  it("refuse a slide that isn't a built-in kind or a Custom slide id", async () => {
    const refused = { ok: false, error: "That Finale slide no longer exists." };
    await expect(
      moveFinaleSlide(WAR_WEEK, {
        slide: { kind: "custom" } as never,
        toIndex: 0,
      }),
    ).resolves.toEqual(refused);
    await expect(
      setFinaleSlideHidden(WAR_WEEK, {
        slide: { id: "not-a-uuid" },
        hidden: true,
      }),
    ).resolves.toEqual(refused);
    await expect(
      moveFinaleSlide(WAR_WEEK, {
        slide: { kind: "title" },
        toIndex: -1,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Move a Finale slide to a place in the list.",
    });
    expect(mutations.moveFinaleSlide).not.toHaveBeenCalled();
    expect(mutations.setFinaleSlideHidden).not.toHaveBeenCalled();
  });
});
