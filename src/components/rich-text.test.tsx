import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichText } from "./rich-text";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function render(content: unknown) {
  return renderToStaticMarkup(<RichText content={content} />);
}

describe("RichText", () => {
  it("renders marks, headings, lists and images, and escapes text", () => {
    const html = render(
      doc(
        {
          type: "heading",
          attrs: { level: 2 },
          content: [{ type: "text", text: "Closing Ceremonies" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "bold", marks: [{ type: "bold" }] },
            { type: "text", text: "italic", marks: [{ type: "italic" }] },
            {
              type: "text",
              text: "<script>",
              marks: [{ type: "link", attrs: { href: "https://example.com" } }],
            },
          ],
        },
        {
          type: "orderedList",
          attrs: { start: 3 },
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "Neo" }] },
              ],
            },
          ],
        },
        {
          type: "image",
          attrs: { src: "https://example.com/red-pill.png", alt: "Red pill" },
        },
      ),
    );

    expect(html).toContain("<h2><span>Closing Ceremonies</span></h2>");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
    expect(html).toContain(
      '<a href="https://example.com" rel="noopener noreferrer" target="_blank">&lt;script&gt;</a>',
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain(
      '<ol start="3"><li><p><span>Neo</span></p></li></ol>',
    );
    expect(html).toContain(
      '<img src="https://example.com/red-pill.png" alt="Red pill"/>',
    );
  });

  it("strips a javascript: link on render but keeps its text", () => {
    const html = render(
      doc({
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click me",
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
      }),
    );

    expect(html).toContain("click me");
    expect(html).not.toContain("<a");
    expect(html).not.toContain("javascript:");
  });

  it("drops unsafe images, unknown blocks and unknown marks", () => {
    const html = render(
      doc(
        { type: "image", attrs: { src: "data:image/png;base64,AAAA" } },
        { type: "codeBlock", content: [{ type: "text", text: "rm -rf /" }] },
        {
          type: "paragraph",
          content: [
            {
              type: "text",
              text: "kept",
              marks: [{ type: "textStyle", attrs: { style: "x" } }],
            },
            { type: "hardBreak" },
          ],
        },
      ),
    );

    expect(html).not.toContain("<img");
    expect(html).not.toContain("rm -rf");
    expect(html).toContain("<p><span>kept</span></p>");
  });

  it("renders an allow-listed video as a lazy 16:9 embed", () => {
    const html = render(
      doc({
        type: "video",
        attrs: { src: "https://www.youtube.com/watch?v=abc123" },
      }),
    );

    expect(html).toContain(
      'src="https://www.youtube-nocookie.com/embed/abc123"',
    );
    expect(html).toContain('title="Embedded video"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('allow="fullscreen"');
    expect(html).toContain('referrerPolicy="strict-origin-when-cross-origin"');
    expect(html).toContain("aspect-video");
  });

  it("drops a video outside the allow-list on render", () => {
    const html = render(
      doc(
        { type: "video", attrs: { src: "https://evil.example.com/x" } },
        { type: "video", attrs: { src: "javascript:alert(1)" } },
      ),
    );

    expect(html).not.toContain("<iframe");
  });

  it("renders nothing for a value that is not a document", () => {
    expect(render("<b>hi</b>")).toBe("");
    expect(render(null)).toBe("");
  });

  describe("empty paragraphs", () => {
    const empty = { type: "paragraph" };
    const blank = {
      type: "paragraph",
      content: [{ type: "text", text: "  " }],
    };
    const line = (text: string) => ({
      type: "paragraph",
      content: [{ type: "text", text }],
    });

    it("renders nothing for an empty document", () => {
      expect(render(doc())).toBe("");
    });

    it("renders nothing when every paragraph is empty", () => {
      expect(render(doc(empty, blank, empty))).toBe("");
    });

    it("drops leading and trailing empty paragraphs", () => {
      const html = render(doc(empty, blank, line("Hello"), empty, blank));
      expect(html.match(/<p>/g)).toHaveLength(1);
      expect(html).toContain("<p><span>Hello</span></p>");
    });

    it("keeps empty paragraphs between text", () => {
      const html = render(doc(line("One"), empty, line("Two")));
      expect(html.match(/<p>/g)).toHaveLength(3);
    });
  });
});
