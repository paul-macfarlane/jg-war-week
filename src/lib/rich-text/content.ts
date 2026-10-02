import { z } from "zod";

import { videoEmbedUrl } from "@/lib/video";

/**
 * Rich text (Announcement bodies, FAQ answers, Schedule Item descriptions),
 * stored in `jsonb` exactly as TipTap/ProseMirror emits it: a `doc` holding a
 * list of blocks. Copied from journeys.
 *
 * The allowed set is small and closed, journeys' set plus video:
 * paragraphs and line breaks, headings, quotes (top level, paragraphs only),
 * bullet and ordered lists, captioned images by URL and videos on an
 * allow-listed host (both top level only), and bold/italic/underline/
 * strike/link marks. `sanitizeContent` runs on every write (the seed
 * loader today, organizer actions later) and again on render, so content
 * that reached storage some other way still cannot render a `javascript:`
 * link, a `data:` image or a video from an unlisted host.
 */

export type Mark =
  | { type: "bold" }
  | { type: "italic" }
  | { type: "underline" }
  | { type: "strike" }
  | { type: "link"; attrs: { href: string; rel: "noopener noreferrer" } };

export type TextElement = { type: "text"; text: string; marks?: Mark[] };

/** A line break inside a block (Shift+Enter). It carries nothing. */
export type HardBreak = { type: "hardBreak" };

/** What a paragraph or heading holds. */
export type InlineElement = TextElement | HardBreak;

export type Paragraph = { type: "paragraph"; content?: InlineElement[] };

export type Heading = {
  type: "heading";
  attrs: { level: number };
  content?: InlineElement[];
};

/** A quotation: paragraphs only, and only at the top level of a document. */
export type Blockquote = { type: "blockquote"; content: Paragraph[] };

export type ListItem = {
  type: "listItem";
  content?: Array<Paragraph | BulletList | OrderedList>;
};

export type BulletList = { type: "bulletList"; content: ListItem[] };

export type OrderedList = {
  type: "orderedList";
  attrs?: { start: number };
  content: ListItem[];
};

/**
 * `alt` is for assistive technology; `""` until someone writes one.
 * `caption` is the visible line under the picture, `""` when there is none;
 * images stored before captions existed read as `caption: ""`.
 */
export type ImageBlock = {
  type: "image";
  attrs: { src: string; alt: string; caption: string };
};

/**
 * `src` is the video's original share URL; the embed URL is derived from it
 * on render (`videoEmbedUrl`), so only an embeddable, allow-listed URL is kept.
 */
export type VideoBlock = { type: "video"; attrs: { src: string } };

export type Block =
  | Paragraph
  | Heading
  | Blockquote
  | BulletList
  | OrderedList
  | ImageBlock
  | VideoBlock;

export type Content = { type: "doc"; content: Block[] };

const markSchema: z.ZodType<Mark> = z.union([
  z.object({ type: z.literal("bold") }),
  z.object({ type: z.literal("italic") }),
  z.object({ type: z.literal("underline") }),
  z.object({ type: z.literal("strike") }),
  z.object({
    type: z.literal("link"),
    attrs: z.object({
      href: z.string().min(1),
      // Optional on the way in; the sanitizer always sets it.
      rel: z.literal("noopener noreferrer").default("noopener noreferrer"),
    }),
  }),
]);

const textSchema: z.ZodType<TextElement> = z.object({
  type: z.literal("text"),
  text: z.string().min(1),
  marks: z.array(markSchema).optional(),
});

const inlineSchema: z.ZodType<InlineElement> = z.union([
  textSchema,
  z.object({ type: z.literal("hardBreak") }),
]);

const paragraphSchema: z.ZodType<Paragraph> = z.object({
  type: z.literal("paragraph"),
  content: z.array(inlineSchema).optional(),
});

const headingSchema: z.ZodType<Heading> = z.object({
  type: z.literal("heading"),
  attrs: z.object({ level: z.number().int().min(1).max(6) }),
  content: z.array(inlineSchema).optional(),
});

