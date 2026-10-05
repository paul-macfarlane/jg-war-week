import { type ZodType, z } from "zod";

import type { Competition, Participant, Team, WarWeek } from "@/db/schema";
import { bestScoreConfigSchema } from "@/lib/best-score/config";
import { bracketConfigSchema, thirdPlaceRefusal } from "@/lib/bracket/config";
import { HEX_COLOR } from "@/lib/color";
import { placementLimitRefusal } from "@/lib/competitions";
import { dayOutsideRangeError } from "@/lib/day-range";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  FONT_PRESETS,
  SCORE_DIRECTIONS,
  WAR_WEEK_MODES,
  isLoggedFormat,
} from "@/lib/enums";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { DEFAULT_LEAGUE_CONFIG, roundsError } from "@/lib/league/config";
import { leagueConfigSchema } from "@/lib/league/config-schema";
import { participationPointsSchema } from "@/lib/participation/input";
import { parsePlacementPointsText } from "@/lib/placement-points";
import { pointsSchema as points } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";
import { contentInputSchema } from "@/lib/rich-text/content";
import { descriptionContent } from "@/lib/rich-text/from-plain-text";
import { seriesConfigSchema } from "@/lib/series/config";

export { dayOutsideRangeError } from "@/lib/day-range";

// Field rules the seed file (`src/seed/schema.ts`) and the setup forms share,
// so seed and setup can't drift.

const hexColor = z.string().max(32).regex(HEX_COLOR, "must be a hex color");

const themeUrl = z
  .string()
  .max(500)
  .regex(
    /^(\/[^\s]*|https:\/\/[^\s]+)$/,
    "must be a root-relative path or an https URL",
  );

/** An email address, lowercased. */
export const emailSchema = z.email().max(254).toLowerCase();

/**
 * The War Week fields an Organizer can also edit in `/admin/settings`, so the
 * seed and the setup form share one set of field rules.
 */
export const warWeekSettingsSeedShape = {
  storyTheme: z.string().min(1).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  mode: z.enum(WAR_WEEK_MODES),
  teamLabel: z.string().min(1).max(40),
  leaderTitle: z.string().min(1).max(40),
  slackChannelUrl: z.url({ protocol: /^https$/ }).max(500),
  primary: hexColor,
  primaryForeground: hexColor,
  accent: hexColor,
  background: hexColor,
  foreground: hexColor,
  // The Organizer's overrides of the derived palette (the other color
  // scheme's colors); absent or null means derived.
  overridePrimary: hexColor.nullish(),
  overridePrimaryForeground: hexColor.nullish(),
  overrideAccent: hexColor.nullish(),
  overrideBackground: hexColor.nullish(),
  overrideForeground: hexColor.nullish(),
  fontPreset: z.enum(FONT_PRESETS),
  logoUrl: themeUrl.nullish(),
  bannerUrl: themeUrl.nullish(),
  wikiUrl: themeUrl.nullish(),
  winner: z.string().max(200).nullish(),
  highlights: z.array(z.string().max(500)).default([]),
};

/** The longest Day description, its column's length. */
export const DAY_DESCRIPTION_MAX = 280;

/** A Day's own fields; the seed adds its Schedule Items. */
export const daySeedShape = {
  date: z.iso.date(),
  dayTheme: z.string().min(1).max(120),
  /** Plain text under the Day Theme; `""` is stored as null. */
  description: z.string().trim().max(DAY_DESCRIPTION_MAX).nullish(),
};

export const teamSeedSchema = z.object({
  name: z.string().min(1).max(80),
  color: hexColor,
  logoUrl: themeUrl.nullish(),
});

export const participantSeedSchema = z.object({
  displayName: z.string().min(1).max(120),
  companyTag: z.string().min(1).max(40).nullish(),
  email: emailSchema.nullish(),
  /** A Team name from this seed. */
  team: z.string().min(1).max(80).nullish(),
  isLeader: z.boolean().default(false),
});

