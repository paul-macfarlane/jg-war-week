import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import {
  HOST,
  MORPHEUS,
  NEO,
  NOBODY,
  ORGANIZER,
  TRINITY,
  loggedFixture as fixture,
} from "@/mutations/logged-results.fixture";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const CLOSED = "This Competition is closed.";
const NOT_YOURS = "You log only your own Attempts.";

async function load() {
  return import("@/mutations/attempts");
}

describe.skipIf(!isLocalDatabase)("logAttempt", () => {
  it("lets any linked Participant log their own Attempt, with no Entrant list", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const f = await fixture(tx);

      expect(
        await logAttempt(
          f.ids.bowl,
          { participantId: f.ids.morpheus, score: 120.5 },
          f.ctx(MORPHEUS),
          tx,
        ),
      ).toEqual({ ok: true, resultId: expect.any(String) });
      expect(await f.attemptRows(f.ids.bowl)).toEqual([
        {
          id: expect.any(String),
          participantId: f.ids.morpheus,
          teamId: f.ids.red,
          score: 120.5,
          loggedByEmail: MORPHEUS,
          loggedByParticipantId: f.ids.morpheus,
        },
      ]);
    });
  });

  it("refuses an Attempt for someone else, and no link", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const f = await fixture(tx);

      expect(
        await logAttempt(
          f.ids.bowl,
          { participantId: f.ids.trinity, score: 1 },
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_YOURS });
      expect(
        await logAttempt(
          f.ids.bowl,
          { participantId: f.ids.neo, score: 1 },
          f.ctx(NOBODY),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Your sign-in doesn't match a Participant of this War Week.",
      });
      expect(await f.attemptRows(f.ids.bowl)).toEqual([]);
    });
  });

  it("lets a Host log for any Participant of the War Week, and no one else", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const f = await fixture(tx);

      expect(
        await logAttempt(
          f.ids.bowl,
          { participantId: f.ids.cypher, score: 3 },
          f.ctx(HOST),
          tx,
        ),
      ).toMatchObject({ ok: true });
      expect(
        await logAttempt(
          f.ids.bowl,
          { participantId: f.ids.smith, score: 3 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose a Participant of this War Week." });
      const [row] = await f.attemptRows(f.ids.bowl);
      expect(row.loggedByParticipantId).toBeNull();
    });
  });

  it("in team scoring credits the Participant's Team at logging, and a later Team change doesn't move it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const f = await fixture(tx);

      expect(
        await logAttempt(
          f.ids.stairs,
          { participantId: f.ids.neo, score: 4 },
          f.ctx(NEO),
          tx,
        ),
      ).toMatchObject({ ok: true });
      await tx
        .update(f.schema.participant)
        .set({ teamId: f.ids.blue })
        .where(eq(f.schema.participant.id, f.ids.neo));
      const [row] = await f.attemptRows(f.ids.stairs);
      expect(row.teamId).toBe(f.ids.red);

      // Dozer is on no Team: neither he nor a Host can log one for him.
      expect(
        await logAttempt(
          f.ids.stairs,
          { participantId: f.ids.dozer, score: 4 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "That Participant isn't on a Team, so the Attempt can't count for one.",
      });
    });
  });

  it("refuses everyone, an Organizer included, once the Competition is closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt, updateAttempt, deleteAttempt } = await load();
      const f = await fixture(tx);
      const logged = await logAttempt(
        f.ids.bowl,
        { participantId: f.ids.neo, score: 9 },
        f.ctx(NEO),
        tx,
      );
      if (!logged.ok) throw new Error(logged.error);
      await f.setCompetition(f.ids.bowl, { closedAt: new Date() });

      for (const email of [NEO, HOST, ORGANIZER]) {
        expect(
          await logAttempt(
            f.ids.bowl,
            { participantId: f.ids.neo, score: 1 },
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await updateAttempt(
            f.ids.bowl,
            logged.resultId,
            { participantId: f.ids.neo, score: 1 },
            f.ctx(email),
            tx,
          ),
        ).toEqual({ ok: false, error: CLOSED });
        expect(
          await deleteAttempt(f.ids.bowl, logged.resultId, f.ctx(email), tx),
        ).toEqual({ ok: false, error: CLOSED });
      }
    });
  });

  it("refuses a Head-to-head", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const f = await fixture(tx);
      expect(
        await logAttempt(
          f.ids.pong,
          { participantId: f.ids.neo, score: 1 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Competition isn't run as Best score.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("updateAttempt and deleteAttempt", () => {
  it("lets the logger change and delete their Attempt, and nobody else but a Host", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt, updateAttempt, deleteAttempt } = await load();
      const f = await fixture(tx);
      const logged = await logAttempt(
        f.ids.bowl,
        { participantId: f.ids.neo, score: 9 },
        f.ctx(NEO),
        tx,
      );
      if (!logged.ok) throw new Error(logged.error);

      expect(
        await updateAttempt(
          f.ids.bowl,
          logged.resultId,
          { participantId: f.ids.neo, score: 11 },
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: true });
      expect((await f.attemptRows(f.ids.bowl))[0].score).toBe(11);
      expect(
        await updateAttempt(
          f.ids.bowl,
          logged.resultId,
          { participantId: f.ids.neo, score: 12 },
          f.ctx(TRINITY),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "Only the player who logged this Attempt can change it. Ask the Host.",
      });
      expect(
        await updateAttempt(
          f.ids.bowl,
          logged.resultId,
          { participantId: f.ids.trinity, score: 12 },
          f.ctx(NEO),
          tx,
        ),
      ).toEqual({ ok: false, error: NOT_YOURS });
      expect(
        await updateAttempt(
          f.ids.bowl,
          logged.resultId,
          { participantId: f.ids.trinity, score: 12 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect((await f.attemptRows(f.ids.bowl))[0]).toMatchObject({
        participantId: f.ids.trinity,
        teamId: f.ids.blue,
        score: 12,
      });
      expect(
        await deleteAttempt(f.ids.bowl, logged.resultId, f.ctx(ORGANIZER), tx),
      ).toEqual({ ok: true });
      expect(await f.attemptRows(f.ids.bowl)).toEqual([]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("Best score standings and Close", () => {
  it("Sum of members adds each member's best Attempt for their Team", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const { getLoggedResultsView } = await import("@/queries/logged-results");
      const f = await fixture(tx);
      // Red: Neo 5 then 3, Morpheus 4 → 9. Blue: Trinity 7 → 7.
      for (const [participantId, score] of [
        [f.ids.neo, 5],
        [f.ids.neo, 3],
        [f.ids.morpheus, 4],
        [f.ids.trinity, 7],
      ] as const) {
        expect(
          await logAttempt(
            f.ids.stairs,
            { participantId, score },
            f.ctx(HOST),
            tx,
          ),
        ).toMatchObject({ ok: true });
      }
      const view = await getLoggedResultsView(f.ids.stairs, NEO, tx);
      expect(
        view!.leaderboard.map((r) => [r.name, r.rank, r.total, r.played]),
      ).toEqual([
        ["Red", 1, 9, 3],
        ["Blue", 2, 7, 1],
      ]);
      // Every Participant can be picked, and each Attempt names its Team.
      expect(view!.playerOptions).toHaveLength(5);
      expect(new Set(view!.results.map((r) => r.creditedTo))).toEqual(
        new Set([f.ids.red, f.ids.blue]),
      );
      expect(JSON.stringify(view)).not.toContain("@");
    });
  });

  it("Close awards Placement Points from the best Attempts, ties sharing them, and Reopen withdraws only those", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { logAttempt } = await load();
      const {
        closeCompetition: closeLoggedResults,
        reopenCompetition: reopenLoggedResults,
      } = await import("@/mutations/close");
      const f = await fixture(tx);
      // Neo and Trinity tie at 42 pins; Morpheus is third with 30.
      for (const [participantId, score] of [
        [f.ids.neo, 30],
        [f.ids.neo, 42],
        [f.ids.trinity, 42],
        [f.ids.morpheus, 30],
      ] as const) {
        expect(
          await logAttempt(
            f.ids.bowl,
            { participantId, score },
            f.ctx(HOST),
            tx,
          ),
        ).toMatchObject({ ok: true });
      }
      await tx.insert(f.schema.pointsEntry).values({
        warWeekId: f.warWeekId,
        competitionId: f.ids.bowl,
        participantId: f.ids.cypher,
        points: 5,
        note: "Style points",
        enteredByEmail: HOST,
      });
      const entries = () =>
        tx
          .select({
            participantId: f.schema.pointsEntry.participantId,
            points: f.schema.pointsEntry.points,
            note: f.schema.pointsEntry.note,
            generated: f.schema.pointsEntry.generated,
          })
          .from(f.schema.pointsEntry)
          .where(eq(f.schema.pointsEntry.competitionId, f.ids.bowl));

      expect(await closeLoggedResults(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      const generated = (await entries())
        .filter((e) => e.generated)
        .map((e) => [e.participantId, e.points, e.note]);
      expect(generated).toEqual(
        expect.arrayContaining([
          [f.ids.neo, 10, "From best score"],
          [f.ids.trinity, 10, "From best score"],
          [f.ids.morpheus, 3, "From best score"],
        ]),
      );
      expect(generated).toHaveLength(3);
      // Closing again rewrites the same entries and keeps the first time.
      expect(await closeLoggedResults(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });

      expect(await reopenLoggedResults(f.ids.bowl, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(await entries()).toEqual([
        {
          participantId: f.ids.cypher,
          points: 5,
          note: "Style points",
          generated: false,
        },
      ]);
    });
  });
});
