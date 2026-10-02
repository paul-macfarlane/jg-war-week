import { type ZodType, z } from "zod";

import type { Competition, Participant, Team, WarWeek } from "@/db/schema";
import { heatsConfigSchema } from "@/lib/bracket/config";
import { HEX_COLOR } from "@/lib/color";
import { MAX_PLACEMENTS } from "@/lib/competitions";
import { dayOutsideRangeError } from "@/lib/day-range";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  FONT_PRESETS,
  GAME_TYPES,
  WAR_WEEK_MODES,
} from "@/lib/enums";
import { fieldErrorsFrom } from "@/lib/form-errors";
import { gamesConfigSchema } from "@/lib/games/config";
import { POINTS_NUMBER, pointsSchema as points } from "@/lib/points-entry";
import type { Parsed } from "@/lib/result";

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

/** A Day's own fields; the seed adds its Schedule Items. */
export const daySeedShape = {
  date: z.iso.date(),
  dayTheme: z.string().min(1).max(120),
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
  .object({
    name: z.string().min(1).max(120),
    description: z.string().max(2000).nullish(),
    maxPoints: points.positive().nullish(),
    /** Placement Points for 1st, 2nd, 3rd…, highest first. */
    placementPoints: z
      .array(points.min(0, { error: "must be at least 0" }))
      .min(1, { error: "at least 1 place" })
      .max(MAX_PLACEMENTS, { error: `at most ${MAX_PLACEMENTS} places` })
      .refine((list) => list.every((p, i) => i === 0 || p <= list[i - 1]), {
        error: "each place must be worth no more than the one above it",
      })
      .nullish(),
    scoring: z.enum(COMPETITION_SCORINGS),
    countsTowardTeam: z.boolean().default(false),
    group: z.string().min(1).max(120).nullish(),
    /** How the Competition is run; a Bracket's Entrants aren't seeded yet. */
    format: z.enum(COMPETITION_FORMATS).default("points"),
    /** The Format's settings; a heats Competition without one gets the default. */
    bracketConfig: heatsConfigSchema.nullish(),
    /** A `games` Competition's Game Type: required for `games`, else absent. */
    gameType: z.enum(GAME_TYPES).nullish(),
    /** The Game Type's settings (`src/lib/games/config.ts`); omitted for the default. */
    gameConfig: z.unknown().optional(),
    /** A `games` Competition open to everyone eligible; omitted means a fixed list. */
    entrantsOpen: z.boolean().optional(),
  })
  .refine(
    (c) =>
      c.maxPoints == null ||
      c.placementPoints == null ||
      c.placementPoints[0] <= c.maxPoints,
    {
      message: "1st place can't be worth more than maxPoints",
      path: ["placementPoints"],
    },
  )
  .refine((c) => !c.countsTowardTeam || c.scoring === "individual", {
    message: "countsTowardTeam can only be set on an individual Competition",
    path: ["countsTowardTeam"],
  })
  .superRefine((c, ctx) => {
    // A heats config is checked by its field; any other Format takes none.
    if (c.bracketConfig != null && c.format !== "heats") {
      ctx.addIssue({
        code: "custom",
        message: "bracketConfig is only for a heats Competition",
        path: ["bracketConfig"],
      });
    }
    // A Game Type exactly when the Format is games (the database CHECK
    // `competition_game_type_iff_games`), so a bad seed is a zod error.
    if (c.format === "games") {
      if (c.gameType == null) {
        ctx.addIssue({
          code: "custom",
          message: "gameType is required for a games Competition",
          path: ["gameType"],
        });
      } else if (c.gameConfig != null) {
        const config = gamesConfigSchema(c.gameType).safeParse(c.gameConfig);
        if (!config.success) {
          ctx.addIssue({
            code: "custom",
            message: `gameConfig: ${config.error.issues[0].message}`,
            path: ["gameConfig"],
          });
        }
      }
      return;
    }
    for (const key of ["gameType", "gameConfig", "entrantsOpen"] as const) {
      if (c[key] != null) {
        ctx.addIssue({
          code: "custom",
          message: `${key} is only for a games Competition`,
          path: [key],
        });
      }
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

const settingsSchema = z
  .object({
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
  })
  .refine((s) => s.startDate <= s.endDate, {
    error: "Start date must not be after the end date.",
    path: ["startDate"],
  });

const daySchema = z.object({
  date: trimmed(daySeedShape.date),
  dayTheme: trimmed(daySeedShape.dayTheme),
});

export type DayInput = { date: string; dayTheme: string };
export type DayValues = z.infer<typeof daySchema>;

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
  maxPoints: string;
  /** Points for 1st, 2nd, 3rd…, separated by commas or spaces. */
  placementPoints: string;
  countsTowardTeam: boolean;
  group: string;
  /**
   * How to run the Competition, chosen only on create; the edit form never
   * sends one (the Format changes only through the Bracket actions).
   * Blank (or omitted) means "points".
   */
  format?: string;
  /** The Game Type, read only when the Format is `games`. */
  gameType?: string;
};
export type CompetitionValues = Pick<
  Competition,
  | "name"
  | "description"
  | "scoring"
  | "maxPoints"
  | "placementPoints"
  | "countsTowardTeam"
  | "competitionGroup"
>;

/**
 * A new Competition's fields, with the Format an Organizer chose on create.
 * Defaults in `createCompetition` when omitted (a direct mutation call that
 * predates the create form's Format field), to "points". `createCompetition`
 * alone owns the Format's `bracketConfig` default (`defaultConfig`).
 */
export type CompetitionCreateValues = CompetitionValues &
  Partial<Pick<Competition, "format" | "gameType">>;

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
  maxPoints: "Max points",
  placementPoints: "Placement Points",
  group: "Group",
  format: "Format",
};

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
  maxPoints: z.string(),
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
  const maxPoints = input.maxPoints.trim();
  if (maxPoints && !POINTS_NUMBER.test(maxPoints)) {
    const error = "Max points must be a number.";
    return { ok: false, error, fieldErrors: { maxPoints: error } };
  }
  const places = input.placementPoints.split(/[\s,]+/).filter(Boolean);
  if (!places.every((place) => POINTS_NUMBER.test(place))) {
    const error =
      "Placement Points must be numbers separated by commas, 1st place first.";
    return { ok: false, error, fieldErrors: { placementPoints: error } };
  }

  const parsed = parseWith(
    competitionSeedSchema,
    {
      name: input.name.trim(),
      description: input.description.trim() || null,
      scoring: input.scoring,
      maxPoints: maxPoints ? Number(maxPoints) : null,
      placementPoints: places.length > 0 ? places.map(Number) : null,
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
      if (issue.code === "too_big") {
        return `Placement Points cover at most ${issue.maximum} places.`;
      }
      if (issue.code !== "custom") return null;
      // Two seed refines share this path; the 1st-vs-max one names 1st.
      return issue.message.startsWith("1st")
        ? "1st place's Placement Points can't be more than Max points."
        : "Each place's Placement Points must be no more than the place above it.";
    },
  );
  if (!parsed.ok) return parsed;
  // Only the setup fields: the Format and its settings (Bracket or Games)
  // are set through their own actions, never a setup save.
  const value = parsed.value;
  return {
    ok: true,
    value: {
      name: value.name,
      description: value.description ?? null,
      scoring: value.scoring,
      maxPoints: value.maxPoints ?? null,
      placementPoints: value.placementPoints ?? null,
      countsTowardTeam: value.countsTowardTeam,
      competitionGroup: value.group ?? null,
    },
  };
}

const formatFieldSchema = z.object({
  format: z.enum(COMPETITION_FORMATS).default("points"),
});

/**
 * Validates a new Competition's form, adding the Format an Organizer chose
 * on create. Only validates and returns the Format; `createCompetition`
 * (`src/mutations/setup.ts`) alone owns defaulting a heats Format's
 * `bracketConfig` (`defaultConfig`, `src/lib/bracket/config.ts`). The edit
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
        ? input.format.trim() || "points"
        : (input.format ?? "points"),
  });
  if (!formatParsed.ok) return formatParsed;
  const { format } = formatParsed.value;
  if (format !== "games") return { ok: true, value: { ...base.value, format } };
  const gameType = z.enum(GAME_TYPES).safeParse(input.gameType);
  if (!gameType.success) {
    const error = "Choose a Game Type.";
    return { ok: false, error, fieldErrors: { gameType: error } };
  }
  return {
    ok: true,
    value: { ...base.value, format, gameType: gameType.data },
  };
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

/** Placement Points as either `null` or `[]` normalize to, for comparison. */
function normalizedPlacementPoints(
  points: CompetitionValues["placementPoints"],
): readonly number[] {
  return points ?? [];
}

/** Whether Placement Points changed, treating `null` and `[]` as the same. */
function placementPointsChanged(
  before: CompetitionValues["placementPoints"],
  after: CompetitionValues["placementPoints"],
): boolean {
  const a = normalizedPlacementPoints(before);
  const b = normalizedPlacementPoints(after);
  return a.length !== b.length || a.some((value, index) => value !== b[index]);
}

/**
 * Refuses a Competition whose name is taken, a team Competition in a
 * free-for-all, a scoring change that would strand its Points Entries, or a
 * scoring or Placement Points change while its Bracket is finalized.
 */
export function competitionGuardError(
  values: Pick<CompetitionValues, "name" | "scoring" | "placementPoints">,
  ctx: {
    mode: WarWeek["mode"];
    nameTaken: boolean;
    /** The saved Competition when editing. */
    existing: {
      scoring: Competition["scoring"];
      placementPoints: Competition["placementPoints"];
      pointsEntryCount: number;
      finalizedAt: Competition["finalizedAt"];
      /** Omitted for a Competition that predates Formats: not `games`. */
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
  if (
    existing &&
    existing.finalizedAt &&
    (existing.scoring !== values.scoring ||
      placementPointsChanged(existing.placementPoints, values.placementPoints))
  ) {
    // A closed `games` Competition reuses `finalized_at` (R3 decision 1).
    return existing.format === "games"
      ? "This Competition is closed. Reopen the Competition first."
      : "This Competition's Bracket is finalized. Un-finalize the Bracket first.";
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
