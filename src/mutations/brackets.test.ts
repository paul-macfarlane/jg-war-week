import { and, eq } from "drizzle-orm";
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

const actorEmail = "organizer@jahnelgroup.com";

// Every draw 0 shuffles [a, b, c, d] to [b, c, d, a] (see seeding.test.ts).
const rngZero = () => 0;

/**
 * A War Week with four Teams, a team single-elimination Competition with
 * Placement Points 10 · 6 · 3, and an individual one; plus a Team of
 * another War Week.
 */
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
        storyTheme: "Bracket test",
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
    return row.id;
  };
  const warWeekId = await warWeek(1);
  const otherWarWeekId = await warWeek(2);
  const teams = await tx
    .insert(schema.team)
    .values(
      [
        ["Red", "#f00"],
        ["Blue", "#00f"],
        ["Green", "#0f0"],
        ["Gold", "#fc0"],
      ].map(([name, color]) => ({ warWeekId, name, color })),
    )
    .returning({ id: schema.team.id, name: schema.team.name });
  const [red, blue, green, gold] = teams.map((t) => t.id);
  const [outsider] = await tx
    .insert(schema.team)
    .values({ warWeekId: otherWarWeekId, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  const [neo, trinity] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", teamId: red },
      { warWeekId, displayName: "Trinity", teamId: blue },
    ])
    .returning({ id: schema.participant.id });
  const [captainClash, chess] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Captain Clash",
        scoring: "team",
        format: "single-elimination",
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Speed Chess",
        scoring: "individual",
        format: "single-elimination",
      },
    ])
    .returning({ id: schema.competition.id });
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    red,
    blue,
    green,
    gold,
    outsider: outsider.id,
    neo: neo.id,
    trinity: trinity.id,
    competitionId: captainClash.id,
    chessId: chess.id,
  };
}

async function modules() {
  return {
    mutations: await import("@/mutations/brackets"),
    queries: await import("@/queries/brackets"),
  };
}

/** The Heat at `round`/`position` and its Entrants' labels. */
function heatAt(
  view: NonNullable<
    Awaited<ReturnType<typeof import("@/queries/brackets").getBracket>>
  >,
  round: number,
  position: number,
) {
  const heat = view.bracket.heats.find(
    (h) => h.round === round && h.position === position,
  )!;
  const label = (id: string | null) =>
    view.entrants.find((e) => e.id === id)?.label ?? null;
  return { heat, labels: heat.slots.map((s) => label(s.entrantId)) };
}

