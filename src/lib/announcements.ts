import { z } from "zod";

import { formatLedgerTime } from "@/lib/points-entry";
import { contentInputSchema } from "@/lib/rich-text/content";
import { videoEmbedUrl } from "@/lib/video";

/** The Announcement title's column length. */
export const ANNOUNCEMENT_TITLE_MAX = 200;

/** How many video links an Announcement may carry. */
export const MAX_VIDEO_LINKS = 5;

/** The Announcement title, as limited by its column. */
export const announcementTitleSchema = z
  .string()
  .trim()
  .min(1, { error: "must not be empty" })
  .max(ANNOUNCEMENT_TITLE_MAX, {
    error: `must be at most ${ANNOUNCEMENT_TITLE_MAX} characters`,
  });

/**
 * An Announcement video link: an https URL within the column length that
 * `videoEmbedUrl` can turn into an embeddable video. The allow-list and the
 * embed shapes both live once, in `videoEmbedUrl`.
 */
export const videoUrlSchema = z
  .url({ protocol: /^https$/, error: "must be an https:// link" })
  .max(500, { error: "must be at most 500 characters" })
  .refine((url) => videoEmbedUrl(url) !== null, {
    error: "must be a YouTube, Loom, Vimeo or Google Drive video link",
  });

export const announcementInputSchema = z.object({
  title: announcementTitleSchema,
  body: contentInputSchema,
  videoUrls: z
    .array(videoUrlSchema)
    .max(MAX_VIDEO_LINKS, {
      error: `must have at most ${MAX_VIDEO_LINKS} video links`,
    })
    .default([]),
  pinned: z.boolean().default(false),
});

/** The Announcement form's raw fields. */
export type AnnouncementInput = {
  title: string;
  body: unknown;
  videoUrls: string[];
  pinned: boolean;
};

export type AnnouncementValues = z.infer<typeof announcementInputSchema>;

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
};

/** Validates the Announcement form. Never throws; returns the first error. */
export function parseAnnouncementInput(
  input: AnnouncementInput,
): { ok: true; value: AnnouncementValues } | { ok: false; error: string } {
  const result = announcementInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const issue = result.error.issues[0];
  if (issue.path[0] === "videoUrls") {
    if (issue.path.length === 1) {
      return {
        ok: false,
        error: `Add at most ${MAX_VIDEO_LINKS} video links.`,
      };
    }
    const index = typeof issue.path[1] === "number" ? issue.path[1] : 0;
    return {
      ok: false,
      error: `Video link ${index + 1} ${issue.message}.`,
    };
  }
  if (issue.path[0] === "body") {
    return { ok: false, error: "Body must be valid rich text." };
  }

  const label = FIELD_LABELS[String(issue.path[0])];
  // Shared field schemas word their errors as "must …"; prefix the field.
  const message = issue.message.startsWith("must ")
    ? `${label} ${issue.message}.`
    : issue.message;
  return { ok: false, error: message };
}

const uuid = z.uuid();

/** Whether a URL segment or action argument is shaped like a row id. */
export function isAnnouncementId(id: string): boolean {
  return uuid.safeParse(id).success;
}

/**
 * Pinned Announcements first, then newest first by published-at. Stable:
 * rows that tie on both keep their original order.
 */
export function sortAnnouncements<
  T extends { pinned: boolean; publishedAt: Date },
>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });
}

/** An Announcement's published-at, in War Week time (ET). */
export const formatPublishedAt = formatLedgerTime;

/** How many `video` blocks a rich-text tree holds, at any depth. */
function embeddedVideos(node: unknown): number {
  if (typeof node !== "object" || node === null) return 0;
  const { type, content } = node as { type?: unknown; content?: unknown };
  const own = type === "video" ? 1 : 0;
  return Array.isArray(content)
    ? content.reduce<number>((sum, child) => sum + embeddedVideos(child), own)
    : own;
}

/** An Announcement's videos: its video links plus videos embedded in the body. */
export function announcementVideoCount({
  videoUrls,
  body,
}: {
  videoUrls: string[];
  body: unknown;
}): number {
  return videoUrls.length + embeddedVideos(body);
}
