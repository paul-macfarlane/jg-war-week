import { and, desc, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { type Announcement, type WarWeek, announcement } from "@/db/schema";
import { isAnnouncementId, sortAnnouncements } from "@/lib/announcements";

async function loadSorted(
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<Announcement[]> {
  const rows = await dbOrTx
    .select()
    .from(announcement)
    .where(eq(announcement.warWeekId, warWeekId))
    .orderBy(desc(announcement.publishedAt), desc(announcement.id));
  return sortAnnouncements(rows);
}

/**
 * A War Week's Announcements, pinned first then newest first. `limit` caps
 * the returned list; the feed page and MCP both use it.
 */
export async function getAnnouncements(
  warWeek: Pick<WarWeek, "id">,
  options: { limit?: number } = {},
  dbOrTx: DBOrTx = db,
): Promise<Announcement[]> {
  const sorted = await loadSorted(warWeek.id, dbOrTx);
  return options.limit != null ? sorted.slice(0, options.limit) : sorted;
}

/** The Announcement to show pinned on the edition home, if there is one. */
export async function getPinnedAnnouncement(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<Announcement | undefined> {
  const [first] = await loadSorted(warWeek.id, dbOrTx);
  return first?.pinned ? first : undefined;
}

/** One Announcement of a War Week, for the edit form. */
export async function getAnnouncementForEdit(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<Announcement | undefined> {
  if (!isAnnouncementId(id)) return undefined;
  const [found] = await dbOrTx
    .select()
    .from(announcement)
    .where(and(eq(announcement.id, id), eq(announcement.warWeekId, warWeek.id)))
    .limit(1);
  return found;
}
