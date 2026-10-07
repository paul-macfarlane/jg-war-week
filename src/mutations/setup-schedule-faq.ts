import { and, asc, eq, inArray, max, ne, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  day,
  faqItem,
  participant,
  scheduleItem,
  scheduleItemHost,
} from "@/db/schema";
import {
  type FaqItemValues,
  type ScheduleItemValues,
  duplicateFaqItemError,
  duplicateScheduleItemError,
  faqItemGuardError,
  moveInOrder,
  scheduleItemGuardError,
} from "@/lib/setup-schedule-faq";
import { locked, refusingDuplicate } from "@/mutations/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";

const SCHEDULE_ITEM_NOT_FOUND = "That Schedule Item no longer exists.";
const FAQ_ITEM_NOT_FOUND = "That FAQ Item no longer exists.";
const HOST_NOT_ON_ROSTER = "A Host must be on this War Week's roster.";

/** The War Week's Days, as a subquery for "an item of this War Week". */
function warWeekDayIds(warWeekId: string, dbOrTx: DBOrTx) {
  return dbOrTx
    .select({ id: day.id })
    .from(day)
    .where(eq(day.warWeekId, warWeekId));
}

/** Checks an item's Day, Competition and natural key against the War Week. */
async function scheduleItemRefusal(
  values: ScheduleItemValues,
  ctx: MutationContext,
  tx: DBOrTx,
  exceptItemId?: string,
): Promise<string | null> {
  const days = await warWeekDayIds(ctx.warWeekId, tx);
  const competitions = await tx
    .select({ id: competition.id })
    .from(competition)
    .where(eq(competition.warWeekId, ctx.warWeekId));
  const otherItems = await tx
    .select({
      dayId: scheduleItem.dayId,
      startTime: scheduleItem.startTime,
      title: scheduleItem.title,
    })
    .from(scheduleItem)
    .where(
      and(
        eq(scheduleItem.dayId, values.dayId),
        exceptItemId ? ne(scheduleItem.id, exceptItemId) : undefined,
      ),
    );
  const guard = scheduleItemGuardError(values, {
    dayIds: days.map((row) => row.id),
    competitionIds: competitions.map((row) => row.id),
    otherItems,
  });
  if (guard) return guard;
  return (await hostsOnRoster(hostsToSave(values), ctx, tx))
    ? null
    : HOST_NOT_ON_ROSTER;
}

/**
 * The Hosts an item saves with: the posted ones, deduplicated, or none when
 * it links a Competition (it shows the Competition's Hosts; the form hides
 * the field, so posted ones are discarded, not refused).
 */
function hostsToSave(
  values: Pick<ScheduleItemValues, "hostIds" | "competitionId">,
): string[] {
  return values.competitionId === null ? [...new Set(values.hostIds)] : [];
}

/** Whether every one of `hostIds` is on the War Week's roster. */
async function hostsOnRoster(
  hostIds: string[],
  ctx: MutationContext,
  tx: DBOrTx,
): Promise<boolean> {
  if (hostIds.length === 0) return true;
  const onRoster = await tx
    .select({ id: participant.id })
    .from(participant)
    .where(
      and(
        eq(participant.warWeekId, ctx.warWeekId),
        inArray(participant.id, hostIds),
      ),
    );
  return onRoster.length === hostIds.length;
}

/**
 * Replaces an item's Hosts with those it saves with: deletes its
 * `schedule_item_host` rows, then inserts the new ones (none with a
 * Competition, so linking one clears them).
 */
async function replaceHosts(
  scheduleItemId: string,
  values: Pick<ScheduleItemValues, "hostIds" | "competitionId">,
  tx: DBOrTx,
): Promise<void> {
  await tx
    .delete(scheduleItemHost)
    .where(eq(scheduleItemHost.scheduleItemId, scheduleItemId));
  const hostIds = hostsToSave(values);
  if (hostIds.length > 0) {
    await tx
      .insert(scheduleItemHost)
      .values(
        hostIds.map((participantId) => ({ scheduleItemId, participantId })),
      );
  }
}

export async function createScheduleItem(
  values: ScheduleItemValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateScheduleItemError(values), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      // `deleteDay` takes the same lock, so the Day can't go meanwhile.
      await locked(day, values.dayId, ctx, tx);
      const refusal = await scheduleItemRefusal(values, ctx, tx);
      if (refusal) return { ok: false, error: refusal };
      const { hostIds, ...columns } = values;
      const [created] = await tx
        .insert(scheduleItem)
        .values(columns)
        .returning({ id: scheduleItem.id });
      await replaceHosts(created.id, { ...columns, hostIds }, tx);
      return { ok: true };
    }),
  );
}

