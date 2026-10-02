import { Node, mergeAttributes } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";

import {
  FIGURE_GROUP,
  figureInsertRange,
  replaceLiftingImages,
} from "@/lib/rich-text/figures";
import { VIDEO_IFRAME, videoEmbedUrl } from "@/lib/video";

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    video: {
      /**
       * Inserts a video in place of the selection, or directly after the
       * list or quote the selection sits in, since a video cannot live
       * inside either.
       */
      insertVideo: (attrs: { src: string }) => ReturnType;
    };
  }
}

/**
 * The editor's `video` block: an atom holding one attribute, `src`, the
 * video's original share URL. The editor draws the same embed the viewer
 * does (`videoEmbedUrl`) so an Organizer sees what they inserted; the
 * sanitizer drops any `src` that does not resolve to an embed. It sits in
 * the `figure` group with the image, so like the image it lives only at the
 * top of a document and is placed the same way (`replaceLiftingImages`).
 */
export const Video = Node.create({
  name: "video",
  group: FIGURE_GROUP,
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-video-src"),
        renderHTML: (attributes) => ({ "data-video-src": attributes.src }),
      },
    };
  },

  addCommands() {
    return {
      insertVideo:
        (attrs) =>
        ({ state, tr, dispatch, commands }) => {
          const video = this.type.create(attrs);
          const range = figureInsertRange(state.selection);
          if (!dispatch) return true;
          return (
            replaceLiftingImages(
              tr,
              range.from,
              range.to,
              new Slice(Fragment.from(video), 0, 0),
            ) || commands.insertContentAt(range, video.toJSON())
          );
        },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-video-src]" }];
  },

  renderHTML({ node, HTMLAttributes }) {
    const embed =
      typeof node.attrs.src === "string" ? videoEmbedUrl(node.attrs.src) : null;
    const wrapper = mergeAttributes(HTMLAttributes, {
      class: "aspect-video w-full overflow-hidden rounded-lg",
    });
    if (!embed) return ["div", wrapper];
    return [
      "div",
      wrapper,
      [
        "iframe",
        {
          src: embed,
          title: VIDEO_IFRAME.title,
          allow: VIDEO_IFRAME.allow,
          loading: VIDEO_IFRAME.loading,
          referrerpolicy: VIDEO_IFRAME.referrerPolicy,
          // Clicks select the node instead of starting playback mid-edit.
          class: "pointer-events-none h-full w-full",
        },
      ],
    ];
  },
});
