import { and, eq, inArray, isNotNull, max } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type WarWeek,
  competition,
  day,
  entrant,
  heat,
  heatEntrant,
  participant,
  scheduleItem,
  squad,
  team,
} from "@/db/schema";
import type { TimedHeatRow } from "@/lib/bracket/now-next";
import { BRACKET_FORMATS } from "@/lib/bracket/view";
import { type ScheduleDay, groupSchedule } from "@/lib/schedule";
import { participantNameSql, withProfile } from "@/queries/profile-join";

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
      .select({ id: day.id, date: day.date, dayTheme: day.dayTheme })
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

/**
 * A War Week's timed Heats that are ready to play (a Day, a start time,
 * every slot filled and no Heat Result), for Now/Next: three light selects,
 * never a whole Bracket per Competition (the home page refreshes often).
 */
export async function getTimedHeats(
  warWeek: Pick<WarWeek, "id">,
  dbOrTx: DBOrTx = db,
): Promise<TimedHeatRow[]> {
  const heats = await dbOrTx
    .select({
      id: heat.id,
      round: heat.round,
      position: heat.position,
      status: heat.status,
      slotCount: heat.slotCount,
      dayId: heat.dayId,
      startTime: heat.startTime,
      location: heat.location,
      competitionId: competition.id,
      competitionName: competition.name,
      format: competition.format,
    })
    .from(heat)
    .innerJoin(competition, eq(competition.id, heat.competitionId))
    .where(
      and(
        eq(competition.warWeekId, warWeek.id),
        // Only a Bracket has Heats; kept exact for the `games` Format.
        inArray(competition.format, BRACKET_FORMATS),
        eq(heat.status, "ready"),
        isNotNull(heat.dayId),
        isNotNull(heat.startTime),
      ),
    );
  if (heats.length === 0) return [];

  const competitionIds = [...new Set(heats.map((h) => h.competitionId))];
  const [finalRounds, slots] = await Promise.all([
    dbOrTx
      .select({
        competitionId: heat.competitionId,
        finalRound: max(heat.round),
      })
      .from(heat)
      .where(inArray(heat.competitionId, competitionIds))
      .groupBy(heat.competitionId),
    withProfile(
      dbOrTx
        .select({
          heatId: heatEntrant.heatId,
          slot: heatEntrant.slot,
          entrantId: heatEntrant.entrantId,
          teamName: team.name,
          participantName: participantNameSql(),
          squadName: squad.name,
        })
        .from(heatEntrant)
        .innerJoin(entrant, eq(entrant.id, heatEntrant.entrantId))
        .leftJoin(team, eq(team.id, entrant.teamId))
        .leftJoin(participant, eq(participant.id, entrant.participantId))
        .leftJoin(squad, eq(squad.id, entrant.squadId))
        .$dynamic(),
    ).where(
      inArray(
        heatEntrant.heatId,
        heats.map((h) => h.id),
      ),
    ),
  ]);

  return heats.map((row) => {
    const own = slots.filter((s) => s.heatId === row.id);
    return {
      competition: {
        id: row.competitionId,
        name: row.competitionName,
        format: row.format,
      },
      finalRound:
        finalRounds.find((r) => r.competitionId === row.competitionId)
          ?.finalRound ?? row.round,
      heat: {
        id: row.id,
        round: row.round,
        position: row.position,
        status: row.status,
        dayId: row.dayId,
        startTime: row.startTime,
        location: row.location,
        slots: Array.from({ length: row.slotCount }, (_, slot) => ({
          entrantId: own.find((s) => s.slot === slot)?.entrantId ?? null,
          place: null,
          score: null,
          forfeited: false,
        })),
      },
      labels: Object.fromEntries(
        own.map((s) => [
          s.entrantId,
          s.teamName ?? s.participantName ?? s.squadName ?? "Unknown",
        ]),
      ),
    };
  });
}
