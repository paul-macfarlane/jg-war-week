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

const organizer = "organizer@jahnelgroup.com";

/**
 * Two War Weeks, each with a Team and a Participant on it. Home holds two
 * Discretionary entries (4 to Red, "Spirit award"; 2 to Neo, "Great
 * sportsmanship") and one entry on a Competition (3); the other War Week
 * holds one Discretionary entry (100, "Other week only"). Every surface
 * must show home's and never the other's.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number, teamName: string) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `d${n}`,
        editionNumber: 9200 + n,
        year: 9200 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Discretionary test",
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
    const [person] = await tx
      .insert(schema.participant)
      .values({
        warWeekId: row.id,
        displayName: `Neo ${n}`,
        teamId: team.id,
      })
      .returning({ id: schema.participant.id });
    const [tug] = await tx
      .insert(schema.competition)
      .values({ warWeekId: row.id, name: "Tug of War", scoring: "team" })
      .returning({ id: schema.competition.id });
    return {
      id: row.id,
      mode: "teams" as const,
      teamId: team.id,
      participantId: person.id,
      tugId: tug.id,
    };
  };
  const home = await warWeek(1, "Red");
  const other = await warWeek(2, "Blue");

  const entry = (
    warWeekId: string,
    target: { teamId: string } | { participantId: string },
    points: number,
    note: string | null,
    competitionId: string | null,
    enteredAt: string,
  ) => ({
    warWeekId,
    competitionId,
    points,
    note,
    enteredByEmail: organizer,
    enteredAt: new Date(enteredAt),
    ...target,
  });
  await tx
    .insert(schema.pointsEntry)
    .values([
      entry(
        home.id,
        { teamId: home.teamId },
        4,
        "Spirit award",
        null,
        "2099-01-02T12:00:00Z",
      ),
      entry(
        home.id,
        { participantId: home.participantId },
        2,
        "Great sportsmanship",
        null,
        "2099-01-02T13:00:00Z",
      ),
      entry(
        home.id,
        { teamId: home.teamId },
        3,
        null,
        home.tugId,
        "2099-01-02T14:00:00Z",
      ),
      entry(
        other.id,
        { teamId: other.teamId },
        100,
        "Other week only",
        null,
        "2099-01-02T15:00:00Z",
      ),
    ]);
  return { home, other };
}

describe.skipIf(!isLocalDatabase)("Discretionary points in the queries", () => {
  it("getStandings counts a Team's and a Participant's entry (the Participant's also toward their Team) and leaves out another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getStandings } = await import("@/queries/standings");
      const { home, other } = await fixture(tx);

      const standings = await getStandings(home, tx);
      // 4 to Red + 2 to Neo (toward Red) + 3 on Tug of War.
      expect(standings.team).toEqual([
        expect.objectContaining({ name: "Red", total: 9 }),
      ]);
      expect(standings.individual).toEqual([
        expect.objectContaining({ name: "Neo 1", total: 2 }),
      ]);

      const otherStandings = await getStandings(other, tx);
      expect(otherStandings.team).toEqual([
        expect.objectContaining({ name: "Blue", total: 100 }),
      ]);
      expect(otherStandings.individual).toEqual([]);
    });
  });

  it("getPointsBreakdown labels each 'Discretionary: <reason>' and leaves out another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getPointsBreakdown } = await import("@/queries/standings");
      const { home, other } = await fixture(tx);

      const breakdown = await getPointsBreakdown(home, tx);
      expect(
        breakdown.byTeam
          .get(home.teamId)
          ?.map((r) => [r.competition, r.points]),
      ).toEqual([
        ["Tug of War", 3],
        ["Discretionary: Great sportsmanship", 2],
        ["Discretionary: Spirit award", 4],
      ]);
      expect(
        breakdown.byParticipant
          .get(home.participantId)
          ?.map((r) => [r.competition, r.points]),
      ).toEqual([["Discretionary: Great sportsmanship", 2]]);

      const otherBreakdown = await getPointsBreakdown(other, tx);
      expect(
        otherBreakdown.byTeam.get(other.teamId)?.map((r) => r.competition),
      ).toEqual(["Discretionary: Other week only"]);
    });
  });

  it("getRecentResults has a row per Discretionary entry with its reason, and none of another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getRecentResults } = await import("@/queries/recent-results");
      const { home } = await fixture(tx);

      const rows = await getRecentResults(home, tx);
      const discretionary = rows.flatMap((r) =>
        r.kind === "discretionary"
          ? [[r.target.name, r.points, r.reason] as const]
          : [],
      );
      expect(discretionary).toEqual([
        ["Neo 1", 2, "Great sportsmanship"],
        ["Red", 4, "Spirit award"],
      ]);
      expect(JSON.stringify(rows)).not.toContain("Other week only");
    });
  });

  it("getFinaleCounts counts the entries and their points, and not another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getFinaleCounts } = await import("@/queries/finale-slides");
      const { home, other } = await fixture(tx);

      // Three entries (4 + 2 + 3 points); one Competition has an entry.
      expect(await getFinaleCounts(home.id, tx)).toMatchObject({
        pointsEntries: 3,
        pointsHandedOut: 9,
        competitionsRun: 1,
      });
      expect(await getFinaleCounts(other.id, tx)).toMatchObject({
        pointsEntries: 1,
        pointsHandedOut: 100,
        competitionsRun: 0,
      });
    });
  });

  it("getScoredCounts counts Discretionary entries as scored", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getScoredCounts } = await import("@/queries/scored-counts");
      const { home } = await fixture(tx);

      expect((await getScoredCounts(home.id, tx)).pointsEntries).toBe(3);
    });
  });

  it("getDiscretionaryLedger lists only this War Week's Discretionary entries, newest first, with their reason", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getDiscretionaryLedger } =
        await import("@/queries/discretionary-points");
      const { home } = await fixture(tx);

      const ledger = await getDiscretionaryLedger(home, tx);
      expect(ledger.map((e) => [e.target, e.points, e.reason])).toEqual([
        ["Neo 1", 2, "Great sportsmanship"],
        ["Red", 4, "Spirit award"],
      ]);
      expect(ledger.every((e) => e.editedAt === null)).toBe(true);
    });
  });
});
