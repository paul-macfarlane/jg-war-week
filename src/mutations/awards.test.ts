import { eq } from "drizzle-orm";
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

/** Runs `body` in a transaction that is always rolled back. */
async function inRolledBackTransaction(body: (tx: DBTx) => Promise<void>) {
  const { withTransaction } = await import("@/db");
  await withTransaction(async (tx) => {
    await body(tx);
    throw new Rollback();
  }).catch((error) => {
    if (!(error instanceof Rollback)) throw error;
  });
}

/** Two War Weeks, so mutations can be proven scoped by id and War Week. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `a${n}`,
        editionNumber: 9100 + n,
        year: 9100 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Award mutation test",
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
      .values({ warWeekId: row.id, name: "Red", color: "#f00" })
      .returning({ id: schema.team.id });
    const [neo, trinity] = await tx
      .insert(schema.participant)
      .values([
        { warWeekId: row.id, displayName: "Neo", teamId: red.id },
        { warWeekId: row.id, displayName: "Trinity", teamId: red.id },
      ])
      .returning({ id: schema.participant.id });
    return {
      warWeekId: row.id,
      teamId: red.id,
      neoId: neo.id,
      trinityId: trinity.id,
    };
  };
  return { home: await warWeek(1), other: await warWeek(2), schema };
}

const actorEmail = "organizer@jahnelgroup.com";

describe.skipIf(!isLocalDatabase)("Award mutations", () => {
  it("creates an Award with a Team and Participants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAward } = await import("@/mutations/awards");
      const { getAwards } = await import("@/queries/awards");
      const { home } = await fixture(tx);
      const ctx = { warWeekId: home.warWeekId, actorEmail };

      expect(
        await createAward(
          {
            name: "MVP",
            description: "Most valuable",
            teamId: home.teamId,
            participantIds: [home.trinityId, home.neoId],
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      expect(await getAwards({ id: home.warWeekId }, tx)).toMatchObject([
        {
          name: "MVP",
          description: "Most valuable",
          team: { id: home.teamId, name: "Red", color: "#f00" },
          participants: [
            { id: home.neoId, displayName: "Neo", teamColor: "#f00" },
            { id: home.trinityId, displayName: "Trinity", teamColor: "#f00" },
          ],
        },
      ]);
    });
  });

  it("refuses another War Week's Team or Participants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAward } = await import("@/mutations/awards");
      const { home, other, schema } = await fixture(tx);
      const ctx = { warWeekId: home.warWeekId, actorEmail };
      const base = { name: "MVP", description: null };

      expect(
        await createAward(
          { ...base, teamId: other.teamId, participantIds: [] },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose a Team of this War Week." });
      expect(
        await createAward(
          { ...base, teamId: null, participantIds: [home.neoId, other.neoId] },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose Participants of this War Week." });
      expect(
        await tx
          .select()
          .from(schema.award)
          .where(eq(schema.award.warWeekId, home.warWeekId)),
      ).toEqual([]);
    });
  });

  it("edits, replacing recipients, and deletes only Awards of the War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAward, deleteAward, updateAward } =
        await import("@/mutations/awards");
      const { getAwards } = await import("@/queries/awards");
      const { home, other, schema } = await fixture(tx);
      const ctx = { warWeekId: home.warWeekId, actorEmail };
      const elsewhere = { warWeekId: other.warWeekId, actorEmail };

      await createAward(
        {
          name: "MVP",
          description: null,
          teamId: null,
          participantIds: [home.neoId],
        },
        ctx,
        tx,
      );
      const [{ id }] = await getAwards({ id: home.warWeekId }, tx);
      const edited = {
        name: "Team MVP",
        description: "Edited",
        teamId: home.teamId,
        participantIds: [home.trinityId],
      };

      expect(await updateAward(id, edited, elsewhere, tx)).toEqual({
        ok: false,
        error: "Choose a Team of this War Week.",
      });
      expect(
        await updateAward(
          id,
          { ...edited, teamId: null, participantIds: [other.neoId] },
          elsewhere,
          tx,
        ),
      ).toEqual({ ok: false, error: "That Award no longer exists." });
      expect(await updateAward(id, edited, ctx, tx)).toEqual({ ok: true });
      expect(await getAwards({ id: home.warWeekId }, tx)).toMatchObject([
        {
          id,
          name: "Team MVP",
          description: "Edited",
          team: { id: home.teamId },
          participants: [{ id: home.trinityId }],
        },
      ]);

      expect(await deleteAward(id, elsewhere, tx)).toEqual({
        ok: false,
        error: "That Award no longer exists.",
      });
      expect(await deleteAward(id, ctx, tx)).toEqual({ ok: true });
      expect(
        await tx
          .select()
          .from(schema.awardParticipant)
          .where(eq(schema.awardParticipant.awardId, id)),
      ).toEqual([]);
    });
  });
});
