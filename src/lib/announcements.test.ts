import { describe, expect, it } from "vitest";

import {
  type AnnouncementInput,
  MAX_VIDEO_LINKS,
  announcementVideoCount,
  isAnnouncementId,
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
    videoUrls: [],
    pinned: false,
    ...overrides,
  };
}

describe("parseAnnouncementInput", () => {
  it("accepts a valid Announcement, defaulting videoUrls and pinned", () => {
    const result = parseAnnouncementInput({
      title: "  Kickoff  ",
      body: validBody,
      videoUrls: [],
      pinned: false,
    });
    expect(result).toEqual({
      ok: true,
      value: {
        title: "Kickoff",
        body: validBody,
        videoUrls: [],
        pinned: false,
      },
    });
  });

  it("rejects an empty title", () => {
    expect(parseAnnouncementInput(baseInput({ title: "   " }))).toEqual({
      ok: false,
      error: "Title must not be empty.",
    });
  });

  it("rejects a title over 200 characters", () => {
    expect(
      parseAnnouncementInput(baseInput({ title: "x".repeat(201) })),
    ).toEqual({
      ok: false,
      error: "Title must be at most 200 characters.",
    });
  });

  it("rejects a malformed or wrong-protocol video URL", () => {
    for (const url of ["http://youtube.com/watch?v=x", "not-a-url"]) {
      expect(parseAnnouncementInput(baseInput({ videoUrls: [url] }))).toEqual({
        ok: false,
        error: "Video link 1 must be an https:// link.",
      });
    }
  });

  it("rejects a well-formed https link on a disallowed host", () => {
    expect(
      parseAnnouncementInput(
        baseInput({ videoUrls: ["https://evil.example.com/watch?v=x"] }),
      ),
    ).toEqual({
      ok: false,
      error:
        "Video link 1 must be a YouTube, Loom, Vimeo or Google Drive video link.",
    });
  });

  it("rejects an allow-listed host with an unrecognized path", () => {
    expect(
      parseAnnouncementInput(
        baseInput({
          videoUrls: ["https://www.youtube.com/playlist?list=x"],
        }),
      ),
    ).toEqual({
      ok: false,
      error:
        "Video link 1 must be a YouTube, Loom, Vimeo or Google Drive video link.",
    });
  });

  it("names the offending video link by position", () => {
    expect(
      parseAnnouncementInput(
        baseInput({
          videoUrls: [
            "https://www.youtube.com/watch?v=abc",
            "https://evil.example.com/x",
          ],
        }),
      ),
    ).toEqual({
      ok: false,
      error:
        "Video link 2 must be a YouTube, Loom, Vimeo or Google Drive video link.",
    });
  });

  it("rejects a video link over 500 characters", () => {
    const overlong = `https://www.youtube.com/watch?v=abc&pad=${"x".repeat(500)}`;
    expect(
      parseAnnouncementInput(baseInput({ videoUrls: [overlong] })),
    ).toEqual({
      ok: false,
      error: "Video link 1 must be at most 500 characters.",
    });
  });

  it("rejects more than the maximum number of video links", () => {
    const urls = Array.from(
      { length: MAX_VIDEO_LINKS + 1 },
      () => "https://www.youtube.com/watch?v=abc",
    );
    expect(parseAnnouncementInput(baseInput({ videoUrls: urls }))).toEqual({
      ok: false,
      error: `Add at most ${MAX_VIDEO_LINKS} video links.`,
    });
  });

  it.each([
    "https://www.youtube.com/watch?v=abc",
    "https://youtu.be/abc",
    "https://loom.com/share/abc",
    "https://vimeo.com/12345",
    "https://drive.google.com/file/d/abc/view",
  ])("accepts an allow-listed video URL: %s", (url) => {
    expect(parseAnnouncementInput(baseInput({ videoUrls: [url] }))).toEqual({
      ok: true,
      value: expect.objectContaining({ videoUrls: [url] }),
    });
  });
});

describe("isAnnouncementId", () => {
  it("accepts a uuid and rejects everything else", () => {
    expect(isAnnouncementId("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(true);
    expect(isAnnouncementId("not-a-uuid")).toBe(false);
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

describe("announcementVideoCount", () => {
  const video = (src: string) => ({ type: "video", attrs: { src } });
  const paragraph = {
    type: "paragraph",
    content: [{ type: "text", text: "Hi" }],
  };

  it("is zero with no links and no embeds", () => {
    expect(
      announcementVideoCount({
        videoUrls: [],
        body: { type: "doc", content: [paragraph] },
      }),
    ).toBe(0);
  });

  it("counts video links", () => {
    expect(
      announcementVideoCount({
        videoUrls: ["https://youtu.be/a", "https://vimeo.com/1"],
        body: { type: "doc", content: [paragraph] },
      }),
    ).toBe(2);
  });

  it("counts videos embedded in the body", () => {
    expect(
      announcementVideoCount({
        videoUrls: [],
        body: {
          type: "doc",
          content: [
            video("https://youtu.be/a"),
            paragraph,
            video("https://youtu.be/b"),
          ],
        },
      }),
    ).toBe(2);
  });

  it("counts links and embeds together, including nested embeds", () => {
    expect(
      announcementVideoCount({
        videoUrls: ["https://loom.com/share/abc"],
        body: {
          type: "doc",
          content: [
            video("https://youtu.be/a"),
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [video("https://youtu.be/b")] },
              ],
            },
          ],
        },
      }),
    ).toBe(3);
  });

  it("tolerates a body that isn't a document", () => {
    expect(announcementVideoCount({ videoUrls: [], body: null })).toBe(0);
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
    ['videoUrls: "x"', { videoUrls: "x" }],
    ['pinned: "yes"', { pinned: "yes" }],
    ["body: 5", { body: 5 }],
  ])("returns an error for %s", (_label, overrides) => {
    expect(
      parseAnnouncementInput({ ...baseInput(), ...overrides } as never),
    ).toMatchObject({ ok: false });
  });
});
