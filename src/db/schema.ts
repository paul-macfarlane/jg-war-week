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

import type { BracketConfig } from "@/lib/bracket/config";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  FINALE_AWARDS_LAYOUTS,
  FINALE_SLIDE_KINDS,
  FONT_PRESETS,
  MATCH_STATUSES,
  SCHEDULE_ITEM_CATEGORIES,
  SCORE_DIRECTIONS,
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

export const bracketMatchStatus = pgEnum(
  "bracket_match_status",
  MATCH_STATUSES,
);

export const scoreDirection = pgEnum("score_direction", SCORE_DIRECTIONS);

export const finaleSlideKind = pgEnum("finale_slide_kind", FINALE_SLIDE_KINDS);

export const finaleAwardsLayout = pgEnum(
  "finale_awards_layout",
  FINALE_AWARDS_LAYOUTS,
);

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
    // The Organizer's overrides of the derived palette (the other color
    // scheme's colors); null means derived (CONTEXT.md, "Light and dark
    // Display rules").
    overridePrimaryColor: varchar("override_primary_color", { length: 32 }),
    overridePrimaryForegroundColor: varchar(
      "override_primary_foreground_color",
      { length: 32 },
    ),
    overrideAccentColor: varchar("override_accent_color", { length: 32 }),
    overrideBackgroundColor: varchar("override_background_color", {
      length: 32,
    }),
    overrideForegroundColor: varchar("override_foreground_color", {
      length: 32,
    }),
    logoUrl: varchar("logo_url", { length: 500 }),
    bannerUrl: varchar("banner_url", { length: 500 }),
    fontPreset: fontPreset("font_preset").notNull(),
    wikiUrl: varchar("wiki_url", { length: 500 }),
    winner: varchar("winner", { length: 200 }),
    // How the Finale shows Awards (ticket 73); the Organizer sets it on
    // `/admin/finale`.
    finaleAwardsLayout: finaleAwardsLayout("finale_awards_layout")
      .notNull()
      .default("one-slide"),
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
    // `DAY_DESCRIPTION_MAX` in `@/lib/setup`; kept a literal so the schema
    // imports nothing from the app.
    description: varchar("description", { length: 280 }),
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
    description: jsonb("description").$type<Content>(),
    // Placement Points: points for 1st, 2nd, 3rd…, highest first.
    placementPoints: numeric("placement_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).array(),
    scoring: competitionScoring("scoring").notNull(),
    countsTowardTeam: boolean("counts_toward_team").notNull().default(false),
    competitionGroup: varchar("competition_group", { length: 120 }),
    format: competitionFormat("format").notNull().default("placement"),
    // Placement only (the CHECK below): whether a higher or lower Score
    // wins, filling Places from Scores; `none` means Places are set by hand.
    scoreDirection: scoreDirection("score_direction").notNull().default("none"),
    // A Bracket's settings (`src/lib/bracket/config.ts`): match size,
    // advancing per Match and the 3rd place game. Set for every Bracket (app
    // logic, not a CHECK); null for every other Format.
    bracketConfig: jsonb("bracket_config").$type<BracketConfig | null>(),
    // Participants in a Match may enter its result themselves (ADR 0005).
    selfReport: boolean("self_report").notNull().default(false),
    // Set while the Competition's generated Points Entries exist: a
    // closed Bracket or Placement, or a closed Head-to-head or Best score
    // Competition.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Head-to-head and Best score only (the CHECK below): the Format's
    // settings (`src/lib/games/config.ts`); null means the Format's default.
    gameConfig: jsonb("game_config").$type<GamesConfig | null>(),
    // Head-to-head and Best score: true lets everyone eligible play; false
    // keeps a fixed Entrant list (`entrant` rows).
    entrantsOpen: boolean("entrants_open").notNull().default(false),
    // Head-to-head and Best score: Participants can't log Games after it.
    // Awards nothing.
    loggingClosesAt: timestamp("logging_closes_at", { withTimezone: true }),
    // Participants may enroll themselves as Entrants (ticket 15).
    selfEnroll: boolean("self_enroll").notNull().default(false),
    // Enrollment closes once this many Entrants are in; null for no limit.
    entrantLimit: integer("entrant_limit"),
    // Enrollment closes after this time; null for no close time.
    enrollClosesAt: timestamp("enroll_closes_at", { withTimezone: true }),
    // `participation` with individual scoring only (the CHECK below): N, the
    // points per Participant who took part. A team `participation`
    // Competition ranks Teams by headcount for its Placement Points instead.
    participationPoints: numeric("participation_points", {
      precision: 8,
      scale: 2,
      mode: "number",
    }),
    // `participation` only: Participants may check themselves in (ADR 0009).
    selfCheckIn: boolean("self_check_in").notNull().default(false),
    // `participation` only: Participants can't check in or out after it.
    checkInClosesAt: timestamp("check_in_closes_at", { withTimezone: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.name),
    check(
      "competition_counts_toward_team_individual_only",
      sql`not ${table.countsTowardTeam} or ${table.scoring} = 'individual'`,
    ),
    // Format CHECKs compare the text form, never the enum literal, so a
    // migration that changes the enum can re-add them in the same
    // transaction (R3 decision 13).
    check(
      "competition_score_direction_placement_only",
      sql`${table.scoreDirection}::text = 'none' or ${table.format}::text = 'placement'`,
    ),
    check(
      "competition_game_config_head_to_head_or_best_score",
      sql`${table.gameConfig} is null or ${table.format}::text in ('head-to-head', 'best-score')`,
    ),
    check(
      "competition_entrant_limit_above_1",
      sql`${table.entrantLimit} is null or ${table.entrantLimit} > 1`,
    ),
    // A `participation` Competition scores by its scoring: individual takes
    // N (`participation_points`) and no Placement Points, team takes
    // Placement Points and no N. Other Formats have no `participation`
    // settings.
    check(
      "competition_participation_columns",
      sql`case when ${table.format}::text = 'participation'
        then case when ${table.scoring} = 'individual'
          then ${table.participationPoints} is not null
            and ${table.placementPoints} is null
          else ${table.placementPoints} is not null
            and ${table.participationPoints} is null
          end
        else ${table.participationPoints} is null
          and ${table.checkInClosesAt} is null
          and not ${table.selfCheckIn}
        end`,
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
    // Every read scopes by this, not through the Competition: a
    // Discretionary points entry has no Competition.
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    // Null for Discretionary points, whose reason is the `note` (the CHECK
    // below).
    competitionId: uuid("competition_id").references(() => competition.id, {
      onDelete: "cascade",
    }),
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
    // Written by closing a Bracket or Placement or closing a Head-to-head
    // or Best score Competition; changed only through that Competition. The
    // name predates those Formats (R3 decision 1 keeps it).
    generated: boolean("generated").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.seedKey),
    index("points_entry_competition_id_idx").on(table.competitionId),
    index("points_entry_team_id_idx").on(table.teamId),
    index("points_entry_participant_id_idx").on(table.participantId),
    check(
      "points_entry_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
    check(
      "points_entry_reason_without_competition",
      sql`${table.competitionId} is not null or ${table.note} is not null`,
    ),
  ],
);

/**
 * One row of a Placement Competition's sheet: a Team or Participant with its
 * Place (null while unplaced) and optional Score. Close turns Places into
 * generated Points Entries by the Competition's Placement Points.
 */
export const placement = pgTable(
  "placement",
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
    place: integer("place"),
    score: numeric("score", { precision: 12, scale: 3, mode: "number" }),
    // Set only on rows that came from a seed file; see CONTEXT.md.
    seedKey: varchar("seed_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.teamId),
    unique().on(table.competitionId, table.participantId),
    unique().on(table.competitionId, table.seedKey),
    index("placement_competition_id_idx").on(table.competitionId),
    check(
      "placement_exactly_one_target",
      sql`num_nonnulls(${table.teamId}, ${table.participantId}) = 1`,
    ),
    check(
      "placement_place_from_1",
      sql`${table.place} is null or ${table.place} >= 1`,
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
 * One game of a Bracket, with `slotCount` places (two at match size 2; larger
 * Matches may hold more). A head-to-head winner feeds `winnerToMatchId`; with a
 * 3rd place game, each semifinal's loser feeds `loserToMatchId`, and the 3rd
 * place game is the Match marked `thirdPlace`.
 */
export const bracketMatch = pgTable(
  "bracket_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    position: integer("position").notNull(),
    status: bracketMatchStatus("status").notNull().default("pending"),
    // Fixed at Generate; `bracket_match_entrant.slot` runs 0…slotCount-1.
    slotCount: smallint("slot_count").notNull().default(2),
    winnerToMatchId: uuid("winner_to_match_id").references(
      (): AnyPgColumn => bracketMatch.id,
      { onDelete: "set null" },
    ),
    winnerToSlot: integer("winner_to_slot"),
    // A semifinal's loser feeds the 3rd place game (part 98).
    loserToMatchId: uuid("loser_to_match_id").references(
      (): AnyPgColumn => bracketMatch.id,
      { onDelete: "set null" },
    ),
    loserToSlot: integer("loser_to_slot"),
    // The 3rd place game: in the final's round, beside the final.
    thirdPlace: boolean("third_place").notNull().default(false),
    // When the Match's result was last saved; null until it is played.
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    // Set when a Participant self-reported the current result; cleared when
    // a later save changes the Match. The email is kept for audit and never
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
    index("bracket_match_winner_to_match_id_idx").on(table.winnerToMatchId),
    index("bracket_match_loser_to_match_id_idx").on(table.loserToMatchId),
    index("bracket_match_reported_by_participant_id_idx").on(
      table.reportedByParticipantId,
    ),
  ],
);

/** An Entrant in a Match's slot, with its place and score once decided. */
export const bracketMatchEntrant = pgTable(
  "bracket_match_entrant",
  {
    matchId: uuid("bracket_match_id")
      .notNull()
      .references(() => bracketMatch.id, { onDelete: "cascade" }),
    entrantId: uuid("entrant_id")
      .notNull()
      .references(() => entrant.id, { onDelete: "cascade" }),
    slot: integer("slot").notNull(),
    place: integer("place"),
    score: varchar("score", { length: 40 }),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.slot] }),
    unique().on(table.matchId, table.entrantId),
    index("bracket_match_entrant_entrant_id_idx").on(table.entrantId),
    // The engine's slots are 0-based and its places 1-based.
    check("bracket_match_entrant_slot_from_0", sql`${table.slot} >= 0`),
    check(
      "bracket_match_entrant_place_from_1",
      sql`${table.place} is null or ${table.place} >= 1`,
    ),
  ],
);