export const competitionSeedSchema = z
  // Strict: a key that no longer exists in a seed (a removed setting) is an
  // error, never silently ignored.
  .strictObject({
    name: z.string().min(1).max(120),
    /** Rich text, or plain text the loader turns into paragraphs. */
    description: z.union([z.string(), contentInputSchema]).nullish(),
    /** Placement Points for 1st, 2nd, 3rd…, highest first. */
    placementPoints: z
      .array(points.min(0, { error: "must be at least 0" }))
      .min(1, { error: "at least 1 place" })
      .refine((list) => list.every((p, i) => i === 0 || p <= list[i - 1]), {
        error: "each place must be worth no more than the one above it",
      })
      .nullish(),
    scoring: z.enum(COMPETITION_SCORINGS),
    countsTowardTeam: z.boolean().default(false),
    group: z.string().min(1).max(120).nullish(),
    /** How the Competition is run; a Bracket's Entrants aren't seeded yet. */
    format: z.enum(COMPETITION_FORMATS).default("placement"),
    /** A Bracket's settings; one without them gets the default. */
    bracketConfig: bracketConfigSchema.nullish(),
    /** A Head-to-head's draws and Best of; omitted for the default (Best of 3). */
    seriesConfig: seriesConfigSchema.optional(),
    /** A League's Pairing and rounds; omitted is a round robin. Set on insert only. */
    leagueConfig: leagueConfigSchema.optional(),
    /**
     * A Head-to-head's two Entrants, or a League's (2 or more, in Seed
     * Position order): Participant display names (individual) or Team
     * names (team) from this seed. Added when absent (a League's only
     * while it has no Entrant and no Match); a reload changes nothing.
     */
    entrants: z.array(z.string().min(1).max(120)).min(2).optional(),
    /**
     * The Competition's Hosts: Participant display names from this seed's
     * roster (ADR 0012). Added when absent; a reload never removes one.
     */
    hosts: z.array(z.string().min(1).max(120)).optional(),
    /** A Best score Competition's Team score; omitted for Best member. */
    bestScoreConfig: bestScoreConfigSchema.optional(),
    /** An individual `participation` Competition's points per Participant; omitted is 1. A team one takes `placementPoints` instead. */
    participationPoints: participationPointsSchema.nullish(),
    /** A `participation` Competition's Self check-in switch; omitted is off. */
    selfCheckIn: z.boolean().nullish(),
    /**
     * The Score direction: Placement's (omitted is none) or Best score's
     * (higher or lower; omitted is higher). Set on insert only.
     */
    scoreDirection: z.enum(SCORE_DIRECTIONS).optional(),
    /** The Scores' unit label, like "sec" (Placement or Best score). Set on insert only. */
    scoreUnit: z.string().trim().min(1).max(20).optional(),
    /**
     * A Placement or League Competition seeded Closed, with its real time
     * and author (all three together): the loader writes its generated
     * Points Entries as Close does. Set on insert only.
     */
    closed: z.literal(true).optional(),
    closedAt: z.iso.datetime({ offset: true }).optional(),
    closedByEmail: emailSchema.optional(),
  })
  .refine((c) => !c.countsTowardTeam || c.scoring === "individual", {
    message: "countsTowardTeam can only be set on an individual Competition",
    path: ["countsTowardTeam"],
  })
  .superRefine((c, ctx) => {
    // The Format's limit on places (a Bracket's), one rule for every caller.
    const placeRefusal = placementLimitRefusal(
      c.format,
      c.placementPoints ?? null,
    );
    if (placeRefusal) {
      ctx.addIssue({
        code: "custom",
        message: placeRefusal,
        path: ["placementPoints"],
      });
    }
    // A seeded Close is Placement's and League's.
    if (
      c.format !== "placement" &&
      c.format !== "league" &&
      c.closed !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "closed is only for a placement or league Competition",
        path: ["closed"],
      });
    }
    // The Score direction and unit are Placement's, Best score's and
    // League's; Best score's is never none (the CHECK
    // `competition_score_direction_by_format`).
    if (
      c.format !== "placement" &&
      c.format !== "best-score" &&
      c.format !== "league"
    ) {
      for (const key of ["scoreDirection", "scoreUnit"] as const) {
        if (c[key] !== undefined) {
          ctx.addIssue({
            code: "custom",
            message: `${key} is only for a placement, best-score or league Competition`,
            path: [key],
          });
        }
      }
    }
    if (c.format === "best-score" && c.scoreDirection === "none") {
      ctx.addIssue({
        code: "custom",
        message: "a best-score Competition's scoreDirection is higher or lower",
        path: ["scoreDirection"],
      });
    }
    const closeKeys = [c.closed, c.closedAt, c.closedByEmail];
    if (
      closeKeys.some((v) => v !== undefined) &&
      !closeKeys.every((v) => v !== undefined)
    ) {
      ctx.addIssue({
        code: "custom",
        message: "closed needs closedAt and closedByEmail together",
        path: ["closed"],
      });
    }
    // A Bracket config is checked by its field; a Bracket must have one in
    // full, and any other Format takes none.
    if (c.format === "bracket" && c.bracketConfig == null) {
      ctx.addIssue({
        code: "custom",
        message:
          "a Bracket needs its bracketConfig (kind, entrantsPerMatch, advancePerMatch, thirdPlaceMatch, rounds)",
        path: ["bracketConfig"],
      });
    }
    // A seed has no Entrants yet, so only the config half of the 3rd place
    // Match rule applies; Generate checks the Entrant count.
    const thirdPlace =
      c.bracketConfig &&
      thirdPlaceRefusal(c.bracketConfig, Number.POSITIVE_INFINITY);
    if (thirdPlace) {
      ctx.addIssue({
        code: "custom",
        message: thirdPlace,
        path: ["bracketConfig", "thirdPlaceMatch"],
      });
    }
    if (c.bracketConfig != null && c.format !== "bracket") {
      ctx.addIssue({
        code: "custom",
        message: "bracketConfig is only for a Bracket",
        path: ["bracketConfig"],
      });
    }
    // Participation settings only on a `participation` Competition: an
    // individual one takes N and no Placement Points, a team one Placement
    // Points and no N (the database CHECK `competition_participation_columns`).
    const participationKeys = ["participationPoints", "selfCheckIn"] as const;
    if (c.format !== "participation") {
      for (const key of participationKeys) {
        if (c[key] != null) {
          ctx.addIssue({
            code: "custom",
            message: `${key} is only for a participation Competition`,
            path: [key],
          });
        }
      }
    } else if (c.scoring === "team") {
      if (c.participationPoints != null) {
        ctx.addIssue({
          code: "custom",
          message: "participationPoints is only for an individual Competition",
          path: ["participationPoints"],
        });
      }
      if (c.placementPoints == null) {
        ctx.addIssue({
          code: "custom",
          message:
            "placementPoints is required for a team participation Competition",
          path: ["placementPoints"],
        });
      }
    } else if (c.placementPoints != null) {
      ctx.addIssue({
        code: "custom",
        message: "placementPoints is only for a team participation Competition",
        path: ["placementPoints"],
      });
    }
    // Each Format's own settings only on that Format (the database CHECKs
    // `competition_series_config_head_to_head` and
    // `competition_best_score_config_best_score`), so a bad seed is a zod
    // error.
    if (c.format !== "head-to-head" && c.seriesConfig !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "seriesConfig is only for a head-to-head Competition",
        path: ["seriesConfig"],
      });
    }
    if (
      c.format !== "head-to-head" &&
      c.format !== "league" &&
      c.entrants !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        message: "entrants is only for a head-to-head or league Competition",
        path: ["entrants"],
      });
    }
    if (c.format === "head-to-head" && c.entrants && c.entrants.length !== 2) {
      ctx.addIssue({
        code: "custom",
        message: "a head-to-head has exactly 2 entrants",
        path: ["entrants"],
      });
    }
    if (
      c.format === "head-to-head" &&
      c.entrants &&
      c.entrants[0] === c.entrants[1]
    ) {
      ctx.addIssue({
        code: "custom",
        message: "a head-to-head's 2 entrants are different",
        path: ["entrants"],
      });
    }
    if (c.leagueConfig !== undefined && c.format !== "league") {
      ctx.addIssue({
        code: "custom",
        message: "leagueConfig is only for a League",
        path: ["leagueConfig"],
      });
    }
    if (c.format === "league" && c.entrants) {
      if (new Set(c.entrants).size !== c.entrants.length) {
        ctx.addIssue({
          code: "custom",
          message: "a League's entrants are all different",
          path: ["entrants"],
        });
      }
      const rounds = roundsError(
        c.leagueConfig ?? DEFAULT_LEAGUE_CONFIG,
        c.entrants.length,
      );
      if (rounds && c.leagueConfig?.rounds != null) {
        ctx.addIssue({
          code: "custom",
          message: rounds,
          path: ["leagueConfig", "rounds"],
        });
      }
    }
    if (c.format !== "best-score" && c.bestScoreConfig !== undefined) {
      ctx.addIssue({
        code: "custom",
        message: "bestScoreConfig is only for a best-score Competition",
        path: ["bestScoreConfig"],
      });
    }
  });

