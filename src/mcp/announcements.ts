import type { Announcement } from "@/db/schema";
import { toPlainText } from "@/lib/rich-text/plain-text";

export type AnnouncementsResult = {
  edition: string;
  announcements: {
    title: string;
    pinned: boolean;
    author: string;
    publishedAt: string;
    body: string | null;
  }[];
};

type AnnouncementRow = Pick<
  Announcement,
  "title" | "pinned" | "publishedAt" | "body"
> & {
  /** The resolved author name (`announcementAuthorName`); never an email. */
  authorName: string;
};

/**
 * Serializes a War Week's Announcements (already sorted and limited by the
 * query) into the `get_announcements` MCP tool payload. The body renders as
 * plain text; images are dropped, like the schedule serializer. The author
 * is the resolved name (Profile name, else roster name, else the handle
 * before the `@`), never the email: no MCP tool returns one.
 */
export function toAnnouncementsResult(
  edition: string,
  rows: AnnouncementRow[],
): AnnouncementsResult {
  return {
    edition,
    announcements: rows.map((row) => ({
      title: row.title,
      pinned: row.pinned,
      author: row.authorName,
      publishedAt: row.publishedAt.toISOString(),
      body: toPlainText(row.body),
    })),
  };
}
