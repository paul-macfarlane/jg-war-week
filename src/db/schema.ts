import {
  InferInsertModel,
  InferSelectModel,
  relations,
  sql,
} from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { Content } from "@/lib/rich-text/content";

export const warWeekStatus = pgEnum("war_week_status", [
  "upcoming",
  "live",
  "complete",
]);

export const warWeekMode = pgEnum("war_week_mode", ["teams", "free-for-all"]);

export const fontPreset = pgEnum("font_preset", ["sans", "serif", "mono"]);

export const scheduleItemCategory = pgEnum("schedule_item_category", [
  "competition",
  "education",
  "social",
  "meal",
  "work",
  "other",
]);

export const competitionScoring = pgEnum("competition_scoring", [
  "team",
  "individual",
]);

export const competitionFormat = pgEnum("competition_format", [
  "points",
  "single-elimination",
]);

export const bracketPoints = pgEnum("bracket_points", [
  "placings",
  "per-heat",
  "both",
]);

export const heatStatus = pgEnum("heat_status", [
  "pending",
  "ready",
  "played",
  "forfeit",
]);

export const warWeek = pgTable(
  "war_week",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    edition: varchar("edition", { length: 8 }).notNull().unique(),
    editionNumber: integer("edition_number").notNull().unique(),
    year: integer("year").notNull().unique(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    storyTheme: varchar("story_theme", { length: 120 }).notNull(),
    status: warWeekStatus("status").notNull(),
    mode: warWeekMode("mode").notNull(),
    teamLabel: varchar("team_label", { length: 40 }).notNull(),
    leaderTitle: varchar("leader_title", { length: 40 }).notNull(),
    slackChannelUrl: varchar("slack_channel_url", { length: 500 }).notNull(),
    primaryColor: varchar("primary_color", { length: 32 }).notNull(),
    primaryForegroundColor: varchar("primary_foreground_color", {
      length: 32,
    }).notNull(),
    accentColor: varchar("accent_color", { length: 32 }).notNull(),
    backgroundColor: varchar("background_color", { length: 32 }).notNull(),
    foregroundColor: varchar("foreground_color", { length: 32 }).notNull(),
    logoUrl: varchar("logo_url", { length: 500 }),
    bannerUrl: varchar("banner_url", { length: 500 }),
    fontPreset: fontPreset("font_preset").notNull(),
    wikiUrl: varchar("wiki_url", { length: 500 }),
    // Deprecated: Organizers are global now (the `organizer` table). Kept,
    // unread by the new access rule, so a rollback still works; ticket 18
    // drops it.
    organizerEmails: varchar("organizer_emails", { length: 254 })
      .array()
      .notNull()
      .default([]),
    winner: varchar("winner", { length: 200 }),
    highlights: varchar("highlights", { length: 500 })
      .array()
      .notNull()
      .default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  // At most one War Week is `live` (CONTEXT.md, "War Week lifecycle rules").
  () => [
    uniqueIndex("war_week_one_live")
      .on(sql`(true)`)
      .where(sql`status = 'live'`),
  ],
);

export const day = pgTable(
  "day",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    dayTheme: varchar("day_theme", { length: 120 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.warWeekId, table.date)],
);

export const team = pgTable(
  "team",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    color: varchar("color", { length: 32 }).notNull(),
    logoUrl: varchar("logo_url", { length: 500 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.warWeekId, table.name)],
);

export const participant = pgTable(
  "participant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    displayName: varchar("display_name", { length: 120 }).notNull(),
    companyTag: varchar("company_tag", { length: 40 }),
    // Optional, and unique within a War Week when present (NULLs are
    // distinct, so any number of Participants may have no email).
    email: varchar("email", { length: 254 }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "set null",
    }),
    isLeader: boolean("is_leader").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.displayName),
    unique().on(table.warWeekId, table.email),
  ],
);

export const competition = pgTable(
  "competition",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 2000 }),
    maxPoints: numeric("max_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    // Placement Points: points for 1st, 2nd, 3rd…, highest first.
    placementPoints: numeric("placement_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).array(),
    scoring: competitionScoring("scoring").notNull(),
    countsTowardTeam: boolean("counts_toward_team").notNull().default(false),
    competitionGroup: varchar("competition_group", { length: 120 }),
    format: competitionFormat("format").notNull().default("points"),
    bracketPoints: bracketPoints("bracket_points")
      .notNull()
      .default("placings"),
    // Set while the Bracket's generated Points Entries exist.
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.name),
    check(
      "competition_counts_toward_team_individual_only",
      sql`not ${table.countsTowardTeam} or ${table.scoring} = 'individual'`,
    ),
  ],
);

