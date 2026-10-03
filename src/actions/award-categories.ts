"use server";

import { guarded } from "@/actions/result";
import { revalidateSite } from "@/actions/revalidate";
import { authorizeOrganizerList } from "@/auth/authorize";
import {
  AWARD_CATEGORY_NOT_FOUND,
  awardCategoryIdSchema,
  parseAwardCategoryInput,
} from "@/lib/award-categories";
import * as mutations from "@/mutations/award-categories";
import type { MutationResult } from "@/mutations/types";

export type AwardCategoryActionResult = MutationResult;

/** Adds a global Award Category. Organizers only. */
export async function createAwardCategory(
  input: unknown,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.create");
    if (!authorized.ok) return authorized;
    const parsed = parseAwardCategoryInput(input);
    if (!parsed.ok) return parsed;
    const result = await mutations.createAwardCategory(parsed.value.name);
    // Awards pages in every War Week group by Category.
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function renameAwardCategory(
  id: unknown,
  input: unknown,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.rename");
    if (!authorized.ok) return authorized;
    const parsed = parseAwardCategoryInput(input);
    if (!parsed.ok) return parsed;
    const categoryId = awardCategoryIdSchema.safeParse(id);
    if (!categoryId.success) {
      return { ok: false, error: AWARD_CATEGORY_NOT_FOUND };
    }
    const result = await mutations.renameAwardCategory(
      categoryId.data,
      parsed.value.name,
    );
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function archiveAwardCategory(
  id: unknown,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.archive");
    if (!authorized.ok) return authorized;
    const categoryId = awardCategoryIdSchema.safeParse(id);
    if (!categoryId.success) {
      return { ok: false, error: AWARD_CATEGORY_NOT_FOUND };
    }
    const result = await mutations.archiveAwardCategory(categoryId.data);
    if (result.ok) revalidateSite();
    return result;
  });
}

export async function restoreAwardCategory(
  id: unknown,
): Promise<AwardCategoryActionResult> {
  return guarded(async () => {
    const authorized = await authorizeOrganizerList("award-category.restore");
    if (!authorized.ok) return authorized;
    const categoryId = awardCategoryIdSchema.safeParse(id);
    if (!categoryId.success) {
      return { ok: false, error: AWARD_CATEGORY_NOT_FOUND };
    }
    const result = await mutations.restoreAwardCategory(categoryId.data);
    if (result.ok) revalidateSite();
    return result;
  });
}
