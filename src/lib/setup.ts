import { type ZodType, z } from "zod";

import type { Competition, Participant, Team, WarWeek } from "@/db/schema";
import { dayOutsideRangeError } from "@/lib/day-range";
import {
  competitionSeedSchema,
  daySeedSchema,
  participantSeedSchema,
  warWeekSettingsSeedShape as seed,
  teamSeedSchema,
} from "@/seed/schema";

export { dayOutsideRangeError } from "@/lib/day-range";

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
  logoUrl: string;
  bannerUrl: string;
  fontPreset: string;
  /** Blank until the War Week ends (or for an edition with no Winner). */
  winner: string;
  /** Short lines, one per line. */
  highlights: string;
};

/** Validated settings, keyed by the `war_week` columns they update. */
export type WarWeekSettingsValues = Pick<
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

// Field rules come from the seed schema so seed and setup can't drift.
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
  date: trimmed(daySeedSchema.shape.date),
  dayTheme: trimmed(daySeedSchema.shape.dayTheme),
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

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

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

  const issue = result.error.issues[0];
  // Not an object at all: only a malformed direct call gets here.
  if (issue.path.length === 0 && issue.code === "invalid_type") {
    return { ok: false, error: "The form's fields are missing." };
  }
  const special = describe(issue);
  if (special) return { ok: false, error: special };
  const field = String(issue.path[0]);
  const label = labels[field] ?? FIELD_LABELS[field];
  const phrase = mustPhrase(issue);
  return {
    ok: false,
    error: label && phrase ? `${label} ${phrase}.` : issue.message,
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

const NUMBER = /^-?\d+(\.\d+)?$/;

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
  if (maxPoints && !NUMBER.test(maxPoints)) {
    return { ok: false, error: "Max points must be a number." };
  }
  const places = input.placementPoints.split(/[\s,]+/).filter(Boolean);
  if (!places.every((place) => NUMBER.test(place))) {
    return {
      ok: false,
      error:
        "Placement Points must be numbers separated by commas, 1st place first.",
    };
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
  // The Format is set through the Bracket actions, never a setup save.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { group, format, ...value } = parsed.value;
  return {
    ok: true,
    value: {
      ...value,
      description: value.description ?? null,
      maxPoints: value.maxPoints ?? null,
      placementPoints: value.placementPoints ?? null,
      competitionGroup: group ?? null,
    },
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
    return "This Competition's Bracket is finalized. Un-finalize the Bracket first.";
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
