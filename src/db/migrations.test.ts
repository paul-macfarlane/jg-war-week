import { sql } from "drizzle-orm";
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import {
  DRIZZLE_DIR,
  migrateTo,
  withThrowawayDatabase,
} from "@/db/test-database";
import { inRolledBackTransaction } from "@/db/test-transaction";

const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/** A committed migration's statements, found by its fixed tag. */
function statementsOf(tag: string): string[] {
  const file = readdirSync(DRIZZLE_DIR).find((f) => f.endsWith(`_${tag}.sql`));
  if (!file) throw new Error(`No migration tagged ${tag}`);
  return readFileSync(path.join(DRIZZLE_DIR, file), "utf-8")
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);
}

const paragraph = {
  type: "paragraph",
  content: [{ type: "text", text: "Kickoff at nine." }],
};

describe.skipIf(!isLocalDatabase)(
  "moving Announcement videos into the body",
  () => {
    it("appends each video link as a video node, in order, then drops the column", async () => {
      await inRolledBackTransaction(async (tx) => {
        await tx.execute(sql`create schema r11_migration_test`);
        await tx.execute(sql`set local search_path to r11_migration_test`);
        await tx.execute(sql`
        create table announcement (
          id uuid primary key,
          body jsonb not null,
          video_urls varchar(500)[] not null default '{}'
        )`);
        const withLinks = "00000000-0000-0000-0000-000000000001";
        const withoutLinks = "00000000-0000-0000-0000-000000000002";
        const body = JSON.stringify({ type: "doc", content: [paragraph] });
        await tx.execute(sql`
        insert into announcement (id, body, video_urls) values
          (${withLinks}, ${body}::jsonb,
            array['https://www.youtube.com/watch?v=aaa','https://vimeo.com/123']),
          (${withoutLinks}, ${body}::jsonb, '{}')`);

        for (const tag of [
          "announcement-videos-into-body",
          "drop-announcement-video-urls",
        ]) {
          for (const statement of statementsOf(tag)) {
            await tx.execute(sql.raw(statement));
          }
        }

        const rows = (await tx.execute(sql`select id, body from announcement`))
          .rows as { id: string; body: unknown }[];
        const bodyOf = (id: string) => rows.find((r) => r.id === id)?.body;
        expect(bodyOf(withLinks)).toEqual({
          type: "doc",
          content: [
            paragraph,
            {
              type: "video",
              attrs: { src: "https://www.youtube.com/watch?v=aaa" },
            },
            { type: "video", attrs: { src: "https://vimeo.com/123" } },
          ],
        });
        expect(bodyOf(withoutLinks)).toEqual({
          type: "doc",
          content: [paragraph],
        });

        const columns = (
          await tx.execute(sql`
          select column_name from information_schema.columns
          where table_schema = 'r11_migration_test'
            and table_name = 'announcement'`)
        ).rows.map((r) => (r as { column_name: string }).column_name);
        expect(columns).not.toContain("video_urls");
      });
    });
  },
);

/** A copy of `drizzle/` whose journal stops at migration `lastIdx`. */
function migrationsUpTo(lastIdx: number): string {
  const dir = mkdtempSync(path.join(tmpdir(), "migrations-"));
  cpSync(DRIZZLE_DIR, dir, { recursive: true });
  const journalPath = path.join(dir, "meta", "_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf-8")) as {
    entries: { idx: number }[];
  };
  journal.entries = journal.entries.filter((entry) => entry.idx <= lastIdx);
  writeFileSync(journalPath, JSON.stringify(journal));
  return dir;
}

