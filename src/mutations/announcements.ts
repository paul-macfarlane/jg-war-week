import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { announcement } from "@/db/schema";
import type { AnnouncementValues } from "@/lib/announcements";
import type { MutationContext, MutationResult } from "@/mutations/types";

const NOT_FOUND = "That Announcement no longer exists.";

/** Only Announcements of this War Week, by id. */
function inWarWeek(id: string, warWeekId: string) {
  return and(eq(announcement.id, id), eq(announcement.warWeekId, warWeekId));
}

export async function createAnnouncement(
  values: AnnouncementValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  await dbOrTx.insert(announcement).values({
    warWeekId: ctx.warWeekId,
    title: values.title,
    body: values.body,
    pinned: values.pinned,
    authorEmail: ctx.actorEmail,
  });
  return { ok: true };
}

/**
 * Edits an Announcement of this War Week. Its author and published-at stay
 * as they were; `updated_at` records the edit.
 */
export async function updateAnnouncement(
  id: string,
  values: AnnouncementValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const updated = await dbOrTx
    .update(announcement)
    .set({
      title: values.title,
      body: values.body,
      pinned: values.pinned,
      updatedAt: sql`now()`,
    })
    .where(inWarWeek(id, ctx.warWeekId))
    .returning({ id: announcement.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}

export async function deleteAnnouncement(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const deleted = await dbOrTx
    .delete(announcement)
    .where(inWarWeek(id, ctx.warWeekId))
    .returning({ id: announcement.id });
  return deleted.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}

export async function setAnnouncementPinned(
  id: string,
  pinned: boolean,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const updated = await dbOrTx
    .update(announcement)
    .set({ pinned, updatedAt: sql`now()` })
    .where(inWarWeek(id, ctx.warWeekId))
    .returning({ id: announcement.id });
  return updated.length > 0 ? { ok: true } : { ok: false, error: NOT_FOUND };
}
