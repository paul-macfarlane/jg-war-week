import { z } from "zod";

import type { Competition, PointsEntry } from "@/db/schema";
import { isGameFormat } from "@/lib/enums";
import { gameFormatLabel } from "@/lib/games/config";
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

/**
 * The ledger's mark on a generated Points Entry: its Competition's Format
 * says whether a Bracket, a Head-to-head or Best score or a `participation` Competition wrote
 * it; a Games Format's note names the Format.
 */
export function generatedNote(format: Competition["format"]): string {
  if (isGameFormat(format))
    return `From ${gameFormatLabel(format).toLowerCase()}`;
  if (format === "participation") return "From participation";
  if (format === "placement") return "From placement";
  return "From bracket";
}

/** Why a generated Points Entry can't be edited or deleted in the ledger. */
export function generatedRefusal(format: Competition["format"]): string {
  if (isGameFormat(format)) {
    return `This Points Entry comes from a ${gameFormatLabel(format)} Competition. Change it there.`;
  }
  if (format === "participation") {
    return "This Points Entry comes from a Participation Competition. Change it there.";
  }
  if (format === "placement") {
    return "This Points Entry comes from a Placement. Change it there.";
  }
  return "This Points Entry comes from a bracket. Change it there.";
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
