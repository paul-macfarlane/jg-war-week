import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/**
 * Two War Weeks, each with a Team, a Participant and a Competition, plus
 * one Points Entry posted to the *other* War Week's Competition but
 * targeting the *home* War Week's Team — a row the database itself never
 * refuses, since a Points Entry's Competition and target aren't checked
 * against each other at the schema level. Only the join scoping in
 * `getStandings` keeps it out of home's Standings.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number, teamName: string) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `s${n}`,
        editionNumber: 9100 + n,
        year: 9100 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Standings test",
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
    const [team] = await tx
      .insert(schema.team)
      .values({ warWeekId: row.id, name: teamName, color: "#f00" })
      .returning({ id: schema.team.id });
    const [tug] = await tx
      .insert(schema.competition)
      .values({ warWeekId: row.id, name: "Tug of War", scoring: "team" })
      .returning({ id: schema.competition.id });
    return {
      id: row.id,
      mode: "teams" as const,
      teamId: team.id,
      tugId: tug.id,
    };
  };
  const home = await warWeek(1, "Red");
  const other = await warWeek(2, "Blue");

  // Home's own entry.
  await tx.insert(schema.pointsEntry).values({
    competitionId: home.tugId,
    teamId: home.teamId,
    points: 3,
    enteredByEmail: "organizer@jahnelgroup.com",
  });
  // The other War Week's own entry.
  await tx.insert(schema.pointsEntry).values({
    competitionId: other.tugId,
    teamId: other.teamId,
    points: 100,
    enteredByEmail: "organizer@jahnelgroup.com",
  });
  // A stray entry: posted to the other War Week's Competition but naming
  // home's Team. Only the join's War Week scope keeps it out of home's
  // Standings.
  await tx.insert(schema.pointsEntry).values({
    competitionId: other.tugId,
    teamId: home.teamId,
    points: 1000,
    enteredByEmail: "organizer@jahnelgroup.com",
  });

  return { home, other };
}

describe.skipIf(!isLocalDatabase)("getStandings", () => {
  it("scopes its Points Entry join to the queried War Week's Competitions only", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getStandings } = await import("@/queries/standings");
      const { home, other } = await fixture(tx);

      const standings = await getStandings(home, tx);

      expect(standings.team).toEqual([
        expect.objectContaining({ name: "Red", total: 3 }),
      ]);

      const otherStandings = await getStandings(other, tx);
      expect(otherStandings.team).toEqual([
        expect.objectContaining({ name: "Blue", total: 100 }),
      ]);
    });
  });
});
