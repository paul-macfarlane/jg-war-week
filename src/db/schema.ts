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

import type { BestScoreConfig } from "@/lib/best-score/config";
import type { BracketConfig } from "@/lib/bracket/config";
import {
  COMPETITION_FORMATS,
  COMPETITION_SCORINGS,
  FINALE_SLIDE_KINDS,
  FONT_PRESETS,
  LEAGUE_RESULTS,
  MATCH_STATUSES,
  SCHEDULE_ITEM_CATEGORIES,
  SCORE_DIRECTIONS,
  WAR_WEEK_MODES,
  WAR_WEEK_STATUSES,
} from "@/lib/enums";
import type { LeagueConfig } from "@/lib/league/config";
import type { Content } from "@/lib/rich-text/content";
import type { SeriesConfig } from "@/lib/series/config";

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

export const leagueResult = pgEnum("league_result", LEAGUE_RESULTS);

export const finaleSlideKind = pgEnum("finale_slide_kind", FINALE_SLIDE_KINDS);

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
    // Whether a higher or lower Score wins; `none` means places are set by
    // hand. Best score is always higher or lower, Participation always
    // `none` (the CHECK below).
    scoreDirection: scoreDirection("score_direction").notNull().default("none"),
    // The Scores' unit label, like "sec"; null for none.
    scoreUnit: varchar("score_unit", { length: 20 }),
    // A Bracket's settings (`src/lib/bracket/config.ts`): its kind, match
    // size, advancing per Match, the 3rd place Match and per-round
    // defaults. Set for every Bracket (app logic, not a CHECK); null for
    // every other Format.
    bracketConfig: jsonb("bracket_config").$type<BracketConfig | null>(),
    // "Participants can log their own results" (ADR 0011): with it on,
    // anyone who could have logged a result logs it and changes it while
    // the Competition is open.
    selfReport: boolean("self_report").notNull().default(false),
    // Set while the Competition's generated Points Entries exist: a
    // closed Bracket or Placement, or a closed Head-to-head or Best score
    // Competition.
    closedAt: timestamp("closed_at", { withTimezone: true }),
    // Head-to-head only, and always set there (the CHECK below): draws and
    // Best of (`src/lib/series/config.ts`).
    seriesConfig: jsonb("series_config").$type<SeriesConfig | null>(),
    // Best score only (the CHECK below): how a Team's score adds up
    // (`src/lib/best-score/config.ts`); null means the default.
    bestScoreConfig: jsonb("best_score_config").$type<BestScoreConfig | null>(),
    // Best score only: the most Attempts per person; null for no limit.
    maxAttempts: integer("max_attempts"),
    // League only, and always set there (the CHECKs below): its Pairing
    // and, for Swiss, its rounds (`src/lib/league/config.ts`).
    leagueConfig: jsonb("league_config").$type<LeagueConfig | null>(),
    // Bracket and League only (the CHECK below): Participants may enroll
    // themselves as Entrants (ticket 15).
    selfEnroll: boolean("self_enroll").notNull().default(false),
    // Enrollment closes once this many Entrants are in; null for no limit.
    entrantLimit: integer("entrant_limit"),
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
      "competition_score_direction_by_format",
      sql`case ${table.format}::text
        when 'participation' then ${table.scoreDirection}::text = 'none'
        when 'best-score' then ${table.scoreDirection}::text in ('higher', 'lower')
        else true
        end`,
    ),
    check(
      "competition_series_config_head_to_head",
      sql`(${table.seriesConfig} is not null) = (${table.format}::text = 'head-to-head')`,
    ),
    check(
      "competition_best_score_config_best_score",
      sql`${table.bestScoreConfig} is null or ${table.format}::text = 'best-score'`,
    ),
    check(
      "competition_max_attempts",
      sql`${table.maxAttempts} is null or (${table.maxAttempts} >= 1 and ${table.format}::text = 'best-score')`,
    ),
    // Enrollment is a Bracket's and a League's; the name predates League.
    check(
      "competition_self_enroll_bracket_only",
      sql`${table.format}::text in ('bracket', 'league') or (not ${table.selfEnroll} and ${table.entrantLimit} is null)`,
    ),
    check(
      "competition_league_config_league",
      sql`(${table.leagueConfig} is not null) = (${table.format}::text = 'league')`,
    ),
    // Pairing is Round robin or Swiss; `rounds` is absent or null, or (Swiss
    // only) a whole number from 1. The CASE keeps the cast off a non-number.
    check(
      "competition_league_config_shape",
      sql`${table.leagueConfig} is null or (
        ${table.leagueConfig}->>'pairing' in ('round-robin', 'swiss')
        and case when jsonb_typeof(${table.leagueConfig}->'rounds') = 'number'
          then (${table.leagueConfig}->>'rounds')::numeric >= 1
            and (${table.leagueConfig}->>'rounds')::numeric = floor((${table.leagueConfig}->>'rounds')::numeric)
            and ${table.leagueConfig}->>'pairing' = 'swiss'
          else coalesce(jsonb_typeof(${table.leagueConfig}->'rounds'), 'null') = 'null'
          end)`,
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
 * One Match of a Bracket, with `slotCount` places (two at match size 2;
 * larger Matches may hold more) and `advanceCount` of them advancing. A
 * head-to-head winner feeds `winnerToMatchId`; with a 3rd place Match, each
 * semifinal's loser feeds `loserToMatchId`, and the 3rd place Match is the
 * one marked `thirdPlace`.
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
    // How many of the Match advance (1 in a head-to-head Bracket and in the
    // final); fixed at Generate.
    advanceCount: smallint("advance_count").notNull(),
    winnerToMatchId: uuid("winner_to_match_id").references(
      (): AnyPgColumn => bracketMatch.id,
      { onDelete: "set null" },
    ),
    winnerToSlot: integer("winner_to_slot"),
    // A semifinal's loser feeds the 3rd place Match (part 98).
    loserToMatchId: uuid("loser_to_match_id").references(
      (): AnyPgColumn => bracketMatch.id,
      { onDelete: "set null" },
    ),
    loserToSlot: integer("loser_to_slot"),
    // The 3rd place Match: in the final's round, beside the final.
    thirdPlace: boolean("third_place").notNull().default(false),
    // When the Match's result was last saved; null until it is played.
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    // Set when a Participant self-reported the current result; cleared when
    // a later save changes the Match. The email is kept for audit and never
    // read back to a page (see CONTEXT.md, Access rules).
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
    check(
      "bracket_match_advance_count_from_1",
      sql`${table.advanceCount} >= 1`,
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
    score: numeric("score", { precision: 12, scale: 3, mode: "number" }),
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
 * One Match of a Head-to-head series, between the Competition's two
 * Entrants, logged by a player in it or by a Host or Organizer. Matches
 * have no scheduled time: `recorded_at` orders the series.
 */
export const seriesMatch = pgTable(
  "series_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Kept for audit and never read back to a page (CONTEXT.md,
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
    index("series_match_competition_id_idx").on(table.competitionId),
    index("series_match_logged_by_participant_id_idx").on(
      table.loggedByParticipantId,
    ),
  ],
);

/**
 * One of the two Entrants in a series Match: its place (1 and 2, or 1 and 1
 * for a Draw) and its Score.
 */
export const seriesMatchEntrant = pgTable(
  "series_match_entrant",
  {
    seriesMatchId: uuid("series_match_id")
      .notNull()
      .references(() => seriesMatch.id, { onDelete: "cascade" }),
    entrantId: uuid("entrant_id")
      .notNull()
      .references(() => entrant.id, { onDelete: "cascade" }),
    place: integer("place"),
    score: numeric("score", { precision: 12, scale: 3, mode: "number" }),
  },
  (table) => [
    primaryKey({ columns: [table.seriesMatchId, table.entrantId] }),
    index("series_match_entrant_entrant_id_idx").on(table.entrantId),
    check(
      "series_match_entrant_place_from_1",
      sql`${table.place} is null or ${table.place} >= 1`,
    ),
  ],
);

/**
 * One Attempt in a Best score Competition: a Participant's Score, logged by
 * them or by a Host or Organizer. In team scoring it counts for `team_id`,
 * the Participant's Team when it was logged (a later Team change doesn't
 * move it).
 */
export const attempt = pgTable(
  "attempt",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    teamId: uuid("team_id").references(() => team.id, {
      onDelete: "cascade",
    }),
    score: numeric("score", {
      precision: 12,
      scale: 3,
      mode: "number",
    }).notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    // Kept for audit and never read back to a page (CONTEXT.md,
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
    index("attempt_competition_id_idx").on(table.competitionId),
    index("attempt_participant_id_idx").on(table.participantId),
    index("attempt_team_id_idx").on(table.teamId),
    index("attempt_logged_by_participant_id_idx").on(
      table.loggedByParticipantId,
    ),
  ],
);

