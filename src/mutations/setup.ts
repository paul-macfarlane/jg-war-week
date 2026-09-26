import { type SQL, and, count, eq, ne, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  award,
  awardParticipant,
  competition,
  competitionHost,
  day,
  entrant,
  participant,
  pointsEntry,
  scheduleItem,
  team,
  warWeek,
} from "@/db/schema";
import { isJahnelGroupEmail } from "@/lib/access";
import {
  type CompetitionValues,
  type DayValues,
  type ParticipantValues,
  type TeamValues,
  type WarWeekSettingsValues,
  competitionGuardError,
  dayDeleteGuardError,
  dayGuardError,
  inUseError,
  participantGuardError,
  settingsGuardError,
  teamGuardError,
} from "@/lib/setup";
import type { MutationContext, MutationResult } from "@/mutations/types";

const WAR_WEEK_NOT_FOUND = "That War Week no longer exists.";
const DAY_NOT_FOUND = "That Day no longer exists.";
const TEAM_NOT_FOUND = "That Team no longer exists.";
const PARTICIPANT_NOT_FOUND = "That Participant no longer exists.";
const COMPETITION_NOT_FOUND = "That Competition no longer exists.";

/** Postgres unique_violation: another save took the natural key meanwhile. */
export function isUniqueViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return (
    (error as { code?: string })?.code === "23505" || cause?.code === "23505"
  );
}

/** Runs a write, turning a lost race for a unique value into `refusal`. */
async function refusingDuplicate(
  refusal: string,
  write: () => Promise<MutationResult>,
): Promise<MutationResult> {
  try {
    return await write();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, error: refusal };
  }
}

const refusingDuplicateDate = (
  date: string,
  write: () => Promise<MutationResult>,
) => refusingDuplicate(`There's already a Day on ${date}.`, write);

async function warWeekMode(
  ctx: MutationContext,
  tx: DBOrTx,
): Promise<"teams" | "free-for-all" | null> {
  const [found] = await tx
    .select({ mode: warWeek.mode })
    .from(warWeek)
    .where(eq(warWeek.id, ctx.warWeekId));
  return found?.mode ?? null;
}

async function dayDates(
  warWeekId: string,
  dbOrTx: DBOrTx,
  exceptDayId?: string,
): Promise<string[]> {
  const rows = await dbOrTx
    .select({ date: day.date })
    .from(day)
    .where(
      exceptDayId
        ? and(eq(day.warWeekId, warWeekId), ne(day.id, exceptDayId))
        : eq(day.warWeekId, warWeekId),
    );
  return rows.map((row) => row.date);
}

/**
 * Saves the War Week's settings and Appearance Theme, refusing a save that
 * would strand Teams or Days.
 */
export async function updateWarWeekSettings(
  values: WarWeekSettingsValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const [teams] = await tx
      .select({ count: count() })
      .from(team)
      .where(eq(team.warWeekId, ctx.warWeekId));
    const refusal = settingsGuardError(values, {
      teamCount: teams.count,
      dayDates: await dayDates(ctx.warWeekId, tx),
    });
    if (refusal) return { ok: false, error: refusal };

    const updated = await tx
      .update(warWeek)
      .set({ ...values, updatedAt: sql`now()` })
      .where(eq(warWeek.id, ctx.warWeekId))
      .returning({ id: warWeek.id });
    return updated.length > 0
      ? { ok: true }
      : { ok: false, error: WAR_WEEK_NOT_FOUND };
  });
}

/** Checks a Day's date against its War Week and the War Week's other Days. */
async function dayRefusal(
  values: DayValues,
  ctx: MutationContext,
  tx: DBOrTx,
  exceptDayId?: string,
): Promise<string | null> {
  const [found] = await tx
    .select({ startDate: warWeek.startDate, endDate: warWeek.endDate })
    .from(warWeek)
    .where(eq(warWeek.id, ctx.warWeekId));
  if (!found) return WAR_WEEK_NOT_FOUND;
  return dayGuardError(values, {
    ...found,
    otherDayDates: await dayDates(ctx.warWeekId, tx, exceptDayId),
  });
}

export async function createDay(
  values: DayValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicateDate(values.date, () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = await dayRefusal(values, ctx, tx);
      if (refusal) return { ok: false, error: refusal };
      await tx.insert(day).values({ warWeekId: ctx.warWeekId, ...values });
      return { ok: true };
    }),
  );
}