// Fixed ids, so the assertions read like the rows they describe.
const id = (n: number) =>
  `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const WW_X = id(1);
const WW_XI = id(2);
const RED = id(11);
const BLUE = id(12);
const RED_X = id(13);
const ANA = id(21);
const BEN = id(22);
const CAL_X = id(23);
const POINTS_X = id(101);
const POINTS_XI = id(102);
const HEAD_TO_HEAD = id(103);
const BEST_SCORE = id(104);
const RANKED = id(105);
const PER_PERSON = id(106);
const RANKED_TEAM = id(107);
const BRACKET = id(108);
const PER_PARTICIPANT = id(109);

/** One row of each competition shape the R16 migration must carry. */
const PRE_R16_ROWS = `
  insert into war_week (id, edition, edition_number, year, start_date,
    end_date, story_theme, status, mode, team_label, leader_title,
    slack_channel_url, primary_color, primary_foreground_color, accent_color,
    background_color, foreground_color, font_preset)
  values
    ('${WW_X}', 'x', 9810, 9810, '2025-02-24', '2025-02-28', 'Ten',
      'complete', 'teams', 'Team', 'Captain', 'https://slack.example',
      '#000000', '#ffffff', '#ff0000', '#ffffff', '#000000', 'sans'),
    ('${WW_XI}', 'xi', 9811, 9811, '2026-02-23', '2026-02-27', 'Eleven',
      'live', 'teams', 'Team', 'Captain', 'https://slack.example',
      '#000000', '#ffffff', '#ff0000', '#ffffff', '#000000', 'sans');

  insert into team (id, war_week_id, name, color) values
    ('${RED}', '${WW_XI}', 'Red', '#ff0000'),
    ('${BLUE}', '${WW_XI}', 'Blue', '#0000ff'),
    ('${RED_X}', '${WW_X}', 'Red', '#ff0000');

  insert into participant (id, war_week_id, display_name, team_id) values
    ('${ANA}', '${WW_XI}', 'Ana', '${RED}'),
    ('${BEN}', '${WW_XI}', 'Ben', '${BLUE}'),
    ('${CAL_X}', '${WW_X}', 'Cal', '${RED_X}');

  insert into competition (id, war_week_id, name, scoring, format, max_points,
    placement_points, game_type, game_config, finalized_at, entrants_open,
    logging_closes_at, participation_points, participation_team_scoring)
  values
    ('${POINTS_X}', '${WW_X}', 'Trivia', 'team', 'points', 10,
      null, null, null, null, false, null, null, null),
    ('${POINTS_XI}', '${WW_XI}', 'Trivia', 'individual', 'points', null,
      '{5,3,1}', null, null, null, false, null, null, null),
    ('${HEAD_TO_HEAD}', '${WW_XI}', 'Bouncy Pong', 'individual', 'games', null,
      '{5,3,1}', 'head-to-head', '{"drawsAllowed":false,"bestOf":null}', null,
      false, null, null, null),
    ('${BEST_SCORE}', '${WW_XI}', 'Tuesday Stairs', 'team', 'games', null,
      '{5,3}', 'best-score', null, null, true, null, null, null),
    ('${RANKED}', '${WW_XI}', 'Electric City Matrix', 'individual', 'games',
      null, '{5,3,1}', 'ranked', '{"finishPoints":[3,2,1]}',
      '2026-02-25T17:00:00Z', true, '2026-02-25T16:00:00Z', null, null),
    ('${PER_PERSON}', '${WW_XI}', 'Daily Workout', 'team', 'participation',
      null, null, null, null, null, false, null, 2, 'per-person'),
    ('${RANKED_TEAM}', '${WW_XI}', 'Lunch and Learn', 'team', 'participation',
      null, '{4,2}', null, null, null, false, null, 1, 'ranked'),
    ('${BRACKET}', '${WW_XI}', 'Ping Pong', 'individual', 'single-elimination',
      25, '{5,3}', null, null, null, false, null, null, null),
    ('${PER_PARTICIPANT}', '${WW_XI}', 'Morning Stretch', 'individual',
      'participation', null, '{6,4}', null, null, null, false, null, 3, null);

  insert into points_entry (competition_id, team_id, participant_id, points,
    entered_by_email, seed_key, generated_by_bracket)
  values
    ('${POINTS_X}', '${RED_X}', null, 4, 'organizer@example.com', 'trivia-red', false),
    ('${POINTS_XI}', null, '${ANA}', 3, 'organizer@example.com', 'trivia-ana', false),
    ('${POINTS_XI}', null, '${BEN}', 2, 'host@example.com', null, false),
    ('${RANKED}', null, '${ANA}', 5, 'organizer@example.com', null, true),
    ('${RANKED}', null, '${BEN}', 3, 'organizer@example.com', null, true);

  insert into entrant (id, competition_id, participant_id, seed_position) values
    (gen_random_uuid(), '${HEAD_TO_HEAD}', '${ANA}', 1),
    (gen_random_uuid(), '${HEAD_TO_HEAD}', '${BEN}', 2),
    (gen_random_uuid(), '${RANKED}', '${ANA}', 1),
    (gen_random_uuid(), '${RANKED}', '${BEN}', 2);

  insert into game (id, competition_id, logged_by_email) values
    ('${id(201)}', '${HEAD_TO_HEAD}', 'ana@example.com'),
    ('${id(202)}', '${RANKED}', 'ana@example.com'),
    ('${id(203)}', '${BEST_SCORE}', 'ben@example.com');

  insert into game_player (game_id, team_id, participant_id, place, score) values
    ('${id(201)}', null, '${ANA}', 1, null),
    ('${id(201)}', null, '${BEN}', 2, null),
    ('${id(202)}', null, '${ANA}', 1, null),
    ('${id(202)}', null, '${BEN}', 2, null),
    ('${id(203)}', '${BLUE}', null, null, 42);