/**
 * One Match of a League (CONTEXT.md, League): a pairing of two Entrants in
 * a round, and its result once recorded. A row with no `entrantB` is a bye
 * (Swiss, worth 1) or a sit-out (round robin, worth 0), and never has a
 * result. "An Entrant plays once per round" spans rows, so it is the
 * pairing engine's rule (`src/lib/league/pairing.ts`), not a constraint.
 */
export const leagueMatch = pgTable(
  "league_match",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    round: integer("round").notNull(),
    // The Match's order in its round, from 0.
    position: integer("position").notNull(),
    entrantAId: uuid("entrant_a_id")
      .notNull()
      .references(() => entrant.id, { onDelete: "cascade" }),
    // Null for a bye or sit-out.
    entrantBId: uuid("entrant_b_id").references(() => entrant.id, {
      onDelete: "cascade",
    }),
    result: leagueResult("result"),
    scoreA: numeric("score_a", { precision: 12, scale: 3, mode: "number" }),
    scoreB: numeric("score_b", { precision: 12, scale: 3, mode: "number" }),
    // When the result was last saved; null until it has one.
    recordedAt: timestamp("recorded_at", { withTimezone: true }),
    // Kept for audit and never read back to a page (CONTEXT.md,
    // Access rules).
    recordedByEmail: varchar("recorded_by_email", { length: 254 }),
    // The linked Participant who recorded it; null for a Host or Organizer.
    recordedByParticipantId: uuid("recorded_by_participant_id").references(
      () => participant.id,
      { onDelete: "set null" },
    ),
    // Set only on rows that came from a seed file; see CONTEXT.md.
    seedKey: varchar("seed_key", { length: 80 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    unique().on(table.competitionId, table.round, table.position),
    unique().on(table.competitionId, table.seedKey),
    index("league_match_entrant_a_id_idx").on(table.entrantAId),
    index("league_match_entrant_b_id_idx").on(table.entrantBId),
    index("league_match_recorded_by_participant_id_idx").on(
      table.recordedByParticipantId,
    ),
    check("league_match_round_from_1", sql`${table.round} >= 1`),
    check("league_match_position_from_0", sql`${table.position} >= 0`),
    check(
      "league_match_two_entrants",
      sql`${table.entrantBId} is null or ${table.entrantBId} <> ${table.entrantAId}`,
    ),
    check(
      "league_match_bye_no_result",
      sql`${table.entrantBId} is not null or (${table.result} is null and ${table.scoreA} is null and ${table.scoreB} is null)`,
    ),
    check(
      "league_match_recorded",
      sql`(${table.result} is null) = (${table.recordedAt} is null)`,
    ),
    check(
      "league_match_scores_need_result",
      sql`${table.result} is not null or (${table.scoreA} is null and ${table.scoreB} is null)`,
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
    // Kept for audit and never read back to a page (CONTEXT.md,
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

/**
 * A Host: a roster Participant who runs one Competition (ADR 0012). Access
 * follows the Participant's roster email at request time. The Participant
 * must be on the Competition's War Week roster, a write-time rule in
 * `setCompetitionHosts`, not a constraint.
 */
export const competitionHost = pgTable(
  "competition_host",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    competitionId: uuid("competition_id")
      .notNull()
      .references(() => competition.id, { onDelete: "cascade" }),
    participantId: uuid("participant_id")
      .notNull()
      .references(() => participant.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    // Participant first, so it also serves what a Participant hosts.
    unique().on(table.participantId, table.competitionId),
    index("competition_host_competition_id_idx").on(table.competitionId),
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
export type SeriesMatchRow = InferSelectModel<typeof seriesMatch>;
export type SeriesMatchEntrantRow = InferSelectModel<typeof seriesMatchEntrant>;
export type AttemptRow = InferSelectModel<typeof attempt>;
export type LeagueMatchRow = InferSelectModel<typeof leagueMatch>;
export type ParticipationRow = InferSelectModel<typeof participation>;
export type Organizer = InferSelectModel<typeof organizer>;
export type Profile = InferSelectModel<typeof profile>;
export type CompetitionHost = InferSelectModel<typeof competitionHost>;
