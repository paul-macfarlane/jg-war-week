"use server";

import { guarded } from "@/actions/result";
import { revalidateSite } from "@/actions/revalidate";
import { authorizeOrganizerList } from "@/auth/authorize";
import { parseAwardCategoryName } from "@/lib/award-categories";
import { isUuid } from "@/lib/uuid";
import * as mutations from "@/mutations/award-categories";
import type { MutationResult } from "@/mutations/types";

export type AwardCategoryActionResult = MutationResult;

const NOT_FOUND = "That Category no longer exists.";

/** Adds a global Award Category. Organizers only. */
export async function createAwardCategory(
  name: string,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.create");
    if (!authorized.ok) return authorized;
    const parsed = parseAwardCategoryName(name);
    if (!parsed.ok) return parsed;
    const result = await mutations.createAwardCategory(parsed.value);
    // Awards pages in every War Week group by Category.
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function renameAwardCategory(
  id: string,
  name: string,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.rename");
    if (!authorized.ok) return authorized;
    const parsed = parseAwardCategoryName(name);
    if (!parsed.ok) return parsed;
    if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
    const result = await mutations.renameAwardCategory(id, parsed.value);
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function archiveAwardCategory(
  id: string,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.archive");
    if (!authorized.ok) return authorized;
    if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
    const result = await mutations.archiveAwardCategory(id);
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function restoreAwardCategory(
  id: string,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.restore");
    if (!authorized.ok) return authorized;
    if (!isUuid(id)) return { ok: false, error: NOT_FOUND };
    const result = await mutations.restoreAwardCategory(id);
    if (result.ok) revalidateSite();
    return result;
  });
}
