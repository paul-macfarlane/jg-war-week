import { Node, mergeAttributes, wrappingInputRule } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { ListItem } from "@tiptap/extension-list";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import StarterKit from "@tiptap/starter-kit";

import {
  FIGURE_GROUP,
  insertFigure,
  replaceLiftingFigures,
} from "@/lib/rich-text/figures";
import { Video } from "@/lib/rich-text/video-node";

/** What the Image control writes onto an image. */
export type ImageAttrs = { src: string; alt: string; caption: string };

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    captionedImage: {
      /**
       * Inserts an image in place of the selection, or directly after the
       * list or quote the selection sits in, since an image cannot live
       * inside either.
       */
      insertImage: (attrs: ImageAttrs) => ReturnType;
    };
  }
}

/**
 * An image with its alt text and an optional caption, rendered as a figure
 * so the caption sits under the picture. `alt` is for assistive technology
 * and is never displayed; the `<figcaption>` is emitted only when there is a
 * caption to show. Ported from journeys.
 *
 * It sits in the `figure` group, which only `QuoteDocument` admits: the
 * stored shape gives a list item and a quote paragraphs only, so an image
 * the editor let into either would vanish at the next save. Inserted,
 * pasted, or dropped there, it goes directly after that list or quote
 * instead (`insertFigure`, `replaceLiftingFigures`), and so does a video.
 */
export const CaptionedImage = Image.extend({
  group: FIGURE_GROUP,

  addCommands() {
    return {
      ...this.parent?.(),
      insertImage: (attrs) => (props) =>
        insertFigure(this.type.create(attrs), props),
    };
  },

  addProseMirrorPlugins() {
    return [
      ...(this.parent?.() ?? []),
      new Plugin({
        key: new PluginKey("liftFigures"),
        props: {
          handlePaste(view, _event, slice) {
            const { from, to } = view.state.selection;
            const tr = view.state.tr;
            if (!replaceLiftingFigures(tr, from, to, slice)) return false;
            view.dispatch(tr.scrollIntoView().setMeta("uiEvent", "paste"));
            return true;
          },
          handleDrop(view, event, slice, moved) {
            const target = view.posAtCoords({
              left: event.clientX,
              top: event.clientY,
            });
            if (!target) return false;
            const tr = view.state.tr;
            // A moved figure leaves where it was, as ProseMirror's own drop
            // does; an unhandled drop discards this transaction.
            if (moved) tr.deleteSelection();
            const pos = tr.mapping.map(target.pos);
            if (!replaceLiftingFigures(tr, pos, pos, slice)) return false;
            view.dispatch(tr.setMeta("uiEvent", "drop"));
            return true;
          },
        },
      }),
    ];
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      alt: {
        default: "",
        parseHTML: (element) => element.getAttribute("alt") ?? "",
      },
      caption: {
        default: "",
        // The caption is the figcaption, not an attribute of the <img>.
        renderHTML: () => ({}),
      },
    };
  },

  renderHTML({ node, HTMLAttributes }) {
    const caption = String(node.attrs.caption ?? "");
    const img = [
      "img",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        alt: String(node.attrs.alt ?? ""),
      }),
    ] as const;
    return caption.length > 0
      ? ["figure", {}, img, ["figcaption", {}, caption]]
      : ["figure", {}, img];
  },
});

/**
 * A quote that holds paragraphs and nothing else, the shape
 * `@/lib/rich-text/content` stores. StarterKit's quote holds any block and
 * sits anywhere a block can, a list item among them, so a heading or list
 * in a quote, or a quote in a list, would lose its words on save. Here it
 * holds paragraphs, and it is in a group of its own that only
 * `QuoteDocument` admits. Ported from journeys; the commands and
 * Mod-Shift-b are StarterKit's.
 */
export const ParagraphQuote = Node.create({
  name: "blockquote",
  group: "quote",
  content: "paragraph+",
  defining: true,
  parseHTML() {
    return [{ tag: "blockquote" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["blockquote", HTMLAttributes, 0];
  },
  addCommands() {
    return {
      setBlockquote:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
      toggleBlockquote:
        () =>
        ({ commands }) =>
          commands.toggleWrap(this.name),
      unsetBlockquote:
        () =>
        ({ commands }) =>
          commands.lift(this.name),
    };
  },
  addKeyboardShortcuts() {
    return {
      // Answered even where no quote can go, so the press never falls
      // through to Bold's Mod-b.
      "Mod-Shift-b": () => {
        this.editor.commands.toggleBlockquote();
        return true;
      },
    };
  },
  addInputRules() {
    // "> " at the start of a paragraph quotes it, as in TipTap's own.
    return [wrappingInputRule({ find: /^\s*>\s$/, type: this.type })];
  },
});

/**
 * StarterKit's list item, holding what the stored shape gives one: a
 * paragraph first, then paragraphs and nested lists. StarterKit's holds any
 * block, so a heading typed into a list item would lose its level on save.
 */
export const ParagraphListItem = ListItem.extend({
  content: "paragraph (paragraph | bulletList | orderedList)*",
});

/**
 * StarterKit's document, admitting a quote, an image and a video beside the
 * blocks at its top.
 */
export const QuoteDocument = Node.create({
  name: "doc",
  topNode: true,
  content: "(block|quote|figure)+",
});

/**
 * The TipTap extensions the Organizer's rich-text editor writes with,
 * ported from journeys plus this repo's video. They close over the same
 * allowed set `@/lib/rich-text/content` describes: paragraphs and line
 * breaks, headings, quotes, bold, italic, underline, strike, bullet and
 * ordered lists, links, a captioned image and a video. Everything else
 * StarterKit would bring is switched off; undo/redo, the drop cursor and
 * the gap cursor stay, since they emit no content of their own. The viewer
 * renders with React (`RichText`), not TipTap, so journeys' render-only
 * extension sets are not ported.
 */
export const editorExtensions = [
  StarterKit.configure({
    // StarterKit's own document, quote and list item are swapped for
    // `QuoteDocument`, `ParagraphQuote` and `ParagraphListItem` below.
    document: false,
    blockquote: false,
    listItem: false,
    code: false,
    codeBlock: false,
    horizontalRule: false,
    listKeymap: false,
    trailingNode: false,
    link: {
      openOnClick: false,
      // A typed or pasted non-http link (e.g. `mailto:`, `javascript:`) would
      // otherwise autolink in the editor and then be silently dropped by
      // the sanitizer on save, leaving the Organizer's text unexpectedly
      // unlinked.
      autolink: false,
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    },
  }),
  QuoteDocument,
  ParagraphQuote,
  ParagraphListItem,
  CaptionedImage,
  Video,
];
