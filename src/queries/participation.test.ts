import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const NEO = "pv-neo@jahnelgroup.com";
const HOST = "pv-host@jahnelgroup.com";

/**
 * A War Week with Red (Neo, who set a Profile name, and Morpheus) and Blue
 * (Trinity), and a team `participation` Competition ranked by headcount.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [ww] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "pv1",
      editionNumber: 9501,
      year: 9501,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Participation view test",
      status: "upcoming",
      mode: "teams",
      teamLabel: "House",
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
  const warWeekId = ww.id;
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  const [neo, morpheus, trinity] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: red.id },
      {
        warWeekId,
        displayName: "Morpheus",
        email: "pv-morpheus@jahnelgroup.com",
        teamId: red.id,
      },
      {
        warWeekId,
        displayName: "Trinity",
        email: "pv-trinity@jahnelgroup.com",
        teamId: blue.id,
      },
    ])
    .returning({ id: schema.participant.id });
  await tx
    .insert(schema.profile)
    .values({ email: NEO, name: "The One" })
    .onConflictDoNothing();
  const [workout] = await tx
    .insert(schema.competition)
    .values({
      warWeekId,
      name: "Workout",
      scoring: "team",
      format: "participation",
      participationPoints: 1,
      participationTeamScoring: "ranked",
      selfCheckIn: true,
      placementPoints: [5, 3, 1],
    })
    .returning({ id: schema.competition.id });
  return {
    ctx: (actorEmail: string) => ({ warWeekId, actorEmail }),
    ids: {
      red: red.id,
      blue: blue.id,
      neo: neo.id,
      morpheus: morpheus.id,
      trinity: trinity.id,
      workout: workout.id,
    },
  };
}

describe.skipIf(!isLocalDatabase)("getParticipationView", () => {
  it("lists who took part by Profile name with their House, and each House's headcount", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getParticipationView } = await import("@/queries/participation");
      const { checkIn, markParticipant } =
        await import("@/mutations/participation");
      const f = await fixture(tx);
      await checkIn(f.ids.workout, f.ctx(NEO), tx);
      for (const id of [f.ids.morpheus, f.ids.trinity]) {
        await markParticipant(f.ids.workout, id, f.ctx(HOST), tx);
      }

      const view = await getParticipationView(f.ids.workout, tx);
      expect(
        view?.tookPart.map(({ name, team, checkedIn }) => ({
          name,
          team,
          checkedIn,
        })),
      ).toEqual([
        { name: "Morpheus", team: "Red", checkedIn: false },
        { name: "The One", team: "Red", checkedIn: true },
        { name: "Trinity", team: "Blue", checkedIn: false },
      ]);
      expect(view?.teamCounts).toEqual([
        { teamId: f.ids.red, name: "Red", color: "#f00", count: 2, place: 1 },
        { teamId: f.ids.blue, name: "Blue", color: "#00f", count: 1, place: 2 },
      ]);
      expect(view?.competition).toMatchObject({
        name: "Workout",
        closed: false,
        selfCheckIn: true,
      });
      expect(JSON.stringify(view)).not.toContain("@");
    });
  });

  it("is undefined for another Format or a malformed id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getParticipationView } = await import("@/queries/participation");
      await fixture(tx);
      expect(await getParticipationView("not-a-uuid", tx)).toBeUndefined();
      expect(
        await getParticipationView("6f1c2f1e-8a49-4c38-9a4a-0d6f1f3c2b10", tx),
      ).toBeUndefined();
    });
  });
});
