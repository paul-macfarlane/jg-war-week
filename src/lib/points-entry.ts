import { z } from "zod";

import type { Competition, PointsEntry } from "@/db/schema";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { formatPoints } from "@/lib/points";
import type { Parsed } from "@/lib/result";
import { WAR_WEEK_TIME_ZONE } from "@/lib/schedule";

/** A points value as typed: an optional minus, digits, optional decimals. */
export const POINTS_NUMBER = /^-?\d+(\.\d+)?$/;

/**
 * A points value as the database stores it, numeric(8, 2): at most two
 * decimals and six whole digits. Shared by the seed and the Points Entry
 * form.
 */
export const pointsSchema = z
  .number()
  .min(-999999.99, { error: "must be at least -999999.99" })
  .max(999999.99, { error: "must be at most 999999.99" })
  .refine((value) => Math.round(value * 100) / 100 === value, {
    error: "must have at most two decimal places",
  });

/** The Points Entry note, as limited by its column. */
export const pointsEntryNoteSchema = z.string().max(500);

export type PointsEntryTargetKind = "team" | "participant";

/**
 * The one target rule: a team Competition's Points Entries target a Team,
 * an individual Competition's target a Participant. Returns the refusal, or
 * null when the kind fits. The seed and the Organizer actions both use it.
 */
export function pointsEntryTargetError(
  competition: Pick<Competition, "name" | "scoring">,
  kind: PointsEntryTargetKind,
): string | null {
  if (competition.scoring === "team" && kind !== "team") {
    return `"${competition.name}" is a team Competition, so its Points Entries must target a team`;
  }
  if (competition.scoring === "individual" && kind !== "participant") {
    return `"${competition.name}" is an individual Competition, so its Points Entries must target a participant`;
  }
  return null;
}

/** The Points Entry columns for a target of the given kind. */
export function pointsEntryTarget(
  kind: PointsEntryTargetKind,
  targetId: string,
): Pick<PointsEntry, "teamId" | "participantId"> {
  return kind === "team"
    ? { teamId: targetId, participantId: null }
    : { teamId: null, participantId: targetId };
}

/** The Points Entry form's raw fields, as strings from the browser. */
export type PointsEntryInput = {
  competitionId: string;
  targetId: string;
  points: string;
  note?: string | null;
};

export type PointsEntryValues = {
  competitionId: string;
  targetId: string;
  points: number;
  note: string | null;
};

const pointsEntryFormSchema = z.object({
  competitionId: z.uuid({ error: "Choose a Competition." }),
  targetId: z.uuid({ error: "Choose a Team or Participant." }),
  points: z
    .string()
    .trim()
    .regex(POINTS_NUMBER, { error: "Points must be a number." })
    .transform(Number)
    .pipe(pointsSchema),
  note: pointsEntryNoteSchema
    .trim()
    .nullish()
    .transform((note) => (note ? note : null)),
});

const FIELD_LABELS: Record<string, string> = {
  points: "Points",
  note: "Note",
};

/**
 * Validates the Points Entry form. Never throws; returns the first error and
 * one per refused field.
 */
export function parsePointsEntryInput(
  input: PointsEntryInput,
): Parsed<PointsEntryValues> {
  const result = pointsEntryFormSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  // Shared field schemas word their errors as "must …"; prefix the field.
  return {
    ok: false,
    ...fieldErrorsFrom(result.error, { labels: FIELD_LABELS }),
  };
}

/**
 * The warning shown when an entry goes over the Competition's max points.
 * Going over is allowed (it may be a bonus); the warning only catches typos.
 */
export function overMaxWarning(
  points: number,
  maxPoints: number | null,
): string | null {
  if (maxPoints === null || !Number.isFinite(points) || points <= maxPoints) {
    return null;
  }
  return `${formatPoints(points)} is over this Competition's max of ${formatPoints(maxPoints)} points. It will still save.`;
}

export type AdminLedgerRow = Pick<
  PointsEntry,
  | "id"
  | "points"
  | "note"
  | "enteredByEmail"
  | "enteredAt"
  | "createdAt"
  | "updatedAt"
  | "generatedByBracket"
> & {
  competition: string;
  competitionId: string;
  teamName: string | null;
  participantName: string | null;
};

export type AdminLedgerEntry = Pick<
  AdminLedgerRow,
  | "id"
  | "competition"
  | "competitionId"
  | "points"
  | "note"
  | "enteredByEmail"
  | "enteredAt"
  | "generatedByBracket"
> & {
  target: string;
  /** When the entry was last edited, or null if it never was. */
  editedAt: Date | null;
};

/**
 * The admin ledger: every entry, newest first, with its target's name. An
 * entry counts as edited when its row changed after it was saved; a seeded
 * entry's `enteredAt` is historical, so it isn't the comparison point.
 */
export function buildAdminLedger(rows: AdminLedgerRow[]): AdminLedgerEntry[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.enteredAt.getTime() - a.enteredAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((row) => ({
      id: row.id,
      competition: row.competition,
      competitionId: row.competitionId,
      target: row.participantName ?? row.teamName ?? "Unknown",
      points: row.points,
      note: row.note,
      enteredByEmail: row.enteredByEmail,
      enteredAt: row.enteredAt,
      generatedByBracket: row.generatedByBracket,
      editedAt:
        row.updatedAt.getTime() - row.createdAt.getTime() > 1000
          ? row.updatedAt
          : null,
    }));
}

const ledgerTime = new Intl.DateTimeFormat("en-US", {
  timeZone: WAR_WEEK_TIME_ZONE,
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** A ledger timestamp in War Week time (ET), e.g. "Tue, Feb 24, 1:05 PM". */
export function formatLedgerTime(instant: Date): string {
  return ledgerTime.format(instant);
}
