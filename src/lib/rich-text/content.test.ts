import { describe, expect, it } from "vitest";

import {
  contentInputSchema,
  contentSchema,
  isBlankContent,
  isHttpUrl,
} from "@/lib/rich-text/content";

describe("contentInputSchema", () => {
  it("drops an unrecognized block (iframe) and keeps the paragraph", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "iframe", attrs: { src: "https://evil.example.com" } },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };

    expect(contentInputSchema.parse(doc)).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
      ],
    });
  });

  it("fails when the input is not a document", () => {
    expect(() => contentInputSchema.parse({ nope: true })).toThrow();
  });
});

describe("isHttpUrl", () => {
  it("accepts absolute http(s) URLs and rejects everything else", () => {
    expect(isHttpUrl("https://example.com")).toBe(true);
    expect(isHttpUrl("http://example.com")).toBe(true);
    expect(isHttpUrl("javascript:alert(1)")).toBe(false);
    expect(isHttpUrl("not-a-url")).toBe(false);
  });
});

describe("video blocks", () => {
  function video(src: unknown) {
    return { type: "doc", content: [{ type: "video", attrs: { src } }] };
  }

  it("keeps a video whose URL is an embeddable allow-listed host", () => {
    const src = "https://www.youtube.com/watch?v=abc123";
    expect(contentInputSchema.parse(video(src))).toEqual(video(src));
  });

  it.each([
    "https://evil.example.com/watch?v=abc123",
    "javascript:alert(1)",
    "http://www.youtube.com/watch?v=abc123",
    "https://www.youtube.com/playlist?list=x",
    42,
  ])("drops a video with src %s", (src) => {
    expect(contentInputSchema.parse(video(src))).toEqual({
      type: "doc",
      content: [],
    });
  });

  it("keeps a src of 500 characters and drops a video whose src is longer", () => {
    const at = (length: number) =>
      `https://www.youtube.com/watch?v=abc123&t=${"1".repeat(length - 41)}`;
    expect(at(500)).toHaveLength(500);
    expect(contentInputSchema.parse(video(at(500)))).toEqual(video(at(500)));
    expect(contentInputSchema.parse(video(at(501)))).toEqual({
      type: "doc",
      content: [],
    });
    expect(contentSchema.safeParse(video(at(501))).success).toBe(false);
  });

  it("drops attrs other than src", () => {
    const src = "https://vimeo.com/123456";
    expect(
      contentInputSchema.parse({
        type: "doc",
        content: [{ type: "video", attrs: { src, onload: "x" } }],
      }),
    ).toEqual(video(src));
  });
});

