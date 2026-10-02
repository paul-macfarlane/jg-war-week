/**
 * Validation for the Participation server actions' input and the seed's
 * Participation fields. Never throws; each parser returns the first error,
 * worded for the person filling in the form.
 */
import { z } from "zod";

import { MAX_PLACEMENTS } from "@/lib/competitions";
import {
  PARTICIPATION_TEAM_SCORINGS,
  type ParticipationTeamScoring,
} from "@/lib/enums";
import { closesAtOf } from "@/lib/games/enroll-input";
import { POINTS_NUMBER, pointsSchema } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";

/**
 * N, the points per Participant who took part: more than 0 and within a
 * Points Entry's bounds. Shared by the settings form and the seed file.
 */
export const participationPointsSchema = pointsSchema.refine((n) => n > 0, {
  error: "must be more than 0",
});

/** The setup page's settings, parsed. The team scoring is checked against the Competition's scoring by the mutation. */
export type ParticipationSettings = {
  participationPoints: number;
  participationTeamScoring: ParticipationTeamScoring | null;
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

/** "5, 3, 1" as Placement Points, highest first; blank is none. */
function parsePlacementPoints(value: unknown): Parsed<number[] | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") {
    return refuse("Placement Points must be text.", "placementPoints");
  }
  const places = value.split(/[\s,]+/).filter(Boolean);
  if (places.length === 0) return { ok: true, value: null };
  if (!places.every((place) => POINTS_NUMBER.test(place))) {
    return refuse(
      "Placement Points must be numbers separated by commas, 1st place first.",
      "placementPoints",
    );
  }
  const points = places.map(Number);
  if (points.length > MAX_PLACEMENTS) {
    return refuse(
      `Placement Points cover at most ${MAX_PLACEMENTS} places.`,
      "placementPoints",
    );
  }
  if (!points.every((p) => pointsSchema.safeParse(p).success && p >= 0)) {
    return refuse(
      "Each place's Placement Points must be 0 or more, with at most two decimal places.",
      "placementPoints",
    );
  }
  if (!points.every((p, i) => i === 0 || p <= points[i - 1])) {
    return refuse(
      "Each place's Placement Points must be no more than the place above it.",
      "placementPoints",
    );
  }
  return { ok: true, value: points };
}

/**
 * A `participation` Competition's settings from its setup page: N
 * (`participationPoints`), the team scoring (`teamScoring`, blank for
 * individual), Placement Points as text, the Self check-in switch and the
 * optional check-in close time (an ISO string, blank for none).
 */
export function parseParticipationSettingsInput(
  raw: unknown,
): Parsed<ParticipationSettings> {
  const input = record(raw);
  if (!input) return refuse("The form's fields are missing.");

  const points = parsePoints(input.participationPoints);
  if (!points.ok) return points;

  const scoringRaw = input.teamScoring;
  let teamScoring: ParticipationTeamScoring | null = null;
  if (scoringRaw !== null && scoringRaw !== undefined && scoringRaw !== "") {
    const scoring = z.enum(PARTICIPATION_TEAM_SCORINGS).safeParse(scoringRaw);
    if (!scoring.success) {
      return refuse("Choose how Teams score.", "teamScoring");
    }
    teamScoring = scoring.data;
  }

  const placementPoints = parsePlacementPoints(input.placementPoints);
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
      participationTeamScoring: teamScoring,
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
