import { and, asc, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type FaqItem,
  type ScheduleItem,
  type WarWeek,
  competition,
  day,
  faqItem,
  scheduleItem,
} from "@/db/schema";
import { isUuid } from "@/lib/uuid";

/** A War Week's Competitions by name, for the Schedule Item form's picker. */
export async function getCompetitionOptions(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<{ id: string; name: string }[]> {
  return dbOrTx
    .select({ id: competition.id, name: competition.name })
    .from(competition)
    .where(eq(competition.warWeekId, warWeek.id))
    .orderBy(asc(competition.name));
}

/** One Schedule Item of a War Week, for the edit form. */
export async function getScheduleItemForEdit(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<ScheduleItem | undefined> {
  if (!isUuid(id)) return undefined;
  const [found] = await dbOrTx
    .select({ item: scheduleItem })
    .from(scheduleItem)
    .innerJoin(day, eq(day.id, scheduleItem.dayId))
    .where(and(eq(scheduleItem.id, id), eq(day.warWeekId, warWeek.id)))
    .limit(1);
  return found?.item;
}

/** One FAQ Item of a War Week, for the edit form. */
export async function getFaqItemForEdit(
  warWeek: Pick<WarWeek, "id">,
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<FaqItem | undefined> {
  if (!isUuid(id)) return undefined;
  const [found] = await dbOrTx
    .select()
    .from(faqItem)
    .where(and(eq(faqItem.id, id), eq(faqItem.warWeekId, warWeek.id)))
    .limit(1);
  return found;
}
