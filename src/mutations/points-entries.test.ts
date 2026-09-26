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

/** Two War Weeks with a team and an individual Competition each. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `t${n}`,
        editionNumber: 9000 + n,
        year: 9000 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Mutation test",
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
      .values({ warWeekId: row.id, name: "Red", color: "#f00" })
      .returning({ id: schema.team.id });
    const [participant] = await tx
      .insert(schema.participant)
      .values({ warWeekId: row.id, displayName: "Neo", teamId: team.id })
      .returning({ id: schema.participant.id });
    const [tug, chess] = await tx
      .insert(schema.competition)
      .values([
        {
          warWeekId: row.id,
          name: "Tug of War",
          scoring: "team",
          maxPoints: 3,
        },
        { warWeekId: row.id, name: "Speed Chess", scoring: "individual" },
      ])
      .returning({ id: schema.competition.id });
    return {
      warWeekId: row.id,
      teamId: team.id,
      participantId: participant.id,
      tugId: tug.id,
      chessId: chess.id,
    };
  };
  return { home: await warWeek(1), other: await warWeek(2), schema };
}

const actorEmail = "organizer@jahnelgroup.com";

describe.skipIf(!isLocalDatabase)("Points Entry mutations", () => {
  it("creates an over-max decimal entry for a Team, recording the actor", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createPointsEntry } = await import("@/mutations/points-entries");
      const { home, schema } = await fixture(tx);

      const result = await createPointsEntry(
        {
          competitionId: home.tugId,
          targetId: home.teamId,
          points: 4.25,
          note: "bonus",
        },
        { warWeekId: home.warWeekId, actorEmail },
        tx,
      );

      expect(result).toEqual({ ok: true });
      const rows = await tx
        .select()
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, home.tugId));
      expect(rows).toMatchObject([
        {
          teamId: home.teamId,
          participantId: null,
          points: 4.25,
          note: "bonus",
          enteredByEmail: actorEmail,
        },
      ]);
    });
  });

  it("refuses the wrong target kind and targets or Competitions of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createPointsEntry } = await import("@/mutations/points-entries");
      const { home, other } = await fixture(tx);
      const ctx = { warWeekId: home.warWeekId, actorEmail };
      const entry = { points: 1, note: null };

      expect(
        await createPointsEntry(
          { ...entry, competitionId: home.tugId, targetId: home.participantId },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          '"Tug of War" is a team Competition, so its Points Entries must target a team.',
      });
      expect(
        await createPointsEntry(
          { ...entry, competitionId: home.chessId, targetId: home.teamId },
          ctx,
          tx,
        ),
      ).toMatchObject({ ok: false });
      expect(
        await createPointsEntry(
          { ...entry, competitionId: home.tugId, targetId: other.teamId },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Choose a Team or Participant of this War Week.",
      });
      expect(
        await createPointsEntry(
          { ...entry, competitionId: other.tugId, targetId: other.teamId },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose a Competition of this War Week." });
    });
  });

  it("edits and deletes only entries of the War Week, keeping entered-by", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createPointsEntry, deletePointsEntry, updatePointsEntry } =
        await import("@/mutations/points-entries");
      const { home, other, schema } = await fixture(tx);
      await createPointsEntry(
        {
          competitionId: home.tugId,
          targetId: home.teamId,
          points: 2,
          note: null,
        },
        { warWeekId: home.warWeekId, actorEmail },
        tx,
      );
      const [{ id }] = await tx
        .select({ id: schema.pointsEntry.id })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, home.tugId));

      const moved = {
        competitionId: home.chessId,
        targetId: home.participantId,
        points: 1.5,
        note: "fixed",
      };
      const editor = {
        warWeekId: home.warWeekId,
        actorEmail: "b@jahnelgroup.com",
      };
      const elsewhere = { warWeekId: other.warWeekId, actorEmail };

      expect(await updatePointsEntry(id, moved, elsewhere, tx)).toMatchObject({
        ok: false,
      });
      expect(await updatePointsEntry(id, moved, editor, tx)).toEqual({
        ok: true,
      });
      const [edited] = await tx
        .select()
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.id, id));
      expect(edited).toMatchObject({
        competitionId: home.chessId,
        teamId: null,
        participantId: home.participantId,
        points: 1.5,
        enteredByEmail: actorEmail,
      });

      expect(await deletePointsEntry(id, elsewhere, tx)).toEqual({
        ok: false,
        error: "That Points Entry no longer exists.",
      });
      expect(await deletePointsEntry(id, editor, tx)).toEqual({ ok: true });
      expect(
        await tx
          .select()
          .from(schema.pointsEntry)
          .where(eq(schema.pointsEntry.id, id)),
      ).toEqual([]);
    });
  });
});
