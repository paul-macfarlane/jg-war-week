import { z } from "zod";

import { isJahnelGroupEmail } from "@/lib/access";
import { announcementTitleSchema, videoUrlSchema } from "@/lib/announcements";
import { AWARD_DESCRIPTION_MAX, AWARD_NAME_MAX } from "@/lib/awards";
import { MAX_PLACEMENTS } from "@/lib/competitions";
import {
  pointsSchema as points,
  pointsEntryNoteSchema,
  pointsEntryTargetError,
} from "@/lib/points-entry";
import { contentInputSchema } from "@/lib/rich-text/content";

const hexColor = z
  .string()
  .max(32)
  .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "must be a hex color");

const themeUrl = z
  .string()
  .max(500)
  .regex(
    /^(\/[^\s]*|https:\/\/[^\s]+)$/,
    "must be a root-relative path or an https URL",
  );

const email = z.email().max(254).toLowerCase();

const jgEmail = email.refine(isJahnelGroupEmail, {
  error: "must be an @jahnelgroup.com email",
});

const httpsUrl = z.url({ protocol: /^https$/ }).max(500);

const clockTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be a 24-hour HH:MM time");

/**
 * A stable id for a seeded organizer-owned record (Points Entry, Award,
 * Announcement), unique within its list. The loader inserts a keyed record
 * only if it is absent and never updates or deletes it; see CONTEXT.md.
 */
const seedKey = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9-]+$/, "must be lowercase letters, digits and dashes");

export const scheduleItemSeedSchema = z
  .object({
    startTime: clockTime,
    endTime: clockTime.nullish(),
    title: z.string().min(1).max(200),
    host: z.string().max(200).nullish(),
    location: z.string().max(200).nullish(),
    virtualLink: httpsUrl.nullish(),
    description: contentInputSchema.nullish(),
    category: z.enum([
      "competition",
      "education",
      "social",
      "meal",
      "work",
      "other",
    ]),
    /** A Competition name from this seed. */
    competition: z.string().min(1).max(120).nullish(),
  })
  .refine((item) => !item.endTime || item.endTime > item.startTime, {
    message: "endTime must be after startTime",
    path: ["endTime"],
  });

export type ScheduleItemSeed = z.infer<typeof scheduleItemSeedSchema>;

export const daySeedSchema = z.object({
  date: z.iso.date(),
  dayTheme: z.string().min(1).max(120),
  scheduleItems: z.array(scheduleItemSeedSchema).default([]),
});

export type DaySeed = z.infer<typeof daySeedSchema>;

export const teamSeedSchema = z.object({
  name: z.string().min(1).max(80),
  color: hexColor,
  logoUrl: themeUrl.nullish(),
});

export type TeamSeed = z.infer<typeof teamSeedSchema>;

export const participantSeedSchema = z.object({
  displayName: z.string().min(1).max(120),
  companyTag: z.string().min(1).max(40).nullish(),
  email: email.nullish(),
  /** A Team name from this seed. */
  team: z.string().min(1).max(80).nullish(),
  isLeader: z.boolean().default(false),
});

export type ParticipantSeed = z.infer<typeof participantSeedSchema>;

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
    scoring: z.enum(["team", "individual"]),
    countsTowardTeam: z.boolean().default(false),
    group: z.string().min(1).max(120).nullish(),
    /** How the Competition is run; a Bracket's Entrants aren't seeded yet. */
    format: z.enum(["points", "single-elimination"]).default("points"),
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
  });

export type CompetitionSeed = z.infer<typeof competitionSeedSchema>;

export const pointsEntrySeedSchema = z
  .object({
    key: seedKey,
    /** A Competition name from this seed. */
    competition: z.string().min(1).max(120),
    /** A Team name from this seed; exactly one of team or participant. */
    team: z.string().min(1).max(80).nullish(),
    /** A Participant display name from this seed. */
    participant: z.string().min(1).max(120).nullish(),
    points,
    note: pointsEntryNoteSchema.nullish(),
    enteredByEmail: email,
    enteredAt: z.iso.datetime({ offset: true }),
  })
  .refine((entry) => (entry.team == null) !== (entry.participant == null), {
    message: "a Points Entry must target exactly one of team or participant",
    path: ["team"],
  });

