import type { Content } from "@/lib/rich-text/content";

/**
 * Plain text as rich text: one paragraph per non-empty line, in order, each
 * trimmed. Null when there is nothing to show. Used by the seed loader to
 * turn a plain-text Competition description into content.
 */
export function plainTextToContent(text: string): Content | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== "");
  if (lines.length === 0) return null;
  return {
    type: "doc",
    content: lines.map((line) => ({
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: line }],
    })),
  };
}

/**
 * A seed or form description as stored: content as is, a string as one
 * paragraph per non-empty line, nothing as null.
 */
export function descriptionContent(
  description: string | Content | null | undefined,
): Content | null {
  if (description == null) return null;
  return typeof description === "string"
    ? plainTextToContent(description)
    : description;
}