const blockquoteSchema: z.ZodType<Blockquote> = z.object({
  type: z.literal("blockquote"),
  content: z.array(paragraphSchema).min(1),
});

// Lists and list items refer to each other, so the inner schemas are reached
// lazily. TipTap omits `content` on an empty list item.
const listItemSchema: z.ZodType<ListItem> = z.object({
  type: z.literal("listItem"),
  content: z
    .array(
      z.lazy(() =>
        z.union([paragraphSchema, bulletListSchema, orderedListSchema]),
      ),
    )
    .optional(),
});

const bulletListSchema: z.ZodType<BulletList> = z.object({
  type: z.literal("bulletList"),
  content: z.array(z.lazy(() => listItemSchema)),
});

const orderedListSchema: z.ZodType<OrderedList> = z.object({
  type: z.literal("orderedList"),
  attrs: z.object({ start: z.number().int() }).optional(),
  content: z.array(z.lazy(() => listItemSchema)),
});

/**
 * The one compatibility read every reader of a stored image shares: a
 * missing or non-string `alt` or `caption` is `""`, so images stored before
 * captions existed stay valid without being rewritten.
 */
export function readStoredImageAttrs(attrs: unknown): {
  src: unknown;
  alt: string;
  caption: string;
} {
  const record = isRecord(attrs) ? attrs : {};
  return {
    src: record.src,
    alt: typeof record.alt === "string" ? record.alt : "",
    caption: typeof record.caption === "string" ? record.caption : "",
  };
}

/** The longest video `src` kept, as the old Announcement video links were. */
export const VIDEO_SRC_MAX = 500;
/** The longest image caption kept, once trimmed. */
export const IMAGE_CAPTION_MAX = 300;

const imageSchema: z.ZodType<ImageBlock> = z.object({
  type: z.literal("image"),
  attrs: z.preprocess(
    readStoredImageAttrs,
    z.object({
      src: z.string().min(1),
      alt: z.string(),
      caption: z.string().max(IMAGE_CAPTION_MAX),
    }),
  ),
});

const videoSchema: z.ZodType<VideoBlock> = z.object({
  type: z.literal("video"),
  attrs: z.object({
    src: z
      .string()
      .max(VIDEO_SRC_MAX)
      .refine((src) => videoEmbedUrl(src) !== null),
  }),
});

const blockSchema: z.ZodType<Block> = z.union([
  paragraphSchema,
  headingSchema,
  blockquoteSchema,
  bulletListSchema,
  orderedListSchema,
  imageSchema,
  videoSchema,
]);

/** The shape of stored rich text. Pair with `sanitizeContent` on write. */
export const contentSchema: z.ZodType<Content> = z.object({
  type: z.literal("doc"),
  content: z.array(blockSchema),
});

export type SanitizeContentResult =
  { ok: true; content: Content } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Returns the URL when it is an absolute `http:` or `https:` URL, and null
 * otherwise. `javascript:`, `data:`, `mailto:`, relative paths, and
 * protocol-relative `//host` forms all return null.
 */
function absoluteHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** The same absolute http(s) test the write-path sanitizer applies. */
export function isHttpUrl(value: string): boolean {
  return absoluteHttpUrl(value) !== null;
}

function sanitizeMarks(input: unknown): Mark[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const marks: Mark[] = [];
  for (const candidate of input) {
    if (!isRecord(candidate)) {
      continue;
    }
    if (
      candidate.type === "bold" ||
      candidate.type === "italic" ||
      candidate.type === "underline" ||
      candidate.type === "strike"
    ) {
      marks.push({ type: candidate.type });
      continue;
    }
    if (candidate.type === "link") {
      const attrs = isRecord(candidate.attrs) ? candidate.attrs : {};
      const href = absoluteHttpUrl(attrs.href);
      // An unsafe link loses the mark; the text it wrapped stays.
      if (href !== null) {
        marks.push({
          type: "link",
          attrs: { href, rel: "noopener noreferrer" },
        });
      }
    }
  }
  return marks;
}