export type PointsEntrySeed = z.infer<typeof pointsEntrySeedSchema>;

export const awardSeedSchema = z
  .object({
    key: seedKey,
    name: z.string().min(1).max(AWARD_NAME_MAX),
    description: z.string().max(AWARD_DESCRIPTION_MAX).nullish(),
    /** A Team name from this seed. */
    team: z.string().min(1).max(80).nullish(),
    /** Participant display names from this seed. */
    participants: z.array(z.string().min(1).max(120)).default([]),
  })
  .refine((a) => a.team != null || a.participants.length > 0, {
    message: "an Award needs at least one recipient (a team or participants)",
    path: ["participants"],
  });

export type AwardSeed = z.infer<typeof awardSeedSchema>;

export const announcementSeedSchema = z.object({
  key: seedKey,
  title: announcementTitleSchema,
  body: contentInputSchema,
  videoUrls: z.array(videoUrlSchema).default([]),
  pinned: z.boolean().default(false),
  authorEmail: email,
  publishedAt: z.iso.datetime({ offset: true }),
});

export type AnnouncementSeed = z.infer<typeof announcementSeedSchema>;

export const faqItemSeedSchema = z.object({
  question: z.string().min(1).max(300),
  answer: contentInputSchema,
});

export type FaqItemSeed = z.infer<typeof faqItemSeedSchema>;

/**
 * The War Week fields an Organizer can also edit in `/admin/setup`, so the
 * seed and the setup form share one set of field rules.
 */
export const warWeekSettingsSeedShape = {
  storyTheme: z.string().min(1).max(120),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  mode: z.enum(["teams", "free-for-all"]),
  teamLabel: z.string().min(1).max(40),
  leaderTitle: z.string().min(1).max(40),
  slackChannelUrl: z.url({ protocol: /^https$/ }).max(500),
  primary: hexColor,
  primaryForeground: hexColor,
  accent: hexColor,
  background: hexColor,
  foreground: hexColor,
  fontPreset: z.enum(["sans", "serif", "mono"]),
  logoUrl: themeUrl.nullish(),
  bannerUrl: themeUrl.nullish(),
  wikiUrl: themeUrl.nullish(),
  winner: z.string().max(200).nullish(),
  highlights: z.array(z.string().max(500)).default([]),
};

