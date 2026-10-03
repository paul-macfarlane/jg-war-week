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
  const dir = mkdtempSync(path.join(tmpdir(), "r16-migrations-"));
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
      try {
        await withThrowawayDatabase(
          async (url) => {
            await migrateTo(url, upTo0027);

            const client = new Client({ connectionString: url });
            await client.connect();
            try {
              await client.query(PRE_R16_ROWS);

              await migrateTo(url, DRIZZLE_DIR);

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
      }
    }, 60_000);
  },
);