export const scheduleItem = pgTable(
  "schedule_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    dayId: uuid("day_id")
      .notNull()
      .references(() => day.id, { onDelete: "cascade" }),
    // Wall-clock times in ET; the Day supplies the date.
    startTime: time("start_time").notNull(),
    endTime: time("end_time"),
    title: varchar("title", { length: 200 }).notNull(),
    host: varchar("host", { length: 200 }),
    location: varchar("location", { length: 200 }),
    virtualLink: varchar("virtual_link", { length: 500 }),
    description: jsonb("description").$type<Content>(),
    category: scheduleItemCategory("category").notNull(),
    competitionId: uuid("competition_id").references(() => competition.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.dayId, table.startTime, table.title)],
);

export const pointsEntry = pgTable(
  "points_entry",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    participantId: uuid("participant_id").references(() => participant.id, {
      onDelete: "cascade",
    }),
    points: numeric("points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    note: varchar("note", { length: 500 }),
    enteredByEmail: varchar("entered_by_email", { length: 254 }).notNull(),
    enteredAt: timestamp("entered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Set only on rows that came from a seed file; see CONTEXT.md.
    seedKey: varchar("seed_key", { length: 80 }),
    // Written by finalizing a Bracket; changed only through the Bracket.
    generatedByBracket: boolean("generated_by_bracket")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.seedKey),
    check(
      "points_entry_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
  ],
);

/** A Team or Participant entered in a Competition's Bracket. */
export const entrant = pgTable(
  "entrant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    participantId: uuid("participant_id").references(() => participant.id, {
      onDelete: "cascade",
    }),
    seedPosition: integer("seed_position").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.teamId),
    unique().on(table.competitionId, table.participantId),
    unique().on(table.competitionId, table.seedPosition),
    check(
      "entrant_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
  ],
);

/** One game of a single-stage Bracket; its winner feeds `winnerToHeatId`. */
export const heat = pgTable(
  "heat",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    position: integer("position").notNull(),
    status: heatStatus("status").notNull().default("pending"),
    winnerToHeatId: uuid("winner_to_heat_id").references(
      (): AnyPgColumn => heat.id,
      { onDelete: "set null" },
    ),
    winnerToSlot: integer("winner_to_slot"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.competitionId, table.round, table.position)],
);

/** An Entrant in a Heat's slot, with its place and score once decided. */
export const heatEntrant = pgTable(
  "heat_entrant",
  {
    heatId: uuid("heat_id")
      .notNull()
      .references(() => heat.id, { onDelete: "cascade" }),
    entrantId: uuid("entrant_id")
      .notNull()
      .references(() => entrant.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    place: integer("place"),
    score: varchar("score", { length: 40 }),
    forfeited: boolean("forfeited").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.heatId, table.slot] }),
    unique().on(table.heatId, table.entrantId),
  ],
);

export const award = pgTable(
  "award",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 120 }).notNull(),
    description: varchar("description", { length: 1000 }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "set null",
    }),
    seedKey: varchar("seed_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.warWeekId, table.seedKey)],
);

export const awardParticipant = pgTable(
  "award_participant",
  {
    awardId: uuid("award_id")
      .notNull()
      .references(() => award.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.awardId, table.participantId] })],
);

export const announcement = pgTable(
  "announcement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    title: varchar("title", { length: 200 }).notNull(),
    body: jsonb("body").$type<Content>().notNull(),
    videoUrls: varchar("video_urls", { length: 500 })
      .array()
      .notNull()
      .default([]),
    pinned: boolean("pinned").notNull().default(false),
    authorEmail: varchar("author_email", { length: 254 }).notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    seedKey: varchar("seed_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.warWeekId, table.seedKey)],
);

export const faqItem = pgTable(
  "faq_item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    question: varchar("question", { length: 300 }).notNull(),
    answer: jsonb("answer").$type<Content>().notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [unique().on(table.warWeekId, table.question)],
);

/** A global Organizer: may change everything in every War Week. */
export const organizer = pgTable(
  "organizer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 254 }).notNull().unique(),
    // Null for rows copied by the migration or inserted by a seed load.
    addedBy: varchar("added_by", { length: 254 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "organizer_email_lowercase",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);

/** A Host: a JG email that runs one Competition. */
export const competitionHost = pgTable(
  "competition_host",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 254 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Email first, so it also serves the lookup of what an email hosts.
    unique().on(table.email, table.competitionId),
    check(
      "competition_host_email_lowercase",
      sql`${table.email} = lower(${table.email})`,
    ),
  ],
);

// better-auth's core tables (Google sign-in only). Property names follow
// better-auth's field names so its Drizzle adapter can map them.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const warWeekRelations = relations(warWeek, ({ many }) => ({
  days: many(day),
  teams: many(team),
  participants: many(participant),
  competitions: many(competition),
  awards: many(award),
  announcements: many(announcement),
  faqItems: many(faqItem),
}));

