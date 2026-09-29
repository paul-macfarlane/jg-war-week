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
  smallint,
  text,
  time,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import type { HeatsConfig } from "@/lib/bracket/config";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  FONT_PRESETS,
  GAME_TYPES,
  HEAT_STATUSES,
  SCHEDULE_ITEM_CATEGORIES,
  WAR_WEEK_MODES,
  WAR_WEEK_STATUSES,
} from "@/lib/enums";
import type { GamesConfig } from "@/lib/games/config";
import type { Content } from "@/lib/rich-text/content";

// The value lists live in `src/lib/enums.ts`, so client code can use them
// without importing this module.
export const warWeekStatus = pgEnum("war_week_status", WAR_WEEK_STATUSES);

export const warWeekMode = pgEnum("war_week_mode", WAR_WEEK_MODES);

export const fontPreset = pgEnum("font_preset", FONT_PRESETS);

export const scheduleItemCategory = pgEnum(
  "schedule_item_category",
  SCHEDULE_ITEM_CATEGORIES,
);

export const competitionScoring = pgEnum(
  "competition_scoring",
  COMPETITION_SCORINGS,
);

export const competitionFormat = pgEnum(
  "competition_format",
  COMPETITION_FORMATS,
);

export const heatStatus = pgEnum("heat_status", HEAT_STATUSES);

export const gameType = pgEnum("game_type", GAME_TYPES);

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
    winner: varchar("winner", { length: 200 }),
    highlights: varchar("highlights", { length: 500 })
      .array()
      .notNull()
      .default([]),
    // `created_at` and `updated_at` (here and on every table) stay
    // `timestamp` without time zone on purpose: they're audit columns, never
    // shown, and the database session runs in UTC.
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
    index("participant_team_id_idx").on(table.teamId),
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
    // The Format's settings (`src/lib/bracket/config.ts`); null means the
    // Format's default, and single elimination has none.
    bracketConfig: jsonb("bracket_config").$type<HeatsConfig | null>(),
    // Participants in a Heat may enter its result themselves (ADR 0005).
    selfReport: boolean("self_report").notNull().default(false),
    // Set while the Competition's generated Points Entries exist: a
    // finalized Bracket, or a closed `games` Competition (the name predates
    // `games`; R3 decision 1 keeps it).
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    // `games` only: how its Games are decided; set exactly when the Format
    // is `games` (the CHECK below).
    gameType: gameType("game_type"),
    // The Game Type's settings (`src/lib/games/config.ts`); null means the
    // Game Type's default.
    gameConfig: jsonb("game_config").$type<GamesConfig | null>(),
    // `games` only: true lets everyone eligible play; false keeps a fixed
    // Entrant list (`entrant` rows).
    entrantsOpen: boolean("entrants_open").notNull().default(false),
    // `games` only: Participants can't log Games after it. Awards nothing.
    loggingClosesAt: timestamp("logging_closes_at", { withTimezone: true }),
    // Participants may enroll themselves as Entrants (ticket 15).
    selfEnroll: boolean("self_enroll").notNull().default(false),
    // Enrollment closes once this many Entrants are in; null for no limit.
    entrantLimit: integer("entrant_limit"),
    // Enrollment closes after this time; null for no close time.
    enrollClosesAt: timestamp("enroll_closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.name),
    check(
      "competition_counts_toward_team_individual_only",
      sql`not ${table.countsTowardTeam} or ${table.scoring} = 'individual'`,
    ),
    // On the text form, never the enum literal: the migration adding the
    // `games` value runs in the same transaction (R3 decision 13).
    check(
      "competition_game_type_iff_games",
      sql`(${table.gameType} is not null) = (${table.format}::text = 'games')`,
    ),
    check(
      "competition_entrant_limit_above_1",
      sql`${table.entrantLimit} is null or ${table.entrantLimit} > 1`,
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
  (table) => [
    unique().on(table.dayId, table.startTime, table.title),
    index("schedule_item_competition_id_idx").on(table.competitionId),
  ],
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
    // Written by finalizing a Bracket or closing a `games` Competition;
    // changed only through that Competition. The name predates `games`
    // (R3 decision 1 keeps it).
    generatedByBracket: boolean("generated_by_bracket")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.seedKey),
    index("points_entry_team_id_idx").on(table.teamId),
    index("points_entry_participant_id_idx").on(table.participantId),
    check(
      "points_entry_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
  ],
);

/**
 * A named group of Participants of one Team, entered as one Entrant in a
 * team-scoring Bracket; its Placement Points go to its Team.
 */
export const squad = pgTable(
  "squad",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    teamId: uuid("team_id")
      .notNull()
      .references(() => team.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.name),
    index("squad_team_id_idx").on(table.teamId),
  ],
);

/** A Participant in a Squad. */
export const squadParticipant = pgTable(
  "squad_participant",
  {
    squadId: uuid("squad_id")
      .notNull()
      .references(() => squad.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.squadId, table.participantId] }),
    index("squad_participant_participant_id_idx").on(table.participantId),
  ],
);