export const warWeekSeedSchema = z
  .object({
    edition: z
      .string()
      .min(1)
      .max(8)
      .regex(/^[a-z]+$/, "must be a lowercase roman numeral"),
    editionNumber: z.number().int().positive(),
    year: z.number().int(),
    // Seed-initialized only: `status`, `winner` and `highlights` (from the
    // settings shape) are set when the War Week is first inserted, never on
    // a reload.
    status: z.enum(["upcoming", "live", "complete"]),
    ...warWeekSettingsSeedShape,
    /**
     * Global Organizers this seed adds when missing; a load never removes
     * one (CONTEXT.md, "Seed idempotence rules").
     */
    organizers: z.array(jgEmail).default([]),
    days: z.array(daySeedSchema),
    teams: z.array(teamSeedSchema).default([]),
    participants: z.array(participantSeedSchema).default([]),
    competitions: z.array(competitionSeedSchema).default([]),
    pointsEntries: z.array(pointsEntrySeedSchema).default([]),
    awards: z.array(awardSeedSchema).default([]),
    announcements: z.array(announcementSeedSchema).default([]),
    faqItems: z.array(faqItemSeedSchema).default([]),
  })
  .refine((seed) => seed.startDate <= seed.endDate, {
    message: "startDate must not be after endDate",
    path: ["startDate"],
  })
  .refine(
    (seed) =>
      seed.days.every(
        (d) => d.date >= seed.startDate && d.date <= seed.endDate,
      ),
    {
      message: "every day must fall within startDate and endDate",
      path: ["days"],
    },
  )
  .refine(
    (seed) => new Set(seed.days.map((d) => d.date)).size === seed.days.length,
    {
      message: "day dates must be unique",
      path: ["days"],
    },
  )
  .superRefine((seed, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    const unique = <T>(
      list: string | (string | number)[],
      items: T[],
      keyOf: (item: T) => string | null | undefined,
      field: string,
      label: string,
    ) => {
      const seen = new Set<string>();
      items.forEach((item, index) => {
        const key = keyOf(item);
        if (key == null) return;
        if (seen.has(key)) {
          issue(
            [...(Array.isArray(list) ? list : [list]), index, field],
            `duplicate ${label} "${key}"`,
          );
        }
        seen.add(key);
      });
    };

    unique("teams", seed.teams, (t) => t.name, "name", "Team name");
    unique(
      "participants",
      seed.participants,
      (p) => p.displayName,
      "displayName",
      "Participant display name",
    );
    unique(
      "participants",
      seed.participants,
      (p) => p.email,
      "email",
      "Participant email",
    );
    unique(
      "competitions",
      seed.competitions,
      (c) => c.name,
      "name",
      "Competition name",
    );
    unique(
      "pointsEntries",
      seed.pointsEntries,
      (e) => e.key,
      "key",
      "Points Entry key",
    );
    unique("awards", seed.awards, (a) => a.key, "key", "Award key");
    unique(
      "announcements",
      seed.announcements,
      (a) => a.key,
      "key",
      "Announcement key",
    );
    unique(
      "faqItems",
      seed.faqItems,
      (f) => f.question,
      "question",
      "FAQ question",
    );
    seed.days.forEach((d, dayIndex) =>
      unique(
        ["days", dayIndex, "scheduleItems"],
        d.scheduleItems,
        (item) => `${item.startTime} ${item.title}`,
        "title",
        "Schedule Item (start time and title)",
      ),
    );

    if (seed.mode === "free-for-all" && seed.teams.length > 0) {
      issue(["teams"], "a free-for-all War Week has no Teams");
    }

    const teams = new Set(seed.teams.map((t) => t.name));
    const participants = new Set(seed.participants.map((p) => p.displayName));
    const competitions = new Map(seed.competitions.map((c) => [c.name, c]));

    seed.participants.forEach((p, index) => {
      if (p.team != null && !teams.has(p.team)) {
        issue(["participants", index, "team"], `unknown Team "${p.team}"`);
      }
    });

    seed.days.forEach((d, dayIndex) =>
      d.scheduleItems.forEach((item, itemIndex) => {
        if (item.competition != null && !competitions.has(item.competition)) {
          issue(
            ["days", dayIndex, "scheduleItems", itemIndex, "competition"],
            `unknown Competition "${item.competition}"`,
          );
        }
      }),
    );

    seed.pointsEntries.forEach((entry, index) => {
      const path = ["pointsEntries", index];
      const comp = competitions.get(entry.competition);
      if (!comp) {
        issue(
          [...path, "competition"],
          `unknown Competition "${entry.competition}"`,
        );
      }
      if (entry.team != null) {
        if (!teams.has(entry.team)) {
          issue([...path, "team"], `unknown Team "${entry.team}"`);
        }
        const refusal = comp && pointsEntryTargetError(comp, "team");
        if (refusal) issue([...path, "team"], refusal);
      }
      if (entry.participant != null) {
        if (!participants.has(entry.participant)) {
          issue(
            [...path, "participant"],
            `unknown Participant "${entry.participant}"`,
          );
        }
        const refusal = comp && pointsEntryTargetError(comp, "participant");
        if (refusal) issue([...path, "participant"], refusal);
      }
    });

    seed.awards.forEach((a, index) => {
      if (a.team != null && !teams.has(a.team)) {
        issue(["awards", index, "team"], `unknown Team "${a.team}"`);
      }
      a.participants.forEach((name, recipientIndex) => {
        if (!participants.has(name)) {
          issue(
            ["awards", index, "participants", recipientIndex],
            `unknown Participant "${name}"`,
          );
        }
      });
    });
  });

export type WarWeekSeed = z.infer<typeof warWeekSeedSchema>;