/**
 * One recorded contest in a Head-to-head or Best score Competition, logged
 * by a player in it or
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
 * has none): its place (Head-to-head 1/2, 1/1 for a draw) or its score
 * (Best score).
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

/**
 * A Participant who took part in a `participation` Competition: ticked by
 * the Host or an Organizer, or checked in by the Participant themselves
 * (ADR 0009). Scored only when the Competition closes.
 */
export const participation = pgTable(
  "participation",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    // Kept for audit and never read back to a page or MCP (CONTEXT.md,
    // Access rules).
    markedByEmail: varchar("marked_by_email", { length: 254 }).notNull(),
    // True when the Participant checked themselves in; false when the Host
    // or an Organizer marked them.
    checkedIn: boolean("checked_in").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.participantId),
    index("participation_participant_id_idx").on(table.participantId),
  ],
);

/**
 * A global Award Category (e.g. War Week MVP): what Awards of different War
 * Weeks share, so one view lists a Category's recipients through the years.
 * Archived, never deleted: an archived Category stays on past Awards but
 * can't be newly picked. `key` is set only on the seeded Categories, which
 * seeds name so a rename never breaks them.
 */
export const awardCategory = pgTable(
  "award_category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 80 }).notNull(),
    key: varchar("key", { length: 80 }).unique(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("award_category_name_lower").on(sql`lower(${table.name})`),
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
    categoryId: uuid("category_id").references(() => awardCategory.id, {
      onDelete: "restrict",
    }),
    seedKey: varchar("seed_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.warWeekId, table.seedKey),
    index("award_team_id_idx").on(table.teamId),
    index("award_category_id_idx").on(table.categoryId),
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

/**
 * One Finale slide in a War Week's saved list (CONTEXT.md, Finale slide):
 * a built-in (once per War Week, no heading) or a Custom slide (unique by
 * heading). A War Week with no rows plays the default order; the first
 * change saves the whole list (`src/mutations/finale-slides.ts`).
 */
export const finaleSlide = pgTable(
  "finale_slide",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    warWeekId: uuid("war_week_id")
      .notNull()
      .references(() => warWeek.id, { onDelete: "cascade" }),
    kind: finaleSlideKind("kind").notNull(),
    sortOrder: integer("sort_order").notNull(),
    hidden: boolean("hidden").notNull().default(false),
    // Custom slides only (the CHECKs below). `FINALE_SLIDE_HEADING_MAX` in
    // `@/lib/custom-finale-slide`; a literal so the schema imports nothing from
    // the app.
    heading: varchar("heading", { length: 120 }),
    body: jsonb("body").$type<Content>(),
    // `#rrggbb`, lower-case; null for the theme's background.
    backgroundColor: varchar("background_color", { length: 7 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    // Nulls not distinct: each built-in (heading null) once per War Week,
    // each Custom slide heading once.
    unique("finale_slide_war_week_kind_heading")
      .on(table.warWeekId, table.kind, table.heading)
      .nullsNotDistinct(),
    check(
      "finale_slide_custom_columns",
      sql`(${table.kind}::text = 'custom') = (${table.heading} is not null) and (${table.kind}::text = 'custom' or (${table.body} is null and ${table.backgroundColor} is null))`,
    ),
    check(
      "finale_slide_background_color_hex",
      sql`${table.backgroundColor} is null or ${table.backgroundColor} ~ '^#[0-9a-f]{6}$'`,
    ),
  ],
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

/**
 * A person's Profile, by lowercase email: the name and picture URL they set
 * themselves, shown wherever that email is linked (ADR 0007). Not columns
 * on `user`: better-auth writes `user`, and a Profile resolves by email for
 * Participants who never signed in. Empty fields mean the roster name and
 * the Google photo (`user.image`).
 */
export const profile = pgTable(
  "profile",
  {
    email: varchar("email", { length: 254 }).primaryKey(),
    name: varchar("name", { length: 120 }),
    imageUrl: varchar("image_url", { length: 2048 }),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    check(
      "profile_email_lowercase",
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
    // Written only by Test sign-in (`src/actions/test-sign-in.ts`).
    testSignIn: boolean("test_sign_in").notNull().default(false),
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
  finaleSlides: many(finaleSlide),
  pointsEntries: many(pointsEntry),
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
  placements: many(placement),
}));

export const participantRelations = relations(participant, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [participant.warWeekId],
    references: [warWeek.id],
  }),
  team: one(team, { fields: [participant.teamId], references: [team.id] }),
  pointsEntries: many(pointsEntry),
  placements: many(placement),
  awards: many(awardParticipant),
}));

export const competitionRelations = relations(competition, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [competition.warWeekId],
    references: [warWeek.id],
  }),
  pointsEntries: many(pointsEntry),
  placements: many(placement),
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
  warWeek: one(warWeek, {
    fields: [pointsEntry.warWeekId],
    references: [warWeek.id],
  }),
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

