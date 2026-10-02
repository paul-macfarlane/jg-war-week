"use client";

import { getMarkAttributes } from "@tiptap/core";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import type React from "react";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  type Content,
  IMAGE_CAPTION_MAX,
  VIDEO_SRC_MAX,
  isHttpUrl,
  sanitizeContent,
} from "@/lib/rich-text/content";
import { type ImageAttrs, editorExtensions } from "@/lib/rich-text/extensions";
import { Placeholder } from "@/lib/rich-text/placeholder";
import { formatShortcut, isApplePlatform } from "@/lib/rich-text/shortcuts";
import { videoEmbedUrl } from "@/lib/video";

/**
 * A document with no blocks is one ProseMirror can render but not edit into,
 * so an empty body shows as one empty paragraph.
 */
function withTextBlock(content: Content): Content {
  return content.content.length > 0
    ? content
    : { type: "doc", content: [{ type: "paragraph" }] };
}

/** Both URL fields take the same absolute addresses the sanitizer keeps. */
const URL_HINT = "Start the address with http:// or https://";
/** The help line under the alt text field, the one field the dialog insists on. */
const ALT_HELP = "Describe the image for people who cannot see it";
const MISSING_ALT = "Every image needs alt text";
/** Video URLs follow the rich-text video block's rule (`videoEmbedUrl`). */
const VIDEO_HINT = "Use a YouTube, Loom, Vimeo or Google Drive video link";

/**
 * `.ProseMirror-selectednode` is the class ProseMirror puts on a selected
 * block node (the figure around an image, or a video), so the ring tells a
 * selected one apart. `[&>.is-empty]` draws the placeholder the
 * `Placeholder` decoration puts on the first block while the document is
 * empty; `float-left h-0` keeps that block's own height and caret.
 */
const EDITOR_CLASS =
  "min-h-48 rounded-b-xl px-4 py-3 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 [&>*+*]:mt-3 break-words [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:border-l-2 [&_blockquote]:border-muted-foreground [&_blockquote]:pl-4 [&_blockquote]:not-italic [&_blockquote>*+*]:mt-3 [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground [&_figure]:w-fit [&_figure]:rounded-lg [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring [&_.ProseMirror-selectednode]:ring-offset-2 [&_.ProseMirror-selectednode]:ring-offset-background [&>.is-empty]:before:pointer-events-none [&>.is-empty]:before:float-left [&>.is-empty]:before:h-0 [&>.is-empty]:before:text-muted-foreground [&>.is-empty]:before:content-[attr(data-placeholder)]";

/**
 * The floating image toolbar shows while the selection is an image node.
 * Both values are module constants on purpose: `BubbleMenu` dispatches an
 * options update into the editor whenever either changes identity, so an
 * inline function or object here would dispatch one on every render.
 */
const showImageTools: NonNullable<
  React.ComponentProps<typeof BubbleMenu>["shouldShow"]
> = ({ editor: instance }) => instance.isActive("image");
/**
 * Where the image toolbar sits: over the picture itself, along its bottom
 * edge, so it covers neither the text above nor the caption below. A
 * picture too short to hold the menu gets it just below instead. `flip` is
 * off: flipped to the top it would land on the text above.
 */
const IMAGE_TOOLS_INSET = 8;
const IMAGE_TOOLS_PLACEMENT = {
  placement: "bottom",
  flip: false,
  offset: ({
    rects,
  }: {
    rects: { reference: { height: number }; floating: { height: number } };
  }) =>
    rects.reference.height >= rects.floating.height + 2 * IMAGE_TOOLS_INSET
      ? -(rects.floating.height + IMAGE_TOOLS_INSET)
      : IMAGE_TOOLS_INSET,
} as const;

/** Phone-sized touch targets in the dialogs, as on the form around them. */
const DIALOG_BUTTON_CLASS = "min-h-11 min-w-11 sm:min-h-8 sm:min-w-0";
const DIALOG_INPUT_CLASS = "h-11 sm:h-9";