/** The War Week settings form's raw fields, all as the inputs hold them. */
export type WarWeekSettingsInput = {
  storyTheme: string;
  startDate: string;
  endDate: string;
  mode: string;
  teamLabel: string;
  leaderTitle: string;
  slackChannelUrl: string;
  wikiUrl: string;
  primaryColor: string;
  primaryForegroundColor: string;
  accentColor: string;
  backgroundColor: string;
  foregroundColor: string;
  /** The derived palette's overrides; blank means derived. */
  overridePrimaryColor: string;
  overridePrimaryForegroundColor: string;
  overrideAccentColor: string;
  overrideBackgroundColor: string;
  overrideForegroundColor: string;
  logoUrl: string;
  bannerUrl: string;
  fontPreset: string;
  /** Blank until the War Week ends (or for an edition with no Winner). */
  winner: string;
  /** Short lines, one per line. */
  highlights: string;
};

/** The derived palette's override columns. */
export type OverrideColumn =
  | "overridePrimaryColor"
  | "overridePrimaryForegroundColor"
  | "overrideAccentColor"
  | "overrideBackgroundColor"
  | "overrideForegroundColor";

const DATE_RANGE_FIELDS = ["startDate", "endDate"] as const;

// The background with the overrides: a background crossing light and dark
// clears the overrides (the form resets them), so they save with it.
const SCHEME_FIELDS = [
  "backgroundColor",
  "overridePrimaryColor",
  "overridePrimaryForegroundColor",
  "overrideAccentColor",
  "overrideBackgroundColor",
  "overrideForegroundColor",
] as const satisfies readonly (keyof WarWeekSettingsInput)[];

