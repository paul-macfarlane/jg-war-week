import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

class Rollback extends Error {}

async function inRolledBackTransaction(body: (tx: DBTx) => Promise<void>) {
  const { withTransaction } = await import("@/db");
  await withTransaction(async (tx) => {
    await body(tx);
    throw new Rollback();
  }).catch((error) => {
    if (!(error instanceof Rollback)) throw error;
  });
}

async function seed(edition: string, n: number, status: string) {
  const { warWeekSeedSchema } = await import("@/seed/schema");
  return warWeekSeedSchema.parse({
    edition,
    editionNumber: 9400 + n,
    year: 9400 + n,
    startDate: "2099-01-01",
    endDate: "2099-01-05",
    storyTheme: "Seed load test",
    status,
    mode: "teams",
    teamLabel: "Team",
    leaderTitle: "Captain",
    slackChannelUrl: "https://example.slack.com/archives/x",
    primary: "#000000",
    primaryForeground: "#ffffff",
    accent: "#000000",
    background: "#ffffff",
    foreground: "#000000",
    fontPreset: "sans",
    organizerEmails: ["o@jahnelgroup.com"],
    winner: null,
    highlights: [],
    days: [],
  });
}

/** Nothing else live, so the test's own live War Week is the only one. */
async function clearLive(tx: DBTx) {
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await tx
    .update(schema.warWeek)
    .set({ status: "complete" })
    .where(eq(schema.warWeek.status, "live"));
}

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed lifecycle fields", () => {
  it("sets status, Winner and highlights on insert and never overwrites them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      await clearLive(tx);
      const first = await loadWarWeekSeed(await seed("sa", 1, "live"), tx);
      expect(first.status).toBe("live");

      await endWarWeek(first.id, { winner: "Red", highlights: ["gg"] }, tx);
      const reloaded = await loadWarWeekSeed(await seed("sa", 1, "live"), tx);

      expect(reloaded).toMatchObject({
        status: "complete",
        winner: "Red",
        highlights: ["gg"],
      });
    });
  });

  it("refuses a seed that would insert a second live War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      await loadWarWeekSeed(await seed("sa", 1, "live"), tx);

      await expect(
        loadWarWeekSeed(await seed("sb", 2, "live"), tx),
      ).rejects.toThrow(
        'Seed "sb" is live, but War Week SA is already live. End it first or give the seed another status.',
      );
    });
  });
});
