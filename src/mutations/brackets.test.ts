import { and, eq } from "drizzle-orm";
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

class Rollback extends Error {}

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

/**
 * The fixture plus an individual Competition, "Relay Heats", with eight
 * Participants and Placement Points 5 · 3 · 1, still single elimination.
 */
async function heatsFixture(tx: DBTx) {
  const f = await fixture(tx);
  const { schema } = f;
  const runners = await tx
    .insert(schema.participant)
    .values(
      ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"].map((displayName) => ({
        warWeekId: f.ctx.warWeekId,
        displayName,
      })),
    )
    .returning({ id: schema.participant.id });
  const [relay] = await tx
    .insert(schema.competition)
    .values({
      warWeekId: f.ctx.warWeekId,
      name: "Relay Heats",
      scoring: "individual",
      format: "single-elimination",
      placementPoints: [5, 3, 1],
    })
    .returning({ id: schema.competition.id });
  return { ...f, relayId: relay.id, runners: runners.map((r) => r.id) };
}

const fourTwo = { entrantsPerHeat: 4, advancePerHeat: 2 };

/** Relay Heats set to 4 per Heat, 2 advancing, entered and generated. */
async function generatedHeats(tx: DBTx) {
  const { mutations } = await modules();
  const f = await heatsFixture(tx);
  expect(
    await mutations.setCompetitionFormat(
      f.relayId,
      { format: "heats", config: fourTwo },
      f.ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  expect(
    await mutations.replaceEntrants(
      f.relayId,
      { targetIds: f.runners },
      f.ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  expect(
    await mutations.generateBracket(f.relayId, { rng: rngZero }, f.ctx, tx),
  ).toEqual({ ok: true });
  return f;
}

/** A Competition's saved `bracket_config`. */
async function savedConfig(
  tx: DBTx,
  f: Awaited<ReturnType<typeof fixture>>,
  competitionId: string,
) {
  const [row] = await tx
    .select({ bracketConfig: f.schema.competition.bracketConfig })
    .from(f.schema.competition)
    .where(eq(f.schema.competition.id, competitionId));
  return row.bracketConfig;
}

describe.skipIf(!isLocalDatabase)("brackets", () => {
  it("enters Teams, generates a randomly seeded Bracket and shows it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { targetIds: [f.red, f.blue, f.green, f.gold] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
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
        { targetIds: [f.neo, f.trinity] },
        f.ctx,
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
          { targetIds: [f.red, f.neo] },
          f.ctx,
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
          { targetIds: [f.red, f.outsider] },
          f.ctx,
          tx,
        ),
      ).toMatchObject({ ok: false });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { targetIds: [f.red] },
          f.otherCtx,
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
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        { rng: rngZero },
        f.ctx,
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
      // The later Heat's Entrants and recorded result are untouched.
      expect(heatAt(view, 2, 1).labels).toEqual(["Red", "Gold"]);
      expect(heatAt(view, 2, 1).heat.slots.map((s) => s.place)).toEqual([2, 1]);

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
        { targetIds: [f.red, f.blue, f.green] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        { rng: rngZero },
        f.ctx,
        tx,
      );
      // Regenerating before any Heat Result needs no force (byes don't count).
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
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
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { targetIds: [f.red, f.blue] },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);

      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero, force: true },
          f.ctx,
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
          { targetIds: [f.red, f.blue], force: true },
          f.ctx,
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
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        { rng: rngZero },
        f.ctx,
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
          { force: true },
          f.ctx,
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

  it("refuses to change Placement Points while the Bracket is finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const setup = await import("@/mutations/setup");
      const f = await fixture(tx);
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(
        f.competitionId,
        { rng: rngZero },
        f.ctx,
        tx,
      );
      const bracket = (await queries.getBracket(f.competitionId, tx))!;
      const only = bracket.bracket.heats[0];
      await mutations.recordHeatResult(
        f.competitionId,
        only.id,
        { order: only.slots.map((s) => s.entrantId!) },
        f.ctx,
        tx,
      );
      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });

      const values: Parameters<typeof setup.updateCompetition>[1] = {
        name: "Captain Clash",
        description: null,
        scoring: "team",
        maxPoints: null,
        placementPoints: [10, 5, 1],
        countsTowardTeam: false,
        competitionGroup: null,
      };
      expect(
        await setup.updateCompetition(f.competitionId, values, f.ctx, tx),
      ).toEqual({
        ok: false,
        error:
          "This Competition's Bracket is finalized. Un-finalize the Bracket first.",
      });
      const [row] = await tx
        .select({ placementPoints: f.schema.competition.placementPoints })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.competitionId));
      expect(row.placementPoints).toEqual([10, 6, 3]);
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
          { targetIds: [f.red, f.blue] },
          f.ctx,
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
        { targetIds: [f.red, f.blue] },
        f.ctx,
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

  it("runs a heats Bracket from Generate to generated Points Entries", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);
      const { schema } = f;

      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
      const rows = await tx
        .select({
          round: schema.heat.round,
          slotCount: schema.heat.slotCount,
          winnerToHeatId: schema.heat.winnerToHeatId,
        })
        .from(schema.heat)
        .where(eq(schema.heat.competitionId, f.relayId))
        .orderBy(schema.heat.round, schema.heat.position);
      // Two Heats of four, then a final of the four who advance.
      expect(rows).toEqual([
        { round: 1, slotCount: 4, winnerToHeatId: null },
        { round: 1, slotCount: 4, winnerToHeatId: null },
        { round: 2, slotCount: 4, winnerToHeatId: null },
      ]);

      let view = (await queries.getBracket(f.relayId, tx))!;
      const first = heatAt(view, 1, 1).heat;
      const second = heatAt(view, 1, 2).heat;
      const final = heatAt(view, 2, 1).heat;
      const [a0, a1, a2, a3] = first.slots.map((s) => s.entrantId!);
      const [b0, b1, b2, b3] = second.slots.map((s) => s.entrantId!);
      expect(final.slots.every((s) => s.entrantId === null)).toBe(true);

      expect(
        await mutations.recordHeatResult(
          f.relayId,
          first.id,
          { order: [a0, a1, a2, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      // The forfeiter, listed first, finishes last.
      expect(
        await mutations.recordHeatResult(
          f.relayId,
          second.id,
          { order: [b0, b1, b2, b3], forfeits: [b0] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });

      view = (await queries.getBracket(f.relayId, tx))!;
      const played = heatAt(view, 1, 2).heat;
      expect(played.status).toBe("forfeit");
      expect(
        played.slots.map((s) => [s.entrantId, s.place, s.forfeited]),
      ).toEqual([
        [b0, 4, true],
        [b1, 1, false],
        [b2, 2, false],
        [b3, 3, false],
      ]);
      const filled = heatAt(view, 2, 1).heat;
      expect(filled.status).toBe("ready");
      expect(filled.slots.map((s) => s.entrantId).sort()).toEqual(
        [a0, a1, b1, b2].sort(),
      );
      expect(view.champion).toBeNull();

      expect(
        await mutations.recordHeatResult(
          f.relayId,
          final.id,
          { order: [a1, b1, a0, b2] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.champion).toBe(a1);

      expect(await mutations.finalizeBracket(f.relayId, f.ctx, tx)).toEqual({
        ok: true,
      });
      const entrants = await tx
        .select({
          id: schema.entrant.id,
          participantId: schema.entrant.participantId,
        })
        .from(schema.entrant)
        .where(eq(schema.entrant.competitionId, f.relayId));
      const participantOf = (id: string) =>
        entrants.find((e) => e.id === id)!.participantId;
      const generated = await tx
        .select({
          participantId: schema.pointsEntry.participantId,
          points: schema.pointsEntry.points,
          note: schema.pointsEntry.note,
        })
        .from(schema.pointsEntry)
        .where(
          and(
            eq(schema.pointsEntry.competitionId, f.relayId),
            eq(schema.pointsEntry.generatedByBracket, true),
          ),
        );
      expect(generated.sort((x, y) => y.points - x.points)).toEqual([
        { participantId: participantOf(a1), points: 5, note: "From bracket" },
        { participantId: participantOf(b1), points: 3, note: "From bracket" },
        { participantId: participantOf(a0), points: 1, note: "From bracket" },
      ]);

      // A finalized Bracket's Format and config can't change.
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          {
            format: "heats",
            config: { entrantsPerHeat: 4, advancePerHeat: 1 },
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Un-finalize the Bracket before changing it.",
      });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
    });
  });

  it("empties a decided heats final when a re-recorded Heat changes who advances", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);
      let view = (await queries.getBracket(f.relayId, tx))!;
      const first = heatAt(view, 1, 1).heat;
      const second = heatAt(view, 1, 2).heat;
      const final = heatAt(view, 2, 1).heat;
      const [a0, a1, a2, a3] = first.slots.map((s) => s.entrantId!);
      const [b0, b1, b2, b3] = second.slots.map((s) => s.entrantId!);
      await mutations.recordHeatResult(
        f.relayId,
        first.id,
        { order: [a0, a1, a2, a3] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.relayId,
        second.id,
        { order: [b0, b1, b2, b3] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.relayId,
        final.id,
        { order: [a0, b0, a1, b1] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.champion).toBe(a0);

      // a2 now advances in place of a0.
      expect(
        await mutations.recordHeatResult(
          f.relayId,
          first.id,
          { order: [a2, a1, a0, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [final.id] });
      view = (await queries.getBracket(f.relayId, tx))!;
      const after = heatAt(view, 2, 1).heat;
      expect(after.slots.every((s) => s.place === null)).toBe(true);
      expect(after.slots.map((s) => s.entrantId)).not.toContain(a0);
      expect(after.status).not.toBe("played");
      expect(view.champion).toBeNull();
    });
  });

  it("refuses to generate Heats that would never end", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      await mutations.setCompetitionFormat(
        f.competitionId,
        { format: "heats", config: { entrantsPerHeat: 3, advancePerHeat: 2 } },
        f.ctx,
        tx,
      );
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "With 4 Entrants, 3 per Heat and 2 advancing, Round 1 would never end. Lower how many advance.",
      });
      expect(
        (await queries.getBracket(f.competitionId, tx))!.bracket.heats,
      ).toEqual([]);
    });
  });

  it("saves a heats config, and a different one clears the Heats (with force once there are results)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);

      // Omitting the config keeps the saved one.
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "heats" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);

      let view = (await queries.getBracket(f.relayId, tx))!;
      const first = heatAt(view, 1, 1).heat;
      await mutations.recordHeatResult(
        f.relayId,
        first.id,
        { order: first.slots.map((s) => s.entrantId!) },
        f.ctx,
        tx,
      );

      const fourOne = { entrantsPerHeat: 4, advancePerHeat: 1 };
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "heats", config: fourOne },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Bracket has Heat Results. Confirm to clear them and start over.",
      });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
      expect(
        (await queries.getBracket(f.relayId, tx))!.bracket.heats,
      ).toHaveLength(3);

      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "heats", config: fourOne, force: true },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourOne);
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.bracket.heats).toEqual([]);
      expect(view.bracket.config).toEqual(fourOne);
      expect(view.entrants).toHaveLength(8);

      // Back to single elimination once the Entrants are gone: no config.
      await mutations.replaceEntrants(f.relayId, { targetIds: [] }, f.ctx, tx);
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "single-elimination" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.relayId)).toBeNull();
    });
  });

  it("refuses deleting a Team or Participant that is an Entrant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const setup = await import("@/mutations/setup");
      const f = await fixture(tx);
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.gold, f.green] },
        f.ctx,
        tx,
      );
      await mutations.replaceEntrants(
        f.chessId,
        { targetIds: [f.trinity] },
        f.ctx,
        tx,
      );

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

  it("refuses a Heat slot below 0, or a place below 1", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await fixture(tx);
      const { heat, heatEntrant, entrant } = f.schema;
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue] },
        f.ctx,
        tx,
      );
      const [red, blue] = await tx
        .select({ id: entrant.id })
        .from(entrant)
        .where(eq(entrant.competitionId, f.competitionId))
        .orderBy(entrant.seedPosition);
      const [final] = await tx
        .insert(heat)
        .values({ competitionId: f.competitionId, round: 1, position: 1 })
        .returning({ id: heat.id });

      /** The Postgres error code an insert fails with, or null. */
      const insertError = async (
        row: Omit<typeof heatEntrant.$inferInsert, "heatId">,
      ) =>
        tx
          .transaction(async (savepoint) => {
            await savepoint
              .insert(heatEntrant)
              .values({ heatId: final.id, ...row });
            throw new Rollback();
          })
          .then(
            () => null,
            (error: { code?: string; cause?: { code?: string } }) =>
              error instanceof Rollback
                ? null
                : (error.cause?.code ?? error.code ?? "unknown"),
          );

      // 23514 is Postgres's check_violation.
      // A Heat may hold more than two Entrants (the heats Format).
      expect(await insertError({ entrantId: red.id, slot: 2 })).toBeNull();
      expect(await insertError({ entrantId: red.id, slot: -1 })).toBe("23514");
      expect(await insertError({ entrantId: red.id, slot: 0, place: 0 })).toBe(
        "23514",
      );
      expect(
        await insertError({ entrantId: blue.id, slot: 1, place: 1 }),
      ).toBeNull();
      expect(
        await insertError({ entrantId: blue.id, slot: 0, place: null }),
      ).toBeNull();
    });
  });
});
