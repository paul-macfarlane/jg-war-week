import { z } from "zod";

import { announcementTitleSchema } from "@/lib/announcements";
import { AWARD_DESCRIPTION_MAX, AWARD_NAME_MAX } from "@/lib/awards";
import { LEAGUE_RESULTS, WAR_WEEK_STATUSES } from "@/lib/enums";
import { finaleSlideSeedSchema } from "@/lib/finale-slides";
import { jgEmailSchema } from "@/lib/jg-email";
import { MAX_SCORE } from "@/lib/placement/input";
import { pointsSchema as points } from "@/lib/points-entry";
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
 * A stable id for a seeded organizer-owned record (Placement, Discretionary
 * points, Award,
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

/**
 * Discretionary points: a Points Entry with no Competition, to one Team or
 * one Participant, with a required reason (stored as the entry's note).
 */
export const discretionaryPointsSeedSchema = z
  .object({
    key: seedKey,
    /** A Team name from this seed; exactly one of team or participant. */
    team: z.string().min(1).max(80).nullish(),
    /** A Participant display name from this seed. */
    participant: z.string().min(1).max(120).nullish(),
    points,
    reason: z.string().trim().min(1).max(500),
    enteredByEmail: emailSchema,
    enteredAt: z.iso.datetime({ offset: true }),
  })
  .refine((entry) => (entry.team == null) !== (entry.participant == null), {
    message:
      "Discretionary points must target exactly one of team or participant",
    path: ["team"],
  });

export type DiscretionaryPointsSeed = z.infer<
  typeof discretionaryPointsSeedSchema
>;

/**
 * One row of a Placement Competition's sheet (CONTEXT.md, Placement). The
 * loader inserts a keyed row only if it is absent and never updates it.
 */
export const placementSeedSchema = z
  .object({
    key: seedKey,
    /** A Placement Competition's name from this seed. */
    competition: z.string().min(1).max(120),
    /** A Team name from this seed; exactly one of team or participant. */
    team: z.string().min(1).max(80).nullish(),
    /** A Participant display name from this seed. */
    participant: z.string().min(1).max(120).nullish(),
    place: z.number().int().min(1),
    score: z.number().min(-MAX_SCORE).max(MAX_SCORE).nullish(),
  })
  .refine((row) => (row.team == null) !== (row.participant == null), {
    message: "a Placement must be for exactly one of team or participant",
    path: ["team"],
  });

export type PlacementSeed = z.infer<typeof placementSeedSchema>;

/**
 * One League Match (CONTEXT.md, League): a round's pairing of two Entrants
 * of a League, or an Entrant alone (`b` null: a bye or sit-out), with its
 * result when played. The loader inserts a League's Matches only while it
 * has no Entrant and no Match, so an Organizer's pairings are never
 * overwritten.
 */
export const leagueMatchSeedSchema = z.object({
  key: seedKey,
  /** A League's name from this seed. */
  competition: z.string().min(1).max(120),
  round: z.number().int().min(1),
  /** The Match's order in its round, from 0. */
  position: z.number().int().min(0),
  /** An Entrant's name (a Participant's display name or a Team's name). */
  a: z.string().min(1).max(120),
  b: z.string().min(1).max(120).nullable(),
  result: z.enum(LEAGUE_RESULTS).nullish(),
  scoreA: z.number().min(-MAX_SCORE).max(MAX_SCORE).nullish(),
  scoreB: z.number().min(-MAX_SCORE).max(MAX_SCORE).nullish(),
  /** When it was recorded; omitted: the League's `closedAt`, else the load time. */
  recordedAt: z.iso.datetime({ offset: true }).optional(),
});

export type LeagueMatchSeed = z.infer<typeof leagueMatchSeedSchema>;

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
    // zod would strip an unknown key and lose the entries silently, so refuse it.
    pointsEntries: z
      .never({
        error:
          "pointsEntries is gone; use placements (with closed) or discretionaryPoints",
      })
      .optional(),
    discretionaryPoints: z.array(discretionaryPointsSeedSchema).default([]),
    placements: z.array(placementSeedSchema).default([]),
    leagueMatches: z.array(leagueMatchSeedSchema).default([]),
    awards: z.array(awardSeedSchema).default([]),
    announcements: z.array(announcementSeedSchema).default([]),
    faqItems: z.array(faqItemSeedSchema).default([]),
    /**
     * The Finale's slides in order. Absent: a load leaves the saved list
     * alone (CONTEXT.md, "Seed idempotence rules").
     */
    finaleSlides: z.array(finaleSlideSeedSchema).optional(),
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
      "discretionaryPoints",
      seed.discretionaryPoints,
      (e) => e.key,
      "key",
      "Discretionary points key",
    );
    unique("placements", seed.placements, (p) => p.key, "key", "Placement key");
    unique(
      "leagueMatches",
      seed.leagueMatches,
      (m) => m.key,
      "key",
      "League Match key",
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
    unique(
      "finaleSlides",
      seed.finaleSlides ?? [],
      (s) => (s.kind === "custom" ? `custom: ${s.heading}` : s.kind),
      "kind",
      "Finale slide",
    );
    seed.days.forEach((d, dayIndex) =>
      unique(
        ["days", dayIndex, "scheduleItems"],
        d.scheduleItems,
        // No start time is a key value of its own ("Any time").
        (item) => `${item.startTime ?? "any time"} ${item.title}`,
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

    seed.discretionaryPoints.forEach((entry, index) => {
      const path = ["discretionaryPoints", index];
      if (entry.team != null && !teams.has(entry.team)) {
        issue([...path, "team"], `unknown Team "${entry.team}"`);
      }
      if (entry.participant != null && !participants.has(entry.participant)) {
        issue(
          [...path, "participant"],
          `unknown Participant "${entry.participant}"`,
        );
      }
    });

    seed.competitions.forEach((c, index) => {
      (c.hosts ?? []).forEach((name, hostIndex) => {
        if (!participants.has(name)) {
          issue(
            ["competitions", index, "hosts", hostIndex],
            `Host "${name}" is not on this War Week's roster`,
          );
        }
      });
      (c.entrants ?? []).forEach((name, entrantIndex) => {
        const known = c.scoring === "team" ? teams : participants;
        if (!known.has(name)) {
          issue(
            ["competitions", index, "entrants", entrantIndex],
            `unknown ${c.scoring === "team" ? "Team" : "Participant"} "${name}"`,
          );
        }
      });
    });

    seed.placements.forEach((row, index) => {
      const path = ["placements", index];
      const comp = competitions.get(row.competition);
      if (!comp) {
        issue(
          [...path, "competition"],
          `unknown Competition "${row.competition}"`,
        );
      } else if (comp.format !== "placement") {
        issue(
          [...path, "competition"],
          `${comp.name} isn't a placement Competition`,
        );
      }
      if (row.team != null) {
        if (comp?.scoring === "individual") {
          issue(
            [...path, "team"],
            "an individual Competition takes participants, not teams",
          );
        } else if (!teams.has(row.team)) {
          issue([...path, "team"], `unknown Team "${row.team}"`);
        }
      }
      if (row.participant != null) {
        if (comp?.scoring === "team") {
          issue(
            [...path, "participant"],
            "a team Competition takes teams, not participants",
          );
        } else if (!participants.has(row.participant)) {
          issue(
            [...path, "participant"],
            `unknown Participant "${row.participant}"`,
          );
        }
      }
    });

    // Each League's Matches: its own Entrants, each once a round, no
    // rematch, no result on a bye, a Score only with a result.
    const slots = new Set<string>();
    const meetings = new Set<string>();
    const playing = new Set<string>();
    seed.leagueMatches.forEach((m, index) => {
      const path = ["leagueMatches", index];
      const comp = competitions.get(m.competition);
      if (!comp) {
        issue(
          [...path, "competition"],
          `unknown Competition "${m.competition}"`,
        );
        return;
      }
      if (comp.format !== "league") {
        issue(
          [...path, "competition"],
          `${comp.name} isn't a league Competition`,
        );
        return;
      }
      const entrants = new Set(comp.entrants ?? []);
      for (const side of ["a", "b"] as const) {
        const name = m[side];
        if (name != null && !entrants.has(name)) {
          issue([...path, side], `"${name}" is not an Entrant of ${comp.name}`);
        }
      }
      if (m.b === m.a) issue([...path, "b"], `${m.a} plays itself`);
      const slot = `${m.competition}\0${m.round}\0${m.position}`;
      if (slots.has(slot)) {
        issue(
          [...path, "position"],
          `round ${m.round} position ${m.position} is taken in ${comp.name}`,
        );
      }
      slots.add(slot);
      for (const name of [m.a, m.b]) {
        if (name == null) continue;
        const key = `${m.competition}\0${m.round}\0${name}`;
        if (playing.has(key)) {
          issue(
            [...path, name === m.a ? "a" : "b"],
            `${name} plays twice in round ${m.round}`,
          );
        }
        playing.add(key);
      }
      if (m.b !== null && m.b !== m.a) {
        const pair = [m.a, m.b].sort().join("\0");
        const key = `${m.competition}\0${pair}`;
        if (meetings.has(key)) {
          issue(
            [...path, "a"],
            `${m.a} and ${m.b} already met in ${comp.name}`,
          );
        }
        meetings.add(key);
      }
      if (m.b === null) {
        if (m.result != null) issue([...path, "result"], "a bye has no result");
        if (m.scoreA != null || m.scoreB != null) {
          issue([...path, "scoreA"], "a bye has no Score");
        }
      } else if (m.result == null && (m.scoreA != null || m.scoreB != null)) {
        issue([...path, "scoreA"], "a Score needs a result");
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
