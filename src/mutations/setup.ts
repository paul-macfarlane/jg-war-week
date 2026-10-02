import { type SQL, and, count, eq, ne, sql } from "drizzle-orm";

import { DBOrTx, db } from "@/db";
import {
  type Competition,
  award,
  awardParticipant,
  competition,
  competitionHost,
  day,
  entrant,
  game,
  gamePlayer,
  participant,
  participation,
  pointsEntry,
  scheduleItem,
  squad,
  squadParticipant,
  team,
  warWeek,
} from "@/db/schema";
import { defaultConfig } from "@/lib/bracket/config";
import { defaultGamesConfig } from "@/lib/games/config";
import { JG_EMAIL_MESSAGE, jgEmailListSchema } from "@/lib/jg-email";
import type { FieldErrors } from "@/lib/result";
import {
  type RosterImportSignature,
  planRosterText,
  planSignature,
} from "@/lib/roster-import";
import {
  type CompetitionCreateValues,
  type CompetitionValues,
  type DayValues,
  type OverrideColumn,
  type ParticipantValues,
  type TeamValues,
  type WarWeekSettingsInput,
  type WarWeekSettingsValues,
  competitionGuardError,
  dayDeleteGuardError,
  dayGuardError,
  inUseError,
  mergeWarWeekSettings,
  participantGuardError,
  settingsGuardError,
  settingsInputFrom,
  teamGuardError,
} from "@/lib/setup";
import { backgroundColorScheme } from "@/lib/theme";
import type { MutationContext, MutationResult } from "@/mutations/types";
import { getSetupParticipants, getSetupTeams } from "@/queries/setup";

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

/** Postgres foreign_key_violation: a row it points at was deleted meanwhile. */
export function isForeignKeyViolation(error: unknown): boolean {
  const cause = (error as { cause?: { code?: string } })?.cause;
  return (
    (error as { code?: string })?.code === "23503" || cause?.code === "23503"
  );
}

