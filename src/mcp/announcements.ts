import type { Announcement } from "@/db/schema";
import { authorHandle } from "@/lib/announcements";
import { toPlainText } from "@/lib/rich-text/plain-text";

export type AnnouncementsResult = {
  edition: string;
  announcements: {
    title: string;
    pinned: boolean;
    author: string;
    publishedAt: string;
    body: string | null;
    videoUrls: string[];
  }[];
};

type AnnouncementRow = Pick<
  Announcement,
  "title" | "pinned" | "authorEmail" | "publishedAt" | "body" | "videoUrls"
>;

/**
 * Serializes a War Week's Announcements (already sorted and limited by the
 * query) into the `get_announcements` MCP tool payload. The body renders as
 * plain text; images are dropped, like the schedule serializer. The author
 * is the handle before the `@`, never the email: no MCP tool returns one.
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
      author: authorHandle(row.authorEmail),
      publishedAt: row.publishedAt.toISOString(),
      body: toPlainText(row.body),
      videoUrls: row.videoUrls,
    })),
  };
}
