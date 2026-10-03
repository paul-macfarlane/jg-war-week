import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const HOST = "placement-test-host@jahnelgroup.com";
const REOPEN_FIRST = "Reopen the Competition first.";
const NOT_PLACEMENT = "This Competition isn't run as Placement.";

/**
 * A War Week (Team Label "House") with Red (Neo, Morpheus), Blue
 * (Trinity), Green (Tank) and Cypher on no House; a second War Week with
 * Smith and its House Grey; and three Competitions: Darts (individual
 * Placement, counts toward the House, 10 / 6 / 3, higher wins), Quiz (team
 * Placement, 5 / 3 / 1) and Pong (Head-to-head).
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `plt${n}`,
        editionNumber: 9600 + n,
        year: 9600 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Placement test",
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
    return row.id;
  };
  const warWeekId = await warWeek(1);
  const otherWarWeekId = await warWeek(2);
  const [red, blue, green] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
      { warWeekId, name: "Green", color: "#0f0" },
    ])
    .returning({ id: schema.team.id });
  const [grey] = await tx
    .insert(schema.team)
    .values({ warWeekId: otherWarWeekId, name: "Grey", color: "#888" })
    .returning({ id: schema.team.id });
  const [neo, trinity, morpheus, tank, cypher] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", teamId: red.id },
      { warWeekId, displayName: "Trinity", teamId: blue.id },
      { warWeekId, displayName: "Morpheus", teamId: red.id },
      { warWeekId, displayName: "Tank", teamId: green.id },
      { warWeekId, displayName: "Cypher" },
    ])
    .returning({ id: schema.participant.id });
  const [smith] = await tx
    .insert(schema.participant)
    .values({ warWeekId: otherWarWeekId, displayName: "Smith" })
    .returning({ id: schema.participant.id });
  const [darts, quiz, pong] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Darts",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "placement" as const,
        scoreDirection: "higher" as const,
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Quiz",
        scoring: "team" as const,
        format: "placement" as const,
        placementPoints: [5, 3, 1],
      },
      {
        warWeekId,
        name: "Pong",
        scoring: "individual" as const,
        format: "head-to-head" as const,
        entrantsOpen: true,
      },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.competitionHost).values(
    [darts.id, quiz.id].map((competitionId) => ({
      competitionId,
      email: HOST,
    })),
  );

  const rows = async (competitionId: string) =>
    (
      await tx
        .select({
          id: schema.placement.id,
          teamId: schema.placement.teamId,
          participantId: schema.placement.participantId,
          place: schema.placement.place,
          score: schema.placement.score,
        })
        .from(schema.placement)
        .where(eq(schema.placement.competitionId, competitionId))
    ).sort((a, b) =>
      String(a.participantId ?? a.teamId).localeCompare(
        String(b.participantId ?? b.teamId),
      ),
    );
  const entries = async (competitionId: string) =>
    (
      await tx
        .select({
          warWeekId: schema.pointsEntry.warWeekId,
          teamId: schema.pointsEntry.teamId,
          participantId: schema.pointsEntry.participantId,
          points: schema.pointsEntry.points,
          note: schema.pointsEntry.note,
          generated: schema.pointsEntry.generatedByBracket,
          enteredByEmail: schema.pointsEntry.enteredByEmail,
        })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, competitionId))
    ).sort(
      (a, b) =>
        b.points - a.points ||
        String(a.teamId ?? a.participantId).localeCompare(
          String(b.teamId ?? b.participantId),
        ),
    );
  const competitionRow = async (id: string) =>
    (
      await tx
        .select({
          format: schema.competition.format,
          scoreDirection: schema.competition.scoreDirection,
          finalizedAt: schema.competition.finalizedAt,
        })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0];
  const rowOf = async (competitionId: string, participantId: string) =>
    (
      await tx
        .select({ id: schema.placement.id })
        .from(schema.placement)
        .where(
          and(
            eq(schema.placement.competitionId, competitionId),
            eq(schema.placement.participantId, participantId),
          ),
        )
    )[0].id;

  return {
    schema,
    warWeekId,
    ctx: { warWeekId, actorEmail: HOST },
    ids: {
      red: red.id,
      blue: blue.id,
      green: green.id,
      grey: grey.id,
      neo: neo.id,
      trinity: trinity.id,
      morpheus: morpheus.id,
      tank: tank.id,
      cypher: cypher.id,
      smith: smith.id,
      darts: darts.id,
      quiz: quiz.id,
      pong: pong.id,
    },
    rows,
    entries,
    competitionRow,
    rowOf,
  };
}

async function load() {
  return import("@/mutations/placements");
}

const participantOf = (id: string) => ({ participantId: id });
const teamOf = (id: string) => ({ teamId: id });

describe.skipIf(!isLocalDatabase)("Placement rows", () => {
  it("adds a Participant once, and Add everyone adds the rest of the roster", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement, addEveryone } = await load();
      const f = await fixture(tx);
      expect(
        await addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx),
      ).toEqual({ ok: true });
      // Adding someone already on the sheet changes nothing.
      expect(
        await addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.rows(f.ids.darts)).toHaveLength(1);

      expect(await addEveryone(f.ids.darts, f.ctx, tx)).toEqual({ ok: true });
      const people = (await f.rows(f.ids.darts)).map((r) => r.participantId);
      expect(people.sort()).toEqual(
        [
          f.ids.neo,
          f.ids.trinity,
          f.ids.morpheus,
          f.ids.tank,
          f.ids.cypher,
        ].sort(),
      );
      // Never another War Week's Smith.
      expect(people).not.toContain(f.ids.smith);
    });
  });

  it("Add everyone in a team Competition adds every Team of the War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addEveryone } = await load();
      const f = await fixture(tx);
      expect(await addEveryone(f.ids.quiz, f.ctx, tx)).toEqual({ ok: true });
      expect((await f.rows(f.ids.quiz)).map((r) => r.teamId).sort()).toEqual(
        [f.ids.red, f.ids.blue, f.ids.green].sort(),
      );
    });
  });

  it("refuses another War Week's Participant or Team, a Team in an individual Competition and a Participant in a team one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement } = await load();
      const f = await fixture(tx);
      expect(
        await addPlacement(f.ids.darts, participantOf(f.ids.smith), f.ctx, tx),
      ).toEqual({ ok: false, error: "That Participant no longer exists." });
      expect(
        await addPlacement(f.ids.quiz, teamOf(f.ids.grey), f.ctx, tx),
      ).toEqual({ ok: false, error: "That Team no longer exists." });
      expect(
        await addPlacement(f.ids.darts, teamOf(f.ids.red), f.ctx, tx),
      ).toEqual({
        ok: false,
        error: "An individual Competition takes Participants, not Teams.",
      });
      expect(
        await addPlacement(f.ids.quiz, participantOf(f.ids.neo), f.ctx, tx),
      ).toEqual({
        ok: false,
        error: "A team Competition takes Teams, not Participants.",
      });
      expect(await f.rows(f.ids.darts)).toEqual([]);
      expect(await f.rows(f.ids.quiz)).toEqual([]);
    });
  });

  it("saves Places, Scores and the Score direction; removes a row", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement, savePlacements, removePlacement } = await load();
      const f = await fixture(tx);
      await addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx);
      await addPlacement(f.ids.darts, participantOf(f.ids.tank), f.ctx, tx);
      const neo = await f.rowOf(f.ids.darts, f.ids.neo);
      const tank = await f.rowOf(f.ids.darts, f.ids.tank);
      expect(
        await savePlacements(
          f.ids.darts,
          {
            scoreDirection: "lower",
            rows: [
              { id: neo, place: 1, score: 12.5 },
              { id: tank, place: null, score: 40 },
            ],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.rows(f.ids.darts)).toEqual(
        [
          {
            id: neo,
            teamId: null,
            participantId: f.ids.neo,
            place: 1,
            score: 12.5,
          },
          {
            id: tank,
            teamId: null,
            participantId: f.ids.tank,
            place: null,
            score: 40,
          },
        ].sort((a, b) => a.participantId.localeCompare(b.participantId)),
      );
      expect((await f.competitionRow(f.ids.darts)).scoreDirection).toBe(
        "lower",
      );

      expect(await removePlacement(f.ids.darts, tank, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect((await f.rows(f.ids.darts)).map((r) => r.id)).toEqual([neo]);
    });
  });

  it("refuses a row of another Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement, savePlacements, removePlacement } = await load();
      const f = await fixture(tx);
      await addPlacement(f.ids.quiz, teamOf(f.ids.red), f.ctx, tx);
      const [red] = await f.rows(f.ids.quiz);
      const missing = {
        ok: false,
        error: "That Placement no longer exists.",
      };
      expect(
        await savePlacements(
          f.ids.darts,
          {
            scoreDirection: "none",
            rows: [{ id: red.id, place: 1, score: 1 }],
          },
          f.ctx,
          tx,
        ),
      ).toEqual(missing);
      expect(await removePlacement(f.ids.darts, red.id, f.ctx, tx)).toEqual(
        missing,
      );
      expect(await f.rows(f.ids.quiz)).toEqual([
        { ...red, place: null, score: null },
      ]);
    });
  });

  it("refuses every placement write on a Competition not run as Placement", async () => {
    await inRolledBackTransaction(async (tx) => {
      const m = await load();
      const f = await fixture(tx);
      const refused = { ok: false, error: NOT_PLACEMENT };
      expect(
        await m.addPlacement(f.ids.pong, participantOf(f.ids.neo), f.ctx, tx),
      ).toEqual(refused);
      expect(await m.addEveryone(f.ids.pong, f.ctx, tx)).toEqual(refused);
      expect(
        await m.savePlacements(
          f.ids.pong,
          { scoreDirection: "higher", rows: [] },
          f.ctx,
          tx,
        ),
      ).toEqual(refused);
      expect(await m.finalizePlacements(f.ids.pong, f.ctx, tx)).toEqual(
        refused,
      );
      expect(await m.reopenPlacements(f.ids.pong, f.ctx, tx)).toEqual(refused);
      expect(await f.rows(f.ids.pong)).toEqual([]);
      expect((await f.competitionRow(f.ids.pong)).scoreDirection).toBe("none");
    });
  });

  it("refuses a Competition of another War Week than the request's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addEveryone } = await load();
      const f = await fixture(tx);
      const elsewhere = { warWeekId: crypto.randomUUID(), actorEmail: HOST };
      expect(await addEveryone(f.ids.darts, elsewhere, tx)).toEqual({
        ok: false,
        error: "That Competition no longer exists.",
      });
      expect(await f.rows(f.ids.darts)).toEqual([]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("Finalize and Reopen", () => {
  /** Darts with Neo 1st, Morpheus 1st (a tie), Trinity 3rd, Tank 4th (beyond the list) and Cypher unplaced. */
  async function placed(tx: DBTx) {
    const m = await load();
    const f = await fixture(tx);
    await m.addEveryone(f.ids.darts, f.ctx, tx);
    const id = (p: string) => f.rowOf(f.ids.darts, p);
    await m.savePlacements(
      f.ids.darts,
      {
        scoreDirection: "higher",
        rows: [
          { id: await id(f.ids.neo), place: 1, score: 30 },
          { id: await id(f.ids.morpheus), place: 1, score: 30 },
          { id: await id(f.ids.trinity), place: 3, score: 20 },
          { id: await id(f.ids.tank), place: 4, score: 10 },
          { id: await id(f.ids.cypher), place: null, score: null },
        ],
      },
      f.ctx,
      tx,
    );
    return { m, f };
  }

  it("writes generated Points Entries by Place: ties share the full points, beyond the list and unplaced earn nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { m, f } = await placed(tx);
      expect(await m.finalizePlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      const entry = (participantId: string, points: number) => ({
        warWeekId: f.warWeekId,
        teamId: null,
        participantId,
        points,
        note: "From placement",
        generated: true,
        enteredByEmail: HOST,
      });
      expect(await f.entries(f.ids.darts)).toEqual(
        [
          entry(f.ids.neo, 10),
          entry(f.ids.morpheus, 10),
          entry(f.ids.trinity, 3),
        ].sort(
          (a, b) =>
            b.points - a.points ||
            a.participantId.localeCompare(b.participantId),
        ),
      );
      expect((await f.competitionRow(f.ids.darts)).finalizedAt).not.toBeNull();
    });
  });

  it("a team Competition's entries go to its Teams", async () => {
    await inRolledBackTransaction(async (tx) => {
      const m = await load();
      const f = await fixture(tx);
      await m.addEveryone(f.ids.quiz, f.ctx, tx);
      const rows = await f.rows(f.ids.quiz);
      const rowFor = (teamId: string) =>
        rows.find((r) => r.teamId === teamId)!.id;
      await m.savePlacements(
        f.ids.quiz,
        {
          scoreDirection: "none",
          rows: [
            { id: rowFor(f.ids.blue), place: 1, score: null },
            { id: rowFor(f.ids.red), place: 2, score: null },
          ],
        },
        f.ctx,
        tx,
      );
      expect(await m.finalizePlacements(f.ids.quiz, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(
        (await f.entries(f.ids.quiz)).map(
          ({ teamId, participantId, points }) => ({
            teamId,
            participantId,
            points,
          }),
        ),
      ).toEqual([
        { teamId: f.ids.blue, participantId: null, points: 5 },
        { teamId: f.ids.red, participantId: null, points: 3 },
      ]);
    });
  });

  it("refuses a Score without a Place, naming the rows, and writes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { m, f } = await placed(tx);
      await m.savePlacements(
        f.ids.darts,
        {
          scoreDirection: "higher",
          rows: [
            {
              id: await f.rowOf(f.ids.darts, f.ids.cypher),
              place: null,
              score: 5,
            },
          ],
        },
        f.ctx,
        tx,
      );
      expect(await m.finalizePlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: false,
        error:
          "Give every row with a Score a Place, or clear its Score. No Place: Cypher.",
      });
      expect(await f.entries(f.ids.darts)).toEqual([]);
      expect((await f.competitionRow(f.ids.darts)).finalizedAt).toBeNull();
    });
  });

  it("refuses every row change while Finalized; Reopen withdraws the generated entries and keeps a non-generated one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { m, f } = await placed(tx);
      await tx.insert(f.schema.pointsEntry).values({
        warWeekId: f.warWeekId,
        competitionId: f.ids.darts,
        participantId: f.ids.tank,
        points: 2,
        enteredByEmail: HOST,
      });
      await m.finalizePlacements(f.ids.darts, f.ctx, tx);
      const before = await f.rows(f.ids.darts);
      const neo = await f.rowOf(f.ids.darts, f.ids.neo);
      const refused = { ok: false, error: REOPEN_FIRST };
      expect(
        await m.savePlacements(
          f.ids.darts,
          { scoreDirection: "lower", rows: [{ id: neo, place: 2, score: 1 }] },
          f.ctx,
          tx,
        ),
      ).toEqual(refused);
      expect(await m.removePlacement(f.ids.darts, neo, f.ctx, tx)).toEqual(
        refused,
      );
      await tx.delete(f.schema.placement).where(eq(f.schema.placement.id, neo));
      expect(
        await m.addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx),
      ).toEqual(refused);
      expect(await m.addEveryone(f.ids.darts, f.ctx, tx)).toEqual(refused);
      expect(await f.rows(f.ids.darts)).toEqual(
        before.filter((r) => r.id !== neo),
      );
      expect((await f.competitionRow(f.ids.darts)).scoreDirection).toBe(
        "higher",
      );

      expect(await m.reopenPlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await f.entries(f.ids.darts)).toEqual([
        {
          warWeekId: f.warWeekId,
          teamId: null,
          participantId: f.ids.tank,
          points: 2,
          note: null,
          generated: false,
          enteredByEmail: HOST,
        },
      ]);
      expect((await f.competitionRow(f.ids.darts)).finalizedAt).toBeNull();
    });
  });

  it("Finalize twice writes the same entries and keeps the first time; Reopen twice is harmless", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { m, f } = await placed(tx);
      await m.finalizePlacements(f.ids.darts, f.ctx, tx);
      const entries = await f.entries(f.ids.darts);
      const at = (await f.competitionRow(f.ids.darts)).finalizedAt;
      expect(await m.finalizePlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await f.entries(f.ids.darts)).toEqual(entries);
      expect((await f.competitionRow(f.ids.darts)).finalizedAt).toEqual(at);

      expect(await m.reopenPlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await m.reopenPlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await f.entries(f.ids.darts)).toEqual([]);
      expect(await m.finalizePlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await f.entries(f.ids.darts)).toEqual(entries);
    });
  });
});