`;

describe.skipIf(!isLocalDatabase)(
  "migrating populated pre-R16 data to the Competition model",
  () => {
    it("commits, maps every old shape to its new Format and backfills each Points Entry's War Week", async () => {
      const upTo0027 = migrationsUpTo(27);
      const upTo0028 = migrationsUpTo(28);
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0027);

            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(PRE_R16_ROWS);

              await migrateTo(url, upTo0028);

              const applied = await client.query(
                "select count(*)::int as n from drizzle.__drizzle_migrations",
              );
              expect(applied.rows[0].n).toBe(29);

              const formats = await client.query<{
                id: string;
                format: string;
              }>("select id, format::text from competition");
              expect(
                Object.fromEntries(formats.rows.map((r) => [r.id, r.format])),
              ).toEqual({
                [POINTS_X]: "placement",
                [POINTS_XI]: "placement",
                [HEAD_TO_HEAD]: "head-to-head",
                [BEST_SCORE]: "best-score",
                [RANKED]: "placement",
                [PER_PERSON]: "participation",
                [RANKED_TEAM]: "participation",
                [BRACKET]: "single-elimination",
                [PER_PARTICIPANT]: "participation",
              });

              const ranked = await client.query(
                `select finalized_at, game_config, logging_closes_at, entrants_open,
                (select count(*)::int from game where competition_id = $1) as games,
                (select count(*)::int from entrant where competition_id = $1) as entrants,
                (select count(*)::int from points_entry where competition_id = $1) as entries
              from competition where id = $1`,
                [RANKED],
              );
              expect(ranked.rows[0]).toEqual({
                finalized_at: null,
                game_config: null,
                logging_closes_at: null,
                entrants_open: false,
                games: 0,
                entrants: 0,
                entries: 0,
              });

              const headToHead = await client.query(
                `select game_config,
                (select count(*)::int from game where competition_id = $1) as games,
                (select count(*)::int from entrant where competition_id = $1) as entrants
              from competition where id = $1`,
                [HEAD_TO_HEAD],
              );
              expect(headToHead.rows[0]).toEqual({
                game_config: { drawsAllowed: false, bestOf: null },
                games: 1,
                entrants: 2,
              });

              const teamParticipation = await client.query<{
                id: string;
                placement_points: number[] | null;
                participation_points: number | null;
              }>(
                `select id, placement_points,
                participation_points::float8 as participation_points
              from competition
              where id in ($1, $2, $3) order by name`,
                [PER_PERSON, RANKED_TEAM, PER_PARTICIPANT],
              );
              expect(teamParticipation.rows).toEqual([
                {
                  id: PER_PERSON,
                  placement_points: [2],
                  participation_points: null,
                },
                {
                  id: RANKED_TEAM,
                  placement_points: [4, 2],
                  participation_points: null,
                },
                // Individual: N kept, the Placement Points it held dropped.
                {
                  id: PER_PARTICIPANT,
                  placement_points: null,
                  participation_points: 3,
                },
              ]);

              const entries = await client.query<{
                competition_id: string;
                war_week_id: string;
              }>(
                "select competition_id, war_week_id from points_entry order by competition_id",
              );
              expect(entries.rows).toEqual([
                { competition_id: POINTS_X, war_week_id: WW_X },
                { competition_id: POINTS_XI, war_week_id: WW_XI },
                { competition_id: POINTS_XI, war_week_id: WW_XI },
              ]);

              const columns = await client.query<{ column_name: string }>(
                `select column_name from information_schema.columns
              where table_schema = 'public' and table_name = 'competition'`,
              );
              const columnNames = columns.rows.map((r) => r.column_name);
              expect(columnNames).not.toContain("max_points");
              expect(columnNames).not.toContain("game_type");
              expect(columnNames).not.toContain("participation_team_scoring");
            } finally {
              await client.end();
            }
          },
          { migrations: false },
        );
      } finally {
        rmSync(upTo0027, { recursive: true, force: true });
        rmSync(upTo0028, { recursive: true, force: true });
      }
    }, 60_000);
  },
);

const SINGLE_ELIMINATION = id(301);
const HEATS = id(302);
const CHESS_DAY = id(303);
const FORFEIT_HEAT = id(311);
const TIMED_HEAT = id(312);
const HEATS_HEAT = id(313);
const ANA_ENTRANT = id(321);
const BEN_ENTRANT = id(322);
const HEATS_ANA = id(323);
const HEATS_BEN = id(324);

/** A finalized single-elimination Bracket and a Heats one, as of 0028. */
const PRE_R17_ROWS = `
  insert into war_week (id, edition, edition_number, year, start_date,
    end_date, story_theme, status, mode, team_label, leader_title,
    slack_channel_url, primary_color, primary_foreground_color, accent_color,
    background_color, foreground_color, font_preset)
  values ('${WW_XI}', 'xi', 9811, 9811, '2026-02-23', '2026-02-27', 'Eleven',
    'live', 'teams', 'Team', 'Captain', 'https://slack.example',
    '#000000', '#ffffff', '#ff0000', '#ffffff', '#000000', 'sans');

  insert into team (id, war_week_id, name, color) values
    ('${RED}', '${WW_XI}', 'Red', '#ff0000'),
    ('${BLUE}', '${WW_XI}', 'Blue', '#0000ff');

  insert into participant (id, war_week_id, display_name, team_id) values
    ('${ANA}', '${WW_XI}', 'Ana', '${RED}'),
    ('${BEN}', '${WW_XI}', 'Ben', '${BLUE}');

  insert into day (id, war_week_id, date, day_theme) values
    ('${CHESS_DAY}', '${WW_XI}', '2026-02-24', 'Tuesday');

  insert into competition (id, war_week_id, name, scoring, format,
    placement_points, bracket_config, finalized_at)
  values
    ('${SINGLE_ELIMINATION}', '${WW_XI}', 'Ping Pong', 'individual',
      'single-elimination', '{5,3}', null, '2026-02-25T17:00:00Z'),
    ('${HEATS}', '${WW_XI}', 'Chess Heats', 'individual', 'heats',
      '{9,7,5,3,1}', '{"entrantsPerHeat":4,"advancePerHeat":2}', null);

  insert into entrant (id, competition_id, participant_id, seed_position) values
    ('${ANA_ENTRANT}', '${SINGLE_ELIMINATION}', '${ANA}', 1),
    ('${BEN_ENTRANT}', '${SINGLE_ELIMINATION}', '${BEN}', 2),
    ('${HEATS_ANA}', '${HEATS}', '${ANA}', 1),
    ('${HEATS_BEN}', '${HEATS}', '${BEN}', 2);

  insert into heat (id, competition_id, round, position, status, slot_count,
    day_id, start_time, location)
  values
    ('${FORFEIT_HEAT}', '${SINGLE_ELIMINATION}', 1, 0, 'forfeit', 2,
      null, null, null),
    ('${TIMED_HEAT}', '${SINGLE_ELIMINATION}', 1, 1, 'played', 2,
      '${CHESS_DAY}', '14:30', 'Break room'),
    ('${HEATS_HEAT}', '${HEATS}', 1, 0, 'ready', 4, null, null, null);

  insert into heat_entrant (heat_id, entrant_id, slot, place, forfeited) values
    ('${FORFEIT_HEAT}', '${ANA_ENTRANT}', 0, 1, false),
    ('${FORFEIT_HEAT}', '${BEN_ENTRANT}', 1, null, true),
    ('${TIMED_HEAT}', '${BEN_ENTRANT}', 0, 1, false),
    ('${HEATS_HEAT}', '${HEATS_ANA}', 0, null, false),
    ('${HEATS_HEAT}', '${HEATS_BEN}', 1, null, false);

  insert into points_entry (war_week_id, competition_id, participant_id,
    points, note, entered_by_email, generated_by_bracket)
  values
    ('${WW_XI}', '${SINGLE_ELIMINATION}', '${ANA}', 5, null,
      'organizer@example.com', true),
    ('${WW_XI}', '${SINGLE_ELIMINATION}', '${BEN}', 3, null,
      'organizer@example.com', true),
    ('${WW_XI}', '${SINGLE_ELIMINATION}', '${BEN}', 1, 'Good sport',
      'host@example.com', false);
