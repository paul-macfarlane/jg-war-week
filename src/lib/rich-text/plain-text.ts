import {
  type Block,
  type InlineElement,
  sanitizeContent,
} from "@/lib/rich-text/content";

/** A block's text as lines: a hard break starts a new one. */
function inlineLines(elements: InlineElement[] | undefined): string[] {
  return (elements ?? [])
    .map((e) => (e.type === "text" ? e.text : "\n"))
    .join("")
    .split("\n");
}

function blockLines(block: Block, indent = ""): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
      return inlineLines(block.content).map((line) => indent + line);
    case "blockquote":
      return block.content.flatMap((paragraph) =>
        blockLines(paragraph, indent).map((line) => `> ${line}`),
      );
    case "bulletList":
    case "orderedList":
      return block.content.flatMap((item) =>
        (item.content ?? []).flatMap((child, index) =>
          blockLines(child, indent).map((line, lineIndex) =>
            index === 0 && lineIndex === 0 ? `- ${line}` : `  ${line}`,
          ),
        ),
      );
    case "image":
      // An image is its caption, when it has one.
      return block.attrs.caption ? [indent + block.attrs.caption] : [];
    case "video":
      return [indent + block.attrs.src];
  }
}

/**
 * Rich text as plain text for a Claude user: a quote's lines read `> `, a
 * line break is a newline, an image is its caption (or nothing) and a video
 * is its URL. Shared by
 * every MCP serializer that returns a rich-text field as readable text
 * (Schedule Item descriptions, Announcement bodies).
 */
export function toPlainText(content: unknown): string | null {
  if (content == null) return null;
  const result = sanitizeContent(content);
  if (!result.ok) return null;
  const text = result.content.content
    .flatMap((block) => blockLines(block))
    .join("\n")
    .trim();
  return text || null;
}
