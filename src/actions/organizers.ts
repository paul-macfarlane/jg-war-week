"use server";

import { revalidatePath } from "next/cache";

import { guarded } from "@/actions/result";
import { authorizeOrganizerList } from "@/auth/authorize";
import { JG_EMAIL_MESSAGE, jgEmailSchema } from "@/lib/jg-email";
import * as mutations from "@/mutations/organizers";
import type { MutationResult } from "@/mutations/types";

export type OrganizerActionResult = MutationResult;

// The Organizer list decides `/admin` and the Admin link on every page.
function revalidateSite() {
  revalidatePath("/", "layout");
}

/** Adds a JG email to the global Organizer list. Organizers only. */
export async function addOrganizer(
  email: string,
): Promise<OrganizerActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("organizers.add");
    if (!authorized.ok) return authorized;
    const parsed = jgEmailSchema.safeParse(email);
    if (!parsed.success) return { ok: false, error: JG_EMAIL_MESSAGE };
    const result = await mutations.addOrganizer(
      parsed.data,
      authorized.actor.email,
    );
    if (result.ok) revalidateSite();
    return result;
  });
}

/**
 * Removes an Organizer, yourself included while another remains; the last
 * one can't be removed. Organizers only.
 */
export async function removeOrganizer(
  email: string,
): Promise<OrganizerActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("organizers.remove");
    if (!authorized.ok) return authorized;
    const parsed = jgEmailSchema.safeParse(email);
    if (!parsed.success) return { ok: false, error: JG_EMAIL_MESSAGE };
    const result = await mutations.removeOrganizer(
      parsed.data,
      authorized.actor.email,
    );
    if (result.ok) revalidateSite();
    return result;
  });
}
