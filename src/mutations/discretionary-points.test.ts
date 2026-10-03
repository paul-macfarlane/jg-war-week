import { eq } from "drizzle-orm";
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

const actorEmail = "organizer@jahnelgroup.com";

/** Two War Weeks, each with a Team, a Participant and a Competition. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `m${n}`,
        editionNumber: 9300 + n,
        year: 9300 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Discretionary mutation test",
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
    const [tug] = await tx
      .insert(schema.competition)
      .values({ warWeekId: row.id, name: "Tug of War", scoring: "team" })
      .returning({ id: schema.competition.id });
    return {
      ctx: { warWeekId: row.id, actorEmail },
      teamId: team.id,
      participantId: participant.id,
      tugId: tug.id,
    };
  };
  return { home: await warWeek(1), other: await warWeek(2), schema };
}

async function entries(tx: DBTx, warWeekId: string) {
  const { pointsEntry } = await import("@/db/schema");
  return tx
    .select()
    .from(pointsEntry)
    .where(eq(pointsEntry.warWeekId, warWeekId));
}

describe.skipIf(!isLocalDatabase)("Discretionary points mutations", () => {
  it("gives points to a Team with no Competition, recording the actor and the reason", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home } = await fixture(tx);

      expect(
        await createDiscretionaryPoints(
          { targetId: home.teamId, points: 2.5, reason: "Spirit award" },
          home.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const rows = await entries(tx, home.ctx.warWeekId);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        competitionId: null,
        teamId: home.teamId,
        participantId: null,
        points: 2.5,
        note: "Spirit award",
        enteredByEmail: actorEmail,
        generatedByBracket: false,
      });
    });
  });

  it("gives points to a Participant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home } = await fixture(tx);

      await createDiscretionaryPoints(
        { targetId: home.participantId, points: 1, reason: "Helped" },
        home.ctx,
        tx,
      );
      const [row] = await entries(tx, home.ctx.warWeekId);
      expect(row).toMatchObject({
        teamId: null,
        participantId: home.participantId,
      });
    });
  });

  it("refuses a Team or Participant of another War Week on create and writes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home, other } = await fixture(tx);
      const refusal = {
        ok: false,
        error: "Choose a Team or Participant of this War Week.",
      };

      for (const targetId of [other.teamId, other.participantId]) {
        expect(
          await createDiscretionaryPoints(
            { targetId, points: 1, reason: "Foreign" },
            home.ctx,
            tx,
          ),
        ).toEqual(refusal);
      }
      expect(await entries(tx, home.ctx.warWeekId)).toEqual([]);
      expect(await entries(tx, other.ctx.warWeekId)).toEqual([]);
    });
  });

  it("edits target, points and reason, keeping who entered it and when", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home, schema } = await fixture(tx);
      const enteredAt = new Date("2026-02-24T15:00:00Z");
      const [entry] = await tx
        .insert(schema.pointsEntry)
        .values({
          warWeekId: home.ctx.warWeekId,
          competitionId: null,
          teamId: home.teamId,
          points: 3,
          note: "Spirit",
          enteredByEmail: "first@jahnelgroup.com",
          enteredAt,
        })
        .returning({ id: schema.pointsEntry.id });

      expect(
        await updateDiscretionaryPoints(
          entry.id,
          { targetId: home.participantId, points: 4, reason: "Helped" },
          { ...home.ctx, actorEmail: "second@jahnelgroup.com" },
          tx,
        ),
      ).toEqual({ ok: true });

      const [row] = await entries(tx, home.ctx.warWeekId);
      expect(row).toMatchObject({
        id: entry.id,
        competitionId: null,
        teamId: null,
        participantId: home.participantId,
        points: 4,
        note: "Helped",
        enteredByEmail: "first@jahnelgroup.com",
      });
      expect(row.enteredAt).toEqual(enteredAt);
    });
  });

  it("refuses a target from another War Week on edit and leaves the entry as it was", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home, other, schema } = await fixture(tx);
      const [entry] = await tx
        .insert(schema.pointsEntry)
        .values({
          warWeekId: home.ctx.warWeekId,
          competitionId: null,
          teamId: home.teamId,
          points: 3,
          note: "Spirit",
          enteredByEmail: actorEmail,
        })
        .returning({ id: schema.pointsEntry.id });

      expect(
        await updateDiscretionaryPoints(
          entry.id,
          { targetId: other.teamId, points: 99, reason: "Foreign" },
          home.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Choose a Team or Participant of this War Week.",
      });
      const [row] = await entries(tx, home.ctx.warWeekId);
      expect(row).toMatchObject({
        teamId: home.teamId,
        points: 3,
        note: "Spirit",
      });
    });
  });

  it("refuses to edit or delete an entry a Competition owns, typed or generated", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateDiscretionaryPoints, deleteDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home, schema } = await fixture(tx);
      const ids = (
        await tx
          .insert(schema.pointsEntry)
          .values(
            [false, true].map((generatedByBracket) => ({
              warWeekId: home.ctx.warWeekId,
              competitionId: home.tugId,
              teamId: home.teamId,
              points: 3,
              note: generatedByBracket ? "From bracket" : "typed",
              enteredByEmail: actorEmail,
              generatedByBracket,
            })),
          )
          .returning({ id: schema.pointsEntry.id })
      ).map((r) => r.id);
      const refusal = {
        ok: false,
        error: "That Points Entry comes from a Competition. Change it there.",
      };

      for (const id of ids) {
        expect(
          await updateDiscretionaryPoints(
            id,
            { targetId: home.teamId, points: 99, reason: "Hijack" },
            home.ctx,
            tx,
          ),
        ).toEqual(refusal);
        expect(await deleteDiscretionaryPoints(id, home.ctx, tx)).toEqual(
          refusal,
        );
      }
      const rows = await entries(tx, home.ctx.warWeekId);
      expect(rows.map((r) => [r.points, r.note]).sort()).toEqual([
        [3, "From bracket"],
        [3, "typed"],
      ]);
    });
  });

  it("deletes a Discretionary entry and nothing else, and not another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { deleteDiscretionaryPoints } =
        await import("@/mutations/discretionary-points");
      const { home, other, schema } = await fixture(tx);
      const [mine, theirs] = await tx
        .insert(schema.pointsEntry)
        .values([
          {
            warWeekId: home.ctx.warWeekId,
            competitionId: null,
            teamId: home.teamId,
            points: 3,
            note: "mine",
            enteredByEmail: actorEmail,
          },
          {
            warWeekId: other.ctx.warWeekId,
            competitionId: null,
            teamId: other.teamId,
            points: 5,
            note: "theirs",
            enteredByEmail: actorEmail,
          },
        ])
        .returning({ id: schema.pointsEntry.id });

      expect(await deleteDiscretionaryPoints(theirs.id, home.ctx, tx)).toEqual({
        ok: false,
        error: "That Discretionary points entry no longer exists.",
      });
      expect(await entries(tx, other.ctx.warWeekId)).toHaveLength(1);

      expect(await deleteDiscretionaryPoints(mine.id, home.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await entries(tx, home.ctx.warWeekId)).toEqual([]);
    });
  });
});