export const dayRelations = relations(day, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [day.warWeekId],
    references: [warWeek.id],
  }),
  scheduleItems: many(scheduleItem),
}));

export const teamRelations = relations(team, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [team.warWeekId],
    references: [warWeek.id],
  }),
  participants: many(participant),
  pointsEntries: many(pointsEntry),
}));

export const participantRelations = relations(participant, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [participant.warWeekId],
    references: [warWeek.id],
  }),
  team: one(team, { fields: [participant.teamId], references: [team.id] }),
  pointsEntries: many(pointsEntry),
  awards: many(awardParticipant),
}));

export const competitionRelations = relations(competition, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [competition.warWeekId],
    references: [warWeek.id],
  }),
  pointsEntries: many(pointsEntry),
  scheduleItems: many(scheduleItem),
}));

export const scheduleItemRelations = relations(scheduleItem, ({ one }) => ({
  day: one(day, { fields: [scheduleItem.dayId], references: [day.id] }),
  competition: one(competition, {
    fields: [scheduleItem.competitionId],
    references: [competition.id],
  }),
}));

export const pointsEntryRelations = relations(pointsEntry, ({ one }) => ({
  competition: one(competition, {
    fields: [pointsEntry.competitionId],
    references: [competition.id],
  }),
  team: one(team, { fields: [pointsEntry.teamId], references: [team.id] }),
  participant: one(participant, {
    fields: [pointsEntry.participantId],
    references: [participant.id],
  }),
}));

export const awardRelations = relations(award, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [award.warWeekId],
    references: [warWeek.id],
  }),
  team: one(team, { fields: [award.teamId], references: [team.id] }),
  participants: many(awardParticipant),
}));

export const awardParticipantRelations = relations(
  awardParticipant,
  ({ one }) => ({
    award: one(award, {
      fields: [awardParticipant.awardId],
      references: [award.id],
    }),
    participant: one(participant, {
      fields: [awardParticipant.participantId],
      references: [participant.id],
    }),
  }),
);

export const announcementRelations = relations(announcement, ({ one }) => ({
  warWeek: one(warWeek, {
    fields: [announcement.warWeekId],
    references: [warWeek.id],
  }),
}));

export const faqItemRelations = relations(faqItem, ({ one }) => ({
  warWeek: one(warWeek, {
    fields: [faqItem.warWeekId],
    references: [warWeek.id],
  }),
}));

export type WarWeek = InferSelectModel<typeof warWeek>;
export type NewWarWeek = InferInsertModel<typeof warWeek>;
export type Day = InferSelectModel<typeof day>;
export type NewDay = InferInsertModel<typeof day>;
export type Team = InferSelectModel<typeof team>;
export type Participant = InferSelectModel<typeof participant>;
export type Competition = InferSelectModel<typeof competition>;
export type ScheduleItem = InferSelectModel<typeof scheduleItem>;
export type PointsEntry = InferSelectModel<typeof pointsEntry>;
export type Award = InferSelectModel<typeof award>;
export type AwardParticipant = InferSelectModel<typeof awardParticipant>;
export type Announcement = InferSelectModel<typeof announcement>;
export type FaqItem = InferSelectModel<typeof faqItem>;
export type EntrantRow = InferSelectModel<typeof entrant>;
export type HeatRow = InferSelectModel<typeof heat>;
export type HeatEntrantRow = InferSelectModel<typeof heatEntrant>;
export type Organizer = InferSelectModel<typeof organizer>;
export type CompetitionHost = InferSelectModel<typeof competitionHost>;