/**
 * The settings fields that autosave together with `field`: the date range
 * as one, the background with every override, any other field alone.
 */
export function settingsSaveGroup(
  field: keyof WarWeekSettingsInput,
): readonly (keyof WarWeekSettingsInput)[] {
  for (const group of [DATE_RANGE_FIELDS, SCHEME_FIELDS]) {
    if ((group as readonly string[]).includes(field)) return group;
  }
  return [field];
}

/**
 * Validated settings, keyed by the `war_week` columns they update. The
 * overrides are optional here: the mutation leaves an omitted key's column
 * as it was. Through the action, though, `settingsSchema` turns a missing
 * override key into null, so callers of the action must send all five.
 */
export type WarWeekSettingsValues = Partial<Pick<WarWeek, OverrideColumn>> &
  Pick<
    WarWeek,
    | "storyTheme"
    | "startDate"
    | "endDate"
    | "mode"
    | "teamLabel"
    | "leaderTitle"
    | "slackChannelUrl"
    | "wikiUrl"
    | "primaryColor"
    | "primaryForegroundColor"
    | "accentColor"
    | "backgroundColor"
    | "foregroundColor"
    | "logoUrl"
    | "bannerUrl"
    | "fontPreset"
    | "winner"
    | "highlights"
  >;

/** The form's starting fields from the War Week row. */
export function settingsInputFrom(warWeek: WarWeek): WarWeekSettingsInput {
  return {
    storyTheme: warWeek.storyTheme,
    startDate: warWeek.startDate,
    endDate: warWeek.endDate,
    mode: warWeek.mode,
    teamLabel: warWeek.teamLabel,
    leaderTitle: warWeek.leaderTitle,
    slackChannelUrl: warWeek.slackChannelUrl,
    wikiUrl: warWeek.wikiUrl ?? "",
    primaryColor: warWeek.primaryColor,
    primaryForegroundColor: warWeek.primaryForegroundColor,
    accentColor: warWeek.accentColor,
    backgroundColor: warWeek.backgroundColor,
    foregroundColor: warWeek.foregroundColor,
    overridePrimaryColor: warWeek.overridePrimaryColor ?? "",
    overridePrimaryForegroundColor:
      warWeek.overridePrimaryForegroundColor ?? "",
    overrideAccentColor: warWeek.overrideAccentColor ?? "",
    overrideBackgroundColor: warWeek.overrideBackgroundColor ?? "",
    overrideForegroundColor: warWeek.overrideForegroundColor ?? "",
    logoUrl: warWeek.logoUrl ?? "",
    bannerUrl: warWeek.bannerUrl ?? "",
    fontPreset: warWeek.fontPreset,
    winner: warWeek.winner ?? "",
    highlights: warWeek.highlights.join("\n"),
  };
}

const trim = (value: unknown) =>
  typeof value === "string" ? value.trim() : value;

