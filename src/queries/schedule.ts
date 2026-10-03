import { and, eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import { competition, day, scheduleItem } from "@/db/schema";
import { type ScheduleDay, groupSchedule } from "@/lib/schedule";

/**
 * Loads a War Week's schedule, grouped and ordered by `groupSchedule`:
 * every Day, or only the Day on `date` (`YYYY-MM-DD`) when one is given.
 */
export async function getSchedule(
  warWeekId: string,
  { date }: { date?: string } = {},
  dbOrTx: DBOrTx = db,
): Promise<ScheduleDay[]> {
  const dayFilter = and(
    eq(day.warWeekId, warWeekId),
    date === undefined ? undefined : eq(day.date, date),
  );

  const [days, rows] = await Promise.all([
    dbOrTx
      .select({
        id: day.id,
        date: day.date,
        dayTheme: day.dayTheme,
        description: day.description,
      })
      .from(day)
      .where(dayFilter),
    dbOrTx
      .select({
        item: scheduleItem,
        competitionName: competition.name,
      })
      .from(scheduleItem)
      .innerJoin(day, eq(day.id, scheduleItem.dayId))
      .leftJoin(competition, eq(competition.id, scheduleItem.competitionId))
      .where(dayFilter),
  ]);

  return groupSchedule(
    days,
    rows.map(({ item, competitionName }) => ({
      dayId: item.dayId,
      entry: {
        id: item.id,
        startTime: item.startTime,
        endTime: item.endTime,
        title: item.title,
        host: item.host,
        location: item.location,
        virtualLink: item.virtualLink,
        description: item.description,
        category: item.category,
        competition:
          item.competitionId && competitionName
            ? { id: item.competitionId, name: competitionName }
            : null,
      },
    })),
  );
}