`;

describe.skipIf(!isLocalDatabase)(
  "migrating populated pre-R17 Brackets to the one Bracket Format",
  () => {
    it("commits, makes both Brackets not generated with a full config and at most 4 Placement Points", async () => {
      const upTo0028 = migrationsUpTo(28);
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0028);

            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(PRE_R17_ROWS);

              await migrateTo(url, DRIZZLE_DIR);

              const applied = await client.query(
                "select count(*)::int as n from drizzle.__drizzle_migrations",
              );
              expect(applied.rows[0].n).toBe(34);

              const brackets = await client.query(
                `select id, format::text as format, bracket_config,
                  placement_points, closed_at,
                  (select count(*)::int from bracket_match
                    where competition_id = competition.id) as heats,
                  (select count(*)::int from points_entry
                    where competition_id = competition.id
                      and generated) as generated
                from competition order by name`,
              );
              expect(brackets.rows).toEqual([
                {
                  id: HEATS,
                  format: "bracket",
                  bracket_config: {
                    kind: "group",
                    entrantsPerMatch: 4,
                    advancePerMatch: 2,
                    thirdPlaceMatch: false,
                    rounds: {},
                  },
                  placement_points: [9, 7, 5, 3],
                  closed_at: null,
                  heats: 0,
                  generated: 0,
                },
                {
                  id: SINGLE_ELIMINATION,
                  format: "bracket",
                  bracket_config: {
                    kind: "head-to-head",
                    entrantsPerMatch: 2,
                    advancePerMatch: 1,
                    thirdPlaceMatch: false,
                    rounds: {},
                  },
                  placement_points: [5, 3],
                  closed_at: null,
                  heats: 0,
                  generated: 0,
                },
              ]);

              // A hand-entered Points Entry is not the Bracket's to delete.
              const kept = await client.query("select note from points_entry");
              expect(kept.rows).toEqual([{ note: "Good sport" }]);

              const heatEntrants = await client.query(
                "select count(*)::int as n from bracket_match_entrant",
              );
              expect(heatEntrants.rows[0].n).toBe(0);

              const formats = await client.query<{ value: string }>(
                `select unnest(enum_range(null::competition_format))::text as value`,
              );
              expect(formats.rows.map((r) => r.value)).toEqual([
                "placement",
                "bracket",
                "head-to-head",
                "best-score",
                "participation",
              ]);
              const statuses = await client.query<{ value: string }>(
                `select unnest(enum_range(null::bracket_match_status))::text as value`,
              );
              expect(statuses.rows.map((r) => r.value)).toEqual([
                "pending",
                "ready",
                "played",
              ]);

              const columns = await client.query<{
                table_name: string;
                column_name: string;
              }>(
                `select table_name, column_name from information_schema.columns
                where table_schema = 'public'
                  and table_name in ('bracket_match', 'bracket_match_entrant')`,
              );
              const heatColumns = columns.rows
                .filter((r) => r.table_name === "bracket_match")
                .map((r) => r.column_name);
              expect(heatColumns).not.toContain("day_id");
              expect(heatColumns).not.toContain("start_time");
              expect(heatColumns).not.toContain("location");
              expect(heatColumns).toEqual(
                expect.arrayContaining([
                  "recorded_at",
                  "loser_to_match_id",
                  "loser_to_slot",
                  "third_place",
                ]),
              );
              expect(
                columns.rows
                  .filter((r) => r.table_name === "bracket_match_entrant")
                  .map((r) => r.column_name),
              ).not.toContain("forfeited");
            } finally {
              await client.end();
            }
          },
          { migrations: false },
        );
      } finally {
        rmSync(upTo0028, { recursive: true, force: true });
      }
    }, 60_000);
  },
);

const DARTS = id(401);

describe.skipIf(!isLocalDatabase)(
  "migrating a pre-R18 Competition's plain-text description",
  () => {
    it("commits and leaves the description empty, as rich text the seeds restore", async () => {
      const upTo0029 = migrationsUpTo(29);
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0029);

            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(`
                insert into war_week (id, edition, edition_number, year,
                  start_date, end_date, story_theme, status, mode, team_label,
                  leader_title, slack_channel_url, primary_color,
                  primary_foreground_color, accent_color, background_color,
                  foreground_color, font_preset)
                values ('${WW_XI}', 'xi', 9811, 9811, '2026-02-23',
                  '2026-02-27', 'Eleven', 'live', 'teams', 'Team', 'Captain',
                  'https://slack.example', '#000000', '#ffffff', '#ff0000',
                  '#ffffff', '#000000', 'sans');

                insert into competition (id, war_week_id, name, scoring,
                  format, description)
                values ('${DARTS}', '${WW_XI}', 'Darts', 'team', 'placement',
                  'Bring your own darts.');
              `);
              const before = await client.query(
                "select description from competition",
              );
              expect(before.rows).toEqual([
                { description: "Bring your own darts." },
              ]);

              await migrateTo(url, DRIZZLE_DIR);

              const applied = await client.query(
                "select count(*)::int as n from drizzle.__drizzle_migrations",
              );
              expect(applied.rows[0].n).toBe(34);
              const after = await client.query(
                `select id, description is null as cleared,
                  pg_typeof(description)::text as type
                from competition`,
              );
              expect(after.rows).toEqual([
                { id: DARTS, cleared: true, type: "jsonb" },
              ]);
            } finally {
              await client.end();
            }
          },
          { migrations: false },
        );
      } finally {
        rmSync(upTo0029, { recursive: true, force: true });
      }
    }, 60_000);
  },
);

// R21 0032: one row of each source shape the reshape must carry (the
// execution plan's P10b), in the 0031 schema.
const R21 = (n: number) => id(500 + n);
const [ANA21, BEN21, CAL21, DEE21] = [R21(1), R21(2), R21(3), R21(4)];
const [RED21, BLUE21] = [R21(11), R21(12)];
const GROUP4 = R21(21);
const KNOCK = R21(22);
const NOCFG = R21(23);
const H2H_PAIR = R21(31);
const H2H_NOENT = R21(32);
const H2H_THREE = R21(33);
const H2H_CROWD = R21(34);
const H2H_LONG = R21(35);
const H2H_IDLE = R21(36);
// Saved Best of shorter than the Matches converted: Best of 3 with 4, and
// Best of 1 with 2.
const H2H_GROWN = R21(37);
const H2H_ONE = R21(38);
const BEST_TEAM = R21(41);
const BEST_IND = R21(42);
const BEST_NULL = R21(43);
const G = (n: number) => id(600 + n);
const M = (n: number) => id(700 + n);
const E = (n: number) => id(800 + n);

const PRE_R21_ROWS = `
  insert into war_week (id, edition, edition_number, year, start_date,
    end_date, story_theme, status, mode, team_label, leader_title,
    slack_channel_url, primary_color, primary_foreground_color, accent_color,
    background_color, foreground_color, font_preset)
  values ('${WW_XI}', 'xi', 9811, 9811, '2026-02-23', '2026-02-27', 'Eleven',
    'live', 'teams', 'Team', 'Captain', 'https://slack.example',
    '#000000', '#ffffff', '#ff0000', '#ffffff', '#000000', 'sans');

  insert into finale_slide (war_week_id, kind, sort_order) values
    ('${WW_XI}', 'champions', 1);

  insert into team (id, war_week_id, name, color) values
    ('${RED21}', '${WW_XI}', 'Red', '#ff0000'),
    ('${BLUE21}', '${WW_XI}', 'Blue', '#0000ff');

  insert into participant (id, war_week_id, display_name, team_id) values
    ('${ANA21}', '${WW_XI}', 'Ana', '${RED21}'),
    ('${BEN21}', '${WW_XI}', 'Ben', '${BLUE21}'),
    ('${CAL21}', '${WW_XI}', 'Cal', '${RED21}'),
    ('${DEE21}', '${WW_XI}', 'Dee', '${BLUE21}');

  insert into competition (id, war_week_id, name, scoring, format,
    bracket_config, game_config, entrants_open, self_enroll, entrant_limit)
  values
    ('${GROUP4}', '${WW_XI}', 'Chess Groups', 'individual', 'bracket',
      '{"entrantsPerHeat":4,"advancePerHeat":2,"thirdPlaceGame":false}', null,
      false, false, null),
    ('${KNOCK}', '${WW_XI}', 'Knockout', 'individual', 'bracket',
      '{"entrantsPerHeat":2,"advancePerHeat":1,"thirdPlaceGame":true}', null,
      false, true, 8),
    ('${NOCFG}', '${WW_XI}', 'No Config', 'individual', 'bracket', null, null,
      false, false, null),
    ('${H2H_PAIR}', '${WW_XI}', 'Pair', 'individual', 'head-to-head', null,
      null, false, true, 4),
    ('${H2H_NOENT}', '${WW_XI}', 'No Entrants', 'individual', 'head-to-head',
      null, '{"drawsAllowed":true,"bestOf":3}', true, false, null),
    ('${H2H_THREE}', '${WW_XI}', 'Three', 'individual', 'head-to-head', null,
      null, false, false, null),
    ('${H2H_CROWD}', '${WW_XI}', 'Crowd', 'individual', 'head-to-head', null,
      null, false, false, null),
    ('${H2H_LONG}', '${WW_XI}', 'Long', 'individual', 'head-to-head', null,
      null, false, false, null),
    ('${H2H_IDLE}', '${WW_XI}', 'Idle', 'individual', 'head-to-head', null,
      null, false, false, null),
    ('${H2H_GROWN}', '${WW_XI}', 'Grown', 'individual', 'head-to-head', null,
      '{"drawsAllowed":false,"bestOf":3}', false, false, null),
    ('${H2H_ONE}', '${WW_XI}', 'One', 'individual', 'head-to-head', null,
      '{"drawsAllowed":true,"bestOf":1}', false, false, null),
    ('${BEST_TEAM}', '${WW_XI}', 'Team Stairs', 'team', 'best-score', null,
      '{"count":"total","betterIs":"lower","unit":"sec"}', false, false, null),
    ('${BEST_IND}', '${WW_XI}', 'Solo Stairs', 'individual', 'best-score',
      null, '{"count":"total","betterIs":"higher","unit":""}', false, true,
      null),
    ('${BEST_NULL}', '${WW_XI}', 'Bare Stairs', 'individual', 'best-score',
      null, null, true, false, null);

  insert into entrant (id, competition_id, participant_id, team_id,
    seed_position)
  values
    ('${E(1)}', '${GROUP4}', '${ANA21}', null, 1),
    ('${E(2)}', '${GROUP4}', '${BEN21}', null, 2),
    ('${E(3)}', '${GROUP4}', '${CAL21}', null, 3),
    ('${E(4)}', '${GROUP4}', '${DEE21}', null, 4),
    ('${E(5)}', '${KNOCK}', '${ANA21}', null, 1),
    ('${E(6)}', '${KNOCK}', '${BEN21}', null, 2),
    ('${E(11)}', '${H2H_PAIR}', '${ANA21}', null, 1),
    ('${E(12)}', '${H2H_PAIR}', '${BEN21}', null, 2),
    ('${E(21)}', '${H2H_THREE}', '${ANA21}', null, 1),
    ('${E(22)}', '${H2H_THREE}', '${BEN21}', null, 2),
    ('${E(23)}', '${H2H_THREE}', '${CAL21}', null, 3),
    ('${E(31)}', '${H2H_CROWD}', '${ANA21}', null, 1),
    ('${E(32)}', '${H2H_CROWD}', '${BEN21}', null, 2),
    ('${E(33)}', '${H2H_CROWD}', '${CAL21}', null, 3),
    ('${E(41)}', '${H2H_LONG}', '${ANA21}', null, 1),
    ('${E(42)}', '${H2H_LONG}', '${BEN21}', null, 2),
    ('${E(51)}', '${H2H_IDLE}', '${ANA21}', null, 1),
    ('${E(52)}', '${H2H_IDLE}', '${BEN21}', null, 2),
    ('${E(53)}', '${H2H_IDLE}', '${CAL21}', null, 3),
    ('${E(54)}', '${H2H_IDLE}', '${DEE21}', null, 4),
    ('${E(61)}', '${BEST_TEAM}', null, '${RED21}', 1),
    ('${E(62)}', '${BEST_TEAM}', null, '${BLUE21}', 2),
    ('${E(71)}', '${BEST_IND}', '${CAL21}', null, 1);

  insert into bracket_match (id, competition_id, round, position, slot_count,
    third_place)
  values
    ('${M(1)}', '${GROUP4}', 1, 1, 2, false),
    ('${M(2)}', '${GROUP4}', 1, 2, 2, false),
    ('${M(3)}', '${GROUP4}', 2, 1, 2, false),
    ('${M(11)}', '${KNOCK}', 1, 1, 2, false),
    ('${M(12)}', '${KNOCK}', 2, 1, 2, false),
    ('${M(13)}', '${KNOCK}', 2, 2, 2, true);

  insert into bracket_match_entrant (bracket_match_id, entrant_id, slot,
    place, score)
  values
    ('${M(1)}', '${E(1)}', 0, 1, '21'),
    ('${M(1)}', '${E(2)}', 1, 2, ' 7.5 '),
    ('${M(2)}', '${E(3)}', 0, 1, 'W/O'),
    ('${M(2)}', '${E(4)}', 1, 2, '21-19'),
    ('${M(11)}', '${E(5)}', 0, 1, '1234567890'),
    ('${M(11)}', '${E(6)}', 1, 2, null);

  insert into game (id, competition_id, logged_at, logged_by_email,
    logged_by_participant_id)
  values
    ('${G(1)}', '${H2H_PAIR}', '2026-02-24T10:00:00Z', 'ana@example.com', '${ANA21}'),
    ('${G(2)}', '${H2H_PAIR}', '2026-02-24T11:00:00Z', 'host@example.com', null),
    ('${G(3)}', '${H2H_NOENT}', '2026-02-24T10:00:00Z', 'cal@example.com', '${CAL21}'),
    ('${G(4)}', '${H2H_THREE}', '2026-02-24T10:00:00Z', 'ana@example.com', '${ANA21}'),
    ('${G(5)}', '${H2H_CROWD}', '2026-02-24T10:00:00Z', 'ana@example.com', '${ANA21}'),
    ('${G(6)}', '${H2H_CROWD}', '2026-02-24T11:00:00Z', 'ben@example.com', '${BEN21}'),
    ${Array.from(
      { length: 8 },
      (_, i) =>
        `('${G(10 + i)}', '${H2H_LONG}', '2026-02-24T1${i}:00:00Z', 'host@example.com', null)`,
    ).join(",\n    ")},
    ${Array.from(
      { length: 4 },
      (_, i) =>
        `('${G(40 + i)}', '${H2H_GROWN}', '2026-02-24T1${i}:00:00Z', 'host@example.com', null)`,
    ).join(",\n    ")},
    ('${G(45)}', '${H2H_ONE}', '2026-02-24T10:00:00Z', 'host@example.com', null),
    ('${G(46)}', '${H2H_ONE}', '2026-02-24T11:00:00Z', 'host@example.com', null),
    ('${G(21)}', '${BEST_TEAM}', '2026-02-24T10:00:00Z', 'ana@example.com', '${ANA21}'),
    ('${G(22)}', '${BEST_TEAM}', '2026-02-24T11:00:00Z', 'host@example.com', null),
    ('${G(23)}', '${BEST_TEAM}', '2026-02-24T12:00:00Z', 'ana@example.com', '${ANA21}'),
    ('${G(24)}', '${BEST_TEAM}', '2026-02-24T13:00:00Z', 'ben@example.com', '${BEN21}'),
    ('${G(31)}', '${BEST_IND}', '2026-02-24T10:00:00Z', 'host@example.com', null),
    ('${G(32)}', '${BEST_IND}', '2026-02-24T11:00:00Z', 'dee@example.com', '${DEE21}');

  insert into game_player (game_id, team_id, participant_id, place, score)
  values
    ('${G(1)}', null, '${ANA21}', 1, null),
    ('${G(1)}', null, '${BEN21}', 2, null),
    ('${G(2)}', null, '${ANA21}', 2, 15),
    ('${G(2)}', null, '${BEN21}', 1, 21),
    ('${G(3)}', null, '${CAL21}', 1, null),
    ('${G(3)}', null, '${DEE21}', 1, null),
    ('${G(4)}', null, '${ANA21}', 1, null),
    ('${G(4)}', null, '${CAL21}', 2, null),
    ('${G(5)}', null, '${ANA21}', 1, null),
    ('${G(5)}', null, '${BEN21}', 2, null),
    ('${G(6)}', null, '${BEN21}', 1, null),
    ('${G(6)}', null, '${CAL21}', 2, null),
    ${Array.from(
      { length: 8 },
      (_, i) =>
        `('${G(10 + i)}', null, '${ANA21}', 1, null), ('${G(10 + i)}', null, '${BEN21}', 2, null)`,
    ).join(",\n    ")},
    ${Array.from(
      { length: 4 },
      (_, i) =>
        `('${G(40 + i)}', null, '${CAL21}', 1, null), ('${G(40 + i)}', null, '${DEE21}', 2, null)`,
    ).join(",\n    ")},
    ('${G(45)}', null, '${CAL21}', 1, null),
    ('${G(45)}', null, '${DEE21}', 2, null),
    ('${G(46)}', null, '${CAL21}', 1, null),
    ('${G(46)}', null, '${DEE21}', 1, null),
    ('${G(21)}', '${RED21}', null, null, 12),
    ('${G(22)}', '${BLUE21}', null, null, 9),
    ('${G(23)}', '${BLUE21}', null, null, 8),
    ('${G(24)}', '${BLUE21}', null, null, null),
    ('${G(31)}', null, '${CAL21}', null, 30),
    ('${G(32)}', null, '${DEE21}', null, null);