/** One trimmed line per entry, blank lines dropped. */
export function splitLines(value: unknown): unknown {
  if (value === undefined || value === null) return [];
  if (typeof value !== "string") return value;
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

/** Trims, then applies the seed's rule for the field. */
export function trimmed<T extends ZodType>(schema: T) {
  return z.preprocess(trim, schema);
}

/** Trims, turns blank into null, then applies the seed's (nullish) rule. */
export function optional<T extends ZodType>(schema: T) {
  return z
    .preprocess((value) => trim(value) || null, schema)
    .transform((value) => value ?? null);
}

const seed = warWeekSettingsSeedShape;

const settingsShape = {
  storyTheme: trimmed(seed.storyTheme),
  startDate: trimmed(seed.startDate),
  endDate: trimmed(seed.endDate),
  mode: seed.mode,
  teamLabel: trimmed(seed.teamLabel),
  leaderTitle: trimmed(seed.leaderTitle),
  slackChannelUrl: trimmed(seed.slackChannelUrl),
  wikiUrl: optional(seed.wikiUrl),
  primaryColor: trimmed(seed.primary),
  primaryForegroundColor: trimmed(seed.primaryForeground),
  accentColor: trimmed(seed.accent),
  backgroundColor: trimmed(seed.background),
  foregroundColor: trimmed(seed.foreground),
  overridePrimaryColor: optional(seed.overridePrimary),
  overridePrimaryForegroundColor: optional(seed.overridePrimaryForeground),
  overrideAccentColor: optional(seed.overrideAccent),
  overrideBackgroundColor: optional(seed.overrideBackground),
  overrideForegroundColor: optional(seed.overrideForeground),
  logoUrl: optional(seed.logoUrl),
  bannerUrl: optional(seed.bannerUrl),
  fontPreset: seed.fontPreset,
  winner: optional(seed.winner),
  highlights: z.preprocess(splitLines, seed.highlights),
} satisfies Record<keyof WarWeekSettingsInput, ZodType>;

const settingsSchema = z
  .object(settingsShape)
  .refine((s) => s.startDate <= s.endDate, {
    error: "Start date must not be after the end date.",
    path: ["startDate"],
  });

const daySchema = z.object({
  date: trimmed(daySeedShape.date),
  dayTheme: trimmed(daySeedShape.dayTheme),
  description: optional(daySeedShape.description),
});

export type DayInput = {
  date: string;
  dayTheme: string;
  description?: string | null;
};
/**
 * A parsed Day. `optional()` reads an omitted or blank `description` as
 * null, so a parsed Day always carries one and a write sets it: a caller
 * that leaves it out clears the Day's description.
 */
export type DayValues = Omit<z.infer<typeof daySchema>, "description"> & {
  description?: string | null;
};

const teamSchema = z.object({
  name: trimmed(teamSeedSchema.shape.name),
  color: trimmed(teamSeedSchema.shape.color),
  logoUrl: optional(teamSeedSchema.shape.logoUrl),
});

export type TeamInput = { name: string; color: string; logoUrl: string };
export type TeamValues = Pick<Team, "name" | "color" | "logoUrl">;

const participantSchema = z
  .object({
    displayName: trimmed(participantSeedSchema.shape.displayName),
    companyTag: optional(participantSeedSchema.shape.companyTag),
    email: optional(participantSeedSchema.shape.email),
    /** A Team id of this War Week; blank means no Team. */
    teamId: optional(z.uuid({ error: "Choose a Team." }).nullish()),
    isLeader: z.boolean(),
  })
  .refine((p) => !p.isLeader || p.teamId !== null, {
    error: "A Leader needs a Team.",
    path: ["isLeader"],
  });

export type ParticipantInput = {
  displayName: string;
  companyTag: string;
  email: string;
  teamId: string;
  isLeader: boolean;
};
export type ParticipantValues = Pick<
  Participant,
  "displayName" | "companyTag" | "email" | "teamId" | "isLeader"
>;

export type CompetitionInput = {
  name: string;
  description: string;
  scoring: string;
  /** Points for 1st, 2nd, 3rd…, separated by commas or spaces. */
  placementPoints: string;
  countsTowardTeam: boolean;
  group: string;
  /**
   * How to run the Competition, chosen only on create; the edit form never
   * sends one (the Format changes only through the Bracket actions).
   * Blank (or omitted) means "placement".
   */
  format?: string;
};
export type CompetitionValues = Pick<
  Competition,
  | "name"
  | "description"
  | "scoring"
  | "placementPoints"
  | "countsTowardTeam"
  | "competitionGroup"
>;

/**
 * A new Competition's fields, with the Format an Organizer chose on create.
 * Defaults in `createCompetition` when omitted (a direct mutation call that
 * predates the create form's Format field), to "placement". `createCompetition`
 * alone owns the Format's `bracketConfig` default (`DEFAULT_BRACKET_CONFIG`).
 */
export type CompetitionCreateValues = CompetitionValues &
  Partial<Pick<Competition, "format">>;

const FIELD_LABELS: Record<string, string> = {
  storyTheme: "Story Theme",
  startDate: "Start date",
  endDate: "End date",
  winner: "Winner",
  highlights: "Highlights",
  mode: "Mode",
  teamLabel: "Team Label",
  leaderTitle: "Leader Title",
  slackChannelUrl: "Slack URL",
  wikiUrl: "Wiki URL",
  primaryColor: "Primary color",
  primaryForegroundColor: "Primary text color",
  accentColor: "Accent color",
  backgroundColor: "Background color",
  foregroundColor: "Text color",
  overridePrimaryColor: "Primary override",
  overridePrimaryForegroundColor: "Primary text override",
  overrideAccentColor: "Accent override",
  overrideBackgroundColor: "Background override",
  overrideForegroundColor: "Text override",
  logoUrl: "Logo URL",
  bannerUrl: "Banner URL",
  fontPreset: "Font",
  date: "Date",
  dayTheme: "Day Theme",
  name: "Name",
  color: "Color",
  displayName: "Display name",
  companyTag: "Company Tag",
  email: "Email",
  description: "Description",
  scoring: "Scoring",
  placementPoints: "Placement Points",
  group: "Group",
  format: "Format",
};

/** A setup field's label, as its errors name it ("Slack URL"). */
export function setupFieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** A zod issue worded as "must …", or null when it is already a sentence. */
function mustPhrase(issue: z.core.$ZodIssue): string | null {
  switch (issue.code) {
    case "too_small":
      if (issue.origin === "string") return "must not be empty";
      if (issue.origin !== "number") return null;
      if (issue.message.startsWith("must ")) return issue.message;
      return `must be ${issue.inclusive ? "at least" : "more than"} ${issue.minimum}`;
    case "too_big":
      if (issue.origin === "string") {
        return `must be at most ${issue.maximum} characters`;
      }
      return issue.message.startsWith("must ") ? issue.message : null;
    case "custom":
      return issue.message.startsWith("must ") ? issue.message : null;
    case "invalid_value":
      return `must be one of ${issue.values.join(", ")}`;
    case "invalid_format":
      if (issue.message.startsWith("must ")) return issue.message;
      if (issue.format === "url") return "must be an https URL";
      if (issue.format === "email") return "must be a valid email";
      if (issue.format === "date") return "must be a date";
      return null;
    case "invalid_type":
      return "must be filled in";
    default:
      return null;
  }
}

/**
 * Parses a setup form, worded as "<Field label> must …" from `labels`
 * (on top of the War Week and Day labels) unless `describe` words it.
 */
export function parseWith<T>(
  schema: ZodType<T>,
  input: unknown,
  describe: (issue: z.core.$ZodIssue) => string | null = () => null,
  labels: Record<string, string> = {},
): Parsed<T> {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  return {
    ok: false,
    ...fieldErrorsFrom(result.error, {
      describe: (issue) => {
        // Not an object at all: only a malformed direct call gets here.
        if (issue.path.length === 0 && issue.code === "invalid_type") {
          return "The form's fields are missing.";
        }
        const special = describe(issue);
        if (special) return special;
        const field = String(issue.path[0]);
        const label = labels[field] ?? FIELD_LABELS[field];
        const phrase = mustPhrase(issue);
        return label && phrase ? `${label} ${phrase}.` : null;
      },
    }),
  };
}

/** Validates the War Week settings form. Never throws; returns the first error. */
export function parseWarWeekSettingsInput(
  input: WarWeekSettingsInput,
): Parsed<WarWeekSettingsValues> {
  return parseWith(settingsSchema, input);
}

/**
 * Validates the settings fields one autosave sends: some of the form's
 * fields, each a string. Never throws. Their values are checked once laid
 * over the stored ones (`mergeWarWeekSettings`).
 */
export function parseWarWeekSettingsFields(
  input: unknown,
): Parsed<Partial<WarWeekSettingsInput>> {
  const missing = {
    ok: false,
    error: "The form's fields are missing.",
    fieldErrors: {},
  } as const;
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return missing;
  }
  const entries = Object.entries(input);
  if (entries.length === 0) return missing;
  for (const [field, value] of entries) {
    if (!Object.hasOwn(settingsShape, field)) return missing;
    if (typeof value !== "string") {
      const error = `${FIELD_LABELS[field]} must be filled in.`;
      return { ok: false, error, fieldErrors: { [field]: error } };
    }
  }
  return { ok: true, value: input as Partial<WarWeekSettingsInput> };
}

