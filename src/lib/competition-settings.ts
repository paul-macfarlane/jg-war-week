/**
 * One setting of a Competition, as the admin Competition page autosaves it
 * (`saveCompetitionSetting`): its field and new value. The parser checks the
 * value's shape and its own rules; the mutation checks who may save it, the
 * lock (`src/lib/competition-locks.ts`) and the rules that read the stored
 * row. Pure: no database, no framework.
 */
import { z } from "zod";

import { type BracketConfig, bracketConfigSchema } from "@/lib/bracket/config";
import { MAX_ENTRANTS } from "@/lib/bracket/input";
import type { EntrantKind } from "@/lib/bracket/squads";
import type { Format } from "@/lib/bracket/types";
import type { CompetitionSettingField } from "@/lib/competition-locks";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  SCORE_DIRECTIONS,
  type ScoreDirection,
} from "@/lib/enums";
import {
  ENROLL_CLOSES_AT_INVALID,
  ENROLL_SWITCH_INVALID,
  ENTRANT_LIMIT_TOO_LOW,
  closesAtOf,
  limitOf,
} from "@/lib/games/enroll-input";
import { JG_EMAIL_MESSAGE, jgEmailListSchema } from "@/lib/jg-email";
import { participationPointsSchema } from "@/lib/participation/input";
import { parsePlacementPointsText } from "@/lib/placement-points";
import type { Parsed } from "@/lib/result";
import {
  type Content,
  contentInputSchema,
  isBlankContent,
} from "@/lib/rich-text/content";

/** The longest Competition name and Group (the columns). */
export const COMPETITION_NAME_MAX = 120;
export const COMPETITION_GROUP_MAX = 120;

export type CompetitionSettingChange =
  | { field: "name"; value: string }
  /** Rich text, as an Announcement body; blank is none. */
  | { field: "description"; value: Content | null }
  | { field: "group"; value: string | null }
  /** Host emails, each `@jahnelgroup.com`. */
  | { field: "hosts"; value: string[] }
  /** Points for 1st, 2nd, 3rd…, highest first; null or empty for none. */
  | { field: "placementPoints"; value: number[] | null }
  | { field: "participationPoints"; value: number }
  | { field: "format"; value: Format }
  | { field: "scoring"; value: (typeof COMPETITION_SCORINGS)[number] }
  | { field: "countsTowardTeam"; value: boolean }
  | { field: "scoreDirection"; value: ScoreDirection }
  /** Checked against the Competition's Format by the mutation. */
  | { field: "gameConfig"; value: unknown }
  | { field: "entrantsOpen"; value: boolean }
  | { field: "bracketConfig"; value: BracketConfig }
  | {
      field: "entrants";
      value: { targetIds: string[]; kind?: EntrantKind };
    }
  /** Generate (or re-roll) the Bracket. */
  | { field: "bracket"; value: null }
  | { field: "selfEnroll"; value: boolean }
  /** Null for no limit; else at least 2. */
  | { field: "entrantLimit"; value: number | null }
  | { field: "enrollClosesAt"; value: Date | null }
  | { field: "loggingClosesAt"; value: Date | null }
  | { field: "selfReport"; value: boolean }
  | { field: "selfCheckIn"; value: boolean }
  | { field: "checkInClosesAt"; value: Date | null };

// Every lock-table field has a change, and every change a lock-table field.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const fieldsMatch: Same<
  CompetitionSettingChange["field"],
  CompetitionSettingField
> = true;
void fieldsMatch;

/** A refusal shown at `field`. */
export function refusedAt(field: string, error: string): Parsed<never> {
  return { ok: false, error, fieldErrors: { [field]: error } };
}

const BOOLEAN_FIELDS = {
  countsTowardTeam: "Choose whether it counts toward the Team.",
  entrantsOpen: "Choose whether Entrants are open.",
  selfEnroll: ENROLL_SWITCH_INVALID,
  selfReport: "Turn self-report on or off.",
  selfCheckIn: "Choose whether Participants can check in.",
} as const;

const CLOSES_AT_FIELDS = {
  enrollClosesAt: ENROLL_CLOSES_AT_INVALID,
  loggingClosesAt: "Enter a valid logging close time.",
  checkInClosesAt: "Enter a valid check-in close time.",
} as const;

/** Trimmed text, blank as null, at most `max` characters. */
function optionalText(
  field: string,
  value: unknown,
  max: number,
  label: string,
): Parsed<string | null> {
  if (value === null || value === undefined) return { ok: true, value: null };
  if (typeof value !== "string") return refusedAt(field, `Enter the ${label}.`);
  const text = value.trim();
  if (text.length > max) {
    return refusedAt(field, `The ${label} is at most ${max} characters.`);
  }
  return { ok: true, value: text || null };
}

