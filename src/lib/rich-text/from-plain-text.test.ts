import { describe, expect, it } from "vitest";

import { plainTextToContent } from "@/lib/rich-text/from-plain-text";

describe("plainTextToContent", () => {
  it("turns each non-empty line into one paragraph, in order", () => {
    expect(plainTextToContent("Line one\nLine two\n\nLine three")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Line one" }] },
        { type: "paragraph", content: [{ type: "text", text: "Line two" }] },
        { type: "paragraph", content: [{ type: "text", text: "Line three" }] },
      ],
    });
  });

  it("reads CRLF line ends and trims each line", () => {
    expect(plainTextToContent("  A \r\n\r\n B")).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "A" }] },
        { type: "paragraph", content: [{ type: "text", text: "B" }] },
      ],
    });
  });

  it("is null for blank text", () => {
    expect(plainTextToContent(" \n \n")).toBeNull();
    expect(plainTextToContent("")).toBeNull();
  });
});
