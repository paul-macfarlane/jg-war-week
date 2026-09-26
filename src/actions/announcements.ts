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
 * the Announcement is pinned is checked as a pin or unpin too.
 */
function pinRefusal(
  authorized: Authorized,
  input: unknown,
  pinnedNow: boolean,
): string | null {
  const posted =
    typeof input === "object" && input !== null
      ? (input as { pinned?: unknown }).pinned
      : undefined;
  if (typeof posted !== "boolean" || posted === pinnedNow) return null;
  return can(
    authorized.actor,
    posted ? "announcement.pin" : "announcement.unpin",
    {
      warWeekId: authorized.warWeek.id,
    },
  );
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
    const refusal = pinRefusal(authorized, input, false);
    if (refusal) return { ok: false, error: refusal };
    const parsed = parseAnnouncementInput(input);
    if (!parsed.ok) return parsed;

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
    const refusal = pinRefusal(
      authorized,
      input,
      authorized.target.pinned ?? false,
    );
    if (refusal) return { ok: false, error: refusal };
    const parsed = parseAnnouncementInput(input);
    if (!parsed.ok) return parsed;

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
