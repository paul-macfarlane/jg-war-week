/**
 * Validation for the Participation server actions' input and the seed's
 * Participation fields. Never throws; each parser returns the first error,
 * worded for the person filling in the form.
 */
import { z } from "zod";

import { pointsSchema } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";

/**
 * N, the points per Participant who took part: more than 0 and within a
 * Points Entry's bounds. Shared by the settings form and the seed file.
 */
export const participationPointsSchema = pointsSchema.refine((n) => n > 0, {
  error: "must be more than 0",
});

/**
 * The setup page's settings, parsed. N applies to an individual Competition
 * and Placement Points to a team one; the mutation checks which is given
 * against the Competition's scoring.
 */
export type ParticipationSettings = {
  participationPoints: number | null;
  placementPoints: number[] | null;
  selfCheckIn: boolean;
};

function refuse(error: string, field?: string): Parsed<never> {
  return {
    ok: false,
    error,
    ...(field ? { fieldErrors: { [field]: error } } : {}),
  };
}

function record(raw: unknown): Record<string, unknown> | null {
  return typeof raw === "object" && raw !== null
    ? (raw as Record<string, unknown>)
    : null;
}

const PARTICIPANT_MISSING = "That Participant no longer exists.";

/** Who the Host or an Organizer marks or unmarks: one Participant id. */
export function parseMarkInput(
  raw: unknown,
): Parsed<{ participantId: string }> {
  const result = z
    .object({ participantId: z.uuid() })
    .safeParse(record(raw) ?? {});
  return result.success
    ? { ok: true, value: { participantId: result.data.participantId } }
    : refuse(PARTICIPANT_MISSING);
}
