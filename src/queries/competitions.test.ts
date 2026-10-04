import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { competitionStatusText } from "@/lib/competition-status";
import {
  getCompetition,
  getCompetitionByName,
  getCompetitions,
} from "@/queries/competitions";

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
        format: "placement",
        scoring: "team",
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
        format: "placement",
        scoring: "team",
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
        format: "placement",
        scoring: "team",
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

describe.skipIf(!isLocalDatabase)("getCompetition", () => {
  it("finds a Competition of this War Week by id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [pool] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: warWeek.id,
          name: "Beyblades",
          scoring: "individual",
          competitionGroup: "Floor",
        })
        .returning({ id: schema.competition.id });

      expect(await getCompetition(warWeek, pool.id, tx)).toEqual({
        id: pool.id,
        name: "Beyblades",
        description: null,
        scoring: "individual",
        countsTowardTeam: false,
        competitionGroup: "Floor",
        format: "placement",
      });
    });
  });

  it("returns undefined for another War Week's Competition or a malformed id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [pool] = await tx
        .insert(schema.competition)
        .values({ warWeekId: warWeek.id, name: "Beyblades", scoring: "team" })
        .returning({ id: schema.competition.id });

      expect(
        await getCompetition(
          { id: "00000000-0000-4000-8000-000000000000" },
          pool.id,
          tx,
        ),
      ).toBeUndefined();
      expect(await getCompetition(warWeek, "not-a-uuid", tx)).toBeUndefined();
    });
  });
});

describe.skipIf(!isLocalDatabase)("getCompetitions", () => {
  it("gives each Competition its status, from one batch of facts per War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema, warWeek } = await fixture(tx);
      const [zion, nebuchadnezzar, logos, hammer] = await tx
        .insert(schema.team)
        .values(
          ["Zion", "Nebuchadnezzar", "Logos", "Hammer"].map((name) => ({
            warWeekId: warWeek.id,
            name,
            color: "#123456",
          })),
        )
        .returning({ id: schema.team.id });
      const competitions = await tx
        .insert(schema.competition)
        .values(
          [
            { name: "Fresh", format: "placement" as const },
            { name: "Open games", format: "head-to-head" as const },
            {
              name: "Tied",
              format: "placement" as const,
              finalizedAt: new Date("2099-01-03T12:00:00Z"),
            },
            {
              name: "Stairs",
              format: "best-score" as const,
              finalizedAt: new Date("2099-01-03T13:00:00Z"),
            },
            { name: "Knockout", format: "bracket" as const },
          ].map((c) => ({
            ...c,
            warWeekId: warWeek.id,
            scoring: "team" as const,
          })),
        )
        .returning({
          id: schema.competition.id,
          name: schema.competition.name,
        });
      const id = (name: string) =>
        competitions.find((c) => c.name === name)!.id;

      // Open games: an Entrant is a result.
      await tx.insert(schema.entrant).values({
        competitionId: id("Open games"),
        teamId: zion.id,
        seedPosition: 1,
      });

      // Tied: two 1st-place entries and a 2nd.
      await tx.insert(schema.pointsEntry).values(
        [
          { teamId: zion.id, points: 10 },
          { teamId: nebuchadnezzar.id, points: 10 },
          { teamId: logos.id, points: 5 },
        ].map((e) => ({
          ...e,
          warWeekId: warWeek.id,
          competitionId: id("Tied"),
          enteredByEmail: "organizer@jahnelgroup.com",
          generatedByBracket: true,
        })),
      );

      // Knockout: four Entrants, Round 1 half played, the final to come.
      const entrants = await tx
        .insert(schema.entrant)
        .values(
          [zion, nebuchadnezzar, logos, hammer].map((t, index) => ({
            competitionId: id("Knockout"),
            teamId: t.id,
            seedPosition: index + 1,
          })),
        )
        .returning({ id: schema.entrant.id });
      const heats = await tx
        .insert(schema.heat)
        .values(
          [
            { round: 1, position: 1, status: "played" as const },
            { round: 1, position: 2, status: "ready" as const },
            { round: 2, position: 1, status: "pending" as const },
          ].map((h) => ({ ...h, competitionId: id("Knockout") })),
        )
        .returning({ id: schema.heat.id });
      await tx.insert(schema.heatEntrant).values([
        { heatId: heats[0].id, entrantId: entrants[0].id, slot: 0, place: 1 },
        { heatId: heats[0].id, entrantId: entrants[3].id, slot: 1, place: 2 },
        { heatId: heats[1].id, entrantId: entrants[1].id, slot: 0 },
        { heatId: heats[1].id, entrantId: entrants[2].id, slot: 1 },
        { heatId: heats[2].id, entrantId: entrants[0].id, slot: 0 },
      ]);

      const { ungrouped } = await getCompetitions(warWeek, tx);
      expect(
        Object.fromEntries(
          ungrouped.map((c) => [c.name, competitionStatusText(c.status)]),
        ),
      ).toEqual({
        Fresh: "Not started",
        "Open games": "Underway",
        Tied: "Done · Winners: Nebuchadnezzar, Zion",
        Stairs: "Closed",
        Knockout: "Underway · Round 1 of 2",
      });
    });
  });
});