/** Edits a Day of this War Week; its Schedule Items move with it. */
export async function updateDay(
  id: string,
  values: DayValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicateDate(values.date, () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = await dayRefusal(values, ctx, tx, id);
      if (refusal) return { ok: false, error: refusal };
      const updated = await tx
        .update(day)
        .set({ ...values, updatedAt: sql`now()` })
        .where(and(eq(day.id, id), eq(day.warWeekId, ctx.warWeekId)))
        .returning({ id: day.id });
      return updated.length > 0
        ? { ok: true }
        : { ok: false, error: DAY_NOT_FOUND };
    }),
  );
}

/** Deletes a Day of this War Week, refusing one that has Schedule Items. */
export async function deleteDay(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    // Schedule Item writes lock their Day too, so none lands after the count.
    if (!(await locked(tx, day, id, ctx))) {
      return { ok: false, error: DAY_NOT_FOUND };
    }
    const [items] = await tx
      .select({ count: count() })
      .from(scheduleItem)
      .where(eq(scheduleItem.dayId, id));
    const refusal = dayDeleteGuardError(items.count);
    if (refusal) return { ok: false, error: refusal };

    const deleted = await tx
      .delete(day)
      .where(and(eq(day.id, id), eq(day.warWeekId, ctx.warWeekId)))
      .returning({ id: day.id });
    return deleted.length > 0
      ? { ok: true }
      : { ok: false, error: DAY_NOT_FOUND };
  });
}

/**
 * Locks a row of this War Week for a delete or a guarded change, so a
 * Points Entry or other reference can't be added between counting
 * references and writing (a delete would cascade it). False when there's
 * no such row.
 */
export async function locked(
  tx: DBOrTx,
  table: typeof team | typeof participant | typeof competition | typeof day,
  id: string,
  ctx: MutationContext,
): Promise<boolean> {
  const rows = await tx
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.warWeekId, ctx.warWeekId)))
    .for("update");
  return rows.length > 0;
}

/** Whether another row of this War Week (not `exceptId`) matches `where`. */
async function taken(
  tx: DBOrTx,
  table: typeof team | typeof participant | typeof competition,
  where: SQL,
  ctx: MutationContext,
  exceptId?: string,
): Promise<boolean> {
  const n = await tx.$count(
    table,
    and(
      eq(table.warWeekId, ctx.warWeekId),
      where,
      exceptId ? ne(table.id, exceptId) : undefined,
    ),
  );
  return n > 0;
}

async function teamRefusal(
  values: TeamValues,
  ctx: MutationContext,
  tx: DBOrTx,
  exceptId?: string,
): Promise<string | null> {
  const mode = await warWeekMode(ctx, tx);
  if (!mode) return WAR_WEEK_NOT_FOUND;
  return teamGuardError(values, {
    mode,
    nameTaken: await taken(tx, team, eq(team.name, values.name), ctx, exceptId),
  });
}

export async function createTeam(
  values: TeamValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(
    `There's already a Team named "${values.name}".`,
    () =>
      dbOrTx.transaction(async (tx): Promise<MutationResult> => {
        const refusal = await teamRefusal(values, ctx, tx);
        if (refusal) return { ok: false, error: refusal };
        await tx.insert(team).values({ warWeekId: ctx.warWeekId, ...values });
        return { ok: true };
      }),
  );
}

export async function updateTeam(
  id: string,
  values: TeamValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(
    `There's already a Team named "${values.name}".`,
    () =>
      dbOrTx.transaction(async (tx): Promise<MutationResult> => {
        const refusal = await teamRefusal(values, ctx, tx, id);
        if (refusal) return { ok: false, error: refusal };
        const updated = await tx
          .update(team)
          .set({ ...values, updatedAt: sql`now()` })
          .where(and(eq(team.id, id), eq(team.warWeekId, ctx.warWeekId)))
          .returning({ id: team.id });
        return updated.length > 0
          ? { ok: true }
          : { ok: false, error: TEAM_NOT_FOUND };
      }),
  );
}

/**
 * Deletes a Team of this War Week, refusing one that still has Participants,
 * Points Entries or Awards.
 */
export async function deleteTeam(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(tx, team, id, ctx))) {
      return { ok: false, error: TEAM_NOT_FOUND };
    }
    const refusal = inUseError(
      "Team",
      [
        [
          await tx.$count(participant, eq(participant.teamId, id)),
          "Participant",
          "Participants",
        ],
        [
          await tx.$count(pointsEntry, eq(pointsEntry.teamId, id)),
          "Points Entry",
          "Points Entries",
        ],
        [await tx.$count(award, eq(award.teamId, id)), "Award", "Awards"],
        [
          await tx.$count(entrant, eq(entrant.teamId, id)),
          "Bracket Entrant",
          "Bracket Entrants",
        ],
      ],
      "Move or delete them first.",
    );
    if (refusal) return { ok: false, error: refusal };

    const deleted = await tx
      .delete(team)
      .where(and(eq(team.id, id), eq(team.warWeekId, ctx.warWeekId)))
      .returning({ id: team.id });
    return deleted.length > 0
      ? { ok: true }
      : { ok: false, error: TEAM_NOT_FOUND };
  });
}

