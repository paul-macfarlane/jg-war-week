"use server";

import { revalidatePath } from "next/cache";

import { guarded } from "@/actions/result";
import { type Authorized, authorize } from "@/auth/authorize";
import { can } from "@/lib/access";
import {
  type AnnouncementInput,
  parseAnnouncementInput,
} from "@/lib/announcements";
import * as mutations from "@/mutations/announcements";

export type AnnouncementActionResult =
  { ok: true } | { ok: false; error: string };

function revalidateWarWeek(edition: string) {
  revalidatePath("/admin", "layout");
  revalidatePath(`/${edition}`, "layout");
}

/**
 * Pinning is Organizer-only, so a create or edit that would change whether
 * the Announcement is pinned is checked as a pin or unpin too, against the
 * parsed value that will be written.
 */
function pinRefusal(
  authorized: Authorized,
  pinned: boolean,
  pinnedNow: boolean,
): string | null {
  if (pinned === pinnedNow) return null;
  return can(
    authorized.actor,
    pinned ? "announcement.pin" : "announcement.unpin",
    {
      warWeekId: authorized.warWeek.id,
    },
  );
}

/**
 * An edit that doesn't post `pinned` leaves it as it is: the current value
 * is carried into the input before parsing, so the parser's default
 * (`false`) never unpins it.
 */
function withCurrentPin(input: unknown, pinnedNow: boolean): unknown {
  if (typeof input !== "object" || input === null) return input;
  const posted = (input as { pinned?: unknown }).pinned;
  return posted === undefined ? { ...input, pinned: pinnedNow } : input;
}

/** Posts an Announcement to the War Week the form was rendered for. */
export async function createAnnouncement(
  warWeekId: string,
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "announcement.create",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseAnnouncementInput(input);
    if (!parsed.ok) return parsed;
    const refusal = pinRefusal(authorized, parsed.value.pinned, false);
    if (refusal) return { ok: false, error: refusal };

    const result = await mutations.createAnnouncement(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function updateAnnouncement(
  id: string,
  input: AnnouncementInput,
): Promise<AnnouncementActionResult> {
  return guarded(async () => {
    const authorized = await authorize("announcement.edit", "announcement", id);
    if (!authorized.ok) return authorized;
    const pinnedNow = authorized.target.pinned ?? false;
    const parsed = parseAnnouncementInput(
      withCurrentPin(input, pinnedNow) as AnnouncementInput,
    );
    if (!parsed.ok) return parsed;
    const refusal = pinRefusal(authorized, parsed.value.pinned, pinnedNow);
    if (refusal) return { ok: false, error: refusal };

    const result = await mutations.updateAnnouncement(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

export async function deleteAnnouncement(
  id: string,
): Promise<AnnouncementActionResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "announcement.delete",
      "announcement",
      id,
    );
    if (!authorized.ok) return authorized;

    const result = await mutations.deleteAnnouncement(id, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

async function setPinned(
  id: string,
  pinned: boolean,
): Promise<AnnouncementActionResult> {
  const authorized = await authorize(
    pinned ? "announcement.pin" : "announcement.unpin",
    "announcement",
    id,
  );
  if (!authorized.ok) return authorized;

  const result = await mutations.setAnnouncementPinned(
    id,
    pinned,
    authorized.ctx,
  );
  if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
  return result;
}

export async function pinAnnouncement(
  id: string,
): Promise<AnnouncementActionResult> {
  return guarded(async () => {
    return setPinned(id, true);
  });
}

export async function unpinAnnouncement(
  id: string,
): Promise<AnnouncementActionResult> {
  return guarded(async () => {
    return setPinned(id, false);
  });
}