/**
 * Lays an autosave's `fields` over the `stored` settings and validates the
 * whole, so rules across fields (the date range) hold against the newest
 * stored values. `values` is the whole result, for the guards; `changed`
 * is only the columns `fields` names, so a save never writes back a
 * column it didn't send.
 */
export function mergeWarWeekSettings(
  stored: WarWeekSettingsInput,
  fields: Partial<WarWeekSettingsInput>,
): Parsed<{
  values: WarWeekSettingsValues;
  changed: Partial<WarWeekSettingsValues>;
}> {
  const parsed = parseWarWeekSettingsInput({ ...stored, ...fields });
  if (!parsed.ok) return parsed;
  const values = parsed.value;
  const changed = Object.fromEntries(
    Object.keys(fields).map((field) => [
      field,
      values[field as keyof WarWeekSettingsValues],
    ]),
  ) as Partial<WarWeekSettingsValues>;
  return { ok: true, value: { values, changed } };
}

/** Validates one Day's form. Never throws; returns the first error. */
export function parseDayInput(input: DayInput): Parsed<DayValues> {
  return parseWith(daySchema, input);
}

/** Validates one Team's form. Never throws; returns the first error. */
export function parseTeamInput(input: TeamInput): Parsed<TeamValues> {
  return parseWith(teamSchema, input);
}

/** Validates one Participant's form. Never throws; returns the first error. */
export function parseParticipantInput(
  input: ParticipantInput,
): Parsed<ParticipantValues> {
  return parseWith(participantSchema, input, (issue) =>
    issue.path[0] === "isLeader" ? issue.message : null,
  );
}

/** The Competition form's fields, as strings (and one checkbox). */
const competitionInputShape = z.object({
  name: z.string(),
  description: z.string(),
  scoring: z.string(),
  placementPoints: z.string(),
  countsTowardTeam: z.boolean(),
  group: z.string(),
});