export const placementRelations = relations(placement, ({ one }) => ({
  competition: one(competition, {
    fields: [placement.competitionId],
    references: [competition.id],
  }),
  team: one(team, { fields: [placement.teamId], references: [team.id] }),
  participant: one(participant, {
    fields: [placement.participantId],
    references: [participant.id],
  }),
}));

export const awardRelations = relations(award, ({ one, many }) => ({
  warWeek: one(warWeek, {
    fields: [award.warWeekId],
    references: [warWeek.id],
  }),
  team: one(team, { fields: [award.teamId], references: [team.id] }),
  category: one(awardCategory, {
    fields: [award.categoryId],
    references: [awardCategory.id],
  }),
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

export const finaleSlideRelations = relations(finaleSlide, ({ one }) => ({
  warWeek: one(warWeek, {
    fields: [finaleSlide.warWeekId],
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
export type PlacementRow = InferSelectModel<typeof placement>;
export type Award = InferSelectModel<typeof award>;
export type AwardCategory = InferSelectModel<typeof awardCategory>;
export type AwardParticipant = InferSelectModel<typeof awardParticipant>;
export type Announcement = InferSelectModel<typeof announcement>;
export type FaqItem = InferSelectModel<typeof faqItem>;
export type FinaleSlide = InferSelectModel<typeof finaleSlide>;
export type Squad = InferSelectModel<typeof squad>;
export type SquadParticipant = InferSelectModel<typeof squadParticipant>;
export type EntrantRow = InferSelectModel<typeof entrant>;
export type BracketMatchRow = InferSelectModel<typeof bracketMatch>;
export type BracketMatchEntrantRow = InferSelectModel<
  typeof bracketMatchEntrant
>;
export type GameRow = InferSelectModel<typeof game>;
export type GamePlayerRow = InferSelectModel<typeof gamePlayer>;
export type ParticipationRow = InferSelectModel<typeof participation>;
export type Organizer = InferSelectModel<typeof organizer>;
export type Profile = InferSelectModel<typeof profile>;
export type CompetitionHost = InferSelectModel<typeof competitionHost>;