describe("the rich-text content set", () => {
  function doc(...content: unknown[]) {
    return { type: "doc", content };
  }
  const text = (value: string, marks?: unknown[]) =>
    marks
      ? { type: "text", text: value, marks }
      : { type: "text", text: value };
  const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

  it("keeps underline, strike and a hard break", () => {
    const input = doc(
      paragraph(
        text("under", [{ type: "underline" }]),
        { type: "hardBreak" },
        text("struck", [{ type: "strike" }]),
      ),
    );
    expect(contentInputSchema.parse(input)).toEqual(input);
  });

  it("drops a mark it does not know and keeps the text", () => {
    expect(
      contentInputSchema.parse(
        doc(paragraph(text("hi", [{ type: "highlight" }]))),
      ),
    ).toEqual(doc(paragraph(text("hi"))));
  });

  it("drops attrs on a hard break and an unknown inline node", () => {
    expect(
      contentInputSchema.parse(
        doc(
          paragraph(
            { type: "hardBreak", attrs: { x: 1 }, marks: [{ type: "bold" }] },
            { type: "mention", attrs: { id: "x" } },
          ),
        ),
      ),
    ).toEqual(doc(paragraph({ type: "hardBreak" })));
  });

  it("keeps a top-level quote of paragraphs", () => {
    const input = doc({
      type: "blockquote",
      content: [paragraph(text("said")), paragraph(text("again"))],
    });
    expect(contentInputSchema.parse(input)).toEqual(input);
  });

  it("keeps only the paragraphs of a quote holding a heading and a list", () => {
    expect(
      contentInputSchema.parse(
        doc({
          type: "blockquote",
          content: [
            { type: "heading", attrs: { level: 2 }, content: [text("H")] },
            paragraph(text("kept")),
            {
              type: "bulletList",
              content: [
                { type: "listItem", content: [paragraph(text("gone"))] },
              ],
            },
          ],
        }),
      ),
    ).toEqual(doc({ type: "blockquote", content: [paragraph(text("kept"))] }));
  });

  it("drops a quote with no paragraph left", () => {
    expect(
      contentInputSchema.parse(
        doc({
          type: "blockquote",
          content: [{ type: "heading", attrs: { level: 1 } }],
        }),
      ),
    ).toEqual(doc());
  });

  it("keeps an image's caption, trimmed", () => {
    expect(
      contentInputSchema.parse(
        doc({
          type: "image",
          attrs: { src: "https://x.test/a.png", alt: " A ", caption: " Cap " },
        }),
      ),
    ).toEqual(
      doc({
        type: "image",
        attrs: { src: "https://x.test/a.png", alt: "A", caption: "Cap" },
      }),
    );
  });

  it("keeps a caption of 300 characters, trimmed, and drops a longer one", () => {
    const image = (caption: string) =>
      doc({
        type: "image",
        attrs: { src: "https://x.test/a.png", alt: "A", caption },
      });
    const longest = "c".repeat(300);
    expect(contentInputSchema.parse(image(` ${longest} `))).toEqual(
      image(longest),
    );
    expect(contentInputSchema.parse(image(`${longest}c`))).toEqual(image(""));
    expect(contentSchema.safeParse(image(`${longest}c`)).success).toBe(false);
  });

  it("reads an old image with no caption as caption ''", () => {
    expect(
      contentInputSchema.parse(
        doc({
          type: "image",
          attrs: { src: "https://x.test/a.png", alt: "A" },
        }),
      ),
    ).toEqual(
      doc({
        type: "image",
        attrs: { src: "https://x.test/a.png", alt: "A", caption: "" },
      }),
    );
    expect(
      contentSchema.parse(
        doc({
          type: "image",
          attrs: { src: "https://x.test/a.png", alt: "A" },
        }),
      ),
    ).toEqual(
      doc({
        type: "image",
        attrs: { src: "https://x.test/a.png", alt: "A", caption: "" },
      }),
    );
  });

  it("drops an image, a video or a quote inside a list item", () => {
    expect(
      contentInputSchema.parse(
        doc({
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                paragraph(text("one")),
                { type: "image", attrs: { src: "https://x.test/a.png" } },
                { type: "video", attrs: { src: "https://youtu.be/abc123" } },
                { type: "blockquote", content: [paragraph(text("q"))] },
              ],
            },
          ],
        }),
      ),
    ).toEqual(
      doc({
        type: "bulletList",
        content: [{ type: "listItem", content: [paragraph(text("one"))] }],
      }),
    );
  });
});

describe("isBlankContent", () => {
  const doc = (...content: unknown[]) => ({ type: "doc", content });

  it("is blank for no blocks, empty paragraphs and a hard-break-only line", () => {
    expect(isBlankContent(doc())).toBe(true);
    expect(isBlankContent(doc({ type: "paragraph" }))).toBe(true);
    expect(
      isBlankContent(
        doc({ type: "paragraph", content: [{ type: "hardBreak" }] }),
      ),
    ).toBe(true);
  });

  it("is not blank for an image, a video or a quote with words", () => {
    expect(
      isBlankContent(
        doc({ type: "image", attrs: { src: "https://x.test/a.png" } }),
      ),
    ).toBe(false);
    expect(
      isBlankContent(
        doc({ type: "video", attrs: { src: "https://youtu.be/abc123" } }),
      ),
    ).toBe(false);
    expect(
      isBlankContent(
        doc({
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "q" }] },
          ],
        }),
      ),
    ).toBe(false);
  });

  it("is not blank for something that is not a document", () => {
    expect(isBlankContent({ nope: true })).toBe(false);
  });
});