/**
 * Validates one Competition's form against the seed's Competition rules.
 * Never throws; returns the first error.
 */
export function parseCompetitionInput(
  input: CompetitionInput,
): Parsed<CompetitionValues> {
  // Check the shape before touching a field: a direct POST can send anything.
  const shape = parseWith(competitionInputShape, input);
  if (!shape.ok) return shape;
  input = shape.value;
  const places = parsePlacementPointsText(input.placementPoints);
  if (!places.ok) return places;

  const parsed = parseWith(
    competitionSeedSchema,
    {
      name: input.name.trim(),
      description: input.description.trim() || null,
      scoring: input.scoring,
      placementPoints: places.value,
      countsTowardTeam: input.countsTowardTeam,
      group: input.group.trim() || null,
    },
    (issue) => {
      // The seed words these for seed authors; reword them for the form.
      if (issue.path[0] === "countsTowardTeam") {
        return "Only an individual Competition can count toward the Team.";
      }
      if (issue.path[0] !== "placementPoints" || issue.path.length > 1) {
        return null;
      }
      if (issue.code !== "custom") return null;
      return "Each place's Placement Points must be no more than the place above it.";
    },
  );
  if (!parsed.ok) return parsed;
  // Only the setup fields: the Format and its settings (Bracket, Head-to-head, Best score)
  // are set through their own actions, never a setup save.
  const value = parsed.value;
  return {
    ok: true,
    value: {
      name: value.name,
      description: descriptionContent(value.description),
      scoring: value.scoring,
      placementPoints: value.placementPoints ?? null,
      countsTowardTeam: value.countsTowardTeam,
      competitionGroup: value.group ?? null,
    },
  };
}

const formatFieldSchema = z.object({
  format: z.enum(COMPETITION_FORMATS).default("placement"),
});

/**
 * Validates a new Competition's form, adding the Format an Organizer chose
 * on create. Only validates and returns the Format; `createCompetition`
 * (`src/mutations/setup.ts`) alone owns defaulting a Bracket's
 * `bracketConfig` (`DEFAULT_BRACKET_CONFIG`, `src/lib/bracket/config.ts`). The edit
 * form never sends a Format: its Format changes only through the Bracket
 * actions (`setCompetitionFormat`).
 */
export function parseCreateCompetitionInput(
  input: CompetitionInput,
): Parsed<CompetitionCreateValues> {
  const base = parseCompetitionInput(input);
  if (!base.ok) return base;
  const formatParsed = parseWith(formatFieldSchema, {
    format:
      typeof input.format === "string"
        ? input.format.trim() || "placement"
        : (input.format ?? "placement"),
  });
  if (!formatParsed.ok) return formatParsed;
  const { format } = formatParsed.value;
  const tooMany = placementLimitRefusal(format, base.value.placementPoints);
  if (tooMany) {
    return {
      ok: false,
      error: tooMany,
      fieldErrors: { placementPoints: tooMany },
    };
  }
  return { ok: true, value: { ...base.value, format } };
}

const FREE_FOR_ALL_HAS_NO_TEAMS = "A free-for-all War Week has no Teams.";

/** Refuses a Team in a free-for-all or one whose name is taken. */
export function teamGuardError(
  values: Pick<TeamValues, "name">,
  ctx: { mode: WarWeek["mode"]; nameTaken: boolean },
): string | null {
  if (ctx.mode === "free-for-all") {
    return `${FREE_FOR_ALL_HAS_NO_TEAMS} Switch the mode to teams first.`;
  }
  if (ctx.nameTaken) return `There's already a Team named "${values.name}".`;
  return null;
}

/**
 * Refuses a Participant whose email or display name another Participant of
 * the War Week has, or whose Team isn't one of the War Week's.
 */
export function participantGuardError(
  values: Pick<ParticipantValues, "displayName" | "email" | "teamId">,
  ctx: {
    mode: WarWeek["mode"];
    teamExists: boolean;
    nameTaken: boolean;
    /** The display name of the other Participant with this email. */
    emailTakenBy: string | null;
  },
): string | null {
  if (values.teamId !== null) {
    if (ctx.mode === "free-for-all") return FREE_FOR_ALL_HAS_NO_TEAMS;
    if (!ctx.teamExists) return "That Team no longer exists.";
  }
  if (ctx.emailTakenBy !== null) {
    return `${values.email} is already ${ctx.emailTakenBy}'s email.`;
  }
  if (ctx.nameTaken) {
    return `There's already a Participant named "${values.displayName}".`;
  }
  return null;
}

/** A Closed Placement Competition's refusal of a setup or Format change. */
export const PLACEMENT_IS_CLOSED =
  "This Competition is closed. Reopen it first.";