/** A Team, Participant or Squad entered in a Competition's Bracket. */
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
    squadId: uuid("squad_id").references(() => squad.id, {
      onDelete: "cascade",
    }),
    seedPosition: integer("seed_position").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.teamId),
    unique().on(table.competitionId, table.participantId),
    unique().on(table.competitionId, table.squadId),
    unique().on(table.competitionId, table.seedPosition),
    check(
      "entrant_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}, ${table.squadId}) = 1`,
    ),
  ],
);

/**
 * One game of a Bracket, with `slotCount` places (two in single elimination;
 * a Heats Format's Heats may hold more). A single-elimination winner feeds
 * `winnerToHeatId`.
 */
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
    // Fixed at Generate; `heat_entrant.slot` runs 0…slotCount-1.
    slotCount: smallint("slot_count").notNull().default(2),
    winnerToHeatId: uuid("winner_to_heat_id").references(
      (): AnyPgColumn => heat.id,
      { onDelete: "set null" },
    ),
    winnerToSlot: integer("winner_to_slot"),
    // Optional time and place, set from the results screen; a Day delete
    // nulls this rather than being refused (see CONTEXT.md, Bracket rules).
    dayId: uuid("day_id").references(() => day.id, { onDelete: "set null" }),
    // Wall-clock time in ET, like a Schedule Item's.
    startTime: time("start_time"),
    location: varchar("location", { length: 200 }),
    // Set when a Participant self-reported the current result; cleared when
    // a later save changes the Heat. The email is kept for audit and never
    // read back to a page or MCP (see CONTEXT.md, Access rules).
    reportedByEmail: varchar("reported_by_email", { length: 254 }),
    reportedByParticipantId: uuid("reported_by_participant_id").references(
      () => participant.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.round, table.position),
    index("heat_winner_to_heat_id_idx").on(table.winnerToHeatId),
    index("heat_day_id_idx").on(table.dayId),
    index("heat_reported_by_participant_id_idx").on(
      table.reportedByParticipantId,
    ),
  ],
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
    index("heat_entrant_entrant_id_idx").on(table.entrantId),
    // The engine's slots are 0-based and its places 1-based.
    check("heat_entrant_slot_from_0", sql`${table.slot} >= 0`),
    check(
      "heat_entrant_place_from_1",
      sql`${table.place} is null or ${table.place} >= 1`,
    ),
  ],
);

/**
 * One recorded contest in a `games` Competition, logged by a player in it or
 * by a Host or Organizer. Games have no scheduled time: `logged_at` orders
 * the log.
 */
export const game = pgTable(
  "game",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    loggedAt: timestamp("logged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Kept for audit and never read back to a page or MCP (CONTEXT.md,
    // Access rules).
    loggedByEmail: varchar("logged_by_email", { length: 254 }).notNull(),
    // The linked Participant who logged it; null for a Host or Organizer.
    loggedByParticipantId: uuid("logged_by_participant_id").references(
      () => participant.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("game_competition_id_idx").on(table.competitionId),
    index("game_logged_by_participant_id_idx").on(table.loggedByParticipantId),
  ],
);

/**
 * A Team or Participant in a Game, never an Entrant row (an open Competition
 * has none): its place (head-to-head 1/2, 1/1 for a draw; ranked 1-based
 * with ties) or its score (best-score).
 */
export const gamePlayer = pgTable(
  "game_player",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    participantId: uuid("participant_id").references(() => participant.id, {
      onDelete: "cascade",
    }),
    place: integer("place"),
    score: numeric("score", { precision: 10, scale: 2, mode: "number" }),
  },
  (table) => [
    unique().on(table.gameId, table.teamId),
    unique().on(table.gameId, table.participantId),
    index("game_player_team_id_idx").on(table.teamId),
    index("game_player_participant_id_idx").on(table.participantId),
    check(
      "game_player_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
    check(
      "game_player_place_from_1",
      sql`${table.place} is null or ${table.place} >= 1`,
    ),
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
  (table) => [
    unique().on(table.warWeekId, table.seedKey),
    index("award_team_id_idx").on(table.teamId),
  ],
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
  (table) => [
    primaryKey({ columns: [table.awardId, table.participantId] }),
    index("award_participant_participant_id_idx").on(table.participantId),
  ],
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
    index("competition_host_competition_id_idx").on(table.competitionId),
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
export type Squad = InferSelectModel<typeof squad>;
export type SquadParticipant = InferSelectModel<typeof squadParticipant>;
export type EntrantRow = InferSelectModel<typeof entrant>;
export type HeatRow = InferSelectModel<typeof heat>;
export type HeatEntrantRow = InferSelectModel<typeof heatEntrant>;
export type GameRow = InferSelectModel<typeof game>;
export type GamePlayerRow = InferSelectModel<typeof gamePlayer>;
export type Organizer = InferSelectModel<typeof organizer>;
export type CompetitionHost = InferSelectModel<typeof competitionHost>;