`;

describe.skipIf(!isLocalDatabase)(
  "migrating the 0031 Competition model to R21's (0032)",
  () => {
    it("commits, converts every source shape by its fate and refuses the new CHECKs' violations", async () => {
      const upTo0031 = migrationsUpTo(31);
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0031);
            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(PRE_R21_ROWS);
              await migrateTo(url, DRIZZLE_DIR);
              const q = async (text: string, values: unknown[] = []) =>
                (await client.query(text, values)).rows;

              expect(
                (
                  await q(
                    "select count(*)::int as n from drizzle.__drizzle_migrations",
                  )
                )[0].n,
              ).toBe(34);

              // Bracket configs under their new keys; null is the default.
              const configs = Object.fromEntries(
                (
                  await q(
                    `select id, bracket_config from competition
                    where format::text = 'bracket'`,
                  )
                ).map((r) => [r.id, r.bracket_config]),
              );
              expect(configs).toEqual({
                [GROUP4]: {
                  kind: "group",
                  entrantsPerMatch: 4,
                  advancePerMatch: 2,
                  thirdPlaceMatch: false,
                  rounds: {},
                },
                [KNOCK]: {
                  kind: "head-to-head",
                  entrantsPerMatch: 2,
                  advancePerMatch: 1,
                  thirdPlaceMatch: true,
                  rounds: {},
                },
                [NOCFG]: {
                  kind: "head-to-head",
                  entrantsPerMatch: 2,
                  advancePerMatch: 1,
                  thirdPlaceMatch: false,
                  rounds: {},
                },
              });

              // Each Match's advancing count: the config's, 1 in the final
              // and in a head-to-head Bracket (the 3rd place Match too).
              expect(
                await q(
                  `select id, advance_count from bracket_match
                  order by competition_id, round, position`,
                ),
              ).toEqual([
                { id: M(1), advance_count: 2 },
                { id: M(2), advance_count: 2 },
                { id: M(3), advance_count: 1 },
                { id: M(11), advance_count: 1 },
                { id: M(12), advance_count: 1 },
                { id: M(13), advance_count: 1 },
              ]);

              // Numeric Match Scores; anything else (or too large) null.
              expect(
                await q(
                  `select entrant_id, score::float8 as score
                  from bracket_match_entrant order by entrant_id`,
                ),
              ).toEqual([
                { entrant_id: E(1), score: 21 },
                { entrant_id: E(2), score: 7.5 },
                { entrant_id: E(3), score: null },
                { entrant_id: E(4), score: null },
                { entrant_id: E(5), score: null },
                { entrant_id: E(6), score: null },
              ]);

              // Head-to-head: draws as saved, Best of as saved or 7.
              const series = Object.fromEntries(
                (
                  await q(
                    `select id, series_config from competition
                    where format::text = 'head-to-head'`,
                  )
                ).map((r) => [r.id, r.series_config]),
              );
              expect(series[H2H_PAIR]).toEqual({
                drawsAllowed: false,
                bestOf: 7,
              });
              expect(series[H2H_NOENT]).toEqual({
                drawsAllowed: true,
                bestOf: 3,
              });
              // A saved Best of shorter than the converted Matches grows to
              // the shortest Best of (1, 3, 5, 7) that holds them.
              expect(series[H2H_GROWN]).toEqual({
                drawsAllowed: false,
                bestOf: 5,
              });
              expect(series[H2H_ONE]).toEqual({
                drawsAllowed: true,
                bestOf: 3,
              });
              expect(
                await q(
                  `select competition_id, count(*)::int as n from series_match
                  where competition_id = any($1)
                  group by competition_id order by count(*)`,
                  [[H2H_GROWN, H2H_ONE]],
                ),
              ).toEqual([
                { competition_id: H2H_ONE, n: 2 },
                { competition_id: H2H_GROWN, n: 4 },
              ]);

              // Each Head-to-head's Entrants, by Seed Position.
              const entrantsOf = async (competition: string) =>
                (
                  await q(
                    `select participant_id from entrant
                    where competition_id = $1 order by seed_position`,
                    [competition],
                  )
                ).map((r) => r.participant_id);
              expect(await entrantsOf(H2H_PAIR)).toEqual([ANA21, BEN21]);
              // Created for the two who played.
              expect((await entrantsOf(H2H_NOENT)).sort()).toEqual(
                [CAL21, DEE21].sort(),
              );
              // Three Entrant rows, Games between 1 and 3: those two stay.
              expect(await entrantsOf(H2H_THREE)).toEqual([ANA21, CAL21]);
              // Games among three players: dropped; the first two stay.
              expect(await entrantsOf(H2H_CROWD)).toEqual([ANA21, BEN21]);
              expect(await entrantsOf(H2H_LONG)).toEqual([ANA21, BEN21]);
              expect(await entrantsOf(H2H_IDLE)).toEqual([ANA21, BEN21]);

              // The converted Matches keep their ids, times, loggers and
              // places, by Entrant.
              const matches = await q(
                `select m.id, m.competition_id, m.recorded_at,
                  m.logged_by_participant_id,
                  array_agg(e.participant_id::text || ':' ||
                    coalesce(sme.place::text, '-') || ':' ||
                    coalesce(sme.score::text, '-')
                    order by e.participant_id) as sides
                from series_match m
                join series_match_entrant sme on sme.series_match_id = m.id
                join entrant e on e.id = sme.entrant_id
                where m.competition_id <> all($1)
                group by m.id order by m.id`,
                [[H2H_GROWN, H2H_ONE]],
              );
              expect(matches).toEqual([
                {
                  id: G(1),
                  competition_id: H2H_PAIR,
                  recorded_at: new Date("2026-02-24T10:00:00Z"),
                  logged_by_participant_id: ANA21,
                  sides: [`${ANA21}:1:-`, `${BEN21}:2:-`],
                },
                {
                  id: G(2),
                  competition_id: H2H_PAIR,
                  recorded_at: new Date("2026-02-24T11:00:00Z"),
                  logged_by_participant_id: null,
                  sides: [`${ANA21}:2:15.000`, `${BEN21}:1:21.000`],
                },
                {
                  id: G(3),
                  competition_id: H2H_NOENT,
                  recorded_at: new Date("2026-02-24T10:00:00Z"),
                  logged_by_participant_id: CAL21,
                  sides: [`${CAL21}:1:-`, `${DEE21}:1:-`],
                },
                {
                  id: G(4),
                  competition_id: H2H_THREE,
                  recorded_at: new Date("2026-02-24T10:00:00Z"),
                  logged_by_participant_id: ANA21,
                  sides: [`${ANA21}:1:-`, `${CAL21}:2:-`],
                },
              ]);

              // Best score: direction and unit as columns, Team score.
              expect(
                await q(
                  `select id, score_direction::text as direction, score_unit,
                    best_score_config, series_config
                  from competition where format::text = 'best-score'
                  order by name`,
                ),
              ).toEqual([
                {
                  id: BEST_NULL,
                  direction: "higher",
                  score_unit: null,
                  best_score_config: { teamScore: "best-member" },
                  series_config: null,
                },
                {
                  id: BEST_IND,
                  direction: "higher",
                  score_unit: null,
                  best_score_config: { teamScore: "best-member" },
                  series_config: null,
                },
                {
                  id: BEST_TEAM,
                  direction: "lower",
                  score_unit: "sec",
                  best_score_config: { teamScore: "sum-of-members" },
                  series_config: null,
                },
              ]);
              // Attempts: an individual player (credited to their Team
              // now); a team Game by a logger on that Team. Null scores,
              // Host-logged and other-Team team Games are dropped.
              expect(
                await q(
                  `select id, competition_id, participant_id, team_id,
                    score::float8 as score, logged_by_participant_id
                  from attempt order by id`,
                ),
              ).toEqual([
                {
                  id: G(21),
                  competition_id: BEST_TEAM,
                  participant_id: ANA21,
                  team_id: RED21,
                  score: 12,
                  logged_by_participant_id: ANA21,
                },
                {
                  id: G(31),
                  competition_id: BEST_IND,
                  participant_id: CAL21,
                  team_id: RED21,
                  score: 30,
                  logged_by_participant_id: null,
                },
              ]);
              // Best score has no Entrant list.
              expect(
                await q(
                  `select count(*)::int as n from entrant
                  where competition_id = any($1)`,
                  [[BEST_TEAM, BEST_IND, BEST_NULL]],
                ),
              ).toEqual([{ n: 0 }]);

              // Enrollment is a Bracket's alone.
              expect(
                await q(
                  `select id, self_enroll, entrant_limit from competition
                  where id = any($1) order by name`,
                  [[KNOCK, H2H_PAIR, BEST_IND]],
                ),
              ).toEqual([
                { id: KNOCK, self_enroll: true, entrant_limit: 8 },
                { id: H2H_PAIR, self_enroll: false, entrant_limit: null },
                { id: BEST_IND, self_enroll: false, entrant_limit: null },
              ]);

              // The Finale's Winners slide.
              expect(
                await q("select kind::text as kind from finale_slide"),
              ).toEqual([{ kind: "winners" }]);

              const columns = (
                await q(
                  `select column_name from information_schema.columns
                  where table_schema = 'public' and table_name = 'competition'`,
                )
              ).map((r) => r.column_name);
              for (const gone of [
                "entrants_open",
                "logging_closes_at",
                "enroll_closes_at",
                "check_in_closes_at",
              ]) {
                expect(columns).not.toContain(gone);
              }
              expect(columns).toEqual(
                expect.arrayContaining([
                  "score_unit",
                  "series_config",
                  "best_score_config",
                  "max_attempts",
                ]),
              );
              const tables = (
                await q(
                  `select table_name from information_schema.tables
                  where table_schema = 'public'`,
                )
              ).map((r) => r.table_name);
              expect(tables).toEqual(
                expect.arrayContaining(["series_match", "attempt"]),
              );
              expect(tables.filter((t) => /^game/.test(t))).toEqual([]);

              // The new CHECKs refuse what the model forbids.
              const refused = async (statement: string) => {
                await client.query("savepoint r21");
                const error = await client.query(statement).then(
                  () => null,
                  (e: { code?: string }) => e.code ?? "error",
                );
                await client.query("rollback to savepoint r21");
                return error;
              };
              await client.query("begin");
              try {
                for (const statement of [
                  `update competition set series_config = '{"drawsAllowed":false,"bestOf":3}' where id = '${GROUP4}'`,
                  `update competition set series_config = null where id = '${H2H_PAIR}'`,
                  `update competition set score_direction = 'none' where id = '${BEST_IND}'`,
                  `update competition set best_score_config = '{"teamScore":"best-member"}' where id = '${H2H_PAIR}'`,
                  `update competition set max_attempts = 0 where id = '${BEST_IND}'`,
                  `update competition set max_attempts = 3 where id = '${H2H_PAIR}'`,
                  `update competition set self_enroll = true where id = '${BEST_IND}'`,
                  `update competition set entrant_limit = 4 where id = '${H2H_PAIR}'`,
                  `update bracket_match set advance_count = 0 where id = '${M(1)}'`,
                  `insert into attempt (competition_id, participant_id, score, logged_by_email) values ('${BEST_IND}', '${CAL21}', null, 'x@example.com')`,
                ]) {
                  expect(await refused(statement), statement).toMatch(
                    /^23(514|502)$/,
                  );
                }
                // And allows what it permits.
                expect(
                  await refused(
                    `update competition set max_attempts = 3 where id = '${BEST_IND}'`,
                  ),
                ).toBeNull();
              } finally {
                await client.query("rollback");
              }
            } finally {
              await client.end();
            }
          },
          { migrations: false },
        );
      } finally {
        rmSync(upTo0031, { recursive: true, force: true });
      }
    }, 60_000);
  },
);

describe.skipIf(!isLocalDatabase)(
  "migrating email Hosts to roster-Participant Hosts (0033)",
  () => {
    it("deletes the email Hosts, then holds Participant Hosts the roster owns", async () => {
      const upTo0032 = migrationsUpTo(32);
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0032);
            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(`
                insert into war_week (id, edition, edition_number, year,
                  start_date, end_date, story_theme, status, mode, team_label,
                  leader_title, slack_channel_url, primary_color,
                  primary_foreground_color, accent_color, background_color,
                  foreground_color, font_preset)
                values ('${id(1)}', 'xi', 9811, 9811, '2026-02-23',
                  '2026-02-27', 'Eleven', 'live', 'teams', 'Team', 'Captain',
                  'https://slack.example', '#000000', '#ffffff', '#ff0000',
                  '#ffffff', '#000000', 'sans');
                insert into competition (id, war_week_id, name, scoring)
                  values ('${id(2)}', '${id(1)}', 'Chess', 'individual');
                insert into competition_host (competition_id, email)
                  values ('${id(2)}', 'tony@jahnelgroup.com');`);
              await migrateTo(url, DRIZZLE_DIR);
              const q = async (text: string) => (await client.query(text)).rows;

              expect(
                (await q("select count(*)::int as n from competition_host"))[0]
                  .n,
              ).toBe(0);
              expect(
                await q(
                  `select column_name from information_schema.columns
                   where table_name = 'competition_host'
                   order by column_name`,
                ),
              ).toEqual([
                { column_name: "competition_id" },
                { column_name: "created_at" },
                { column_name: "id" },
                { column_name: "participant_id" },
              ]);

              // A Host is a roster Participant; the same one can't host twice,
              // and deleting the Participant deletes the Host row.
              await client.query(`
                insert into participant (id, war_week_id, display_name)
                  values ('${id(3)}', '${id(1)}', 'Tony');
                insert into competition_host (competition_id, participant_id)
                  values ('${id(2)}', '${id(3)}');`);
              await expect(
                client.query(
                  `insert into competition_host (competition_id, participant_id)
                   values ('${id(2)}', '${id(3)}')`,
                ),
              ).rejects.toMatchObject({ code: "23505" });
              await client.query(
                `delete from participant where id = '${id(3)}'`,
              );
              expect(
                (await q("select count(*)::int as n from competition_host"))[0]
                  .n,
              ).toBe(0);
            } finally {
              await client.end();
            }
          },
          { migrations: false },
        );
      } finally {
        rmSync(upTo0032, { recursive: true, force: true });
      }
    }, 60_000);
  },
);