function ok<T extends CompetitionSettingChange>(change: T): Parsed<T> {
  return { ok: true, value: change };
}

/**
 * Parses one setting as the page posts it: `{ field, value }`. Never
 * throws; a refusal names its field (`fieldErrors`).
 */
export function parseCompetitionSetting(
  input: unknown,
): Parsed<CompetitionSettingChange> {
  const shape = z
    .object({ field: z.string(), value: z.unknown() })
    .safeParse(input);
  if (!shape.success) return { ok: false, error: "Choose a setting to save." };
  const { field, value } = shape.data;

  switch (field) {
    case "name": {
      const name = optionalText(field, value, COMPETITION_NAME_MAX, "name");
      if (!name.ok) return name;
      if (name.value === null) return refusedAt(field, "Enter the name.");
      return ok({ field, value: name.value });
    }
    case "description": {
      if (value === null || value === undefined || isBlankContent(value)) {
        return ok({ field, value: null });
      }
      const content = contentInputSchema.safeParse(value);
      if (!content.success) {
        return refusedAt(field, "The description must be valid rich text.");
      }
      return ok({ field, value: content.data });
    }
    case "group": {
      const text = optionalText(field, value, COMPETITION_GROUP_MAX, "Group");
      return text.ok ? ok({ field, value: text.value }) : text;
    }
    case "hosts": {
      const parsed = jgEmailListSchema.safeParse(value);
      if (!parsed.success) return refusedAt(field, JG_EMAIL_MESSAGE);
      const emails = parsed.data.map((email) => email.trim().toLowerCase());
      return ok({ field, value: [...new Set(emails)] });
    }
    case "placementPoints": {
      const text = Array.isArray(value)
        ? value.every((p) => typeof p === "number")
          ? value.join(",")
          : undefined
        : value;
      if (text === undefined) {
        return refusedAt(field, "Placement Points must be numbers.");
      }
      const points = parsePlacementPointsText(text);
      if (!points.ok) return refusedAt(field, points.error);
      return ok({ field, value: points.value });
    }
    case "participationPoints": {
      const n = typeof value === "string" ? Number(value.trim()) : value;
      const parsed = participationPointsSchema.safeParse(n);
      if (!parsed.success) {
        return refusedAt(
          field,
          "Points per Participant must be a number more than 0.",
        );
      }
      return ok({ field, value: parsed.data });
    }
    case "format": {
      const parsed = z.enum(COMPETITION_FORMATS).safeParse(value);
      return parsed.success
        ? ok({ field, value: parsed.data })
        : refusedAt(field, "Choose a Format.");
    }
    case "scoring": {
      const parsed = z.enum(COMPETITION_SCORINGS).safeParse(value);
      return parsed.success
        ? ok({ field, value: parsed.data })
        : refusedAt(field, "Choose team or individual scoring.");
    }
    case "scoreDirection": {
      const parsed = z.enum(SCORE_DIRECTIONS).safeParse(value);
      return parsed.success
        ? ok({ field, value: parsed.data })
        : refusedAt(field, "Choose a Score direction.");
    }
    case "countsTowardTeam":
    case "entrantsOpen":
    case "selfEnroll":
    case "selfReport":
    case "selfCheckIn":
      return typeof value === "boolean"
        ? ok({ field, value })
        : refusedAt(field, BOOLEAN_FIELDS[field]);
    case "gameConfig":
      return typeof value === "object" && value !== null
        ? ok({ field, value })
        : refusedAt(field, "Choose the Format's settings.");
    case "bracketConfig": {
      const parsed = bracketConfigSchema.safeParse(value);
      return parsed.success
        ? ok({ field, value: parsed.data })
        : refusedAt(field, parsed.error.issues[0].message);
    }
    case "entrants": {
      const parsed = z
        .object({
          kind: z.enum(["team", "participant", "squad"]).optional(),
          targetIds: z.array(z.uuid()).max(MAX_ENTRANTS),
        })
        .safeParse(value);
      if (!parsed.success) {
        return refusedAt(field, "Choose Teams, Participants or Squads.");
      }
      return ok({ field, value: parsed.data });
    }
    case "bracket":
      return ok({ field, value: null });
    case "entrantLimit": {
      const limit = limitOf(value);
      return limit.ok
        ? ok({ field, value: limit.value })
        : refusedAt(field, ENTRANT_LIMIT_TOO_LOW);
    }
    case "enrollClosesAt":
    case "loggingClosesAt":
    case "checkInClosesAt": {
      const closesAt = closesAtOf(value);
      return closesAt.ok
        ? ok({ field, value: closesAt.value })
        : refusedAt(field, CLOSES_AT_FIELDS[field]);
    }
    default:
      return { ok: false, error: "Choose a setting to save." };
  }
}
