/**
 * Validation for the Participation server actions' input and the seed's
 * Participation fields. Never throws; each parser returns the first error,
 * worded for the person filling in the form.
 */
import { z } from "zod";

import { closesAtOf } from "@/lib/games/enroll-input";
import { parsePlacementPointsText } from "@/lib/placement-points";
import { POINTS_NUMBER, pointsSchema } from "@/lib/points-entry";
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
  checkInClosesAt: Date | null;
};

const POINTS_LABEL = "Points per Participant";

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

function parsePoints(value: unknown): Parsed<number> {
  const text = typeof value === "number" ? String(value) : value;
  if (typeof text !== "string" || !POINTS_NUMBER.test(text.trim())) {
    return refuse(`${POINTS_LABEL} must be a number.`, "participationPoints");
  }
  const result = participationPointsSchema.safeParse(Number(text.trim()));
  return result.success
    ? { ok: true, value: result.data }
    : refuse(
        `${POINTS_LABEL} ${result.error.issues[0].message}.`,
        "participationPoints",
      );
}

/**
 * A `participation` Competition's settings from its setup page: N
 * (`participationPoints`, individual scoring; blank for none), Placement
 * Points as text (team scoring; blank for none), the Self check-in switch
 * and the optional check-in close time (an ISO string, blank for none).
 */
export function parseParticipationSettingsInput(
  raw: unknown,
): Parsed<ParticipationSettings> {
  const input = record(raw);
  if (!input) return refuse("The form's fields are missing.");

  const blankPoints =
    input.participationPoints === null ||
    input.participationPoints === undefined ||
    input.participationPoints === "";
  const points: Parsed<number | null> = blankPoints
    ? { ok: true, value: null }
    : parsePoints(input.participationPoints);
  if (!points.ok) return points;

  const placementPoints = parsePlacementPointsText(input.placementPoints);
  if (!placementPoints.ok) return placementPoints;

  if (typeof input.selfCheckIn !== "boolean") {
    return refuse("Choose whether Participants can check in.", "selfCheckIn");
  }

  const closesAt = closesAtOf(input.checkInClosesAt);
  if (!closesAt.ok) {
    return refuse("Enter a valid check-in close time.", "checkInClosesAt");
  }

  return {
    ok: true,
    value: {
      participationPoints: points.value,
      placementPoints: placementPoints.value,
      selfCheckIn: input.selfCheckIn,
      checkInClosesAt: closesAt.value,
    },
  };
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
