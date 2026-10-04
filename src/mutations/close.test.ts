import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import {
  HOST,
  type LoggedFixture,
  loggedFixture,
} from "@/mutations/logged-results.fixture";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

async function mutations() {
  return import("@/mutations/close");
}

/** A Competition's generated Points Entries as [side, points, note], sorted. */
async function generated(f: LoggedFixture, tx: DBTx, competitionId: string) {
  const { pointsEntry } = f.schema;
  const rows = await tx
    .select({
      teamId: pointsEntry.teamId,
      participantId: pointsEntry.participantId,
      points: pointsEntry.points,
      note: pointsEntry.note,
    })
    .from(pointsEntry)
    .where(
      and(
        eq(pointsEntry.competitionId, competitionId),
        eq(pointsEntry.generated, true),
      ),
    );
  return rows
    .map((r) => [r.teamId ?? r.participantId, r.points, r.note] as const)
    .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

const closedAtOf = async (f: LoggedFixture, tx: DBTx, id: string) =>
  (
    await tx
      .select({ closedAt: f.schema.competition.closedAt })
      .from(f.schema.competition)
      .where(eq(f.schema.competition.id, id))
  )[0].closedAt;

/** Adds a typed (non-generated) Points Entry, which Close and Reopen leave be. */
async function typedEntry(f: LoggedFixture, tx: DBTx, competitionId: string) {
  await tx.insert(f.schema.pointsEntry).values({
    warWeekId: f.warWeekId,
    competitionId,
    teamId: f.ids.red,
    points: 1,
    note: "Spirit bonus",
    enteredByEmail: HOST,
  });
}

describe.skipIf(!isLocalDatabase)(
  "closeCompetition and reopenCompetition",
  () => {
    it("Placement: Close writes each Place's points, Reopen withdraws them and keeps a typed entry", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        await f.setCompetition(ids.trivia, { placementPoints: [5, 3, 1] });
        await tx.insert(schema.placement).values([
          { competitionId: ids.trivia, teamId: ids.red, place: 1, score: 9 },
          { competitionId: ids.trivia, teamId: ids.blue, place: 2, score: 7 },
        ]);
        await typedEntry(f, tx, ids.trivia);

        expect(await closeCompetition(ids.trivia, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.trivia)).toEqual([
          [ids.red, 5, "From placement"],
          [ids.blue, 3, "From placement"],
        ]);
        const first = await closedAtOf(f, tx, ids.trivia);
        expect(first).not.toBeNull();

        // Closing again rewrites the same entries and keeps the first time.
        expect(await closeCompetition(ids.trivia, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.trivia)).toHaveLength(2);
        expect(await closedAtOf(f, tx, ids.trivia)).toEqual(first);

        expect(await reopenCompetition(ids.trivia, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.trivia)).toEqual([]);
        expect(await closedAtOf(f, tx, ids.trivia)).toBeNull();
        const typed = await tx
          .select({ note: schema.pointsEntry.note })
          .from(schema.pointsEntry)
          .where(eq(schema.pointsEntry.competitionId, ids.trivia));
        expect(typed).toEqual([{ note: "Spirit bonus" }]);
      });
    });

    it("Placement: refuses a Score with no Place, or nobody placed, and writes nothing", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        expect(await closeCompetition(ids.trivia, f.ctx(HOST), tx)).toEqual({
          ok: false,
          error: "Give someone a Place first.",
        });
        await tx.insert(schema.placement).values({
          competitionId: ids.trivia,
          teamId: ids.red,
          place: null,
          score: 4,
        });
        expect(
          await closeCompetition(ids.trivia, f.ctx(HOST), tx),
        ).toMatchObject({ ok: false, error: expect.stringContaining("Red") });
        expect(await generated(f, tx, ids.trivia)).toEqual([]);
        expect(await closedAtOf(f, tx, ids.trivia)).toBeNull();
      });
    });

    it("Head-to-head: Close gives the series winner 1st and the other 2nd; Reopen withdraws", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        const entrants = await tx
          .select({
            id: schema.entrant.id,
            participantId: schema.entrant.participantId,
          })
          .from(schema.entrant)
          .where(eq(schema.entrant.competitionId, ids.pong));
        const entrantOf = (participantId: string) =>
          entrants.find((e) => e.participantId === participantId)!.id;
        for (let n = 0; n < 2; n += 1) {
          const [match] = await tx
            .insert(schema.seriesMatch)
            .values({ competitionId: ids.pong, loggedByEmail: HOST })
            .returning({ id: schema.seriesMatch.id });
          await tx.insert(schema.seriesMatchEntrant).values([
            {
              seriesMatchId: match.id,
              entrantId: entrantOf(ids.neo),
              place: 1,
            },
            {
              seriesMatchId: match.id,
              entrantId: entrantOf(ids.trinity),
              place: 2,
            },
          ]);
        }

        expect(await closeCompetition(ids.pong, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.pong)).toEqual([
          [ids.neo, 10, "From head-to-head"],
          [ids.trinity, 6, "From head-to-head"],
        ]);
        expect(await closedAtOf(f, tx, ids.pong)).not.toBeNull();

        expect(await reopenCompetition(ids.pong, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.pong)).toEqual([]);
        expect(await closedAtOf(f, tx, ids.pong)).toBeNull();
      });
    });

    it("Best score: Close ranks the best Attempts, ties sharing a place's points; Reopen withdraws", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        await tx.insert(schema.attempt).values([
          {
            competitionId: ids.bowl,
            participantId: ids.neo,
            teamId: ids.red,
            score: 200,
            loggedByEmail: HOST,
          },
          {
            competitionId: ids.bowl,
            participantId: ids.trinity,
            teamId: ids.blue,
            score: 200,
            loggedByEmail: HOST,
          },
          {
            competitionId: ids.bowl,
            participantId: ids.morpheus,
            teamId: ids.red,
            score: 150,
            loggedByEmail: HOST,
          },
        ]);

        expect(await closeCompetition(ids.bowl, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.bowl)).toEqual(
          [
            [ids.neo, 10, "From best score"],
            [ids.trinity, 10, "From best score"],
            [ids.morpheus, 3, "From best score"],
          ].sort(
            (a, b) =>
              (b[1] as number) - (a[1] as number) ||
              String(a[0]).localeCompare(String(b[0])),
          ),
        );

        expect(await reopenCompetition(ids.bowl, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, ids.bowl)).toEqual([]);
        expect(await closedAtOf(f, tx, ids.bowl)).toBeNull();
      });
    });

    it("Participation: Close gives each Participant who took part N points; Reopen withdraws", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        const [workout] = await tx
          .insert(schema.competition)
          .values({
            warWeekId: f.warWeekId,
            name: "Workout",
            scoring: "individual",
            format: "participation",
            participationPoints: 2,
          })
          .returning({ id: schema.competition.id });
        await tx.insert(schema.participation).values([
          {
            competitionId: workout.id,
            participantId: ids.neo,
            markedByEmail: HOST,
            checkedIn: false,
          },
          {
            competitionId: workout.id,
            participantId: ids.dozer,
            markedByEmail: HOST,
            checkedIn: false,
          },
        ]);

        expect(await closeCompetition(workout.id, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, workout.id)).toEqual(
          [
            [ids.neo, 2, "From participation"],
            [ids.dozer, 2, "From participation"],
          ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        );
        expect(await closedAtOf(f, tx, workout.id)).not.toBeNull();

        expect(await reopenCompetition(workout.id, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, workout.id)).toEqual([]);
        expect(await closedAtOf(f, tx, workout.id)).toBeNull();
      });
    });

    it("Bracket: Close is refused until the Bracket is complete, then gives the final placings' points", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const { replaceEntrants, generateBracket, recordMatchResult } =
          await import("@/mutations/brackets");
        const { getBracket } = await import("@/queries/brackets");
        const f = await loggedFixture(tx);
        const { schema, ids } = f;
        const [cup] = await tx
          .insert(schema.competition)
          .values({
            warWeekId: f.warWeekId,
            name: "Cup",
            scoring: "team",
            format: "bracket",
            placementPoints: [10, 6, 3],
          })
          .returning({ id: schema.competition.id });
        await replaceEntrants(
          cup.id,
          { targetIds: [ids.red, ids.blue] },
          f.ctx(HOST),
          tx,
        );
        await generateBracket(cup.id, { rng: () => 0 }, f.ctx(HOST), tx);
        await typedEntry(f, tx, cup.id);

        expect(await closeCompetition(cup.id, f.ctx(HOST), tx)).toEqual({
          ok: false,
          error: "Finish every Match before closing.",
        });
        expect(await closedAtOf(f, tx, cup.id)).toBeNull();

        const view = (await getBracket(cup.id, tx))!;
        const final = view.bracket.matches.find((m) => m.round === 1)!;
        const [first, second] = final.slots.map((s) => s.entrantId!);
        expect(
          await recordMatchResult(
            cup.id,
            final.id,
            { order: [first, second] },
            f.ctx(HOST),
            tx,
          ),
        ).toMatchObject({ ok: true });
        const winner = view.entrants.find((e) => e.id === first)!;
        const loser = view.entrants.find((e) => e.id === second)!;

        expect(await closeCompetition(cup.id, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, cup.id)).toEqual([
          [winner.teamId, 10, "From bracket"],
          [loser.teamId, 6, "From bracket"],
        ]);
        expect(await closedAtOf(f, tx, cup.id)).not.toBeNull();

        expect(await reopenCompetition(cup.id, f.ctx(HOST), tx)).toEqual({
          ok: true,
        });
        expect(await generated(f, tx, cup.id)).toEqual([]);
        expect(await closedAtOf(f, tx, cup.id)).toBeNull();
        const kept = await tx
          .select({ note: schema.pointsEntry.note })
          .from(schema.pointsEntry)
          .where(eq(schema.pointsEntry.competitionId, cup.id));
        expect(kept).toEqual([{ note: "Spirit bonus" }]);
      });
    });

    it("refuses a Competition of another War Week or one that doesn't exist", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeCompetition, reopenCompetition } = await mutations();
        const f = await loggedFixture(tx);
        const elsewhere = { warWeekId: crypto.randomUUID(), actorEmail: HOST };
        const gone = { ok: false, error: "That Competition no longer exists." };
        expect(await closeCompetition(f.ids.trivia, elsewhere, tx)).toEqual(
          gone,
        );
        expect(await reopenCompetition(f.ids.trivia, elsewhere, tx)).toEqual(
          gone,
        );
      });
    });
  },
);