/**
 * Whether ⌘ or Ctrl is the platform's modifier. Read once on the client and
 * `false` for the server render, so the tooltips never hydrate differently
 * from what the server sent; they are not open at that point anyway.
 */
function subscribeToNothing() {
  return () => {};
}
function useApplePlatform(): boolean {
  return useSyncExternalStore(subscribeToNothing, isApplePlatform, () => false);
}

/**
 * `onMouseDown` is swallowed so the selection survives the click: without it
 * focus leaves the editor first and the toggle lands on nothing.
 *
 * The tooltip reads the button's name and the shortcut the editor binds for
 * it, in the platform's own keys. The `aria-label` already names the button;
 * the tooltip is not wired into `aria-describedby`, so a screen reader hears
 * the name once.
 */
function ToolbarButton({
  label,
  shortcut,
  text,
  pressed,
  onClick,
}: {
  label: string;
  /** The TipTap key name the editor binds, e.g. `Mod-b`; none for Image. */
  shortcut?: string;
  text: string;
  pressed: boolean;
  onClick: () => void;
}) {
  const apple = useApplePlatform();
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={label}
            aria-pressed={pressed}
            className="aria-pressed:bg-muted min-h-11 min-w-11 sm:min-h-7 sm:min-w-0"
            onMouseDown={(event) => event.preventDefault()}
            onClick={onClick}
          />
        }
      >
        {text}
      </TooltipTrigger>
      <TooltipContent>
        {label}
        {shortcut ? (
          <kbd className="bg-background/20 rounded-sm px-1 font-sans">
            {formatShortcut(shortcut, apple)}
          </kbd>
        ) : null}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * The Organizer's rich-text editor (Announcement bodies, FAQ answers,
 * Schedule Item descriptions), ported from journeys plus this repo's video:
 * headings, bold, italic, underline, strikethrough, quotes, the two lists,
 * links, images by URL with alt text and an optional caption, and videos on
 * an allow-listed host. Shift+Enter breaks a line inside a block; it has no
 * button. A selected image shows a ring and a small floating toolbar to
 * edit or remove it; every toolbar button carries a tooltip with its name
 * and, where the editor binds one, its shortcut.
 *
 * Every update goes through `sanitizeContent` before it leaves this
 * component, so form state already holds the stored shape; the server action
 * sanitizes again on write. The sanitized content is never fed back into the
 * editor while the Organizer types.
 */
