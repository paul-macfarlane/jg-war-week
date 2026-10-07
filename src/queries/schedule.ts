import { and, asc, eq, inArray } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  competition,
  competitionHost,
  day,
  participant,
  scheduleItem,
  scheduleItemHost,
  team,
} from "@/db/schema";
import {
  type ScheduleDay,
  type ScheduleHost,
  groupSchedule,
} from "@/lib/schedule";
import {
  participantImageSql,
  participantNameSql,
  withProfile,
} from "@/queries/profile-join";

/** A Host as the Schedule shows one: by name and Avatar, never an email. */
const hostColumns = {
  id: participant.id,
  displayName: participantNameSql(),
  image: participantImageSql(),
  teamColor: team.color,
};

/** Groups host rows by `key`, each list in name order. */
function byKey<K extends string>(
  rows: (ScheduleHost & Record<K, string>)[],
  key: K,
): Map<string, ScheduleHost[]> {
  const grouped = new Map<string, ScheduleHost[]>();
  for (const row of rows) {
    const { id, displayName, image, teamColor } = row;
    const list = grouped.get(row[key]) ?? [];
    list.push({ id, displayName, image, teamColor });
    grouped.set(row[key], list);
  }
  return grouped;
}

/**
 * Loads a War Week's schedule, grouped and ordered by `groupSchedule`:
 * every Day, or only the Day on `date` (`YYYY-MM-DD`) when one is given.
 * Each item carries the Hosts it shows: its own, or its linked
 * Competition's.
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

  const [days, rows, itemHosts, competitionHosts] = await Promise.all([
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
    withProfile(
      dbOrTx
        .select({
          ...hostColumns,
          scheduleItemId: scheduleItemHost.scheduleItemId,
        })
        .from(scheduleItemHost)
        .innerJoin(
          participant,
          eq(participant.id, scheduleItemHost.participantId),
        )
        .leftJoin(team, eq(team.id, participant.teamId))
        .$dynamic(),
    )
      .where(
        inArray(
          scheduleItemHost.scheduleItemId,
          dbOrTx
            .select({ id: scheduleItem.id })
            .from(scheduleItem)
            .innerJoin(day, eq(day.id, scheduleItem.dayId))
            .where(dayFilter),
        ),
      )
      .orderBy(asc(participantNameSql())),
    withProfile(
      dbOrTx
        .select({
          ...hostColumns,
          competitionId: competitionHost.competitionId,
        })
        .from(competitionHost)
        .innerJoin(
          competition,
          eq(competition.id, competitionHost.competitionId),
        )
        .innerJoin(
          participant,
          eq(participant.id, competitionHost.participantId),
        )
        .leftJoin(team, eq(team.id, participant.teamId))
        .$dynamic(),
    )
      .where(eq(competition.warWeekId, warWeekId))
      .orderBy(asc(participantNameSql())),
  ]);

  const hostsOfItem = byKey(itemHosts, "scheduleItemId");
  const hostsOfCompetition = byKey(competitionHosts, "competitionId");

  return groupSchedule(
    days,
    rows.map(({ item, competitionName }) => ({
      dayId: item.dayId,
      entry: {
        id: item.id,
        startTime: item.startTime,
        endTime: item.endTime,
        title: item.title,
        location: item.location,
        virtualLink: item.virtualLink,
        description: item.description,
        category: item.category,
        competition:
          item.competitionId && competitionName
            ? { id: item.competitionId, name: competitionName }
            : null,
        hosts:
          (item.competitionId
            ? hostsOfCompetition.get(item.competitionId)
            : hostsOfItem.get(item.id)) ?? [],
      },
    })),
  );
}

/**
 * Each Schedule Item's own Hosts (Participant ids) in a War Week, by item
 * id, for the Schedule Item form's Hosts picker. Ids only, no names or
 * emails.
 */
export async function getScheduleItemHostIds(
  warWeekId: string,
  dbOrTx: DBOrTx = db,
): Promise<Map<string, string[]>> {
  const rows = await dbOrTx
    .select({
      scheduleItemId: scheduleItemHost.scheduleItemId,
      participantId: scheduleItemHost.participantId,
    })
    .from(scheduleItemHost)
    .innerJoin(
      scheduleItem,
      eq(scheduleItem.id, scheduleItemHost.scheduleItemId),
    )
    .innerJoin(day, eq(day.id, scheduleItem.dayId))
    .where(eq(day.warWeekId, warWeekId));
  const grouped = new Map<string, string[]>();
  for (const { scheduleItemId, participantId } of rows) {
    grouped.set(scheduleItemId, [
      ...(grouped.get(scheduleItemId) ?? []),
      participantId,
    ]);
  }
  return grouped;
}