describe.skipIf(!isLocalDatabase)("a Placement Competition's setup", () => {
  it("refuses a Format or scoring change while Finalized, but takes a Placement Points change", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement, finalizePlacements, savePlacements } = await load();
      const { setCompetitionFormat } = await import("@/mutations/brackets");
      const { updateCompetition } = await import("@/mutations/setup");
      const f = await fixture(tx);
      await addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx);
      await savePlacements(
        f.ids.darts,
        {
          scoreDirection: "higher",
          rows: [
            {
              id: await f.rowOf(f.ids.darts, f.ids.neo),
              place: 1,
              score: null,
            },
          ],
        },
        f.ctx,
        tx,
      );
      expect(await finalizePlacements(f.ids.darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      const refused = {
        ok: false,
        error: "This Competition is finalized. Reopen it first.",
      };
      expect(
        await setCompetitionFormat(
          f.ids.darts,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Locked once the Competition has a result.",
      });
      const darts = {
        name: "Darts",
        description: null,
        scoring: "individual" as const,
        placementPoints: [10, 5],
        countsTowardTeam: true,
        competitionGroup: null,
      };
      expect(await updateCompetition(f.ids.darts, darts, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(
        await updateCompetition(
          f.ids.darts,
          { ...darts, scoring: "team", countsTowardTeam: false },
          f.ctx,
          tx,
        ),
      ).toEqual(refused);
      const [after] = await tx
        .select({
          format: f.schema.competition.format,
          scoring: f.schema.competition.scoring,
          placementPoints: f.schema.competition.placementPoints,
        })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.ids.darts));
      expect(after).toEqual({
        format: "placement",
        scoring: "individual",
        placementPoints: [10, 5],
      });
    });
  });

  it("locks the Format while it has Placements; without them the Format changes and the Score direction resets", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { addPlacement, removePlacement } = await load();
      const { setCompetitionFormat } = await import("@/mutations/brackets");
      const { updateCompetition } = await import("@/mutations/setup");
      const f = await fixture(tx);
      await addPlacement(f.ids.darts, participantOf(f.ids.neo), f.ctx, tx);
      expect(
        await setCompetitionFormat(
          f.ids.darts,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Locked once the Competition has a result.",
      });
      const darts = {
        name: "Darts",
        description: null,
        scoring: "team" as const,
        placementPoints: [10, 6, 3],
        countsTowardTeam: false,
        competitionGroup: null,
      };
      expect(await updateCompetition(f.ids.darts, darts, f.ctx, tx)).toEqual({
        ok: false,
        error:
          "This Competition has 1 Placement. Remove them before changing its scoring.",
      });
      expect(await f.competitionRow(f.ids.darts)).toMatchObject({
        format: "placement",
        scoreDirection: "higher",
      });

      await removePlacement(
        f.ids.darts,
        await f.rowOf(f.ids.darts, f.ids.neo),
        f.ctx,
        tx,
      );
      expect(
        await setCompetitionFormat(
          f.ids.darts,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.competitionRow(f.ids.darts)).toMatchObject({
        format: "bracket",
        scoreDirection: "none",
      });
    });
  });
});
