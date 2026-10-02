import { z } from "zod";

import { announcementTitleSchema } from "@/lib/announcements";
import { AWARD_DESCRIPTION_MAX, AWARD_NAME_MAX } from "@/lib/awards";
import { WAR_WEEK_STATUSES } from "@/lib/enums";
import { jgEmailSchema } from "@/lib/jg-email";
import {
  pointsSchema as points,
  pointsEntryNoteSchema,
  pointsEntryTargetError,
} from "@/lib/points-entry";
import { contentInputSchema } from "@/lib/rich-text/content";
import {
  competitionSeedSchema,
  daySeedShape,
  emailSchema,
  participantSeedSchema,
  teamSeedSchema,
  warWeekSettingsSeedShape,
} from "@/lib/setup";
import {
  faqItemSeedSchema,
  scheduleItemSeedSchema,
} from "@/lib/setup-schedule-faq";

// Field rules shared with the Organizer setup forms live in `src/lib/`
// (ADR 0001); the seed composes them into the file format.

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

export const daySeedSchema = z.object({
  ...daySeedShape,
  scheduleItems: z.array(scheduleItemSeedSchema).default([]),
});

export type DaySeed = z.infer<typeof daySeedSchema>;

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
    enteredByEmail: emailSchema,
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
    /** An Award Category's key (not its name, which an Organizer may rename). */
    category: seedKey.nullish(),
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
  // zod would strip an unknown key and lose the video silently, so refuse it.
  videoUrls: z
    .never({
      error: "videoUrls is gone; put each video in body as a video block",
    })
    .optional(),
  pinned: z.boolean().default(false),
  authorEmail: emailSchema,
  publishedAt: z.iso.datetime({ offset: true }),
});

export type AnnouncementSeed = z.infer<typeof announcementSeedSchema>;

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
    status: z.enum(WAR_WEEK_STATUSES),
    ...warWeekSettingsSeedShape,
    /**
     * Global Organizers this seed adds when missing; a load never removes
     * one (CONTEXT.md, "Seed idempotence rules").
     */
    organizers: z.array(jgEmailSchema).default([]),
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
