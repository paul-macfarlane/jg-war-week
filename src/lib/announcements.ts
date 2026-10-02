import { z } from "zod";

import type { Announcement } from "@/db/schema";
import { sameEmail } from "@/lib/access";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { formatLedgerTime } from "@/lib/points-entry";
import type { ProfilesByEmail } from "@/lib/profile";
import type { Parsed } from "@/lib/result";
import { contentInputSchema } from "@/lib/rich-text/content";
import { videoEmbedUrl } from "@/lib/video";

/**
 * What an `AnnouncementCard` renders: an Announcement's content plus its
 * author's display name (`announcementAuthorName`), never the raw email.
 */
export type AnnouncementCardData = Pick<
  Announcement,
  "id" | "title" | "body" | "videoUrls" | "pinned" | "publishedAt"
> & { authorName: string };

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

/** Words the video-link and body issues; the rest take the label rule. */
function describeAnnouncementIssue(issue: z.core.$ZodIssue): string | null {
  if (issue.path[0] === "videoUrls") {
    if (issue.path.length === 1) {
      return `Add at most ${MAX_VIDEO_LINKS} video links.`;
    }
    const index = typeof issue.path[1] === "number" ? issue.path[1] : 0;
    return `Video link ${index + 1} ${issue.message}.`;
  }
  if (issue.path[0] === "body") return "Body must be valid rich text.";
  return null;
}

/**
 * Validates the Announcement form. Never throws; returns the first error
 * and one per refused field.
 */
export function parseAnnouncementInput(
  input: AnnouncementInput,
): Parsed<AnnouncementValues> {
  const result = announcementInputSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  // Shared field schemas word their errors as "must …"; prefix the field.
  return {
    ok: false,
    ...fieldErrorsFrom(result.error, {
      labels: FIELD_LABELS,
      describe: describeAnnouncementIssue,
    }),
  };
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

/**
 * The name an Announcement's author shows as, for a Participant-facing
 * card: the author's Profile name (any author, Participant or not), else
 * the roster name of the War Week's Participant whose email matches the
 * author's (account linking: `sameEmail`), else `authorHandle`. Never the
 * raw email; only the admin pages keep it.
 */
export function announcementAuthorName(
  authorEmail: string,
  participants: AuthorCandidate[],
  profiles: ProfilesByEmail = new Map(),
): string {
  const profileName = profiles.get(
    authorEmail.trim().toLowerCase(),
  )?.profileName;
  if (profileName) return profileName;
  const match = participants.find((p) => sameEmail(p.email, authorEmail));
  return match ? match.displayName : authorHandle(authorEmail);
}

/** A War Week's Participant an Announcement author can match. */
export type AuthorCandidate = { email: string | null; displayName: string };

/** The part of an email before the `@`: "pat@jahnelgroup.com" → "pat". */
export function authorHandle(email: string): string {
  return email.split("@")[0];
}
