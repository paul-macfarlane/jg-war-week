import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/**
 * The Organizer copy on pre-migration data (spec "Testing Decisions" 2a):
 * a scratch database gets every migration before the Organizer tables by
 * hand, then War Week fixtures, then drizzle's `migrate()` applies the rest.
 */
const SCRATCH_DATABASE = "war_weeker_migration_test";
const MIGRATIONS = path.resolve(process.cwd(), "drizzle");
/** The first migration of the Organizer and Host set. */
const FIRST_ROLES_MIGRATION = "0008_brief_leopardon";
const COPY_MIGRATION = "0009_copy_organizers";

function databaseUrl(name: string): string {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${name}`;
  return url.toString();
}

const readMigration = (tag: string) =>
  readFileSync(path.join(MIGRATIONS, `${tag}.sql`), "utf-8");

type Fixture = {
  edition: string;
  editionNumber: number;
  status: "upcoming" | "live" | "complete";
  startDate: string;
  organizerEmails: string[];
};

describe.skipIf(!isLocalDatabase)("Organizer copy migration", () => {
  let scratch: Client;

  beforeAll(async () => {
    const admin = new Client({ connectionString: databaseUrl("postgres") });
    await admin.connect();
    try {
      await admin.query(
        `drop database if exists ${SCRATCH_DATABASE} with (force)`,
      );
      await admin.query(`create database ${SCRATCH_DATABASE}`);
    } finally {
      await admin.end();
    }
    scratch = new Client({ connectionString: databaseUrl(SCRATCH_DATABASE) });
    await scratch.connect();

    // Apply the pre-03 migrations and record them as drizzle's migrator
    // does, so `migrate()` applies only what comes after.
    const journal = JSON.parse(
      readFileSync(path.join(MIGRATIONS, "meta", "_journal.json"), "utf-8"),
    ) as { entries: { tag: string; when: number }[] };
    const firstRoles = journal.entries.findIndex(
      (entry) => entry.tag === FIRST_ROLES_MIGRATION,
    );
    expect(firstRoles).toBeGreaterThan(0);
    await scratch.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
    await scratch.query(`
      CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )`);
    for (const entry of journal.entries.slice(0, firstRoles)) {
      const query = readMigration(entry.tag);
      for (const statement of query.split("--> statement-breakpoint")) {
        await scratch.query(statement);
      }
      await scratch.query(
        `insert into "drizzle"."__drizzle_migrations" ("hash", "created_at") values ($1, $2)`,
        [createHash("sha256").update(query).digest("hex"), entry.when],
      );
    }
  }, 60_000);

  afterAll(async () => {
    await scratch?.end();
    const admin = new Client({ connectionString: databaseUrl("postgres") });
    await admin.connect();
    try {
      await admin.query(
        `drop database if exists ${SCRATCH_DATABASE} with (force)`,
      );
    } finally {
      await admin.end();
    }
  });

  async function insertWarWeeks(fixtures: Fixture[]) {
    for (const w of fixtures) {
      await scratch.query(
        `insert into war_week (
           edition, edition_number, year, start_date, end_date, story_theme,
           status, mode, team_label, leader_title, slack_channel_url,
           primary_color, primary_foreground_color, accent_color,
           background_color, foreground_color, font_preset, organizer_emails
         ) values (
           $1, $2, $3, $4, $4, 'Migration test', $5, 'teams', 'Team',
           'Captain', 'https://example.slack.com/', '#000000', '#ffffff',
           '#000000', '#ffffff', '#000000', 'sans', $6
         )`,
        [
          w.edition,
          w.editionNumber,
          2000 + w.editionNumber,
          w.startDate,
          w.status,
          w.organizerEmails,
        ],
      );
    }
  }

  async function organizers() {
    const { rows } = await scratch.query<{
      id: string;
      email: string;
      added_by: string | null;
      created_at: Date;
    }>("select id, email, added_by, created_at from organizer order by email");
    return rows;
  }

  async function organizerEmailLists() {
    const { rows } = await scratch.query<{
      edition: string;
      organizer_emails: string[];
    }>("select edition, organizer_emails from war_week order by edition");
    return Object.fromEntries(
      rows.map((row) => [row.edition, row.organizer_emails]),
    );
  }

  async function startOver(fixtures: Fixture[]) {
    await scratch.query("truncate organizer, war_week cascade");
    await insertWarWeeks(fixtures);
  }

  const runCopy = () => scratch.query(readMigration(COPY_MIGRATION));

  const complete: Fixture = {
    edition: "x",
    editionNumber: 10,
    status: "complete",
    startDate: "2025-02-23",
    organizerEmails: ["Old@jahnelgroup.com"],
  };
  const live: Fixture = {
    edition: "xi",
    editionNumber: 11,
    status: "live",
    startDate: "2026-02-22",
    organizerEmails: [
      "Jason@JahnelGroup.com",
      "jz@jahnelgroup.com",
      "jason@jahnelgroup.com",
      "someone@gmail.com",
    ],
  };
  const upcoming: Fixture = {
    edition: "xii",
    editionNumber: 12,
    status: "upcoming",
    startDate: "2027-02-21",
    organizerEmails: ["next@jahnelgroup.com"],
  };

  it("copies the live War Week's JG emails, deduplicated and lowercased, and reruns harmlessly", async () => {
    await insertWarWeeks([complete, live, upcoming]);

    await migrate(drizzle(scratch), { migrationsFolder: MIGRATIONS });

    const copied = await organizers();
    expect(copied.map(({ email, added_by }) => ({ email, added_by }))).toEqual([
      { email: "jason@jahnelgroup.com", added_by: null },
      { email: "jz@jahnelgroup.com", added_by: null },
    ]);
    expect(await organizerEmailLists()).toEqual({
      x: ["Old@jahnelgroup.com"],
      xi: live.organizerEmails,
      xii: ["next@jahnelgroup.com"],
    });

    await runCopy();
    expect(await organizers()).toEqual(copied);
  }, 60_000);

  it("uses the earliest upcoming War Week when none is live", async () => {
    await startOver([
      complete,
      {
        edition: "xiii",
        editionNumber: 13,
        status: "upcoming",
        startDate: "2028-02-20",
        organizerEmails: ["later@jahnelgroup.com"],
      },
      upcoming,
    ]);

    await runCopy();

    expect((await organizers()).map((o) => o.email)).toEqual([
      "next@jahnelgroup.com",
    ]);
  });

  it("uses the latest complete War Week when none is live or upcoming", async () => {
    await startOver([
      complete,
      {
        edition: "ix",
        editionNumber: 9,
        status: "complete",
        startDate: "2024-02-25",
        organizerEmails: ["older@jahnelgroup.com"],
      },
    ]);

    await runCopy();

    expect((await organizers()).map((o) => o.email)).toEqual([
      "old@jahnelgroup.com",
    ]);
  });

  it("copies nothing when there is no War Week", async () => {
    await startOver([]);

    await runCopy();

    expect(await organizers()).toEqual([]);
  });
});
