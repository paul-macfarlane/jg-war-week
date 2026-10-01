import type { ReactNode } from "react";

import {
  type Block,
  type ListItem,
  type TextElement,
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
 */
export function RichText({ content }: { content: unknown }) {
  const result = sanitizeContent(content);
  if (!result.ok) {
    return null;
  }

  const blocks = trimEmptyParagraphs(result.content.content);
  if (blocks.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 break-words [&_a]:underline [&_a]:underline-offset-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6">
      {blocks.map((block, index) => (
        <BlockView key={index} block={block} />
      ))}
    </div>
  );
}

function isEmptyParagraph(block: Block) {
  return (
    block.type === "paragraph" &&
    (block.content ?? []).every((element) => element.text.trim() === "")
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
    case "bulletList":
      return <ul>{block.content.map(renderListItem)}</ul>;
    case "orderedList":
      return (
        <ol start={block.attrs?.start}>{block.content.map(renderListItem)}</ol>
      );
    case "image":
      // Images are external URLs chosen by organizers; next/image would need
      // every host allow-listed.
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={block.attrs.src} alt={block.attrs.alt} />;
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

function renderInline(elements: TextElement[] | undefined) {
  return elements?.map((element, index) => {
    let node: ReactNode = element.text;
    for (const mark of element.marks ?? []) {
      if (mark.type === "bold") {
        node = <strong>{node}</strong>;
      } else if (mark.type === "italic") {
        node = <em>{node}</em>;
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