function sanitizeInline(input: unknown): InlineElement[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const inline: InlineElement[] = [];
  for (const candidate of input) {
    if (!isRecord(candidate)) {
      continue;
    }
    // A line break keeps its place and loses anything written on it.
    if (candidate.type === "hardBreak") {
      inline.push({ type: "hardBreak" });
      continue;
    }
    // Anything else that is not a run of text is removed with its contents.
    if (candidate.type !== "text") {
      continue;
    }
    if (typeof candidate.text !== "string" || candidate.text.length === 0) {
      continue;
    }
    const marks = sanitizeMarks(candidate.marks);
    inline.push(
      marks.length > 0
        ? { type: "text", text: candidate.text, marks }
        : { type: "text", text: candidate.text },
    );
  }
  return inline;
}

function headingLevel(attrs: unknown): number {
  const level = isRecord(attrs) ? attrs.level : undefined;
  const valid =
    typeof level === "number" &&
    Number.isInteger(level) &&
    level >= 1 &&
    level <= 6;
  return valid ? level : 1;
}

function sanitizeImage(input: Record<string, unknown>): ImageBlock | null {
  const attrs = isRecord(input.attrs) ? input.attrs : {};
  const src = absoluteHttpUrl(attrs.src);
  if (src === null) {
    return null;
  }
  const stored = readStoredImageAttrs(attrs);
  const caption = stored.caption.trim();
  // An over-long caption is dropped like any attr it can't keep; the
  // picture stays.
  return {
    type: "image",
    attrs: {
      src,
      alt: stored.alt.trim(),
      caption: caption.length > IMAGE_CAPTION_MAX ? "" : caption,
    },
  };
}

function sanitizeVideo(input: Record<string, unknown>): VideoBlock | null {
  const attrs = isRecord(input.attrs) ? input.attrs : {};
  const src = attrs.src;
  // Stricter than the image rule: the URL must be on the video allow-list,
  // point at a video its host can embed, and be at most `VIDEO_SRC_MAX`.
  if (
    typeof src !== "string" ||
    src.length > VIDEO_SRC_MAX ||
    videoEmbedUrl(src) === null
  ) {
    return null;
  }
  return { type: "video", attrs: { src } };
}

function sanitizeListItems(input: unknown): ListItem[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const items: ListItem[] = [];
  for (const candidate of input) {
    if (!isRecord(candidate) || candidate.type !== "listItem") {
      continue;
    }
    const children = Array.isArray(candidate.content)
      ? candidate.content
          .map((child) => sanitizeBlock(child))
          .filter(
            (child): child is Paragraph | BulletList | OrderedList =>
              child !== null &&
              (child.type === "paragraph" ||
                child.type === "bulletList" ||
                child.type === "orderedList"),
          )
      : [];
    items.push(
      children.length > 0
        ? { type: "listItem", content: children }
        : { type: "listItem" },
    );
  }
  return items;
}

function sanitizeParagraph(input: Record<string, unknown>): Paragraph {
  const inline = sanitizeInline(input.content);
  return inline.length > 0
    ? { type: "paragraph", content: inline }
    : { type: "paragraph" };
}

/**
 * A quote keeps its paragraphs and nothing else: a heading, list, image,
 * video or quote inside it goes with everything it holds, and a quote left
 * with no paragraph goes too.
 */
function sanitizeBlockquote(input: Record<string, unknown>): Blockquote | null {
  const paragraphs = Array.isArray(input.content)
    ? input.content
        .filter(
          (child): child is Record<string, unknown> =>
            isRecord(child) && child.type === "paragraph",
        )
        .map(sanitizeParagraph)
    : [];
  return paragraphs.length > 0
    ? { type: "blockquote", content: paragraphs }
    : null;
}

/**
 * Returns the cleaned block, or null when the block itself is not allowed.
 * A quote is a top-level block only, so it is read by `sanitizeContent` and
 * not here, where list items also land; images and videos are dropped from
 * list items by `sanitizeListItems`.
 */
