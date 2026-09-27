"use client";

import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  type Content,
  isHttpUrl,
  sanitizeContent,
} from "@/lib/rich-text/content";
import { editorExtensions } from "@/lib/rich-text/extensions";
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
const MISSING_ALT = "Every image needs alt text";
/** Video URLs follow the Announcement video link rule (`videoEmbedUrl`). */
const VIDEO_HINT = "Use a YouTube, Loom, Vimeo or Google Drive video link";

const PANEL_LABEL = {
  link: "Add link",
  image: "Add image",
  video: "Add video",
} as const;
const PANEL_ACTION = {
  link: "Apply link",
  image: "Insert image",
  video: "Insert video",
} as const;

const EDITOR_CLASS =
  "min-h-48 px-4 py-3 outline-none [&>*+*]:mt-3 break-words [&_a]:underline [&_a]:underline-offset-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pl-6 [&_ul]:list-disc [&_ul]:pl-6 [&_.ProseMirror-selectednode]:ring-2 [&_.ProseMirror-selectednode]:ring-ring";

/**
 * `onMouseDown` is swallowed so the selection survives the click: without it
 * focus leaves the editor first and the toggle lands on nothing.
 */
function ToolbarButton({
  label,
  text,
  pressed,
  onClick,
}: {
  label: string;
  text: string;
  pressed: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      aria-pressed={pressed}
      className="aria-pressed:bg-muted"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {text}
    </Button>
  );
}

/**
 * The Organizer's rich-text editor (Announcement bodies), ported from
 * journeys and narrowed to this repo's closed content set: headings, bold,
 * italic, the two lists, links, images by URL with alt text, and videos
 * on an allow-listed host.
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
}) {
  // The editor is created once, so its update callback reads the current
  // `onChange` out of a ref rather than closing over the first render's.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const idPrefix = useId();
  const [panel, setPanel] = useState<keyof typeof PANEL_LABEL | null>(null);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [panelError, setPanelError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: editorExtensions,
    content: withTextBlock(content),
    // Pages are server-rendered by Next; rendering the editor immediately
    // would produce markup the client then disagrees with.
    immediatelyRender: false,
    editorProps: {
      attributes: labelId
        ? { "aria-labelledby": labelId, class: EDITOR_CLASS }
        : { "aria-label": label, class: EDITOR_CLASS },
    },
    onUpdate: ({ editor: instance }) => {
      const sanitized = sanitizeContent(instance.getJSON());
      if (sanitized.ok) onChangeRef.current(sanitized.content);
    },
  });

  const active = useEditorState({
    editor,
    selector: ({ editor: instance }) => ({
      heading1: instance?.isActive("heading", { level: 1 }) ?? false,
      heading2: instance?.isActive("heading", { level: 2 }) ?? false,
      heading3: instance?.isActive("heading", { level: 3 }) ?? false,
      bold: instance?.isActive("bold") ?? false,
      italic: instance?.isActive("italic") ?? false,
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
    setPanelError(null);
    setPanel("link");
  }

  function applyLink() {
    if (!editor) return;
    const href = linkUrl.trim();
    // An emptied URL is how an Organizer takes a link off again.
    if (href.length === 0) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setPanel(null);
      return;
    }
    if (!isHttpUrl(href)) {
      setPanelError(URL_HINT);
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
    setPanel(null);
  }

  function openImage() {
    setImageUrl("");
    setImageAlt("");
    setPanelError(null);
    setPanel("image");
  }

  function applyImage() {
    if (!editor) return;
    const src = imageUrl.trim();
    const alt = imageAlt.trim();
    if (!isHttpUrl(src)) {
      setPanelError(URL_HINT);
      return;
    }
    // Alt text is the editor's rule, not the sanitizer's.
    if (alt.length === 0) {
      setPanelError(MISSING_ALT);
      return;
    }
    editor.chain().focus().setImage({ src, alt }).run();
    setPanel(null);
  }

  function openVideo() {
    setVideoUrl("");
    setPanelError(null);
    setPanel("video");
  }

  function applyVideo() {
    if (!editor) return;
    const src = videoUrl.trim();
    if (videoEmbedUrl(src) === null) {
      setPanelError(VIDEO_HINT);
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent({ type: "video", attrs: { src } })
      .run();
    setPanel(null);
  }

  const applyPanel = { link: applyLink, image: applyImage, video: applyVideo };

  function cancelPanel() {
    setPanel(null);
    setPanelError(null);
  }

  return (
    <div className="ring-foreground/10 rounded-xl ring-1">
      <div
        role="toolbar"
        aria-label="Formatting"
        className="border-foreground/10 flex flex-wrap items-center gap-1 border-b px-2 py-1.5"
      >
        <ToolbarButton
          label="Heading 1"
          text="H1"
          pressed={active?.heading1 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 1 }).run()
          }
        />
        <ToolbarButton
          label="Heading 2"
          text="H2"
          pressed={active?.heading2 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="Heading 3"
          text="H3"
          pressed={active?.heading3 ?? false}
          onClick={() =>
            editor?.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <ToolbarButton
          label="Bold"
          text="B"
          pressed={active?.bold ?? false}
          onClick={() => editor?.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          text="I"
          pressed={active?.italic ?? false}
          onClick={() => editor?.chain().focus().toggleItalic().run()}
        />
        <ToolbarButton
          label="Bullet list"
          text="•"
          pressed={active?.bulletList ?? false}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Numbered list"
          text="1."
          pressed={active?.orderedList ?? false}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarButton
          label="Link"
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

      {panel && (
        <div
          role="group"
          aria-label={PANEL_LABEL[panel]}
          className="border-foreground/10 bg-muted/40 flex flex-col gap-2 border-b px-3 py-3"
        >
          {panel === "link" ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-link-url`}>Link URL</FieldLabel>
              <Input
                id={`${idPrefix}-link-url`}
                autoComplete="off"
                className="h-9"
                value={linkUrl}
                onChange={(event) => setLinkUrl(event.target.value)}
              />
            </Field>
          ) : panel === "video" ? (
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-video-url`}>
                Video URL
              </FieldLabel>
              <Input
                id={`${idPrefix}-video-url`}
                autoComplete="off"
                className="h-9"
                value={videoUrl}
                onChange={(event) => setVideoUrl(event.target.value)}
              />
              <FieldDescription>{VIDEO_HINT}</FieldDescription>
            </Field>
          ) : (
            <>
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-image-url`}>
                  Image URL
                </FieldLabel>
                <Input
                  id={`${idPrefix}-image-url`}
                  autoComplete="off"
                  className="h-9"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor={`${idPrefix}-image-alt`}>
                  Alt text
                </FieldLabel>
                <Input
                  id={`${idPrefix}-image-alt`}
                  autoComplete="off"
                  className="h-9"
                  value={imageAlt}
                  onChange={(event) => setImageAlt(event.target.value)}
                />
                <FieldDescription>
                  Describe the image for people who cannot see it
                </FieldDescription>
              </Field>
            </>
          )}
          {panelError && <FieldError>{panelError}</FieldError>}
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" onClick={applyPanel[panel]}>
              {PANEL_ACTION[panel]}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={cancelPanel}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
