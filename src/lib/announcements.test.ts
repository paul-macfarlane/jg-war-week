import { describe, expect, it } from "vitest";

import {
  type AnnouncementInput,
  announcementAuthorName,
  parseAnnouncementInput,
  sortAnnouncements,
} from "@/lib/announcements";

const validBody = { type: "doc", content: [] };

function baseInput(
  overrides: Partial<AnnouncementInput> = {},
): AnnouncementInput {
  return {
    title: "Kickoff",
    body: validBody,
    pinned: false,
    ...overrides,
  };
}

describe("parseAnnouncementInput", () => {
  it("accepts a valid Announcement, defaulting pinned", () => {
    const result = parseAnnouncementInput({
      title: "  Kickoff  ",
      body: validBody,
      pinned: false,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Kickoff",
        body: validBody,
        pinned: false,
      },
    });
  });

  it("refuses a posted videoUrls key, saying where videos went", () => {
    expect(
      parseAnnouncementInput({
        ...baseInput(),
        videoUrls: ["https://youtu.be/dQw4w9WgXcQ"],
      } as AnnouncementInput),
    ).toMatchObject({
      ok: false,
      error:
        "Video links moved into the body: add each video with the Video button.",
    });
  });

  it("rejects an empty title", () => {
    expect(parseAnnouncementInput(baseInput({ title: "   " }))).toMatchObject({
      ok: false,
      error: "Title must not be empty.",
    });
  });

  it("rejects a title over 200 characters", () => {
    expect(
      parseAnnouncementInput(baseInput({ title: "x".repeat(201) })),
    ).toMatchObject({
      ok: false,
      error: "Title must be at most 200 characters.",
    });
  });
});

describe("sortAnnouncements", () => {
  it("puts pinned first, then orders by published-at descending", () => {
    const a = { id: "a", pinned: false, publishedAt: new Date("2026-01-01") };
    const b = { id: "b", pinned: true, publishedAt: new Date("2026-01-02") };
    const c = { id: "c", pinned: false, publishedAt: new Date("2026-01-03") };
    const d = { id: "d", pinned: true, publishedAt: new Date("2026-01-01") };

    expect(sortAnnouncements([a, b, c, d]).map((row) => row.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
    ]);
  });

  it("keeps original order among rows that tie on both keys", () => {
    const when = new Date("2026-01-01");
    const a = { id: "a", pinned: false, publishedAt: when };
    const b = { id: "b", pinned: false, publishedAt: when };
    expect(sortAnnouncements([a, b]).map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("parseAnnouncementInput given a malformed call", () => {
  const MALFORMED: [string, unknown][] = [
    ["{}", {}],
    ["null", null],
    ["undefined", undefined],
    ["a string", "x"],
    ["a number", 5],
  ];

  it.each(MALFORMED)("returns an error for %s", (_label, value) => {
    expect(parseAnnouncementInput(value as never)).toMatchObject({
      ok: false,
    });
  });

  it.each<[string, Record<string, unknown>]>([
    ["title: 5", { title: 5 }],
    ['pinned: "yes"', { pinned: "yes" }],
    ["body: 5", { body: 5 }],
  ])("returns an error for %s", (_label, overrides) => {
    expect(
      parseAnnouncementInput({ ...baseInput(), ...overrides } as never),
    ).toMatchObject({ ok: false });
  });
});

describe("parseAnnouncementInput field errors", () => {
  it("puts the title's error under title", () => {
    expect(parseAnnouncementInput(baseInput({ title: " " }))).toEqual({
      ok: false,
      error: "Title must not be empty.",
      fieldErrors: { title: "Title must not be empty." },
    });
  });
});

describe("announcementAuthorName", () => {
  const participants = [
    { email: "pmacfarlane@jahnelgroup.com", displayName: "Paul Macfarlane" },
    { email: null, displayName: "No Email" },
  ];

  it("uses the matching Participant's display name", () => {
    expect(
      announcementAuthorName("pmacfarlane@jahnelgroup.com", participants),
    ).toBe("Paul Macfarlane");
  });

  it("matches case-insensitively", () => {
    expect(
      announcementAuthorName("PMacfarlane@JahnelGroup.com", participants),
    ).toBe("Paul Macfarlane");
  });

  it("falls back to the handle before the @ with no Participant match", () => {
    expect(
      announcementAuthorName("someone-else@jahnelgroup.com", participants),
    ).toBe("someone-else");
  });

  it("prefers the author's Profile name, Participant or not", () => {
    const profiles = new Map([
      [
        "pmacfarlane@jahnelgroup.com",
        { profileName: "Paulie", profileImage: null, googleImage: null },
      ],
      [
        "solo@jahnelgroup.com",
        { profileName: "Solo S.", profileImage: null, googleImage: null },
      ],
    ]);
    expect(
      announcementAuthorName(
        "PMacfarlane@JahnelGroup.com",
        participants,
        profiles,
      ),
    ).toBe("Paulie");
    expect(announcementAuthorName("solo@jahnelgroup.com", [], profiles)).toBe(
      "Solo S.",
    );
  });

  it("falls back to the roster name when the Profile has no name", () => {
    const profiles = new Map([
      [
        "pmacfarlane@jahnelgroup.com",
        { profileName: null, profileImage: null, googleImage: null },
      ],
    ]);
    expect(
      announcementAuthorName(
        "pmacfarlane@jahnelgroup.com",
        participants,
        profiles,
      ),
    ).toBe("Paul Macfarlane");
  });

  it("falls back with no Participants at all", () => {
    expect(announcementAuthorName("solo@jahnelgroup.com", [])).toBe("solo");
  });
});
