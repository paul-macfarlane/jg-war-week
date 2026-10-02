import { and, eq, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { finaleSlide, warWeek } from "@/db/schema";
import {
  customSlideHeadingError,
  customSlidePlacement,
  duplicateCustomSlideError,
} from "@/lib/custom-finale-slide";
import type { CustomSlideValues } from "@/lib/custom-finale-slide-input";
import {
  type FinaleSlideRef,
  type ResolvedFinaleSlide,
  isFinaleSlide,
  moveToIndex,
  resolveFinaleSlides,
} from "@/lib/finale-slides";
import { refusingDuplicate } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getFinaleSlideRows } from "@/queries/finale-slides";

const SLIDE_NOT_FOUND = "That Finale slide no longer exists.";
const WAR_WEEK_NOT_FOUND = "That War Week no longer exists.";

type Saved = ResolvedFinaleSlide & { id: string };

/**
 * Every Finale slide change starts here, inside its transaction: locks the
 * War Week row (so two changes to one list run one after the other), then
 * saves the resolved list's unsaved built-ins (the default list on a War
 * Week's first change, or a built-in missing from its rows) and returns the
 * whole list, every slide saved. Null when the War Week is gone.
 */
async function lockedList(
  ctx: MutationContext,
  tx: DBOrTx,
): Promise<Saved[] | null> {
  const [found] = await tx
    .select({ id: warWeek.id })
    .from(warWeek)
    .where(eq(warWeek.id, ctx.warWeekId))
    .for("update");
  if (!found) return null;

  const resolved = resolveFinaleSlides(
    await getFinaleSlideRows(ctx.warWeekId, tx),
  );
  const unsaved = resolved.flatMap((slide, sortOrder) =>
    slide.id === null
      ? [{ warWeekId: ctx.warWeekId, kind: slide.kind, sortOrder }]
      : [],
  );
  if (unsaved.length === 0) return resolved as Saved[];

  await tx.insert(finaleSlide).values(unsaved).onConflictDoNothing();
  return resolveFinaleSlides(
    await getFinaleSlideRows(ctx.warWeekId, tx),
  ) as Saved[];
}

/** Renumbers the list 0, 1, 2… in `ids` order, touching only moved rows. */
async function renumber(list: Saved[], ids: string[], tx: DBOrTx) {
  const current = new Map(list.map((slide, index) => [slide.id, index]));
  for (const [sortOrder, id] of ids.entries()) {
    if (current.get(id) === sortOrder) continue;
    await tx
      .update(finaleSlide)
      .set({ sortOrder, updatedAt: sql`now()` })
      .where(eq(finaleSlide.id, id));
  }
}

/**
 * Moves one slide to `toIndex` in the War Week's list (clamped to it),
 * saving the list first if it isn't yet.
 */
export async function moveFinaleSlide(
  slide: FinaleSlideRef,
  toIndex: number,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const list = await lockedList(ctx, tx);
    if (!list) return { ok: false, error: WAR_WEEK_NOT_FOUND };
    const moving = list.find((s) => isFinaleSlide(s, slide));
    if (!moving) return { ok: false, error: SLIDE_NOT_FOUND };

    const ids = list.map((s) => s.id);
    const order = moveToIndex(ids, moving.id, toIndex);
    if (order) await renumber(list, order, tx);
    return { ok: true };
  });
}

/**
 * Hides a slide from the Finale (`hidden` true) or shows it again, saving
 * the list first if it isn't yet. A hidden slide keeps its place.
 */
export async function setFinaleSlideHidden(
  slide: FinaleSlideRef,
  hidden: boolean,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const list = await lockedList(ctx, tx);
    if (!list) return { ok: false, error: WAR_WEEK_NOT_FOUND };
    const target = list.find((s) => isFinaleSlide(s, slide));
    if (!target) return { ok: false, error: SLIDE_NOT_FOUND };

    if (target.hidden !== hidden) {
      await tx
        .update(finaleSlide)
        .set({ hidden, updatedAt: sql`now()` })
        .where(eq(finaleSlide.id, target.id));
    }
    return { ok: true };
  });
}

/** The headings of the War Week's Custom slides, `exceptId`'s left out. */
function otherHeadings(list: Saved[], exceptId?: string): string[] {
  return list.flatMap((slide) =>
    slide.kind === "custom" && slide.id !== exceptId && slide.heading
      ? [slide.heading]
      : [],
  );
}

/**
 * Adds a Custom slide just before the Standings slide (even when it's
 * hidden), saving the list first if it isn't yet.
 */
export async function createCustomFinaleSlide(
  values: CustomSlideValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateCustomSlideError(values.heading), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const list = await lockedList(ctx, tx);
      if (!list) return { ok: false, error: WAR_WEEK_NOT_FOUND };
      const refusal = customSlideHeadingError(
        values.heading,
        otherHeadings(list),
      );
      if (refusal) return { ok: false, error: refusal };

      const [created] = await tx
        .insert(finaleSlide)
        .values({
          warWeekId: ctx.warWeekId,
          kind: "custom",
          sortOrder: list.length,
          ...values,
        })
        .returning({ id: finaleSlide.id });
      const ids = list.map((slide) => slide.id);
      ids.splice(
        customSlidePlacement(list.map((slide) => slide.kind)),
        0,
        created.id,
      );
      await renumber([...list, { id: created.id } as Saved], ids, tx);
      return { ok: true };
    }),
  );
}

/** Changes a Custom slide's heading, body and background in place. */
export async function updateCustomFinaleSlide(
  id: string,
  values: CustomSlideValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateCustomSlideError(values.heading), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const list = await lockedList(ctx, tx);
      if (!list) return { ok: false, error: WAR_WEEK_NOT_FOUND };
      if (!list.some((s) => isFinaleSlide(s, { id }))) {
        return { ok: false, error: SLIDE_NOT_FOUND };
      }
      const refusal = customSlideHeadingError(
        values.heading,
        otherHeadings(list, id),
      );
      if (refusal) return { ok: false, error: refusal };

      await tx
        .update(finaleSlide)
        .set({ ...values, updatedAt: sql`now()` })
        .where(
          and(eq(finaleSlide.id, id), eq(finaleSlide.warWeekId, ctx.warWeekId)),
        );
      return { ok: true };
    }),
  );
}

/** Deletes a Custom slide. A built-in is never deleted (hide it instead). */
export async function deleteCustomFinaleSlide(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const list = await lockedList(ctx, tx);
    if (!list) return { ok: false, error: WAR_WEEK_NOT_FOUND };
    if (!list.some((s) => isFinaleSlide(s, { id }))) {
      return { ok: false, error: SLIDE_NOT_FOUND };
    }
    await tx
      .delete(finaleSlide)
      .where(
        and(eq(finaleSlide.id, id), eq(finaleSlide.warWeekId, ctx.warWeekId)),
      );
    return { ok: true };
  });
}