async function participantRefusal(
  values: ParticipantValues,
  ctx: MutationContext,
  tx: DBOrTx,
  exceptId?: string,
): Promise<string | null> {
  const mode = await warWeekMode(ctx, tx);
  if (!mode) return WAR_WEEK_NOT_FOUND;
  const teamId = values.teamId;
  const [sameEmail] = values.email
    ? await tx
        .select({ displayName: participant.displayName })
        .from(participant)
        .where(
          and(
            eq(participant.warWeekId, ctx.warWeekId),
            eq(participant.email, values.email),
            exceptId ? ne(participant.id, exceptId) : undefined,
          ),
        )
    : [];
  return participantGuardError(values, {
    mode,
    teamExists:
      teamId !== null &&
      (await tx.$count(
        team,
        and(eq(team.id, teamId), eq(team.warWeekId, ctx.warWeekId)),
      )) > 0,
    nameTaken: await taken(
      tx,
      participant,
      eq(participant.displayName, values.displayName),
      ctx,
      exceptId,
    ),
    emailTakenBy: sameEmail?.displayName ?? null,
  });
}

const PARTICIPANT_TAKEN =
  "Another Participant was just saved with that display name or email.";

export async function createParticipant(
  values: ParticipantValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(PARTICIPANT_TAKEN, () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = await participantRefusal(values, ctx, tx);
      if (refusal) return { ok: false, error: refusal };
      await tx
        .insert(participant)
        .values({ warWeekId: ctx.warWeekId, ...values });
      return { ok: true };
    }),
  );
}

export async function updateParticipant(
  id: string,
  values: ParticipantValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(PARTICIPANT_TAKEN, () =>
    dbOrTx.transaction(async (tx): Promise<MutationResult> => {
      const refusal = await participantRefusal(values, ctx, tx, id);
      if (refusal) return { ok: false, error: refusal };
      const updated = await tx
        .update(participant)
        .set({ ...values, updatedAt: sql`now()` })
        .where(
          and(eq(participant.id, id), eq(participant.warWeekId, ctx.warWeekId)),
        )
        .returning({ id: participant.id });
      return updated.length > 0
        ? { ok: true }
        : { ok: false, error: PARTICIPANT_NOT_FOUND };
    }),
  );
}

/**
 * Deletes a Participant of this War Week, refusing one with Points Entries
 * or who receives an Award.
 */
export async function deleteParticipant(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(tx, participant, id, ctx))) {
      return { ok: false, error: PARTICIPANT_NOT_FOUND };
    }
    const refusal = inUseError(
      "Participant",
      [
        [
          await tx.$count(pointsEntry, eq(pointsEntry.participantId, id)),
          "Points Entry",
          "Points Entries",
        ],
        [
          await tx.$count(
            awardParticipant,
            eq(awardParticipant.participantId, id),
          ),
          "Award",
          "Awards",
        ],
        [
          await tx.$count(entrant, eq(entrant.participantId, id)),
          "Bracket Entrant",
          "Bracket Entrants",
        ],
      ],
      "Delete them or remove the Participant from them first.",
    );
    if (refusal) return { ok: false, error: refusal };

    const deleted = await tx
      .delete(participant)
      .where(
        and(eq(participant.id, id), eq(participant.warWeekId, ctx.warWeekId)),
      )
      .returning({ id: participant.id });
    return deleted.length > 0
      ? { ok: true }
      : { ok: false, error: PARTICIPANT_NOT_FOUND };
  });
}

