import { describe, expect, it } from "vitest";

import { toPlainText } from "@/lib/rich-text/plain-text";

describe("toPlainText", () => {
  it("returns null for null or non-document input", () => {
    expect(toPlainText(null)).toBeNull();
    expect(toPlainText({ nope: true })).toBeNull();
  });

  it("joins paragraphs, headings and list items, dropping images", () => {
    const content = {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Heads up" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Bring snacks." }],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Chips" }],
                },
              ],
            },
          ],
        },
        { type: "image", attrs: { src: "https://x.test/a.png", alt: "" } },
      ],
    };

    expect(toPlainText(content)).toBe("Heads up\nBring snacks.\n- Chips");
  });

  it("renders a video as its URL", () => {
    const src = "https://youtu.be/abc123";
    expect(
      toPlainText({
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "Watch:" }] },
          { type: "video", attrs: { src } },
        ],
      }),
    ).toBe(`Watch:\n${src}`);
  });

  it("returns null when there is no renderable text", () => {
    expect(toPlainText({ type: "doc", content: [] })).toBeNull();
  });
});

describe("toPlainText over the journeys content set", () => {
  it("prefixes a quote's lines, breaks on a hard break, and keeps a caption", () => {
    expect(
      toPlainText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "one" },
              { type: "hardBreak" },
              { type: "text", text: "two" },
            ],
          },
          {
            type: "blockquote",
            content: [
              { type: "paragraph", content: [{ type: "text", text: "said" }] },
              { type: "paragraph", content: [{ type: "text", text: "again" }] },
            ],
          },
          {
            type: "image",
            attrs: { src: "https://x.test/a.png", alt: "A", caption: "Cap" },
          },
          { type: "image", attrs: { src: "https://x.test/b.png", alt: "B" } },
        ],
      }),
    ).toBe("one\ntwo\n> said\n> again\nCap");
  });
});