describe.skipIf(!isLocalDatabase)("brackets", () => {
  it("enters Teams, generates a randomly seeded Bracket and shows it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.blue, f.green, f.gold],
          f.ctx,
          {},
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await mutations.generateBracket(
          f.competitionId,
          f.ctx,
          { rng: rngZero },
          tx,
        ),
      ).toEqual({ ok: true });

      const view = (await queries.getBracket(f.competitionId, tx))!;
      // [Red, Blue, Green, Gold] shuffled to Blue 1, Green 2, Gold 3, Red 4.
      expect(
        view.entrants.map((e) => [e.seedPosition, e.label, e.color]),
      ).toEqual([
        [1, "Blue", "#00f"],
        [2, "Green", "#0f0"],
        [3, "Gold", "#fc0"],
        [4, "Red", "#f00"],
      ]);
      expect(heatAt(view, 1, 1).labels).toEqual(["Blue", "Red"]);
      expect(heatAt(view, 1, 2).labels).toEqual(["Green", "Gold"]);
      expect(heatAt(view, 2, 1).heat.status).toBe("pending");
      expect(view.champion).toBeNull();
      expect(view.finalized).toBe(false);
    });
  });

  it("labels Participant Entrants with their Team color", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      await mutations.replaceEntrants(
        f.chessId,
        [f.neo, f.trinity],
        f.ctx,
        {},
        tx,
      );
      const view = (await queries.getBracket(f.chessId, tx))!;
      expect(view.entrants.map((e) => [e.label, e.color])).toEqual([
        ["Neo", "#f00"],
        ["Trinity", "#00f"],
      ]);
    });
  });

  it("refuses Entrants of the wrong kind or another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await fixture(tx);

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.neo],
          f.ctx,
          {},
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          '"Captain Clash" is a team Competition, so its Entrants must be Teams of this War Week.',
      });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.outsider],
          f.ctx,
          {},
          tx,
        ),
      ).toMatchObject({ ok: false });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red],
          f.otherCtx,
          {},
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
    });
  });

  it("records Heat Results, advances winners and resets later Heats on an edit", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      await mutations.replaceEntrants(
        f.competitionId,
        [f.red, f.blue, f.green, f.gold],
        f.ctx,
        {},
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        f.ctx,
        { rng: rngZero },
        tx,
      );
      let view = (await queries.getBracket(f.competitionId, tx))!;
      const id = (label: string) =>
        view.entrants.find((e) => e.label === label)!.id;
      const semi1 = heatAt(view, 1, 1).heat.id;
      const semi2 = heatAt(view, 1, 2).heat.id;
      const final = heatAt(view, 2, 1).heat.id;

      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")], scores: { [id("Red")]: "21" } },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      await mutations.recordHeatResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")], forfeits: [id("Green")] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 1, 1).heat.slots[1]).toMatchObject({
        place: 1,
        score: "21",
      });
      expect(heatAt(view, 1, 2).heat.status).toBe("forfeit");
      expect(heatAt(view, 2, 1).labels).toEqual(["Red", "Gold"]);
      expect(heatAt(view, 2, 1).heat.status).toBe("ready");

      await mutations.recordHeatResult(
        f.competitionId,
        final,
        { order: [id("Gold"), id("Red")] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.champion).toBe(id("Gold"));

      // A score-only edit keeps the final.
      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")], scores: { [id("Red")]: "25" } },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 1, 1).heat.slots[1]).toMatchObject({ score: "25" });
      expect(heatAt(view, 2, 1).heat.status).toBe("played");
      expect(view.champion).toBe(id("Gold"));

      // Changing the first Heat's winner sends the final back to pending.
      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [final] });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 2, 1).labels).toEqual(["Blue", "Gold"]);
      expect(heatAt(view, 2, 1).heat.status).toBe("ready");
      expect(view.champion).toBeNull();

      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Blue")] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Put every Entrant of this Heat in finishing order, once each.",
      });
    });
  });

  it("asks for force before clearing Heat Results by regenerating or replacing Entrants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      await mutations.replaceEntrants(
        f.competitionId,
        [f.red, f.blue, f.green],
        f.ctx,
        {},
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        f.ctx,
        { rng: rngZero },
        tx,
      );
      // Regenerating before any Heat Result needs no force (byes don't count).
      expect(
        await mutations.generateBracket(
          f.competitionId,
          f.ctx,
          { rng: rngZero },
          tx,
        ),
      ).toEqual({ ok: true });
      let view = (await queries.getBracket(f.competitionId, tx))!;
      const played = view.bracket.heats.find((h) => h.status === "ready")!;
      await mutations.recordHeatResult(
        f.competitionId,
        played.id,
        { order: played.slots.map((s) => s.entrantId!) },
        f.ctx,
        tx,
      );

      const refusal = {
        ok: false,
        error:
          "This Bracket has Heat Results. Confirm to clear them and start over.",
      };
      expect(
        await mutations.generateBracket(
          f.competitionId,
          f.ctx,
          { rng: rngZero },
          tx,
        ),
      ).toEqual(refusal);
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.blue],
          f.ctx,
          {},
          tx,
        ),
      ).toEqual(refusal);

      expect(
        await mutations.generateBracket(
          f.competitionId,
          f.ctx,
          { rng: rngZero, force: true },
          tx,
        ),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.bracket.heats.some((h) => h.status === "ready")).toBe(true);
      expect(
        view.bracket.heats.every(
          (h) => h.round === 1 || h.slots.some((s) => s.place === null),
        ),
      ).toBe(true);

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.blue],
          f.ctx,
          { force: true },
          tx,
        ),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.entrants.map((e) => e.label)).toEqual(["Red", "Blue"]);
      expect(view.bracket.heats).toEqual([]);
    });
  });

  it("finalizes into generated Points Entries, and un-finalizing removes only those", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const pointsEntries = await import("@/mutations/points-entries");
      const { getAdminLedger } = await import("@/queries/points-entries");
      const f = await fixture(tx);
      const { schema } = f;
      await tx.insert(schema.pointsEntry).values({
        competitionId: f.competitionId,
        teamId: f.red,
        points: 1,
        note: "Spirit bonus",
        enteredByEmail: actorEmail,
      });
      await mutations.replaceEntrants(
        f.competitionId,
        [f.red, f.blue, f.green, f.gold],
        f.ctx,
        {},
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        f.ctx,
        { rng: rngZero },
        tx,
      );
      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: false, error: "Finish every Heat before finalizing." });

      // Seeded Blue 1, Green 2, Gold 3, Red 4: Blue and Green win the
      // semifinals, Green wins the final.
      let view = (await queries.getBracket(f.competitionId, tx))!;
      const id = (label: string) =>
        view.entrants.find((e) => e.label === label)!.id;
      for (const [position, round, winner] of [
        [1, 1, "Blue"],
        [2, 1, "Green"],
        [1, 2, "Green"],
      ] as const) {
        view = (await queries.getBracket(f.competitionId, tx))!;
        const heat = heatAt(view, round, position).heat;
        const ids = heat.slots.map((s) => s.entrantId!);
        await mutations.recordHeatResult(
          f.competitionId,
          heat.id,
          {
            order: [id(winner), ...ids.filter((i) => i !== id(winner))],
          },
          f.ctx,
          tx,
        );
      }

      const generated = async () =>
        (
          await tx
            .select({
              teamId: schema.pointsEntry.teamId,
              points: schema.pointsEntry.points,
              note: schema.pointsEntry.note,
            })
            .from(schema.pointsEntry)
            .where(
              and(
                eq(schema.pointsEntry.competitionId, f.competitionId),
                eq(schema.pointsEntry.generatedByBracket, true),
              ),
            )
        ).sort(
          (a, b) => b.points - a.points || a.teamId!.localeCompare(b.teamId!),
        );
      const expected = [
        { teamId: f.green, points: 10, note: "From bracket" },
        { teamId: f.blue, points: 6, note: "From bracket" },
        ...[
          { teamId: f.gold, points: 3, note: "From bracket" },
          { teamId: f.red, points: 3, note: "From bracket" },
        ].sort((a, b) => a.teamId.localeCompare(b.teamId)),
      ];

      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual(expected);
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.finalized).toBe(true);
      expect(view.champion).toBe(id("Green"));

      // A finalized Bracket can't change until it's un-finalized.
      expect(
        await mutations.generateBracket(
          f.competitionId,
          f.ctx,
          { force: true },
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Un-finalize the Bracket before changing it.",
      });

      // Re-finalizing replaces the generated entries with the same ones.
      await mutations.finalizeBracket(f.competitionId, f.ctx, tx);
      expect(await generated()).toEqual(expected);

      // The ledger flags them, and they can't be edited or deleted there.
      const ledger = await getAdminLedger({ id: f.ctx.warWeekId }, tx);
      const fromBracket = ledger.filter((e) => e.generatedByBracket);
      expect(fromBracket).toHaveLength(4);
      expect(ledger.filter((e) => !e.generatedByBracket)).toHaveLength(1);
      const refusal = {
        ok: false,
        error: "This Points Entry comes from a bracket. Change it there.",
      };
      expect(
        await pointsEntries.deletePointsEntry(fromBracket[0].id, f.ctx, tx),
      ).toEqual(refusal);
      expect(
        await pointsEntries.updatePointsEntry(
          fromBracket[0].id,
          {
            competitionId: f.competitionId,
            targetId: f.red,
            points: 99,
            note: null,
          },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);

      expect(
        await mutations.unfinalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual([]);
      const remaining = await tx
        .select({ note: schema.pointsEntry.note })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, f.competitionId));
      expect(remaining).toEqual([{ note: "Spirit bonus" }]);
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.finalized).toBe(false);
    });
  });

  it("sets the Format and refuses to drop it while there are Entrants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "points" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        (await queries.getBracket(f.competitionId, tx))!.competition.format,
      ).toBe("points");
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          [f.red, f.blue],
          f.ctx,
          {},
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Competition isn't run as a Bracket.",
      });

      await mutations.setCompetitionFormat(
        f.competitionId,
        { format: "single-elimination" },
        f.ctx,
        tx,
      );
      await mutations.replaceEntrants(
        f.competitionId,
        [f.red, f.blue],
        f.ctx,
        {},
        tx,
      );
      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "points" },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition has 2 Entrants. Remove them before changing its Format.",
      });
    });
  });

  it("refuses deleting a Team or Participant that is an Entrant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const setup = await import("@/mutations/setup");
      const f = await fixture(tx);
      await mutations.replaceEntrants(
        f.competitionId,
        [f.gold, f.green],
        f.ctx,
        {},
        tx,
      );
      await mutations.replaceEntrants(f.chessId, [f.trinity], f.ctx, {}, tx);

      expect(await setup.deleteTeam(f.gold, f.ctx, tx)).toEqual({
        ok: false,
        error: "This Team has 1 Bracket Entrant. Move or delete them first.",
      });
      expect(await setup.deleteParticipant(f.trinity, f.ctx, tx)).toEqual({
        ok: false,
        error:
          "This Participant has 1 Bracket Entrant. Delete them or remove the Participant from them first.",
      });

      // Its Entrants are Participants, so Speed Chess can't become team.
      expect(
        await setup.updateCompetition(
          f.chessId,
          {
            name: "Speed Chess",
            description: null,
            scoring: "team",
            maxPoints: null,
            placementPoints: null,
            countsTowardTeam: false,
            competitionGroup: null,
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition has 1 Entrant. Remove them before changing its scoring.",
      });
    });
  });
});
