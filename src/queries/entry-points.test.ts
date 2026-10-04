import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { getCompetitionEntryPoints } from "@/queries/entry-points";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/** A War Week with one Competition and two Teams. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "ep1",
      editionNumber: 9300,
      year: 9300,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "getCompetitionEntryPoints test",
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
  const [cup] = await tx
    .insert(schema.competition)
    .values({ warWeekId: warWeek.id, name: "Cup", scoring: "team" })
    .returning({ id: schema.competition.id });
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId: warWeek.id, name: "Red", color: "#f00" },
      { warWeekId: warWeek.id, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  return { schema, warWeekId: warWeek.id, cupId: cup.id, red, blue };
}

describe.skipIf(!isLocalDatabase)("getCompetitionEntryPoints", () => {
  it("reads only the Points Entries the Competition's Close generated", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeekId, cupId, red, blue } = await fixture(tx);
      await tx.insert(schema.pointsEntry).values([
        {
          warWeekId,
          competitionId: cupId,
          teamId: red.id,
          points: 10,
          enteredByEmail: "host@jahnelgroup.com",
          generated: true,
        },
        {
          warWeekId,
          competitionId: cupId,
          teamId: blue.id,
          points: 4,
          note: "Entered by hand",
          enteredByEmail: "host@jahnelgroup.com",
          generated: false,
        },
      ]);

      expect(await getCompetitionEntryPoints(cupId, tx)).toEqual([
        { teamId: red.id, participantId: null, points: 10 },
      ]);
    });
  });
});
