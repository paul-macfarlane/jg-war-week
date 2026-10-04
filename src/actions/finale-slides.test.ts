import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createCustomFinaleSlide,
  deleteCustomFinaleSlide,
  moveFinaleSlide,
  setFinaleSlideHidden,
  updateCustomFinaleSlide,
} from "@/actions/finale-slides";
import { authorize } from "@/auth/authorize";
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
  createCustomFinaleSlide: vi.fn(async () => ({ ok: true })),
  updateCustomFinaleSlide: vi.fn(async () => ({ ok: true })),
  deleteCustomFinaleSlide: vi.fn(async () => ({ ok: true })),
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

const text = (value: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: value }] }],
});

describe("Custom Finale slide actions", () => {
  it("create authorizes against the War Week, then saves the sanitized, trimmed values", async () => {
    await expect(
      createCustomFinaleSlide(WAR_WEEK, {
        heading: "  Thank you  ",
        body: text("Hi"),
        backgroundColor: "#ABCDEF",
      }),
    ).resolves.toEqual({ ok: true });
    expect(authorize).toHaveBeenCalledWith(
      "finale-slide.create",
      "warWeek",
      WAR_WEEK,
    );
    expect(mutations.createCustomFinaleSlide).toHaveBeenCalledWith(
      { heading: "Thank you", body: text("Hi"), backgroundColor: "#abcdef" },
      ctx,
    );
  });

  it("strips unsafe content from the body on the way in", async () => {
    await createCustomFinaleSlide(WAR_WEEK, {
      heading: "Links",
      body: {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "x",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "javascript:alert(1)",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      backgroundColor: null,
    });
    expect(mutations.createCustomFinaleSlide).toHaveBeenCalledWith(
      { heading: "Links", body: text("x"), backgroundColor: null },
      ctx,
    );
  });

  it("update and delete authorize against the Finale slide", async () => {
    await updateCustomFinaleSlide(CUSTOM, {
      heading: "Thanks",
      body: text("Hi"),
      backgroundColor: null,
    });
    await deleteCustomFinaleSlide(CUSTOM);
    expect(authorize).toHaveBeenNthCalledWith(
      1,
      "finale-slide.update",
      "finaleSlide",
      CUSTOM,
    );
    expect(authorize).toHaveBeenNthCalledWith(
      2,
      "finale-slide.delete",
      "finaleSlide",
      CUSTOM,
    );
    expect(mutations.updateCustomFinaleSlide).toHaveBeenCalledWith(
      CUSTOM,
      { heading: "Thanks", body: text("Hi"), backgroundColor: null },
      ctx,
    );
    expect(mutations.deleteCustomFinaleSlide).toHaveBeenCalledWith(CUSTOM, ctx);
  });

  it("refuse a blank or long heading, a bad color and a non-document body, naming the field", async () => {
    const good = { heading: "A", body: text("Hi"), backgroundColor: null };
    await expect(
      createCustomFinaleSlide(WAR_WEEK, { ...good, heading: "   " }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { heading: "Heading must not be empty." },
    });
    await expect(
      createCustomFinaleSlide(WAR_WEEK, { ...good, heading: "x".repeat(121) }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { heading: "Heading must be at most 120 characters." },
    });
    await expect(
      createCustomFinaleSlide(WAR_WEEK, { ...good, backgroundColor: "red" }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { backgroundColor: expect.any(String) },
    });
    await expect(
      createCustomFinaleSlide(WAR_WEEK, { ...good, body: "<script>" }),
    ).resolves.toMatchObject({
      ok: false,
      fieldErrors: { body: "Body must be valid rich text." },
    });
    expect(mutations.createCustomFinaleSlide).not.toHaveBeenCalled();
  });

  it("do nothing when authorization refuses", async () => {
    vi.mocked(authorize).mockResolvedValueOnce({
      ok: false,
      error: "Only an Organizer can add Custom Finale slides.",
    });
    await expect(
      createCustomFinaleSlide(WAR_WEEK, {
        heading: "A",
        body: text("Hi"),
        backgroundColor: null,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Only an Organizer can add Custom Finale slides.",
    });
    expect(mutations.createCustomFinaleSlide).not.toHaveBeenCalled();
  });
});
