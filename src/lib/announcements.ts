import { z } from "zod";

import type { Announcement } from "@/db/schema";
import { sameEmail } from "@/lib/access";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { formatLedgerTime } from "@/lib/points-entry";
import type { ProfilesByEmail } from "@/lib/profile";
import type { Parsed } from "@/lib/result";
import { contentInputSchema } from "@/lib/rich-text/content";

/**
 * What an `AnnouncementCard` renders: an Announcement's content plus its
 * author's display name (`announcementAuthorName`), never the raw email.
 */
export type AnnouncementCardData = Pick<
  Announcement,
  "id" | "title" | "body" | "pinned" | "publishedAt"
> & { authorName: string };

/** The Announcement title's column length. */
export const ANNOUNCEMENT_TITLE_MAX = 200;

/** The Announcement title, as limited by its column. */
export const announcementTitleSchema = z
  .string()
  .trim()
  .min(1, { error: "must not be empty" })
  .max(ANNOUNCEMENT_TITLE_MAX, {
    error: `must be at most ${ANNOUNCEMENT_TITLE_MAX} characters`,
  });

const VIDEO_URLS_MOVED =
  "Video links moved into the body: add each video with the Video button.";

export const announcementInputSchema = z.object({
  title: announcementTitleSchema,
  body: contentInputSchema,
  pinned: z.boolean().default(false),
  // zod would strip an unknown key and lose the videos silently (a form
  // from before R11), so refuse it, as the seed does.
  videoUrls: z.never({ error: VIDEO_URLS_MOVED }).optional(),
});

/** The Announcement form's raw fields. */
export type AnnouncementInput = {
  title: string;
  body: unknown;
  pinned: boolean;
};

export type AnnouncementValues = Omit<
  z.infer<typeof announcementInputSchema>,
  "videoUrls"
>;

const FIELD_LABELS: Record<string, string> = {
  title: "Title",
};

/** Words the body and videoUrls issues; the rest take the label rule. */
function describeAnnouncementIssue(issue: z.core.$ZodIssue): string | null {
  if (issue.path[0] === "body") return "Body must be valid rich text.";
  if (issue.path[0] === "videoUrls") return VIDEO_URLS_MOVED;
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
