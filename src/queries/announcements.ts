import { desc, eq } from "drizzle-orm";

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
import type { ProfilesByEmail } from "@/lib/profile";
import { getProfilesByEmail } from "@/queries/profile-join";

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

/** A War Week's Announcements, pinned first then newest first. */
export async function getAnnouncements(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<Announcement[]> {
  return loadSorted(warWeek.id, dbOrTx);
}

/** The Announcement to show pinned on the edition home, if there is one. */
export async function getPinnedAnnouncement(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<Announcement | undefined> {
  const [first] = await loadSorted(warWeek.id, dbOrTx);
  return first?.pinned ? first : undefined;
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

/** What `announcementAuthorName` resolves with, for these authors. */
type Authors = { participants: AuthorCandidate[]; profiles: ProfilesByEmail };

/**
 * The roster candidates and the authors' Profiles: an author with a Profile
 * name shows as it, Participant or not.
 */
async function loadAuthors(
  warWeekId: string,
  authorEmails: string[],
  dbOrTx: DBOrTx,
): Promise<Authors> {
  const [participants, profiles] = await Promise.all([
    loadAuthorCandidates(warWeekId, dbOrTx),
    getProfilesByEmail(authorEmails, dbOrTx),
  ]);
  return { participants, profiles };
}

function toCardData(row: Announcement, authors: Authors): AnnouncementCardData {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    pinned: row.pinned,
    publishedAt: row.publishedAt,
    authorName: announcementAuthorName(
      row.authorEmail,
      authors.participants,
      authors.profiles,
    ),
  };
}

/**
 * A War Week's Announcements as `AnnouncementCard` data (author display
 * name, not email). `/announcements` and the home feed both use this. The
 * admin pages show the name too; the email is only for the edit/ownership
 * check (the feed shows the same name).
 */
export async function getAnnouncementCards(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AnnouncementCardData[]> {
  const rows = await getAnnouncements(warWeek, dbOrTx);
  const authors = await loadAuthors(
    warWeek.id,
    rows.map((r) => r.authorEmail),
    dbOrTx,
  );
  return rows.map((row) => toCardData(row, authors));
}

/** The pinned Announcement's card data, if there is one. */
export async function getPinnedAnnouncementCard(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<AnnouncementCardData | undefined> {
  const pinned = await getPinnedAnnouncement(warWeek, dbOrTx);
  if (!pinned) return undefined;
  return toCardData(
    pinned,
    await loadAuthors(warWeek.id, [pinned.authorEmail], dbOrTx),
  );
}

/**
 * A War Week's Announcements for the admin list: each row keeps its author's
 * email (for the edit check) and adds the display name to show.
 */
export async function getAdminAnnouncementRows(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<(Announcement & { authorName: string })[]> {
  const rows = await getAnnouncements(warWeek, dbOrTx);
  const { participants, profiles } = await loadAuthors(
    warWeek.id,
    rows.map((r) => r.authorEmail),
    dbOrTx,
  );
  return rows.map((row) => ({
    ...row,
    authorName: announcementAuthorName(row.authorEmail, participants, profiles),
  }));
}
