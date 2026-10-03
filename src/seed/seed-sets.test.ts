import { drizzle } from "drizzle-orm/node-postgres";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { withThrowawayDatabase } from "@/db/test-database";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { localSeedFiles } from "@/seed/local-files";
import type { WarWeekSeed } from "@/seed/schema";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const ROOT = path.resolve(__dirname, "../..");

async function parseSeed(file: string): Promise<WarWeekSeed> {
  const { warWeekSeedSchema } = await import("@/seed/schema");
  return warWeekSeedSchema.parse(
    JSON.parse(readFileSync(path.resolve(ROOT, file), "utf-8")),
  );
}

describe.skipIf(!isLocalDatabase)("War Week XI's frozen Standings", () => {
  it("are Red 38.5 and Blue 31 after the real XI seed is converted and loaded", async () => {
    // The totals below are literals from `seeds/xi.json` at f6d1605, summed
    // per Team over its 24 typed entries before the Placement conversion;
    // nothing here computes them from the converted seed.
    const FROZEN = { Red: 38.5, Blue: 31 };
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { getStandings } = await import("@/queries/standings");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      // A rewritten edition and edition number, as not live, so it can't
      // touch the demo XI the local database holds.
      const seed = {
        ...(await parseSeed("seeds/xi.json")),
        edition: "xifrozen",
        editionNumber: 9460,
        year: 9460,
        status: "complete" as const,
      };
      const warWeek = await loadWarWeekSeed(seed, tx);

      const standings = await getStandings(warWeek, tx);
      expect(
        Object.fromEntries(standings.team.map((t) => [t.name, t.total])),
      ).toEqual(FROZEN);

      // The War Week is deleted afterwards (the transaction also rolls back).
      await tx.delete(schema.warWeek).where(eq(schema.warWeek.id, warWeek.id));
      expect(
        await tx.$count(schema.warWeek, eq(schema.warWeek.edition, "xifrozen")),
      ).toBe(0);
    });
  }, 60_000);
});

/** Each public table's row count. */
async function rowCounts(client: Client): Promise<Record<string, number>> {
  const tables = await client.query<{ tablename: string }>(
    "select tablename from pg_tables where schemaname = 'public' order by tablename",
  );
  const counts: Record<string, number> = {};
  for (const { tablename } of tables.rows) {
    const result = await client.query(
      `select count(*)::int as n from "${tablename}"`,
    );
    counts[tablename] = result.rows[0].n;
  }
  return counts;
}

/**
 * Loads `files` twice, in order and without a reset, into its own migrated
 * throwaway database; `check` sees the client after the second load, with
 * the counts after each.
 */
async function loadTwice(
  files: string[],
  check: (
    client: Client,
    counts: { first: Record<string, number>; second: Record<string, number> },
  ) => Promise<void>,
) {
  const { loadWarWeekSeed } = await import("@/seed/load");
  const seeds = await Promise.all(files.map(parseSeed));
  await withThrowawayDatabase(async (url) => {
    const client = new Client({ connectionString: url });
    await client.connect();
    try {
      const schema = await import("@/db/schema");
      const database = drizzle(client, { schema });
      for (const seed of seeds) await loadWarWeekSeed(seed, database);
      const first = await rowCounts(client);
      for (const seed of seeds) await loadWarWeekSeed(seed, database);
      const second = await rowCounts(client);
      await check(client, { first, second });
    } finally {
      await client.end();
    }
  });
}

const SEED_JSON_FILES = readdirSync(path.join(ROOT, "seeds"))
  .filter((f) => f.endsWith(".json"))
  .sort()
  .map((f) => `seeds/${f}`);

/** The files `pnpm seed:demo:xii` loads, read from package.json. */
function demoXiiFiles(): string[] {
  const scripts = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf-8"),
  ).scripts as Record<string, string>;
  return scripts["seed:demo:xii"]
    .split(/\s+/)
    .filter((a) => a.endsWith(".json"));
}

describe.skipIf(!isLocalDatabase)("every seed loads twice", () => {
  it("loads what smoke loads (localSeedFiles) twice with no row count changing", async () => {
    await loadTwice(localSeedFiles(), async (_client, { first, second }) => {
      expect(second).toEqual(first);
      expect(first.war_week).toBe(12);
      expect(first.placement).toBeGreaterThan(0);
      expect(first.points_entry).toBeGreaterThan(0);
    });
  }, 120_000);

  it("loads every seeds/*.json (the Seed workflow, with the real xi.json) twice with no row count changing, and holds one Subjective Points entry per XI Team", async () => {
    await loadTwice(SEED_JSON_FILES, async (client, { first, second }) => {
      expect(second).toEqual(first);
      expect(first.war_week).toBe(12);
      const subjective = await client.query<{ name: string; n: number }>(
        `select t.name, count(*)::int as n
         from points_entry e
         join team t on t.id = e.team_id
         join war_week w on w.id = e.war_week_id
         where w.edition = 'xi' and e.competition_id is null
           and e.note = 'Subjective Points'
         group by t.name order by t.name`,
      );
      expect(subjective.rows).toEqual([
        { name: "Blue", n: 1 },
        { name: "Red", n: 1 },
      ]);
    });
  }, 120_000);

  it("loads the seed:demo:xii set twice with no row count changing, and its Step Challenge is a finalized sheet of Scores", async () => {
    await loadTwice(demoXiiFiles(), async (client, { first, second }) => {
      expect(second).toEqual(first);
      expect(first.war_week).toBe(12);
      const sheet = await client.query<{
        rows: number;
        scored: number;
        finalized: boolean;
        direction: string;
      }>(
        `select count(p.id)::int as rows,
           count(p.score)::int as scored,
           bool_and(c.finalized_at is not null) as finalized,
           min(c.score_direction::text) as direction
         from competition c
         join placement p on p.competition_id = c.id
         join war_week w on w.id = c.war_week_id
         where w.edition = 'xii' and c.name = 'Step Challenge'`,
      );
      expect(sheet.rows[0]).toEqual({
        rows: 12,
        scored: 12,
        finalized: true,
        direction: "higher",
      });
    });
  }, 120_000);
});