/** Edits a Schedule Item of this War Week; it may move to another Day. */
export async function updateScheduleItem(
  id: string,
  values: ScheduleItemValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateScheduleItemError(values), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      // `deleteDay` takes the same lock, so the target Day can't go meanwhile.
      await locked(day, values.dayId, ctx, tx);
      const refusal = await scheduleItemRefusal(values, ctx, tx, id);
      if (refusal) return { ok: false, error: refusal };
      const { hostIds, ...columns } = values;
      const updated = await tx
        .update(scheduleItem)
        .set({ ...columns, updatedAt: sql`now()` })
        .where(
          and(
            eq(scheduleItem.id, id),
            inArray(scheduleItem.dayId, warWeekDayIds(ctx.warWeekId, tx)),
          ),
        )
        .returning({ id: scheduleItem.id });
      if (updated.length === 0) {
        return { ok: false, error: SCHEDULE_ITEM_NOT_FOUND };
      }
      await replaceHosts(id, { ...columns, hostIds }, tx);
      return { ok: true };
    }),
  );
}

export async function deleteScheduleItem(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const deleted = await dbOrTx
    .delete(scheduleItem)
    .where(
      and(
        eq(scheduleItem.id, id),
        inArray(scheduleItem.dayId, warWeekDayIds(ctx.warWeekId, dbOrTx)),
      ),
    )
    .returning({ id: scheduleItem.id });
  return deleted.length > 0
    ? { ok: true }
    : { ok: false, error: SCHEDULE_ITEM_NOT_FOUND };
}

async function otherQuestions(
  warWeekId: string,
  tx: DBOrTx,
  exceptItemId?: string,
): Promise<string[]> {
  const rows = await tx
    .select({ question: faqItem.question })
    .from(faqItem)
    .where(
      and(
        eq(faqItem.warWeekId, warWeekId),
        exceptItemId ? ne(faqItem.id, exceptItemId) : undefined,
      ),
    );
  return rows.map((row) => row.question);
}

/** Adds an FAQ Item at the end of the War Week's FAQ. */
export async function createFaqItem(
  values: FaqItemValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateFaqItemError(values.question), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = faqItemGuardError(
        values.question,
        await otherQuestions(ctx.warWeekId, tx),
      );
      if (refusal) return { ok: false, error: refusal };
      // Unlocked on purpose: two creates at once can share a `sortOrder`,
      // which only ties their display order, and any move renumbers the
      // list.
      const [last] = await tx
        .select({ sortOrder: max(faqItem.sortOrder) })
        .from(faqItem)
        .where(eq(faqItem.warWeekId, ctx.warWeekId));
      await tx.insert(faqItem).values({
        warWeekId: ctx.warWeekId,
        ...values,
        sortOrder: (last?.sortOrder ?? -1) + 1,
      });
      return { ok: true };
    }),
  );
}

export async function updateFaqItem(
  id: string,
  values: FaqItemValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(duplicateFaqItemError(values.question), () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = faqItemGuardError(
        values.question,
        await otherQuestions(ctx.warWeekId, tx, id),
      );
      if (refusal) return { ok: false, error: refusal };
      const updated = await tx
        .update(faqItem)
        .set({ ...values, updatedAt: sql`now()` })
        .where(and(eq(faqItem.id, id), eq(faqItem.warWeekId, ctx.warWeekId)))
        .returning({ id: faqItem.id });
      return updated.length > 0
        ? { ok: true }
        : { ok: false, error: FAQ_ITEM_NOT_FOUND };
    }),
  );
}

export async function deleteFaqItem(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const deleted = await dbOrTx
    .delete(faqItem)
    .where(and(eq(faqItem.id, id), eq(faqItem.warWeekId, ctx.warWeekId)))
    .returning({ id: faqItem.id });
  return deleted.length > 0
    ? { ok: true }
    : { ok: false, error: FAQ_ITEM_NOT_FOUND };
}

/**
 * Moves an FAQ Item one place up or down, renumbering the War Week's FAQ
 * 0, 1, 2… in the new order. At either end it's a no-op.
 */
export async function moveFaqItem(
  id: string,
  direction: "up" | "down",
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const rows = await tx
      .select({ id: faqItem.id })
      .from(faqItem)
      .where(eq(faqItem.warWeekId, ctx.warWeekId))
      .orderBy(asc(faqItem.sortOrder), asc(faqItem.id));
    const ids = rows.map((row) => row.id);
    if (!ids.includes(id)) return { ok: false, error: FAQ_ITEM_NOT_FOUND };

    const order = moveInOrder(ids, id, direction);
    if (!order) return { ok: true };
    for (const [sortOrder, itemId] of order.entries()) {
      await tx
        .update(faqItem)
        .set({ sortOrder, updatedAt: sql`now()` })
        .where(eq(faqItem.id, itemId));
    }
    return { ok: true };
  });
}
