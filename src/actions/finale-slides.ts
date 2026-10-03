"use server";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import {
  type CustomSlideInput,
  parseCustomSlideInput,
} from "@/lib/custom-finale-slide";
import type { FinaleAwardsLayout } from "@/lib/enums";
import {
  type FinaleSlideRef,
  parseFinaleAwardsLayout,
  parseFinaleSlideHidden,
  parseFinaleSlideMove,
} from "@/lib/finale-slides";
import type { WriteResult } from "@/lib/result";
import * as mutations from "@/mutations/finale-slides";

/**
 * Moves a Finale slide to `toIndex` in the War Week's list (Organizer only;
 * the list's Move up/down buttons and its drag send it).
 */
export async function moveFinaleSlide(
  warWeekId: string,
  input: { slide: FinaleSlideRef; toIndex: number },
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale-slide.move",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseFinaleSlideMove(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.moveFinaleSlide(
      parsed.value.slide,
      parsed.value.toIndex,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Hides a Finale slide from the Finale, or shows it again (Organizer only). */
export async function setFinaleSlideHidden(
  warWeekId: string,
  input: { slide: FinaleSlideRef; hidden: boolean },
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale-slide.hide",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseFinaleSlideHidden(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.setFinaleSlideHidden(
      parsed.value.slide,
      parsed.value.hidden,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Adds a Custom slide to the War Week the form was rendered for (Organizer only). */
export async function createCustomFinaleSlide(
  warWeekId: string,
  input: CustomSlideInput,
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale-slide.create",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseCustomSlideInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.createCustomFinaleSlide(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Changes a Custom slide (Organizer only). */
export async function updateCustomFinaleSlide(
  id: string,
  input: CustomSlideInput,
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale-slide.update",
      "finaleSlide",
      id,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseCustomSlideInput(input);
    if (!parsed.ok) return parsed;

    const result = await mutations.updateCustomFinaleSlide(
      id,
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/** Deletes a Custom slide (Organizer only); a built-in is hidden, not deleted. */
export async function deleteCustomFinaleSlide(
  id: string,
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale-slide.delete",
      "finaleSlide",
      id,
    );
    if (!authorized.ok) return authorized;

    const result = await mutations.deleteCustomFinaleSlide(id, authorized.ctx);
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}

/**
 * How the Finale shows Awards: "one-slide" or "per-category" (Organizer
 * only; admin → Finale's Awards layout saves it on change).
 */
export async function setFinaleAwardsLayout(
  warWeekId: string,
  layout: FinaleAwardsLayout,
): Promise<WriteResult> {
  return guarded(async () => {
    const authorized = await authorize(
      "finale.awards-layout",
      "warWeek",
      warWeekId,
    );
    if (!authorized.ok) return authorized;
    const parsed = parseFinaleAwardsLayout(layout);
    if (!parsed.ok) return parsed;

    const result = await mutations.setFinaleAwardsLayout(
      parsed.value,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
