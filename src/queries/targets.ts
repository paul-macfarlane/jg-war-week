import { eq } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  announcement,
  award,
  competition,
  day,
  faqItem,
  participant,
  pointsEntry,
  scheduleItem,
  team,
  warWeek,
} from "@/db/schema";

/**
 * The War Week an action writes to, as the access check and revalidation
 * need it.
 */
export type TargetWarWeek = {
  id: string;
  edition: string;
  status: "upcoming" | "live" | "complete";
  /** What the lifecycle status rules (`lifecycleActionError`) compare. */
  editionNumber: number;
  startDate: string;
};

/** A row an action changes: its War Week and what `can` checks on it. */
export type LoadedTarget = {
  warWeek: TargetWarWeek;
  /** The row's current Competition (null for an unlinked Schedule Item). */
  competitionId?: string | null;
  /** An Announcement's author. */
  authorEmail?: string;
  /** Whether an Announcement is pinned now. */
  pinned?: boolean;
};

const warWeekColumns = {
  id: warWeek.id,
  edition: warWeek.edition,
  status: warWeek.status,
  editionNumber: warWeek.editionNumber,
  startDate: warWeek.startDate,
};

/*
 * Each loader takes an id already checked to be a uuid and returns the
 * row's War Week (and what `can` needs), or undefined when there's no row.
 */

export async function loadWarWeekTarget(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select(warWeekColumns)
    .from(warWeek)
    .where(eq(warWeek.id, id))
    .limit(1);
  return found && { warWeek: found };
}

/** Rows that belong to a War Week directly, with no Competition. */
async function warWeekRow(
  table:
    | typeof day
    | typeof team
    | typeof participant
    | typeof faqItem
    | typeof award,
  id: string,
  dbOrTx: DBOrTx,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select(warWeekColumns)
    .from(table)
    .innerJoin(warWeek, eq(warWeek.id, table.warWeekId))
    .where(eq(table.id, id))
    .limit(1);
  return found && { warWeek: found };
}

export const loadDayTarget = (id: string, dbOrTx: DBOrTx = db) =>
  warWeekRow(day, id, dbOrTx);
export const loadTeamTarget = (id: string, dbOrTx: DBOrTx = db) =>
  warWeekRow(team, id, dbOrTx);
export const loadParticipantTarget = (id: string, dbOrTx: DBOrTx = db) =>
  warWeekRow(participant, id, dbOrTx);
export const loadFaqItemTarget = (id: string, dbOrTx: DBOrTx = db) =>
  warWeekRow(faqItem, id, dbOrTx);
export const loadAwardTarget = (id: string, dbOrTx: DBOrTx = db) =>
  warWeekRow(award, id, dbOrTx);

export async function loadCompetitionTarget(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select({ warWeek: warWeekColumns, competitionId: competition.id })
    .from(competition)
    .innerJoin(warWeek, eq(warWeek.id, competition.warWeekId))
    .where(eq(competition.id, id))
    .limit(1);
  return found;
}

export async function loadPointsEntryTarget(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select({ warWeek: warWeekColumns, competitionId: competition.id })
    .from(pointsEntry)
    .innerJoin(competition, eq(competition.id, pointsEntry.competitionId))
    .innerJoin(warWeek, eq(warWeek.id, competition.warWeekId))
    .where(eq(pointsEntry.id, id))
    .limit(1);
  return found;
}

export async function loadScheduleItemTarget(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select({
      warWeek: warWeekColumns,
      competitionId: scheduleItem.competitionId,
    })
    .from(scheduleItem)
    .innerJoin(day, eq(day.id, scheduleItem.dayId))
    .innerJoin(warWeek, eq(warWeek.id, day.warWeekId))
    .where(eq(scheduleItem.id, id))
    .limit(1);
  return found;
}

export async function loadAnnouncementTarget(
  id: string,
  dbOrTx: DBOrTx = db,
): Promise<LoadedTarget | undefined> {
  const [found] = await dbOrTx
    .select({
      warWeek: warWeekColumns,
      authorEmail: announcement.authorEmail,
      pinned: announcement.pinned,
    })
    .from(announcement)
    .innerJoin(warWeek, eq(warWeek.id, announcement.warWeekId))
    .where(eq(announcement.id, id))
    .limit(1);
  return found;
}