export function RichTextEditor({
  content,
  onChange,
  label = "Body",
  labelId,
  placeholder,
}: {
  content: Content;
  onChange: (content: Content) => void;
  /** The editing surface's accessible name, used when `labelId` is absent. */
  label?: string;
  /**
   * The id of an external `FieldLabel` that names this editor, so the
   * visible label is the accessible name rather than a duplicate one from
   * `aria-label`.
   */
  labelId?: string;
  /**
   * Shown over the first block while the document is empty, and exposed to
   * assistive technology as `aria-placeholder` for as long.
   */
  placeholder?: string;
}) {
  // The editor is created once, so its update callback reads the current
  // `onChange` out of a ref rather than closing over the first render's.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const idPrefix = useId();

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  // One dialog for both jobs: `imageMode` says whether Save inserts a new
  // image at the cursor or rewrites the attrs of the selected one.
  const [imageOpen, setImageOpen] = useState(false);
  const [imageMode, setImageMode] = useState<"insert" | "edit">("insert");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [imageCaption, setImageCaption] = useState("");
  const [imageError, setImageError] = useState<string | null>(null);

  const [videoOpen, setVideoOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  const editor = useEditor({
    // Read once, as the editor is: whether the surface carries a
    // placeholder is the caller's shape.
    extensions: [
      ...editorExtensions,
      ...(placeholder !== undefined
        ? [Placeholder.configure({ placeholder })]
        : []),
    ],
    content: withTextBlock(content),
    // Pages are server-rendered by Next; rendering the editor immediately
    // would produce markup the client then disagrees with.
    immediatelyRender: false,
    editorProps: {
      // A textbox, not a bare `div`: a name alone is not allowed on an
      // element with no role (axe `aria-prohibited-attr`), and a screen
      // reader should hear an editable, multi-line field.
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        ...(labelId ? { "aria-labelledby": labelId } : { "aria-label": label }),
        class: EDITOR_CLASS,
      },
      // ⌘K on Apple platforms and Ctrl+K elsewhere opens the link dialog
      // while the editor has focus, as the Link tooltip says. The dialog
      // state setters are stable, so this first-render closure stays right.
      handleKeyDown: (view, event) => {
        const mod = isApplePlatform() ? event.metaKey : event.ctrlKey;
        if (!mod) return false;
        if (event.shiftKey || event.altKey) return false;
        if (event.key.toLowerCase() !== "k") return false;
        setLinkUrl(String(getMarkAttributes(view.state, "link").href ?? ""));
        setLinkError(null);
        setLinkOpen(true);
        return true;
      },
    },
    onUpdate: ({ editor: instance }) => {
      const sanitized = sanitizeContent(instance.getJSON());
      if (sanitized.ok) onChangeRef.current(sanitized.content);
    },
  });

  /**
   * The selected image's picture, for the image toolbar to sit over
   * (`IMAGE_TOOLS_PLACEMENT`). `null` hands the choice back to the menu,
   * which then anchors on the selection as it would anyway.
   */
  const imageToolsAnchor = useCallback(() => {
    if (!editor) return null;
    const node = editor.view.nodeDOM(editor.state.selection.from);
    if (!(node instanceof HTMLElement)) return null;
    const picture = node.matches("img") ? node : node.querySelector("img");
    if (picture === null) return null;
    return {
      getBoundingClientRect: () => picture.getBoundingClientRect(),
      getClientRects: () => [picture.getBoundingClientRect()],
    };
  }, [editor]);

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading1: instance?.isActive("heading", { level: 1 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      heading3: instance?.isActive("heading", { level: 3 }) ?? false,
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
      underline: instance?.isActive("underline") ?? false,
      strike: instance?.isActive("strike") ?? false,
      blockquote: instance?.isActive("blockquote") ?? false,
      bulletList: instance?.isActive("bulletList") ?? false,
      orderedList: instance?.isActive("orderedList") ?? false,
      link: instance?.isActive("link") ?? false,
      image: instance?.isActive("image") ?? false,
      video: instance?.isActive("video") ?? false,
    }),
  });

  function openLink() {
    if (!editor) return;
    setLinkUrl(String(editor.getAttributes("link").href ?? ""));
    setLinkError(null);
    setLinkOpen(true);
  }

  function applyLink() {
    if (!editor) return;
    const href = linkUrl.trim();
    // An emptied URL is how an Organizer takes a link off again.
    if (href.length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkOpen(false);
      return;
    }
    if (!isHttpUrl(href)) {
      setLinkError(URL_HINT);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setLinkOpen(false);
  }

  function openImage() {
    setImageMode("insert");
    setImageUrl("");
    setImageAlt("");
    setImageCaption("");
    setImageError(null);
    setImageOpen(true);
  }

  /** The same dialog, pre-filled from the selected image. */
  function openImageEdit() {
    if (!editor) return;
    const attrs = editor.getAttributes("image");
    setImageMode("edit");
    setImageUrl(String(attrs.src ?? ""));
    setImageAlt(String(attrs.alt ?? ""));
    setImageCaption(String(attrs.caption ?? ""));
    setImageError(null);
    setImageOpen(true);
  }

  function saveImage() {
    if (!editor) return;
    const src = imageUrl.trim();
    const alt = imageAlt.trim();
    const caption = imageCaption.trim();
    if (!isHttpUrl(src)) {
      setImageError(URL_HINT);
      return;
    }
    // Alt text is the dialog's rule, not the sanitizer's.
    if (alt.length === 0) {
      setImageError(MISSING_ALT);
      return;
    }
    const attrs: ImageAttrs = { src, alt, caption };
    if (imageMode === "edit") {
      editor.chain().focus().updateAttributes("image", attrs).run();
    } else {
      // `insertImage` rather than `setImage`: it carries the caption, and it
      // places the image after a list or quote the selection sits in.
      editor.chain().focus().insertImage(attrs).run();
    }
    setImageOpen(false);
  }

  function removeImage() {
    editor?.chain().focus().deleteSelection().run();
  }

  function openVideo() {
    setVideoUrl("");
    setVideoError(null);
    setVideoOpen(true);
  }

  function applyVideo() {
    if (!editor) return;
    const src = videoUrl.trim();
    if (videoEmbedUrl(src) === null) {
      setVideoError(VIDEO_HINT);
      return;
    }
    editor.chain().focus().insertVideo({ src }).run();
    setVideoOpen(false);
  }

  const linkUrlId = `${idPrefix}-link-url`;
  const imageUrlId = `${idPrefix}-image-url`;
  const imageAltId = `${idPrefix}-image-alt`;
  const imageAltHelpId = `${idPrefix}-image-alt-help`;
  const imageCaptionId = `${idPrefix}-image-caption`;
  const videoUrlId = `${idPrefix}-video-url`;
  const videoHelpId = `${idPrefix}-video-help`;

  return (
    <div className="ring-foreground/10 rounded-xl ring-1">
      <TooltipProvider>
        <div
          role="toolbar"
          aria-label="Formatting"
          className="border-foreground/10 flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
        >
          <ToolbarButton
            label="Heading 1"
            shortcut="Mod-Alt-1"
            text="H1"
            pressed={active?.heading1 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 1 }).run()
            }
          />
          <ToolbarButton
            label="Heading 2"
            shortcut="Mod-Alt-2"
            text="H2"
            pressed={active?.heading2 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 2 }).run()
            }
          />
          <ToolbarButton
            label="Heading 3"
            shortcut="Mod-Alt-3"
            text="H3"
            pressed={active?.heading3 ?? false}
            onClick={() =>
              editor?.chain().focus().toggleHeading({ level: 3 }).run()
            }
          />
          <ToolbarButton
            label="Bold"
            shortcut="Mod-b"
            text="B"
            pressed={active?.bold ?? false}
            onClick={() => editor?.chain().focus().toggleBold().run()}
          />
          <ToolbarButton
            label="Italic"
            shortcut="Mod-i"
            text="I"
            pressed={active?.italic ?? false}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
          />
          <ToolbarButton
            label="Underline"
            shortcut="Mod-u"
            text="U"
            pressed={active?.underline ?? false}
            onClick={() => editor?.chain().focus().toggleUnderline().run()}
          />
          <ToolbarButton
            label="Strikethrough"
            shortcut="Mod-Shift-s"
            text="S"
            pressed={active?.strike ?? false}
            onClick={() => editor?.chain().focus().toggleStrike().run()}
          />
          <ToolbarButton
            label="Quote"
            shortcut="Mod-Shift-b"
            text="Quote"
            pressed={active?.blockquote ?? false}
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
          />
          <ToolbarButton
            label="Bullet list"
            shortcut="Mod-Shift-8"
            text="•"
            pressed={active?.bulletList ?? false}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
          />
          <ToolbarButton
            label="Numbered list"
            shortcut="Mod-Shift-7"
            text="1."
            pressed={active?.orderedList ?? false}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          />
          <ToolbarButton
            label="Link"
            shortcut="Mod-k"
            text="Link"
            pressed={active?.link ?? false}
            onClick={openLink}
          />
          <ToolbarButton
            label="Image"
            text="Image"
            pressed={active?.image ?? false}
            onClick={openImage}
          />
          <ToolbarButton
            label="Video"
            text="Video"
            pressed={active?.video ?? false}
            onClick={openVideo}
          />
        </div>
      </TooltipProvider>

      <EditorContent editor={editor} />

      {/* The floating toolbar over a selected image. `onMouseDown` is
          swallowed for the same reason as on the toolbar: the node selection
          must survive the click for Edit and Remove to have a target. It is
          appended beside the editing surface, inside the themed root. */}
      {editor ? (
        <BubbleMenu
          editor={editor}
          shouldShow={showImageTools}
          getReferencedVirtualElement={imageToolsAnchor}
          options={IMAGE_TOOLS_PLACEMENT}
        >
          {/* A child rather than the menu element itself: `BubbleMenu`
              forwards only a fixed set of attributes to the element it
              positions, and `aria-label` is not among them. */}
          <div
            role="toolbar"
            aria-label="Image tools"
            className="border-foreground/10 bg-background flex items-center gap-1 rounded-lg border p-1 shadow-md"
          >
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-7"
              onMouseDown={(event) => event.preventDefault()}
              onClick={openImageEdit}
            >
              Edit image
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="min-h-11 sm:min-h-7"
              onMouseDown={(event) => event.preventDefault()}
              onClick={removeImage}
            >
              Remove
            </Button>
          </div>
        </BubbleMenu>
      ) : null}

      <Dialog
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (!open) setLinkError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add link</DialogTitle>
          </DialogHeader>
          <Field data-invalid={linkError ? true : undefined}>
            <FieldLabel htmlFor={linkUrlId}>Link URL</FieldLabel>
            <Input
              id={linkUrlId}
              autoComplete="off"
              className={DIALOG_INPUT_CLASS}
              aria-invalid={linkError ? true : undefined}
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
            />
            <FieldError>{linkError}</FieldError>
          </Field>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={DIALOG_BUTTON_CLASS}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              className={DIALOG_BUTTON_CLASS}
              onClick={applyLink}
            >
              Apply link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={imageOpen}
        onOpenChange={(open) => {
          setImageOpen(open);
          if (!open) setImageError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {imageMode === "edit" ? "Edit image" : "Add image"}
            </DialogTitle>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor={imageUrlId}>Image URL</FieldLabel>
            <Input
              id={imageUrlId}
              autoComplete="off"
              className={DIALOG_INPUT_CLASS}
              value={imageUrl}
              onChange={(event) => setImageUrl(event.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={imageAltId}>Alt text</FieldLabel>
            <Input
              id={imageAltId}
              autoComplete="off"
              className={DIALOG_INPUT_CLASS}
              aria-describedby={imageAltHelpId}
              value={imageAlt}
              onChange={(event) => setImageAlt(event.target.value)}
            />
            <FieldDescription id={imageAltHelpId}>{ALT_HELP}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={imageCaptionId}>Caption (optional)</FieldLabel>
            <Input
              id={imageCaptionId}
              autoComplete="off"
              className={DIALOG_INPUT_CLASS}
              maxLength={IMAGE_CAPTION_MAX}
              value={imageCaption}
              onChange={(event) => setImageCaption(event.target.value)}
            />
            <FieldError>{imageError}</FieldError>
          </Field>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={DIALOG_BUTTON_CLASS}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              className={DIALOG_BUTTON_CLASS}
              onClick={saveImage}
            >
              {imageMode === "edit" ? "Save image" : "Insert image"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={videoOpen}
        onOpenChange={(open) => {
          setVideoOpen(open);
          if (!open) setVideoError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add video</DialogTitle>
          </DialogHeader>
          <Field data-invalid={videoError ? true : undefined}>
            <FieldLabel htmlFor={videoUrlId}>Video URL</FieldLabel>
            <Input
              id={videoUrlId}
              autoComplete="off"
              className={DIALOG_INPUT_CLASS}
              aria-describedby={videoHelpId}
              aria-invalid={videoError ? true : undefined}
              maxLength={VIDEO_SRC_MAX}
              value={videoUrl}
              onChange={(event) => setVideoUrl(event.target.value)}
            />
            <FieldDescription id={videoHelpId}>{VIDEO_HINT}</FieldDescription>
            <FieldError>{videoError}</FieldError>
          </Field>
          <DialogFooter>
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  className={DIALOG_BUTTON_CLASS}
                />
              }
            >
              Cancel
            </DialogClose>
            <Button
              type="button"
              className={DIALOG_BUTTON_CLASS}
              onClick={applyVideo}
            >
              Insert video
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
