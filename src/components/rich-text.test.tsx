import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RichText } from "./rich-text";

function doc(...content: unknown[]) {
  return { type: "doc", content };
}

function render(content: unknown, headingFloor?: number) {
  return renderToStaticMarkup(
    <RichText content={content} headingFloor={headingFloor} />,
  );
}

function heading(level: number, text: string) {
  return {
    type: "heading",
    attrs: { level },
    content: [{ type: "text", text }],
  };
}

function headingTags(html: string) {
  return [...html.matchAll(/<(h[1-6])>/g)].map((match) => match[1]);
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
      '<figure><img src="https://example.com/red-pill.png" alt="Red pill"/></figure>',
    );
  });

  it("renders underline, strike, a hard break, a quote and a caption", () => {
    const html = render(
      doc(
        {
          type: "paragraph",
          content: [
            { type: "text", text: "under", marks: [{ type: "underline" }] },
            { type: "hardBreak" },
            { type: "text", text: "struck", marks: [{ type: "strike" }] },
          ],
        },
        {
          type: "blockquote",
          content: [
            { type: "paragraph", content: [{ type: "text", text: "said" }] },
          ],
        },
        {
          type: "image",
          attrs: {
            src: "https://example.com/a.png",
            alt: "A key",
            caption: "Photo: Trinity",
          },
        },
      ),
    );

    expect(html).toContain(
      "<p><span><u>under</u></span><br/><span><s>struck</s></span></p>",
    );
    expect(html).toContain("<blockquote><p><span>said</span></p></blockquote>");
    expect(html).toContain(
      '<figure><img src="https://example.com/a.png" alt="A key"/><figcaption>Photo: Trinity</figcaption></figure>',
    );
  });

  describe("heading levels", () => {
    it("renders the first heading at the default floor, h2", () => {
      expect(headingTags(render(doc(heading(1, "A"))))).toEqual(["h2"]);
    });

    it("renders the first heading at the floor whatever its stored level", () => {
      expect(headingTags(render(doc(heading(3, "A")), 4))).toEqual(["h4"]);
      expect(headingTags(render(doc(heading(1, "A")), 2))).toEqual(["h2"]);
    });

    it("keeps later headings relative to the first, never skipping a level", () => {
      // Stored H1, H3, H2, H1, H3: rendered from a floor of 3.
      expect(
        headingTags(
          render(
            doc(
              heading(1, "a"),
              heading(3, "b"),
              heading(2, "c"),
              heading(1, "d"),
              heading(3, "e"),
            ),
            3,
          ),
        ),
      ).toEqual(["h3", "h4", "h4", "h3", "h4"]);
    });

    it("never renders above the floor or past h6", () => {
      expect(
        headingTags(
          render(
            doc(
              heading(2, "a"),
              heading(1, "b"),
              heading(3, "c"),
              heading(4, "d"),
              heading(5, "e"),
            ),
            5,
          ),
        ),
      ).toEqual(["h5", "h5", "h6", "h6", "h6"]);
    });
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
            { type: "mention", attrs: { id: "x" } },
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

  it("titles each video with videoTitle when given, keeping its other attributes", () => {
    const html = renderToStaticMarkup(
      <RichText
        content={doc({
          type: "video",
          attrs: { src: "https://www.youtube.com/watch?v=abc123" },
        })}
        videoTitle="Video: Kickoff"
      />,
    );

    expect(html).toContain('title="Video: Kickoff"');
    expect(html).not.toContain('title="Embedded video"');
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('allow="fullscreen"');
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
