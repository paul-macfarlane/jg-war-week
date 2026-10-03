"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AnnouncementActionResult,
  createAnnouncement,
  updateAnnouncement,
} from "@/actions/announcements";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ANNOUNCEMENT_TITLE_MAX } from "@/lib/announcements";
import type { Content } from "@/lib/rich-text/content";

const EMPTY_BODY: Content = { type: "doc", content: [] };

type Initial = {
  title: string;
  body: Content;
  pinned: boolean;
};

/**
 * Write or edit one Announcement: title, rich-text body (videos go in it)
 * and whether it's pinned.
 */
export function AnnouncementForm({
  warWeekId,
  announcementId,
  initial,
  canPin = false,
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
  const formRef = useRef<HTMLFormElement>(null);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [body, setBody] = useState<Content>(initial?.body ?? EMPTY_BODY);
  const [pinned, setPinned] = useState(initial?.pinned ?? false);

  // Validation runs on the server; a refusal names its fields. Every field
  // is closed over from state (rather than read off `FormData`) so the
  // rich-text body survives a refusal unchanged.
  const [result, formAction, pending] = useActionState(
    async (): Promise<AnnouncementActionResult> => {
      const input = {
        title,
        body,
        pinned,
      };
      const saved = announcementId
        ? await updateAnnouncement(announcementId, input)
        : await createAnnouncement(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        return saved;
      }
      toast.success("Announcement saved");
      router.push("/admin/announcements");
      router.refresh();
      return saved;
    },
    null,
  );
  const fieldErrors = fieldErrorsOf(result);
  const formError = formErrorOf(result);
  useFocusFirstInvalid(formRef, result);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-5"
      aria-label="Announcement"
    >
      <FieldGroup>
        <Field data-invalid={!!fieldErrors.title}>
          <FieldLabel htmlFor="announcement-title">Title</FieldLabel>
          <Input
            id="announcement-title"
            name="title"
            required
            maxLength={ANNOUNCEMENT_TITLE_MAX}
            className="h-11 sm:h-9"
            aria-invalid={!!fieldErrors.title}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <FieldError>{fieldErrors.title}</FieldError>
        </Field>

        <Field data-invalid={!!fieldErrors.body}>
          <FieldTitle id="announcement-body-label">Body</FieldTitle>
          <RichTextEditor
            content={body}
            onChange={setBody}
            label="Body"
            labelId="announcement-body-label"
            placeholder="Write the Announcement…"
          />
          <FieldError>{fieldErrors.body}</FieldError>
        </Field>

        {canPin && (
          <Field orientation="horizontal" data-invalid={!!fieldErrors.pinned}>
            <Switch
              id="announcement-pinned"
              name="pinned"
              checked={pinned}
              onCheckedChange={setPinned}
            />
            <FieldLabel htmlFor="announcement-pinned">
              Pinned (shown first in the feed and on the home page)
            </FieldLabel>
            <FieldError>{fieldErrors.pinned}</FieldError>
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
      {formError && !pending && <FieldError>{formError}</FieldError>}
    </form>
  );
}
