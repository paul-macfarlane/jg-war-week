"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type AnnouncementActionResult,
  createAnnouncement,
  updateAnnouncement,
} from "@/actions/announcements";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ANNOUNCEMENT_TITLE_MAX, MAX_VIDEO_LINKS } from "@/lib/announcements";
import type { Content } from "@/lib/rich-text/content";
import { videoEmbedUrl } from "@/lib/video";

const EMPTY_BODY: Content = { type: "doc", content: [] };

type Initial = {
  title: string;
  body: Content;
  videoUrls: string[];
  pinned: boolean;
};

/**
 * Write or edit one Announcement: title, rich-text body, up to five video
 * links, and whether it's pinned. The video hint is only a hint; the server
 * action is the authority on the allow-list and its error is what's shown.
 */
export function AnnouncementForm({
  warWeekId,
  announcementId,
  initial,
  canPin = true,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  /** Pinning is Organizer-only; a Host doesn't see the switch. */
  canPin?: boolean;
  /** Set when editing an existing Announcement. */
  announcementId?: string;
  initial?: Initial;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState<Content>(initial?.body ?? EMPTY_BODY);
  const [videoUrls, setVideoUrls] = useState<string[]>(
    initial?.videoUrls ?? [],
  );
  const [pinned, setPinned] = useState(initial?.pinned ?? false);
  const [result, setResult] = useState<AnnouncementActionResult | null>(null);

  function setVideoUrl(index: number, value: string) {
    setVideoUrls((urls) => urls.map((url, i) => (i === index ? value : url)));
  }

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // Blank rows are left-over "Add video link" clicks, not links.
    const input = {
      title,
      body,
      videoUrls: videoUrls.map((url) => url.trim()).filter(Boolean),
      pinned,
    };
    startTransition(async () => {
      const saved = announcementId
        ? await updateAnnouncement(announcementId, input)
        : await createAnnouncement(warWeekId, input);
      setResult(saved);
      if (!saved.ok) {
        toast.error(saved.error);
        return;
      }
      toast.success(
        announcementId ? "Announcement saved" : "Announcement posted",
      );
      router.push("/admin/announcements");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-5"
      aria-label="Announcement"
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="announcement-title">Title</FieldLabel>
          <Input
            id="announcement-title"
            name="title"
            required
            maxLength={ANNOUNCEMENT_TITLE_MAX}
            className="h-11 sm:h-9"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </Field>

        <Field>
          <FieldLabel>Body</FieldLabel>
          <RichTextEditor content={body} onChange={setBody} label="Body" />
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Video links</FieldLegend>
          <FieldDescription>
            YouTube, Loom, Vimeo or Google Drive links only
          </FieldDescription>
          <FieldGroup>
            {videoUrls.map((url, index) => {
              const hint =
                url.trim() !== "" && videoEmbedUrl(url.trim()) === null
                  ? "Not a recognized YouTube, Loom, Vimeo or Google Drive video link"
                  : null;
              return (
                <Field key={index}>
                  <div className="flex items-center gap-2">
                    <Input
                      type="url"
                      aria-label={`Video link ${index + 1}`}
                      className="h-11 flex-1 sm:h-9"
                      value={url}
                      onChange={(event) =>
                        setVideoUrl(index, event.target.value)
                      }
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="min-h-11 sm:min-h-7"
                      onClick={() =>
                        setVideoUrls((urls) =>
                          urls.filter((_, i) => i !== index),
                        )
                      }
                    >
                      Remove
                    </Button>
                  </div>
                  {hint && (
                    <FieldDescription className="font-medium text-amber-600">
                      {hint}
                    </FieldDescription>
                  )}
                </Field>
              );
            })}
          </FieldGroup>
          {videoUrls.length < MAX_VIDEO_LINKS && (
            <div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11 sm:min-h-7"
                onClick={() => setVideoUrls((urls) => [...urls, ""])}
              >
                Add video link
              </Button>
            </div>
          )}
        </FieldSet>

        {canPin && (
          <Field orientation="horizontal">
            <Switch
              id="announcement-pinned"
              name="pinned"
              checked={pinned}
              onCheckedChange={setPinned}
            />
            <FieldLabel htmlFor="announcement-pinned">
              Pinned (shown first in the feed and on the home page)
            </FieldLabel>
          </Field>
        )}
      </FieldGroup>

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          size="lg"
          className="min-h-11 sm:min-h-9"
          disabled={pending}
        >
          {pending
            ? "Saving…"
            : announcementId
              ? "Save changes"
              : "Post Announcement"}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="min-h-11 sm:min-h-9"
          onClick={() => router.push("/admin/announcements")}
        >
          Cancel
        </Button>
      </div>
      {result && !result.ok && !pending && (
        <FieldError>{result.error}</FieldError>
      )}
    </form>
  );
}