async function competitionRefusal(
  values: CompetitionValues,
  ctx: MutationContext,
  tx: DBOrTx,
  exceptId?: string,
): Promise<string | null> {
  const mode = await warWeekMode(ctx, tx);
  if (!mode) return WAR_WEEK_NOT_FOUND;
  let existing = null;
  if (exceptId) {
    const [found] = await tx
      .select({
        scoring: competition.scoring,
        placementPoints: competition.placementPoints,
        finalizedAt: competition.finalizedAt,
      })
      .from(competition)
      .where(
        and(
          eq(competition.id, exceptId),
          eq(competition.warWeekId, ctx.warWeekId),
        ),
      );
    if (!found) return COMPETITION_NOT_FOUND;
    existing = {
      scoring: found.scoring,
      placementPoints: found.placementPoints,
      finalizedAt: found.finalizedAt,
      pointsEntryCount: await tx.$count(
        pointsEntry,
        eq(pointsEntry.competitionId, exceptId),
      ),
    };
  }
  const refusal = competitionGuardError(values, {
    mode,
    nameTaken: await taken(
      tx,
      competition,
      eq(competition.name, values.name),
      ctx,
      exceptId,
    ),
    existing,
  });
  if (refusal || !exceptId || existing?.scoring === values.scoring) {
    return refusal;
  }
  // A Bracket's Entrants are Teams or Participants by its scoring.
  return inUseError(
    "Competition",
    [
      [
        await tx.$count(entrant, eq(entrant.competitionId, exceptId)),
        "Entrant",
        "Entrants",
      ],
    ],
    "Remove them before changing its scoring.",
  );
}

export async function createCompetition(
  values: CompetitionValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(
    `There's already a Competition named "${values.name}".`,
    () =>
      dbOrTx.transaction(async (tx): Promise<MutationResult> => {
        const refusal = await competitionRefusal(values, ctx, tx);
        if (refusal) return { ok: false, error: refusal };
        await tx
          .insert(competition)
          .values({ warWeekId: ctx.warWeekId, ...values });
        return { ok: true };
      }),
  );
}

export async function updateCompetition(
  id: string,
  values: CompetitionValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return refusingDuplicate(
    `There's already a Competition named "${values.name}".`,
    () =>
      dbOrTx.transaction(async (tx): Promise<MutationResult> => {
        // Adding a Points Entry or Entrant, or finalizing the Bracket, takes
        // the same lock, so the counts below hold until this commits.
        if (!(await locked(tx, competition, id, ctx))) {
          return { ok: false, error: COMPETITION_NOT_FOUND };
        }
        const refusal = await competitionRefusal(values, ctx, tx, id);
        if (refusal) return { ok: false, error: refusal };
        const updated = await tx
          .update(competition)
          .set({ ...values, updatedAt: sql`now()` })
          .where(
            and(
              eq(competition.id, id),
              eq(competition.warWeekId, ctx.warWeekId),
            ),
          )
          .returning({ id: competition.id });
        return updated.length > 0
          ? { ok: true }
          : { ok: false, error: COMPETITION_NOT_FOUND };
      }),
  );
}

/**
 * Deletes a Competition of this War Week, refusing one with Points Entries
 * or Schedule Items.
 */
export async function deleteCompetition(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(tx, competition, id, ctx))) {
      return { ok: false, error: COMPETITION_NOT_FOUND };
    }
    const refusal = inUseError(
      "Competition",
      [
        [
          await tx.$count(pointsEntry, eq(pointsEntry.competitionId, id)),
          "Points Entry",
          "Points Entries",
        ],
        [
          await tx.$count(scheduleItem, eq(scheduleItem.competitionId, id)),
          "Schedule Item",
          "Schedule Items",
        ],
      ],
      "Delete or move them first.",
    );
    if (refusal) return { ok: false, error: refusal };

    const deleted = await tx
      .delete(competition)
      .where(
        and(eq(competition.id, id), eq(competition.warWeekId, ctx.warWeekId)),
      )
      .returning({ id: competition.id });
    return deleted.length > 0
      ? { ok: true }
      : { ok: false, error: COMPETITION_NOT_FOUND };
  });
}

/**
 * Replaces a Competition's Hosts with `emails`, lowercased and deduplicated,
 * in one transaction. Refuses any non-JG email and a Competition outside
 * `ctx.warWeekId`. The only writer of `competition_host`: the Competition
 * setup save never carries Hosts.
 */
export async function setCompetitionHosts(
  competitionId: string,
  emails: string[],
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  const notJg = emails.find((email) => !isJahnelGroupEmail(email));
  if (notJg !== undefined) {
    return {
      ok: false,
      error: `Host email "${notJg.trim()}" must be an @jahnelgroup.com address.`,
    };
  }
  const hosts = [...new Set(emails.map((email) => email.trim().toLowerCase()))];
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(tx, competition, competitionId, ctx))) {
      return { ok: false, error: COMPETITION_NOT_FOUND };
    }
    await tx
      .delete(competitionHost)
      .where(eq(competitionHost.competitionId, competitionId));
    if (hosts.length > 0) {
      await tx
        .insert(competitionHost)
        .values(hosts.map((email) => ({ competitionId, email })));
    }
    return { ok: true };
  });
}
