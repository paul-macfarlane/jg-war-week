import { z } from "zod";

import type { PointsEntry, WarWeek } from "@/db/schema";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { POINTS_NUMBER, pointsSchema } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";

/** The Discretionary points form's raw fields, as strings from the browser. */
export type DiscretionaryInput = {
  targetId: string;
  points: string;
  reason: string;
};

export type DiscretionaryValues = {
  targetId: string;
  points: number;
  reason: string;
};

const discretionaryFormSchema = z.object({
  targetId: z.uuid({ error: "Choose a Team or Participant." }),
  points: z
    .string()
    .trim()
    .regex(POINTS_NUMBER, { error: "Points must be a number." })
    .transform(Number)
    .pipe(pointsSchema),
  // The reason is stored as the entry's note, which has no Competition to
  // explain it, so it is required.
  reason: z
    .string()
    .trim()
    .min(1, { error: "Give a reason." })
    .max(500, { error: "must be at most 500 characters" }),
});

const FIELD_LABELS: Record<string, string> = {
  points: "Points",
  reason: "Reason",
};

/**
 * Validates the Discretionary points form. Never throws; returns the first
 * error and one per refused field.
 */
export function parseDiscretionaryInput(
  input: DiscretionaryInput,
): Parsed<DiscretionaryValues> {
  const result = discretionaryFormSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    ...fieldErrorsFrom(result.error, { labels: FIELD_LABELS }),
  };
}

/**
 * Whether Discretionary points may go to a Team in this War Week: a
 * free-for-all War Week has no Teams to give points to.
 */
export function discretionaryAllowsTeams(mode: WarWeek["mode"]): boolean {
  return mode === "teams";
}

/** How a Discretionary entry reads in "where points came from". */
export function discretionaryLabel(reason: string | null): string {
  return `Discretionary: ${reason ?? ""}`.trimEnd();
}

export type DiscretionaryLedgerRow = Pick<
  PointsEntry,
  | "id"
  | "points"
  | "note"
  | "enteredByEmail"
  | "enteredAt"
  | "createdAt"
  | "updatedAt"
> & {
  teamId: string | null;
  participantId: string | null;
  teamName: string | null;
  participantName: string | null;
  /** A Participant target's Team, for the Team rule; absent or null for none. */
  participantTeamName?: string | null;
  participantTeamColor?: string | null;
};

export type DiscretionaryLedgerEntry = {
  id: string;
  /** The Team's or Participant's id, for the edit form. */
  targetId: string;
  target: string;
  /** A Participant target's Team (the Team rule); null for a Team target or none. */
  targetTeam?: { name: string; color: string | null } | null;
  points: number;
  reason: string;
  enteredByEmail: string;
  enteredAt: Date;
  /** When the entry was last edited, or null if it never was. */
  editedAt: Date | null;
};

/**
 * The Discretionary ledger: every entry, newest first, with its target's
 * name. An entry counts as edited when `updatedAt` is after `createdAt`
 * (both the database's `now()`, equal until an edit); a seeded entry's
 * `enteredAt` is historical, so it isn't the comparison point.
 */
export function buildDiscretionaryLedger(
  rows: DiscretionaryLedgerRow[],
): DiscretionaryLedgerEntry[] {
  return [...rows]
    .sort(
      (a, b) =>
        b.enteredAt.getTime() - a.enteredAt.getTime() ||
        a.id.localeCompare(b.id),
    )
    .map((row) => ({
      id: row.id,
      targetId: (row.teamId ?? row.participantId) as string,
      target: row.participantName ?? row.teamName ?? "Unknown",
      targetTeam:
        row.participantName && row.participantTeamName
          ? {
              name: row.participantTeamName,
              color: row.participantTeamColor ?? null,
            }
          : null,
      points: row.points,
      reason: row.note ?? "",
      enteredByEmail: row.enteredByEmail,
      enteredAt: row.enteredAt,
      editedAt: row.updatedAt > row.createdAt ? row.updatedAt : null,
    }));
}