/**
 * Refuses a Competition whose name is taken, a team Competition in a
 * free-for-all, a scoring change that would strand its Points Entries, or a
 * scoring change while it's Closed or closed. Placement Points change
 * any time; while Closed or closed they apply at the next Close or
 * Close (ticket 101).
 */
export function competitionGuardError(
  values: Pick<CompetitionValues, "name" | "scoring" | "placementPoints"> & {
    /** The chosen Format on create; an edit keeps `existing.format`. */
    format?: Competition["format"];
  },
  ctx: {
    mode: WarWeek["mode"];
    nameTaken: boolean;
    /** The saved Competition when editing. */
    existing: {
      scoring: Competition["scoring"];
      placementPoints: Competition["placementPoints"];
      pointsEntryCount: number;
      closedAt: Competition["closedAt"];
      /** Omitted for a Competition that predates Formats: not Head-to-head or Best score. */
      format?: Competition["format"];
    } | null;
  },
): string | null {
  if (ctx.nameTaken) {
    return `There's already a Competition named "${values.name}".`;
  }
  if (ctx.mode === "free-for-all" && values.scoring === "team") {
    return "A free-for-all War Week has no Teams, so its Competitions are individual.";
  }
  const existing = ctx.existing;
  const format = values.format ?? existing?.format;
  const tooMany =
    format && placementLimitRefusal(format, values.placementPoints);
  if (tooMany) return tooMany;
  if (existing && existing.closedAt && existing.scoring !== values.scoring) {
    // A closed Head-to-head, Best score or `participation` Competition
    // reuses `closed_at` (R3 decision 1); so does a Closed Placement.
    if (existing.format === "placement") return PLACEMENT_IS_CLOSED;
    return (existing.format !== undefined && isLoggedFormat(existing.format)) ||
      existing.format === "participation" ||
      existing.format === "league"
      ? "This Competition is closed. Reopen the Competition first."
      : "This Competition's Bracket is closed. Reopen the Bracket first.";
  }
  if (
    existing &&
    existing.scoring !== values.scoring &&
    existing.pointsEntryCount > 0
  ) {
    return `This Competition has ${counted(existing.pointsEntryCount, "Points Entry", "Points Entries")}, so its scoring can't change. Delete them first.`;
  }
  return null;
}

function counted(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

/** How many of a record refer to another, with its singular and plural. */
export type UsageCount = [count: number, singular: string, plural: string];

/** ["3 Participants", "1 Points Entry"], skipping zero counts. */
export function countedParts(counts: UsageCount[]): string[] {
  return counts
    .filter(([n]) => n > 0)
    .map(([n, singular, plural]) => counted(n, singular, plural));
}

/**
 * Refuses deleting a record that other records still refer to, naming each
 * count, e.g. "This Team has 3 Participants and 1 Points Entry. …". Null
 * when every count is 0. There's no cascading delete of scoring data.
 */
export function inUseError(
  thing: string,
  counts: UsageCount[],
  fix: string,
): string | null {
  const parts = countedParts(counts);
  if (parts.length === 0) return null;
  const list =
    parts.length === 1
      ? parts[0]
      : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
  return `This ${thing} has ${list}. ${fix}`;
}

/**
 * Refuses a settings save that would leave the War Week inconsistent:
 * Teams in a free-for-all or Days outside its dates. No cascading changes;
 * the Organizer fixes it first.
 */
export function settingsGuardError(
  values: WarWeekSettingsValues,
  ctx: { teamCount: number; dayDates: string[] },
): string | null {
  if (values.mode === "free-for-all" && ctx.teamCount > 0) {
    const teams = ctx.teamCount === 1 ? "1 Team" : `${ctx.teamCount} Teams`;
    return `This War Week has ${teams}. Delete ${ctx.teamCount === 1 ? "it" : "them"} before switching to free-for-all.`;
  }
  return dayOutsideRangeError(ctx.dayDates, values.startDate, values.endDate);
}

/** Refuses a Day outside the War Week's dates or on a date already taken. */
export function dayGuardError(
  values: DayValues,
  ctx: { startDate: string; endDate: string; otherDayDates: string[] },
): string | null {
  if (values.date < ctx.startDate || values.date > ctx.endDate) {
    return `A Day must fall within the War Week (${ctx.startDate} to ${ctx.endDate}).`;
  }
  if (ctx.otherDayDates.includes(values.date)) {
    return `There's already a Day on ${values.date}.`;
  }
  return null;
}

/** Refuses deleting a Day that still has Schedule Items. */
export function dayDeleteGuardError(scheduleItemCount: number): string | null {
  if (scheduleItemCount === 0) return null;
  return scheduleItemCount === 1
    ? "This Day has 1 Schedule Item. Delete or move it first."
    : `This Day has ${scheduleItemCount} Schedule Items. Delete or move them first.`;
}
