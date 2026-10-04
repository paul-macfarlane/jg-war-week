/**
 * Validation for the Placement server actions' input (ADR 0004). Never
 * throws; each parser returns the first error, worded for the Host.
 */
import { z } from "zod";

import type { Parsed } from "@/lib/result";

/** Who a row is for: a Team, or a Participant. */
export type PlacementTarget = { teamId: string } | { participantId: string };

/**
 * The sheet's Save: each row's Place and Score. Never the Score direction:
 * that saves on its own (`saveCompetitionSetting`), under its result lock.
 */
export type SavePlacementsValues = {
  rows: { id: string; place: number | null; score: number | null }[];
};

/** The largest Score a row holds (`placement.score`, numeric(12, 3)). */
export const MAX_SCORE = 999_999_999.999;

export const PLACE_ERROR = "Each Place must be a whole number from 1.";
export const SCORE_ERROR =
  "Each Score must be a number with at most three decimal places.";

const refuse = (error: string): Parsed<never> => ({ ok: false, error });

/** Blank (or null) means none; otherwise the text or number as a number. */
const blankable = z
  .union([z.number(), z.string().trim(), z.null()])
  .optional()
  .transform((value) =>
    value === undefined || value === null || value === ""
      ? null
      : Number(value),
  );

const placeSchema = blankable.refine(
  (n) => n === null || (Number.isInteger(n) && n >= 1 && n <= 9999),
  { error: PLACE_ERROR },
);

const scoreSchema = blankable.refine(
  (n) =>
    n === null ||
    (Number.isFinite(n) &&
      Math.abs(n) <= MAX_SCORE &&
      Math.abs(Math.round(n * 1000) - n * 1000) < 1e-6),
  { error: SCORE_ERROR },
);

const saveSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.uuid({ error: "That Placement no longer exists." }),
        place: placeSchema,
        score: scoreSchema,
      }),
    )
    .max(2000),
});

/** The sheet's Save: every row's Place and Score (any other key is dropped). */
export function parseSavePlacementsInput(
  raw: unknown,
): Parsed<SavePlacementsValues> {
  const result = saveSchema.safeParse(raw);
  if (!result.success) return refuse(result.error.issues[0].message);
  return { ok: true, value: result.data };
}

const targetSchema = z.union([
  z.strictObject({ teamId: z.uuid() }),
  z.strictObject({ participantId: z.uuid() }),
]);

/** A row to add: `{ teamId }` or `{ participantId }`. */
export function parsePlacementTargetInput(
  raw: unknown,
): Parsed<PlacementTarget> {
  const result = targetSchema.safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : refuse("Choose someone to add.");
}

/** A row to remove: `{ placementId }`. */
export function parsePlacementIdInput(
  raw: unknown,
): Parsed<{ placementId: string }> {
  const result = z.object({ placementId: z.uuid() }).safeParse(raw);
  return result.success
    ? { ok: true, value: result.data }
    : refuse("That Placement no longer exists.");
}
