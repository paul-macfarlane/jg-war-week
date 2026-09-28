import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { getCompetitionByName } from "@/queries/competitions";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/** A War Week to hang Competitions off, for `getCompetitionByName`. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "u1",
      editionNumber: 9200,
      year: 9200,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "getCompetitionByName test",
      status: "upcoming",
      mode: "teams",
      teamLabel: "Team",
      leaderTitle: "Captain",
      slackChannelUrl: "https://example.slack.com/archives/x",
      primaryColor: "#000",
      primaryForegroundColor: "#fff",
      accentColor: "#000",
      backgroundColor: "#fff",
      foregroundColor: "#000",
      fontPreset: "sans",
    })
    .returning({ id: schema.warWeek.id });
  return { schema, warWeek: { id: warWeek.id } };
}

describe.skipIf(!isLocalDatabase)("getCompetitionByName", () => {
  it("finds the exact name", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [pool] = await tx
        .insert(schema.competition)
        .values({ warWeekId: warWeek.id, name: "Beyblades", scoring: "team" })
        .returning({ id: schema.competition.id });

      expect(await getCompetitionByName(warWeek, "Beyblades", tx)).toEqual({
        id: pool.id,
        name: "Beyblades",
      });
    });
  });

  it("prefers the exact name over a case-insensitive one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [exact] = await tx
        .insert(schema.competition)
        .values({ warWeekId: warWeek.id, name: "beyblades", scoring: "team" })
        .returning({ id: schema.competition.id });
      await tx.insert(schema.competition).values({
        warWeekId: warWeek.id,
        name: "Beyblades",
        scoring: "team",
      });

      expect(await getCompetitionByName(warWeek, "beyblades", tx)).toEqual({
        id: exact.id,
        name: "beyblades",
      });
    });
  });

  it("falls back to the one case-insensitive name", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [pool] = await tx
        .insert(schema.competition)
        .values({ warWeekId: warWeek.id, name: "Beyblades", scoring: "team" })
        .returning({ id: schema.competition.id });

      expect(await getCompetitionByName(warWeek, "beyblades", tx)).toEqual({
        id: pool.id,
        name: "Beyblades",
      });
    });
  });

  it("returns undefined when two names differ only by case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      await tx.insert(schema.competition).values([
        { warWeekId: warWeek.id, name: "Beyblades", scoring: "team" },
        { warWeekId: warWeek.id, name: "BEYBLADES", scoring: "team" },
      ]);

      expect(
        await getCompetitionByName(warWeek, "beyblades", tx),
      ).toBeUndefined();
    });
  });

  it("returns undefined for a Competition of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [otherWarWeek] = await tx
        .insert(schema.warWeek)
        .values({
          edition: "u2",
          editionNumber: 9201,
          year: 9201,
          startDate: "2099-01-01",
          endDate: "2099-01-05",
          storyTheme: "getCompetitionByName test 2",
          status: "upcoming",
          mode: "teams",
          teamLabel: "Team",
          leaderTitle: "Captain",
          slackChannelUrl: "https://example.slack.com/archives/x",
          primaryColor: "#000",
          primaryForegroundColor: "#fff",
          accentColor: "#000",
          backgroundColor: "#fff",
          foregroundColor: "#000",
          fontPreset: "sans",
        })
        .returning({ id: schema.warWeek.id });
      await tx.insert(schema.competition).values({
        warWeekId: otherWarWeek.id,
        name: "Beyblades",
        scoring: "team",
      });

      expect(
        await getCompetitionByName(warWeek, "Beyblades", tx),
      ).toBeUndefined();
    });
  });

  it("returns undefined for an unknown name", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { warWeek } = await fixture(tx);

      expect(
        await getCompetitionByName(warWeek, "Nonexistent", tx),
      ).toBeUndefined();
    });
  });
});