function sanitizeBlock(input: unknown): Block | null {
  if (!isRecord(input)) {
    return null;
  }

  switch (input.type) {
    case "paragraph":
      return sanitizeParagraph(input);
    case "heading": {
      const attrs = { level: headingLevel(input.attrs) };
      const inline = sanitizeInline(input.content);
      return inline.length > 0
        ? { type: "heading", attrs, content: inline }
        : { type: "heading", attrs };
    }
    case "bulletList": {
      const items = sanitizeListItems(input.content);
      return items.length > 0 ? { type: "bulletList", content: items } : null;
    }
    case "orderedList": {
      const items = sanitizeListItems(input.content);
      if (items.length === 0) {
        return null;
      }
      const start = isRecord(input.attrs) ? input.attrs.start : undefined;
      return typeof start === "number" && Number.isInteger(start)
        ? { type: "orderedList", attrs: { start }, content: items }
        : { type: "orderedList", content: items };
    }
    case "image":
      return sanitizeImage(input);
    case "video":
      return sanitizeVideo(input);
    default:
      // Unknown blocks go, and their whole subtree goes with them.
      return null;
  }
}

/**
 * Cleans rich text. Removes blocks and inline elements outside the allowed
 * set, drops marks and attrs it does not understand, and strips links and
 * images whose URL is not an absolute http(s) address. The returned content
 * always satisfies `contentSchema`. The only `ok: false` is input that is not
 * a document at all.
 */
export function sanitizeContent(input: unknown): SanitizeContentResult {
  if (
    !isRecord(input) ||
    input.type !== "doc" ||
    !Array.isArray(input.content)
  ) {
    return {
      ok: false,
      error: "Content must be a document with a list of blocks",
    };
  }

  const blocks = input.content
    .map((block) =>
      isRecord(block) && block.type === "blockquote"
        ? sanitizeBlockquote(block)
        : sanitizeBlock(block),
    )
    .filter((block): block is Block => block !== null);
  return { ok: true, content: { type: "doc", content: blocks } };
}

/**
 * zod schema for rich text arriving on a write path (seed files, organizer
 * forms, or a direct POST past the editor): sanitizes first, the same way
 * `sanitizeContent` always has, so a document holding an unrecognized block
 * (or an unsafe link/image URL) is cleaned rather than rejected outright.
 * The only failure is input that is not a document at all.
 */
export const contentInputSchema = z.unknown().transform((content, ctx) => {
  const result = sanitizeContent(content);
  if (!result.ok) {
    ctx.addIssue({ code: "custom", message: result.error });
    return z.NEVER;
  }
  return result.content;
});

/** A block's words; a line break reads as nothing. */
function inlineText(inline: InlineElement[] | undefined): string {
  return (inline ?? [])
    .map((element) => (element.type === "text" ? element.text : ""))
    .join("");
}

/** Whether any of these blocks shows a reader something. */
function showsAnything(blocks: Array<Block | ListItem>): boolean {
  return blocks.some((block) => {
    switch (block.type) {
      case "paragraph":
      case "heading":
        return inlineText(block.content).trim() !== "";
      case "blockquote":
      case "bulletList":
      case "orderedList":
        return showsAnything(block.content);
      case "listItem":
        return showsAnything(block.content ?? []);
      case "image":
      case "video":
        // A picture or a video is something to see, captioned or not.
        return true;
    }
  });
}

/**
 * Whether rich text shows nothing a reader would see: no blocks, or only
 * paragraphs, headings, quotes and lists with no words in them (a line
 * break alone is no words). An image or a video is always something.
 * Anything that isn't a document is not blank, so validation still reports
 * it. Read over the sanitized document, so a block the sanitizer would drop
 * counts for nothing.
 */
export function isBlankContent(input: unknown): boolean {
  const result = sanitizeContent(input);
  return result.ok && !showsAnything(result.content.content);
}
