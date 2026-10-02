import type { ReactNode } from "react";

import {
  type Block,
  type InlineElement,
  type ListItem,
  sanitizeContent,
} from "@/lib/rich-text/content";
import { VIDEO_IFRAME, videoEmbedUrl } from "@/lib/video";

/**
 * Read-only, server-rendered rich text. Takes whatever came out of a `jsonb`
 * column and runs `sanitizeContent` over it again before rendering, so a
 * document that reached storage without passing the write-path sanitizer
 * still cannot render an unsafe link, image or video. Rendering walks the
 * closed block set with React elements, so text is always escaped and no
 * raw HTML is ever injected.
 *
 * Stored headings are never rendered at their stored level: rich text sits
 * under a heading of the page's own, at different depths, so headings are
 * normalised the way journeys' runner does (`normalizeHeadingLevels`) from
 * `headingFloor`, one below the nearest enclosing heading.
 */
export function RichText({
  content,
  headingFloor = 2,
}: {
  content: unknown;
  /** The level the first stored heading renders at; 2 to 6. */
  headingFloor?: number;
}) {
  const result = sanitizeContent(content);
  if (!result.ok) {
    return null;
  }

  const blocks = normalizeHeadingLevels(
    trimEmptyParagraphs(result.content.content),
    headingFloor,
  );
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="[&_blockquote]:border-muted-foreground [&_figcaption]:text-muted-foreground flex flex-col gap-3 break-words [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:not-italic [&_blockquote>*+*]:mt-3 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:text-base [&_h4]:font-semibold [&_h5]:text-sm [&_h5]:font-semibold [&_h6]:text-sm [&_h6]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

/**
 * Journeys' heading normalisation, from a floor instead of a fixed `h2`:
 * the first heading renders at `floor`, whatever level it was written at;
 * each later heading at its written distance from the first, but never
 * above `floor`, never more than one level deeper than the previous
 * rendered heading (so no level is skipped), and never past 6. Headings are
 * only ever top-level blocks in the stored shape, so only the top level is
 * walked.
 */
function normalizeHeadingLevels(blocks: Block[], floor: number): Block[] {
  let firstWritten: number | null = null;
  let previousRendered = floor - 1;
  return blocks.map((block) => {
    if (block.type !== "heading") return block;
    firstWritten ??= block.attrs.level;
    const rendered = Math.min(
      Math.max(block.attrs.level - firstWritten + floor, floor),
      previousRendered + 1,
      6,
    );
    previousRendered = rendered;
    return { ...block, attrs: { level: rendered } };
  });
}

function isEmptyParagraph(block: Block) {
  return (
    block.type === "paragraph" &&
    (block.content ?? []).every(
      (element) => element.type === "hardBreak" || element.text.trim() === "",
    )
  );
}

/**
 * Drops empty paragraphs at either end, which the editor saves and which would
 * otherwise render as blank lines (and a gap) around the text. Empty paragraphs
 * between text are the author's spacing and stay. Stored content is unchanged.
 */
function trimEmptyParagraphs(blocks: Block[]) {
  let start = 0;
  let end = blocks.length;
  while (start < end && isEmptyParagraph(blocks[start])) start++;
  while (end > start && isEmptyParagraph(blocks[end - 1])) end--;
  return blocks.slice(start, end);
}

function BlockView({ block }: { block: Block }) {
  switch (block.type) {
    case "paragraph":
      return <p>{renderInline(block.content)}</p>;
    case "heading": {
      const Tag = `h${block.attrs.level}` as
        "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return <Tag>{renderInline(block.content)}</Tag>;
    }
    case "blockquote":
      return (
        <blockquote>
          {block.content.map((paragraph, index) => (
            <BlockView key={index} block={paragraph} />
          ))}
        </blockquote>
      );
    case "bulletList":
      return <ul>{block.content.map(renderListItem)}</ul>;
    case "orderedList":
      return (
        <ol start={block.attrs?.start}>{block.content.map(renderListItem)}</ol>
      );
    case "image":
      // Images are external URLs chosen by organizers; next/image would need
      // every host allow-listed.
      return (
        <figure>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={block.attrs.src} alt={block.attrs.alt} />
          {block.attrs.caption ? (
            <figcaption>{block.attrs.caption}</figcaption>
          ) : null}
        </figure>
      );
    case "video": {
      // The sanitizer only keeps videos this resolves, so null is unreachable.
      const src = videoEmbedUrl(block.attrs.src);
      if (!src) return null;
      return (
        <iframe
          src={src}
          {...VIDEO_IFRAME}
          allowFullScreen
          className="aspect-video w-full rounded-lg"
        />
      );
    }
  }
}

function renderListItem(item: ListItem, index: number) {
  return (
    <li key={index}>
      {item.content?.map((child, childIndex) => (
        <BlockView key={childIndex} block={child} />
      ))}
    </li>
  );
}

function renderInline(elements: InlineElement[] | undefined) {
  return elements?.map((element, index) => {
    if (element.type === "hardBreak") return <br key={index} />;
    let node: ReactNode = element.text;
    for (const mark of element.marks ?? []) {
      if (mark.type === "bold") {
        node = <strong>{node}</strong>;
      } else if (mark.type === "italic") {
        node = <em>{node}</em>;
      } else if (mark.type === "underline") {
        node = <u>{node}</u>;
      } else if (mark.type === "strike") {
        node = <s>{node}</s>;
      } else {
        node = (
          <a href={mark.attrs.href} rel={mark.attrs.rel} target="_blank">
            {node}
          </a>
        );
      }
    }
    return <span key={index}>{node}</span>;
  });
}
