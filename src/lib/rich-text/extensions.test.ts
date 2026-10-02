import { getSchema } from "@tiptap/core";
import { generateJSON } from "@tiptap/html";
import { describe, expect, it } from "vitest";

import { editorExtensions } from "./extensions";

/**
 * The editor's own schema must refuse every shape the stored contract
 * drops, or an Organizer could write words the next save silently removes.
 * A quote lives only at the top of a document and holds only paragraphs,
 * and an image or a video lives only at the top of a document. Ported from
 * journeys, plus video.
 */
const schema = getSchema(editorExtensions);

function paragraph(text: string) {
  return { type: "paragraph", content: [{ type: "text", text }] };
}

function quote(...content: unknown[]) {
  return { type: "blockquote", content };
}

const image = {
  type: "image",
  attrs: { src: "https://example.com/a.png", alt: "A key" },
};

const video = {
  type: "video",
  attrs: { src: "https://youtu.be/dQw4w9WgXcQ" },
};

function bulletList(...items: unknown[][]) {
  return {
    type: "bulletList",
    content: items.map((content) => ({ type: "listItem", content })),
  };
}

function check(doc: unknown) {
  return () => schema.nodeFromJSON(doc).check();
}

describe("editorExtensions content set", () => {
  it("produces only the closed content set's nodes", () => {
    expect(Object.keys(schema.nodes).sort()).toEqual(
      [
        "blockquote",
        "bulletList",
        "doc",
        "hardBreak",
        "heading",
        "image",
        "listItem",
        "orderedList",
        "paragraph",
        "text",
        "video",
      ].sort(),
    );
  });

  it("produces only bold, italic, underline, strike and link marks", () => {
    expect(Object.keys(schema.marks).sort()).toEqual(
      ["bold", "italic", "link", "strike", "underline"].sort(),
    );
  });

  it("keeps images as blocks with alt text and a caption", () => {
    const node = schema.nodes.image;
    expect(node.isBlock).toBe(true);
    expect(Object.keys(node.spec.attrs ?? {})).toEqual(
      expect.arrayContaining(["src", "alt", "caption"]),
    );
  });

  it("keeps videos as atomic blocks holding only a src", () => {
    const node = schema.nodes.video;
    expect(node.isBlock).toBe(true);
    expect(node.isAtom).toBe(true);
    expect(Object.keys(node.spec.attrs ?? {})).toEqual(["src"]);
  });
});

describe("editorExtensions schema", () => {
  it("accepts a quote of paragraphs at the top of a document", () => {
    expect(
      check({ type: "doc", content: [quote(paragraph("a"), paragraph("b"))] }),
    ).not.toThrow();
  });

  it("refuses a quote inside a list item", () => {
    expect(
      check({
        type: "doc",
        content: [bulletList([paragraph("a"), quote(paragraph("b"))])],
      }),
    ).toThrow();
  });

  it("refuses a quote inside a quote, and a heading inside a quote", () => {
    expect(
      check({ type: "doc", content: [quote(quote(paragraph("a")))] }),
    ).toThrow();
    expect(
      check({
        type: "doc",
        content: [
          quote({
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "a" }],
          }),
        ],
      }),
    ).toThrow();
  });

  it("refuses a heading inside a list item", () => {
    expect(
      check({
        type: "doc",
        content: [
          bulletList([
            paragraph("a"),
            {
              type: "heading",
              attrs: { level: 2 },
              content: [{ type: "text", text: "b" }],
            },
          ]),
        ],
      }),
    ).toThrow();
  });

  it("accepts a list item of paragraphs and nested lists, starting with a paragraph", () => {
    expect(
      check({
        type: "doc",
        content: [
          bulletList([
            paragraph("a"),
            paragraph("b"),
            bulletList([paragraph("c")]),
            {
              type: "orderedList",
              content: [{ type: "listItem", content: [paragraph("d")] }],
            },
          ]),
        ],
      }),
    ).not.toThrow();
    expect(
      check({
        type: "doc",
        content: [bulletList([bulletList([paragraph("a")])])],
      }),
    ).toThrow();
  });

  it("accepts an image and a video at the top of a document", () => {
    expect(
      check({ type: "doc", content: [paragraph("a"), image, video] }),
    ).not.toThrow();
  });

  it("refuses an image or a video inside a list item or a quote", () => {
    for (const figure of [image, video]) {
      expect(
        check({
          type: "doc",
          content: [bulletList([paragraph("a"), figure])],
        }),
      ).toThrow();
      expect(check({ type: "doc", content: [quote(figure)] })).toThrow();
    }
  });

  it("lifts a pasted image out of a list item instead of dropping it", () => {
    const doc = generateJSON(
      '<ul><li>text<img src="https://example.com/a.png" alt="A key"></li></ul>',
      editorExtensions,
    );
    expect(doc.content.map((block: { type: string }) => block.type)).toEqual([
      "bulletList",
      "image",
    ]);
    expect(doc.content[1].attrs).toMatchObject({
      src: "https://example.com/a.png",
      alt: "A key",
    });
    expect(() => schema.nodeFromJSON(doc).check()).not.toThrow();
  });
});
