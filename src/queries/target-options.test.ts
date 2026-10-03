import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "t1",
      editionNumber: 9401,
      year: 9401,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Points Entry form test",
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
  const [red] = await tx
    .insert(schema.team)
    .values({ warWeekId: warWeek.id, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  await tx.insert(schema.participant).values([
    { warWeekId: warWeek.id, displayName: "Ashley Schuliger", teamId: red.id },
    { warWeekId: warWeek.id, displayName: "Neo" },
  ]);
  return { warWeekId: warWeek.id, red: red.id };
}

describe.skipIf(!isLocalDatabase)("getTargetOptions", () => {
  it("gives each Participant their Team's id beside its name", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getTargetOptions } = await import("@/queries/target-options");
      const f = await fixture(tx);

      const options = await getTargetOptions({ id: f.warWeekId }, tx);
      expect(options.participants).toEqual([
        {
          id: expect.any(String),
          name: "Ashley Schuliger",
          team: "Red",
          teamId: f.red,
        },
        { id: expect.any(String), name: "Neo", team: null, teamId: null },
      ]);
      expect(options.teams).toEqual([{ id: f.red, name: "Red", team: null }]);
    });
  });
});
