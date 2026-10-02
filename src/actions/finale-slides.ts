"use server";

import { z } from "zod";

import { guarded } from "@/actions/result";
import { revalidateWarWeek } from "@/actions/revalidate";
import { authorize } from "@/auth/authorize";
import {
  BUILT_IN_FINALE_SLIDE_KINDS,
  type FinaleSlideRef,
} from "@/lib/finale-slides";
import type { WriteResult } from "@/lib/result";
import * as mutations from "@/mutations/finale-slides";

const SLIDE_NOT_FOUND = "That Finale slide no longer exists.";

/** A built-in by kind, or a Custom slide by id. */
const slideRefSchema = z.union([
  z.strictObject({ kind: z.enum(BUILT_IN_FINALE_SLIDE_KINDS) }),
  z.strictObject({ id: z.uuid() }),
]);

const moveSchema = z.object({
  slide: slideRefSchema,
  toIndex: z.number().int().min(0),
});

const hideSchema = z.object({
  slide: slideRefSchema,
  hidden: z.boolean(),
});

/** The refusal for an input that doesn't parse: the slide first. */
function refusal(
  input: unknown,
  invalid: string,
): { ok: false; error: string } {
  const slide = (input as { slide?: unknown } | null)?.slide;
  return {
    ok: false,
    error: slideRefSchema.safeParse(slide).success ? invalid : SLIDE_NOT_FOUND,
  };
}

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
    const parsed = moveSchema.safeParse(input);
    if (!parsed.success) {
      return refusal(input, "Move a Finale slide to a place in the list.");
    }

    const result = await mutations.moveFinaleSlide(
      parsed.data.slide,
      parsed.data.toIndex,
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
    const parsed = hideSchema.safeParse(input);
    if (!parsed.success) {
      return refusal(input, "Hide or show a Finale slide.");
    }

    const result = await mutations.setFinaleSlideHidden(
      parsed.data.slide,
      parsed.data.hidden,
      authorized.ctx,
    );
    if (result.ok) revalidateWarWeek(authorized.warWeek.edition);
    return result;
  });
}