/** Runs a write, turning a lost race for a unique value into `refusal`. */
export async function refusingDuplicate<R extends MutationResult>(
  refusal: string,
  write: () => Promise<R>,
): Promise<R> {
  try {
    return await write();
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    return { ok: false, error: refusal } as R;
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

const OVERRIDE_COLUMNS: OverrideColumn[] = [
  "overridePrimaryColor",
  "overridePrimaryForegroundColor",
  "overrideAccentColor",
  "overrideBackgroundColor",
  "overrideForegroundColor",
];

/**
 * The overrides a save clears: when the new background moves the base
 * palette across light and dark, the overrides belonged to the scheme the
 * base now dresses, so each one posted unchanged from the stored row (left
 * untouched) goes back to derived. One posted with a new value was set
 * after the flip, and stays.
 */
function overridesClearedByFlip(
  values: WarWeekSettingsValues,
  stored: Pick<WarWeekSettingsValues, "backgroundColor"> &
    Record<OverrideColumn, string | null>,
): Partial<Record<OverrideColumn, null>> {
  if (
    backgroundColorScheme(values.backgroundColor) ===
    backgroundColorScheme(stored.backgroundColor)
  ) {
    return {};
  }
  const cleared: Partial<Record<OverrideColumn, null>> = {};
  for (const column of OVERRIDE_COLUMNS) {
    if (values[column] != null && values[column] === stored[column]) {
      cleared[column] = null;
    }
  }
  return cleared;
}

/**
 * Saves some of the War Week's settings (one autosave's fields): laid over
 * the row as it stands now, locked, and checked whole, then only those
 * columns are written, so a value stored since the form loaded (another
 * tab, End War Week's Winner) is never written back over. Refuses a save that
 * would strand Teams or Days, and clears the overrides a light/dark flip
 * leaves untouched.
 */
export async function updateWarWeekSettingsFields(
  fields: Partial<WarWeekSettingsInput>,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    const [stored] = await tx
      .select()
      .from(warWeek)
      .where(eq(warWeek.id, ctx.warWeekId))
      .for("update");
    if (!stored) return { ok: false, error: WAR_WEEK_NOT_FOUND };
    const merged = mergeWarWeekSettings(settingsInputFrom(stored), fields);
    if (!merged.ok) return merged;
    const { values, changed } = merged.value;

    const [teams] = await tx
      .select({ count: count() })
      .from(team)
      .where(eq(team.warWeekId, ctx.warWeekId));
    const refusal = settingsGuardError(values, {
      teamCount: teams.count,
      dayDates: await dayDates(ctx.warWeekId, tx),
    });
    if (refusal) return { ok: false, error: refusal };

    await tx
      .update(warWeek)
      .set({
        ...changed,
        ...overridesClearedByFlip(values, stored),
        updatedAt: sql`now()`,
      })
      .where(eq(warWeek.id, ctx.warWeekId));
    return { ok: true };
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
    if (!(await locked(day, id, ctx, tx))) {
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
  table: typeof team | typeof participant | typeof competition | typeof day,
  id: string,
  ctx: MutationContext,
  tx: DBOrTx,
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
    if (!(await locked(team, id, ctx, tx))) {
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
        [await tx.$count(squad, eq(squad.teamId, id)), "Squad", "Squads"],
        [
          await tx.$count(gamePlayer, eq(gamePlayer.teamId, id)),
          "Game",
          "Games",
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
      // A Squad write takes this row `for share`, so a Team change and a
      // Squad write on the same Participant run one after the other.
      const [current] = await tx
        .select({ teamId: participant.teamId })
        .from(participant)
        .where(
          and(eq(participant.id, id), eq(participant.warWeekId, ctx.warWeekId)),
        )
        .for("update");
      if (!current) return { ok: false, error: PARTICIPANT_NOT_FOUND };
      if ((values.teamId ?? null) !== current.teamId) {
        // A Squad's Participants are all on its Team.
        const squadRefusal = inUseError(
          "Participant",
          [
            [
              await tx.$count(
                squadParticipant,
                eq(squadParticipant.participantId, id),
              ),
              "Squad",
              "Squads",
            ],
          ],
          "Remove them from the Squads before changing their Team.",
        );
        if (squadRefusal) return { ok: false, error: squadRefusal };
      }
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

/** A roster import as the preview posts it: the text and what it showed. */
export type ImportParticipantsInput = {
  text: string;
  expected: RosterImportSignature;
};

export type ImportParticipantsResult =
  { ok: true; added: number; updated: number } | { ok: false; error: string };

const ROSTER_CHANGED = "The roster changed since the preview. Review it again.";

/**
 * Imports the roster from a spreadsheet (ticket 67) in one transaction:
 * locks this War Week's Participants, re-plans the posted text against the
 * roster, Teams and Squad membership as they stand now, refuses if that
 * plan isn't the one the preview showed (`expected`), then inserts the
 * Adds and writes the Updates. Error and Unchanged rows are skipped. A Team
 * deleted meanwhile (a foreign-key violation) refuses as a changed roster.
 */
export async function importParticipants(
  input: ImportParticipantsInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<ImportParticipantsResult> {
  return refusingDuplicate(PARTICIPANT_TAKEN, async () => {
    try {
      return await importRoster(input, ctx, dbOrTx);
    } catch (error) {
      if (!isForeignKeyViolation(error)) throw error;
      return { ok: false, error: ROSTER_CHANGED };
    }
  });
}

async function importRoster(
  input: ImportParticipantsInput,
  ctx: MutationContext,
  dbOrTx: DBOrTx,
): Promise<ImportParticipantsResult> {
  return dbOrTx.transaction(async (tx): Promise<ImportParticipantsResult> => {
    const [week] = await tx
      .select({
        id: warWeek.id,
        mode: warWeek.mode,
        teamLabel: warWeek.teamLabel,
        leaderTitle: warWeek.leaderTitle,
      })
      .from(warWeek)
      .where(eq(warWeek.id, ctx.warWeekId));
    if (!week) return { ok: false, error: WAR_WEEK_NOT_FOUND };
    // A Squad write takes a Participant `for share`, so a Team change
    // here and a Squad write on the same Participant run one at a time.
    await tx
      .select({ id: participant.id })
      .from(participant)
      .where(eq(participant.warWeekId, ctx.warWeekId))
      .for("update");
    const roster = await getSetupParticipants(week, tx);
    const teams = week.mode === "teams" ? await getSetupTeams(week, tx) : [];

    const plan = planRosterText(input.text, { ...week, roster, teams });
    if (!plan.ok) return plan;
    if (
      JSON.stringify(planSignature(plan.entries)) !==
      JSON.stringify(input.expected)
    ) {
      return { ok: false, error: ROSTER_CHANGED };
    }

    const adds = plan.entries.flatMap((entry) =>
      entry.kind === "add"
        ? [{ warWeekId: ctx.warWeekId, ...entry.values }]
        : [],
    );
    const updates = plan.entries.flatMap((entry) =>
      entry.kind === "update" ? [entry] : [],
    );
    if (adds.length === 0 && updates.length === 0) {
      return { ok: false, error: "There's nothing to add or update." };
    }
    if (adds.length > 0) await tx.insert(participant).values(adds);
    for (const { id, values } of updates) {
      await tx
        .update(participant)
        .set({ ...values, updatedAt: sql`now()` })
        .where(
          and(eq(participant.id, id), eq(participant.warWeekId, ctx.warWeekId)),
        );
    }
    return { ok: true, added: adds.length, updated: updates.length };
  });
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
    if (!(await locked(participant, id, ctx, tx))) {
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
        [
          await tx.$count(
            squadParticipant,
            eq(squadParticipant.participantId, id),
          ),
          "Squad",
          "Squads",
        ],
        [
          await tx.$count(gamePlayer, eq(gamePlayer.participantId, id)),
          "Game",
          "Games",
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
        format: competition.format,
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
      format: found.format,
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
  const entrantRefusal = inUseError(
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
  if (entrantRefusal) return entrantRefusal;
  // A Game's players are Teams or Participants by its scoring.
  const gameRefusal = inUseError(
    "Competition",
    [
      [
        await tx.$count(game, eq(game.competitionId, exceptId)),
        "Game",
        "Games",
      ],
    ],
    "Delete them before changing its scoring.",
  );
  if (gameRefusal) return gameRefusal;
  // Who took part is checked against Teams in team scoring (ADR 0009).
  const participationRefusal = inUseError(
    "Competition",
    [
      [
        await tx.$count(
          participation,
          eq(participation.competitionId, exceptId),
        ),
        "Participant who took part",
        "Participants who took part",
      ],
    ],
    "Remove who took part before changing its scoring.",
  );
  if (participationRefusal) return participationRefusal;
  // Squads are only for team Competitions.
  return inUseError(
    "Competition",
    [
      [
        await tx.$count(squad, eq(squad.competitionId, exceptId)),
        "Squad",
        "Squads",
      ],
    ],
    "Delete them before changing its scoring.",
  );
}

/** What `createCompetition` returns: the new row's id, or a refusal. */
export type CreateCompetitionResult =
  | { ok: true; id: string }
  | { ok: false; error: string; fieldErrors?: FieldErrors };

/**
 * Creates a Competition, with the Format an Organizer chose (default
 * "points") and, for a heats Format with none given, the Bracket builder's
 * default config (`defaultConfig`). A `games` Competition stores its Game
 * Type and that type's default settings; any other Format has no Game Type.
 * A `participation` Competition starts at 1 point per Participant, ranked
 * by headcount in team scoring, with Self check-in off.
 */
export async function createCompetition(
  values: CompetitionCreateValues,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<CreateCompetitionResult> {
  return refusingDuplicate(
    `There's already a Competition named "${values.name}".`,
    () =>
      dbOrTx.transaction(async (tx): Promise<CreateCompetitionResult> => {
        const refusal = await competitionRefusal(values, ctx, tx);
        if (refusal) return { ok: false, error: refusal };
        const format = values.format ?? "points";
        const gameType = format === "games" ? (values.gameType ?? null) : null;
        if (format === "games" && !gameType) {
          return { ok: false, error: "Choose a Game Type." };
        }
        const [created] = await tx
          .insert(competition)
          .values({
            warWeekId: ctx.warWeekId,
            ...values,
            format,
            bracketConfig: defaultConfig(format),
            gameType,
            gameConfig: gameType ? defaultGamesConfig(gameType) : null,
            // A new `games` Competition is open to everyone (Best of is off).
            entrantsOpen: format === "games",
            ...(format === "participation"
              ? {
                  participationPoints: 1,
                  participationTeamScoring:
                    values.scoring === "team" ? ("ranked" as const) : null,
                }
              : {}),
          })
          .returning({ id: competition.id });
        return { ok: true, id: created.id };
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
        if (!(await locked(competition, id, ctx, tx))) {
          return { ok: false, error: COMPETITION_NOT_FOUND };
        }
        const refusal = await competitionRefusal(values, ctx, tx, id);
        if (refusal) return { ok: false, error: refusal };
        const updated = await tx
          .update(competition)
          .set({
            ...values,
            participationTeamScoring: participationTeamScoringFor(
              values.scoring,
            ),
            updatedAt: sql`now()`,
          })
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
 * A `participation` Competition's team scoring after a scoring save (the
 * CHECK `competition_participation_columns`): kept while still team
 * scoring, `ranked` on becoming team, null for individual or another
 * Format. `scoring` is the saved value, from the excluded row in a seed
 * load.
 */
export function participationTeamScoringFor(
  scoring: SQL | Competition["scoring"],
): SQL<"ranked" | "per-person" | null> {
  return sql`case when ${competition.format}::text = 'participation' and ${scoring} = 'team'
    then coalesce(${competition.participationTeamScoring}, 'ranked') end`;
}

/**
 * Deletes a Competition of this War Week, refusing one with Points Entries,
 * Schedule Items, Games or anyone who took part.
 */
export async function deleteCompetition(
  id: string,
  ctx: MutationContext,
  dbOrTx: DBOrTx = db,
): Promise<MutationResult> {
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(competition, id, ctx, tx))) {
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
        [await tx.$count(game, eq(game.competitionId, id)), "Game", "Games"],
      ],
      "Delete or move them first.",
    );
    if (refusal) return { ok: false, error: refusal };
    const tookPart = inUseError(
      "Competition",
      [
        [
          await tx.$count(participation, eq(participation.competitionId, id)),
          "Participant who took part",
          "Participants who took part",
        ],
      ],
      "Remove who took part first.",
    );
    if (tookPart) return { ok: false, error: tookPart };

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
  const parsed = jgEmailListSchema.safeParse(emails);
  if (!parsed.success) return { ok: false, error: JG_EMAIL_MESSAGE };
  const hosts = [...new Set(parsed.data)];
  return dbOrTx.transaction(async (tx): Promise<MutationResult> => {
    if (!(await locked(competition, competitionId, ctx, tx))) {
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
