import { and, desc, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Announcement,
  type WarWeek,
  announcement,
  participant,
} from "@/db/schema";
import {
  type AnnouncementCardData,
  type AuthorCandidate,
  announcementAuthorName,
  sortAnnouncements,
} from "@/lib/announcements";
import { isUuid } from "@/lib/uuid";

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
  if (!isUuid(id)) return undefined;
  const [found] = await dbOrTx
    .select()
    .from(announcement)
    .where(and(eq(announcement.id, id), eq(announcement.warWeekId, warWeek.id)))
    .limit(1);
  return found;
}

/** A War Week's Participant emails, for `announcementAuthorName`'s match. */
async function loadAuthorCandidates(
  warWeekId: string,
  dbOrTx: DBOrTx,
): Promise<AuthorCandidate[]> {
  return dbOrTx
    .select({ email: participant.email, displayName: participant.displayName })
    .from(participant)
    .where(eq(participant.warWeekId, warWeekId));
}

function toCardData(
  row: Announcement,
  participants: AuthorCandidate[],
): AnnouncementCardData {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    videoUrls: row.videoUrls,
    pinned: row.pinned,
    publishedAt: row.publishedAt,
    authorName: announcementAuthorName(row.authorEmail, participants),
  };
}

/**
 * A War Week's Announcements as `AnnouncementCard` data (author display
 * name, not email). `/news` and the home feed both use this; only the
 * admin pages keep the email (MCP shows the handle before the `@`).
 */
export async function getAnnouncementCards(
  warWeek: Pick<WarWeek, "id">,
  options: { limit?: number } = {},
  dbOrTx: DBOrTx = db,
): Promise<AnnouncementCardData[]> {
  const [rows, participants] = await Promise.all([
    getAnnouncements(warWeek, options, dbOrTx),
    loadAuthorCandidates(warWeek.id, dbOrTx),
  ]);
  return rows.map((row) => toCardData(row, participants));
}

/** The pinned Announcement's card data, if there is one. */
export async function getPinnedAnnouncementCard(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AnnouncementCardData | undefined> {
  const [pinned, participants] = await Promise.all([
    getPinnedAnnouncement(warWeek, dbOrTx),
    loadAuthorCandidates(warWeek.id, dbOrTx),
  ]);
  return pinned ? toCardData(pinned, participants) : undefined;
}

/**
 * A War Week's Announcements for the admin list: each row keeps its author's
 * email (for the edit check) and adds the display name to show.
 */
export async function getAdminAnnouncementRows(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<(Announcement & { authorName: string })[]> {
  const [rows, participants] = await Promise.all([
    getAnnouncements(warWeek, {}, dbOrTx),
    loadAuthorCandidates(warWeek.id, dbOrTx),
  ]);
  return rows.map((row) => ({
    ...row,
    authorName: announcementAuthorName(row.authorEmail, participants),
  }));
}
