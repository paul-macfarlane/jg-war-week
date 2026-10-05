import { drizzle } from "drizzle-orm/node-postgres";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { withThrowawayDatabase } from "@/db/test-database";
import { warWeekSeedSchema } from "@/seed/schema";

// Runs only against a local Postgres (CI's service or docker compose), never
// a hosted database. Smoke never loads `seeds/demo/xii.json`, so this is the
// one check of `get_bracket` on the seeded Chess Matches.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const ROOT = path.resolve(__dirname, "../..");

/** The files `pnpm seed:demo:xii` loads, read from package.json. */
function demoXiiFiles(): string[] {
  const scripts = JSON.parse(
    readFileSync(path.join(ROOT, "package.json"), "utf-8"),
  ).scripts as Record<string, string>;
  return scripts["seed:demo:xii"]
    .split(/\s+/)
    .filter((a) => a.endsWith(".json"));
}

describe.skipIf(!isLocalDatabase)("get_bracket on the seeded demo XII", () => {
  it("answers Chess Matches as a Bracket of 4 per Match, 2 advancing, no 3rd place Match, with no time, place, Forfeit or @", async () => {
    await withThrowawayDatabase(async (url) => {
      const client = new Client({ connectionString: url });
      await client.connect();
      try {
        const schema = await import("@/db/schema");
        const database = drizzle(client, { schema });
        const { loadWarWeekSeed } = await import("@/seed/load");
        const { getBracket } = await import("@/queries/brackets");
        const { getCompetitionByName } = await import("@/queries/competitions");
        const { toBracketResult } = await import("@/mcp/bracket");

        let warWeek;
        for (const file of demoXiiFiles()) {
          const seed = warWeekSeedSchema.parse(
            JSON.parse(readFileSync(path.resolve(ROOT, file), "utf-8")),
          );
          warWeek = await loadWarWeekSeed(seed, database);
        }
        const found = await getCompetitionByName(
          warWeek!,
          "Chess Matches",
          database,
        );
        const view = found ? await getBracket(found.id, database) : undefined;
        const result = toBracketResult(view, "Chess Matches");
        const json = JSON.stringify(result);

        expect(result).toMatchObject({
          found: true,
          competition: {
            name: "Chess Matches",
            format: "bracket",
            kind: "group",
            matchSize: 4,
            advancing: 2,
            thirdPlaceMatch: false,
          },
        });
        expect(json).not.toContain("@");
        expect(json).not.toMatch(/forfeit|location|startTime|"day"/i);
      } finally {
        await client.end();
      }
    });
  }, 180_000);
});
