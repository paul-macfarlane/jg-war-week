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
        format: "bracket",
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Speed Chess",
        scoring: "individual",
        format: "bracket",
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
      name: "Relay Matches",
      scoring: "individual",
      format: "bracket",
      placementPoints: [5, 3, 1],
    })
    .returning({ id: schema.competition.id });
  return { ...f, relayId: relay.id, runners: runners.map((r) => r.id) };
}

const fourTwo = {
  entrantsPerHeat: 4,
  advancePerHeat: 2,
  thirdPlaceGame: false,
};

/** Relay Heats set to 4 per Heat, 2 advancing, entered and generated. */
async function generatedHeats(tx: DBTx) {
  const { mutations } = await modules();
  const f = await heatsFixture(tx);
  expect(
    await mutations.setCompetitionFormat(
      f.relayId,
      { format: "bracket", config: fourTwo },
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
      expect(view.winner).toBeNull();
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

  it("records Match Results, advances winners and resets later Matches on an edit", async () => {
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
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 1, 1).heat.slots[1]).toMatchObject({
        place: 1,
        score: "21",
      });
      expect(heatAt(view, 1, 2).heat.status).toBe("played");
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
      expect(view.winner).toBe(id("Gold"));

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
      expect(view.winner).toBe(id("Gold"));
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
      expect(view.winner).toBeNull();

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
        error: "Put every Entrant of this Match in finishing order, once each.",
      });
    });
  });

  it("locks regenerating and replacing Entrants once a Match has a result, clearing nothing", async () => {
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
      // Regenerating before any Heat Result is fine (byes don't count).
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

      const locked = { ok: false, error: "Locked once a Match has a result." };
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual(locked);
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { targetIds: [f.red, f.blue] },
          f.ctx,
          tx,
        ),
      ).toEqual(locked);
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.entrants.map((e) => e.label)).toHaveLength(3);
      expect(view.bracket.heats.find((h) => h.id === played.id)!.status).toBe(
        "played",
      );
    });
  });

  it("closes into generated Points Entries, and un-finalizing removes only those", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const { schema } = f;
      await tx.insert(schema.pointsEntry).values({
        warWeekId: f.ctx.warWeekId,
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
      ).toEqual({ ok: false, error: "Finish every Match before closing." });

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
      expect(view.winner).toBe(id("Green"));

      // A finalized Bracket can't change until it's un-finalized.
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Reopen the Bracket before changing it.",
      });

      // Re-finalizing replaces the generated entries with the same ones.
      await mutations.finalizeBracket(f.competitionId, f.ctx, tx);
      expect(await generated()).toEqual(expected);

      // The non-generated entry sits beside the four generated ones.
      const all = await tx
        .select({ generated: schema.pointsEntry.generatedByBracket })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, f.competitionId));
      expect(all.filter((e) => e.generated)).toHaveLength(4);
      expect(all.filter((e) => !e.generated)).toHaveLength(1);

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

  it("takes a Placement Points change while the Bracket is closed, applying it at the next Close", async () => {
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
        placementPoints: [10, 5, 1],
        countsTowardTeam: false,
        competitionGroup: null,
      };
      const generated = () =>
        tx
          .select({ points: f.schema.pointsEntry.points })
          .from(f.schema.pointsEntry)
          .where(eq(f.schema.pointsEntry.competitionId, f.competitionId))
          .then((rows) => rows.map((r) => r.points).sort((a, b) => b - a));
      expect(await generated()).toEqual([10, 6]);
      expect(
        await setup.updateCompetition(f.competitionId, values, f.ctx, tx),
      ).toEqual({ ok: true });
      const [row] = await tx
        .select({ placementPoints: f.schema.competition.placementPoints })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.competitionId));
      expect(row.placementPoints).toEqual([10, 5, 1]);
      expect(await generated()).toEqual([10, 6]);

      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual([10, 5]);
    });
  });

  it("sets the Format and locks it once there are Entrants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "placement" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        (await queries.getBracket(f.competitionId, tx))!.competition.format,
      ).toBe("placement");
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
        { format: "bracket" },
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
          { format: "placement" },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Locked once the Competition has a result.",
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
      // The Entrant listed last finishes last.
      expect(
        await mutations.recordHeatResult(
          f.relayId,
          second.id,
          { order: [b1, b2, b3, b0] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });

      view = (await queries.getBracket(f.relayId, tx))!;
      const played = heatAt(view, 1, 2).heat;
      expect(played.status).toBe("played");
      expect(played.slots.map((s) => [s.entrantId, s.place])).toEqual([
        [b0, 4],
        [b1, 1],
        [b2, 2],
        [b3, 3],
      ]);
      const filled = heatAt(view, 2, 1).heat;
      expect(filled.status).toBe("ready");
      expect(filled.slots.map((s) => s.entrantId).sort()).toEqual(
        [a0, a1, b1, b2].sort(),
      );
      expect(view.winner).toBeNull();

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
      expect(view.winner).toBe(a1);

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

      // A finalized Bracket's config can't change: it has Heat Results.
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          {
            format: "bracket",
            config: {
              entrantsPerHeat: 4,
              advancePerHeat: 1,
              thirdPlaceGame: false,
            },
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Locked once a Match has a result.",
      });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
    });
  });

  it("empties a decided matches final when a re-recorded Match changes who advances", async () => {
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
      expect(view.winner).toBe(a0);

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
      expect(view.winner).toBeNull();
    });
  });

  it("refuses to generate Matches that would never end", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      await mutations.setCompetitionFormat(
        f.competitionId,
        {
          format: "bracket",
          config: {
            entrantsPerHeat: 3,
            advancePerHeat: 2,
            thirdPlaceGame: false,
          },
        },
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
          "With 4 Entrants, 3 per Match and 2 advancing, Round 1 would never end. Lower how many advance.",
      });
      expect(
        (await queries.getBracket(f.competitionId, tx))!.bracket.heats,
      ).toEqual([]);
    });
  });

  it("saves a matches config, and a different one clears the Matches until a Match has a result, then locks it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);

      // Omitting the config keeps the saved one.
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);

      // No Heat Result yet: a different config clears the drawn Heats.
      const fourOne = {
        entrantsPerHeat: 4,
        advancePerHeat: 1,
        thirdPlaceGame: false,
      };
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "bracket", config: fourOne },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourOne);
      let view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.bracket.heats).toEqual([]);
      expect(view.entrants).toHaveLength(8);

      // Drawn again and a Heat played: the config is locked.
      await mutations.generateBracket(f.relayId, { rng: rngZero }, f.ctx, tx);
      view = (await queries.getBracket(f.relayId, tx))!;
      const first = heatAt(view, 1, 1).heat;
      await mutations.recordHeatResult(
        f.relayId,
        first.id,
        { order: first.slots.map((s) => s.entrantId!) },
        f.ctx,
        tx,
      );
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          { format: "bracket", config: fourTwo },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Locked once a Match has a result." });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourOne);
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(heatAt(view, 1, 1).heat.status).toBe("played");
    });
  });

  it("refuses to save Match settings that Generate would refuse, keeping the drawn Matches", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);

      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          {
            format: "bracket",
            config: {
              entrantsPerHeat: 3,
              advancePerHeat: 2,
              thirdPlaceGame: false,
            },
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "With 8 Entrants, 3 per Match and 2 advancing, Round 3 would never end. Lower how many advance.",
      });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
      expect(
        (await queries.getBracket(f.relayId, tx))!.bracket.heats,
      ).toHaveLength(3);
    });
  });

  it("runs a 3rd place Match: refused under 4 Entrants or off 2 / 1, locked once a Heat has a result, placed from the final", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const withGame = {
        entrantsPerHeat: 2,
        advancePerHeat: 1,
        thirdPlaceGame: true,
      };
      const setGame = (config: typeof withGame) =>
        mutations.setCompetitionFormat(
          f.competitionId,
          { format: "bracket", config },
          f.ctx,
          tx,
        );

      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue, f.green] },
        f.ctx,
        tx,
      );
      expect(await setGame(withGame)).toEqual({
        ok: false,
        error: "A 3rd place Match needs at least 4 Entrants.",
      });
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      expect(
        await setGame({ ...withGame, entrantsPerHeat: 4, advancePerHeat: 2 }),
      ).toEqual({
        ok: false,
        error: "A 3rd place Match is only for 2 per Match with 1 advancing.",
      });
      expect(await setGame(withGame)).toEqual({ ok: true });
      expect(await savedConfig(tx, f, f.competitionId)).toEqual(withGame);
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      // Seeded Blue 1, Green 2, Gold 3, Red 4: Blue v Red, Green v Gold.
      let view = (await queries.getBracket(f.competitionId, tx))!;
      const id = (label: string) =>
        view.entrants.find((e) => e.label === label)!.id;
      const third = heatAt(view, 2, 2).heat;
      expect(third.thirdPlace).toBe(true);
      expect(heatAt(view, 2, 1).heat.thirdPlace).toBe(false);
      expect(heatAt(view, 1, 1).heat.loserTo).toEqual({
        heatId: third.id,
        slot: 0,
      });
      expect(heatAt(view, 1, 2).heat.loserTo).toEqual({
        heatId: third.id,
        slot: 1,
      });

      const record = async (
        round: number,
        position: number,
        winner: string,
      ) => {
        view = (await queries.getBracket(f.competitionId, tx))!;
        const heat = heatAt(view, round, position).heat;
        const ids = heat.slots.map((s) => s.entrantId!);
        return mutations.recordHeatResult(
          f.competitionId,
          heat.id,
          { order: [id(winner), ...ids.filter((i) => i !== id(winner))] },
          f.ctx,
          tx,
        );
      };
      await record(1, 1, "Blue");
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 2, 2).labels).toEqual(["Red", null]);

      // Locked once a Heat Result exists.
      expect(await setGame({ ...withGame, thirdPlaceGame: false })).toEqual({
        ok: false,
        error: "Locked once a Match has a result.",
      });
      expect(await savedConfig(tx, f, f.competitionId)).toEqual(withGame);
      expect(
        (await queries.getBracket(f.competitionId, tx))!.bracket.heats,
      ).toHaveLength(4);

      await record(1, 2, "Green");
      await record(2, 1, "Green");
      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: false, error: "Finish every Match before closing." });
      expect((await queries.getBracket(f.competitionId, tx))!.winner).toBe(
        id("Green"),
      );
      await record(2, 2, "Gold");
      expect((await queries.getBracket(f.competitionId, tx))!.winner).toBe(
        id("Green"),
      );
      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });

      // Placement Points 10 · 6 · 3: 4th (Red) gets none.
      const generated = await tx
        .select({
          teamId: f.schema.pointsEntry.teamId,
          points: f.schema.pointsEntry.points,
        })
        .from(f.schema.pointsEntry)
        .where(eq(f.schema.pointsEntry.competitionId, f.competitionId));
      expect(generated.sort((a, b) => b.points - a.points)).toEqual([
        { teamId: f.green, points: 10 },
        { teamId: f.blue, points: 6 },
        { teamId: f.gold, points: 3 },
      ]);
    });
  });

  it("keeps the first 4 Placement Points when a Competition becomes a Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await fixture(tx);
      await tx
        .update(f.schema.competition)
        .set({ format: "placement", placementPoints: [5, 4, 3, 2, 1] })
        .where(eq(f.schema.competition.id, f.competitionId));
      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      const [row] = await tx
        .select({ placementPoints: f.schema.competition.placementPoints })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.competitionId));
      expect(row.placementPoints).toEqual([5, 4, 3, 2]);
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

  it("refuses a Match slot below 0, or a place below 1", async () => {
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

describe.skipIf(!isLocalDatabase)("Match recorded_at", () => {
  /** A Heat's `recorded_at`, straight from the row. */
  async function recordedAtOf(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    heatId: string,
  ) {
    const [row] = await tx
      .select({ recordedAt: f.schema.heat.recordedAt })
      .from(f.schema.heat)
      .where(eq(f.schema.heat.id, heatId));
    return row.recordedAt;
  }

  /** Four Teams generated into two Semifinals and a Final. */
  async function generated(tx: DBTx) {
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
    const view = (await queries.getBracket(f.competitionId, tx))!;
    const id = (label: string) =>
      view.entrants.find((e) => e.label === label)!.id;
    return {
      f,
      mutations,
      id,
      semi1: heatAt(view, 1, 1).heat.id,
      semi2: heatAt(view, 1, 2).heat.id,
      final: heatAt(view, 2, 1).heat.id,
    };
  }

  const LONG_AGO = new Date("2000-01-01T00:00:00Z");

  it("is null for a Match that isn't played, and set when an Organizer saves its result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2 } = await generated(tx);
      expect(await recordedAtOf(tx, f, semi1)).toBeNull();

      const before = Date.now();
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      const recorded = await recordedAtOf(tx, f, semi1);
      expect(recorded).toBeInstanceOf(Date);
      // Within the test's own clock window (the transaction's now()).
      expect(recorded!.getTime()).toBeGreaterThanOrEqual(before - 60_000);
      expect(recorded!.getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
      expect(await recordedAtOf(tx, f, semi2)).toBeNull();
    });
  });

  it("is set again by an edit of a played Match", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1 } = await generated(tx);
      const result = { order: [id("Red"), id("Blue")] };
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        result,
        f.ctx,
        tx,
      );
      await tx
        .update(f.schema.heat)
        .set({ recordedAt: LONG_AGO })
        .where(eq(f.schema.heat.id, semi1));

      // A score-only edit.
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { ...result, scores: { [id("Red")]: "21" } },
        f.ctx,
        tx,
      );
      const edited = await recordedAtOf(tx, f, semi1);
      expect(edited!.getTime()).toBeGreaterThan(LONG_AGO.getTime());

      // Even an identical re-save records when it was saved.
      await tx
        .update(f.schema.heat)
        .set({ recordedAt: LONG_AGO })
        .where(eq(f.schema.heat.id, semi1));
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { ...result, scores: { [id("Red")]: "21" } },
        f.ctx,
        tx,
      );
      expect((await recordedAtOf(tx, f, semi1))!.getTime()).toBeGreaterThan(
        LONG_AGO.getTime(),
      );
    });
  });

  it("is cleared on a later Match that a changed winner resets, and kept on the Match that was saved", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2, final } = await generated(tx);
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.competitionId,
        final,
        { order: [id("Red"), id("Gold")] },
        f.ctx,
        tx,
      );
      expect(await recordedAtOf(tx, f, final)).toBeInstanceOf(Date);

      // Blue now wins the first Semifinal: the Final goes back to not played.
      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [final] });
      expect(await recordedAtOf(tx, f, final)).toBeNull();
      expect(await recordedAtOf(tx, f, semi1)).toBeInstanceOf(Date);
      expect(await recordedAtOf(tx, f, semi2)).toBeInstanceOf(Date);
    });
  });

  it("reaches the Bracket view as recordedAt on a played Match", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2 } = await generated(tx);
      const { queries } = await modules();
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      const view = (await queries.getBracket(f.competitionId, tx))!;
      const byId = new Map(view.bracket.heats.map((h) => [h.id, h]));
      expect(byId.get(semi1)!.recordedAt).toBeInstanceOf(Date);
      expect(byId.get(semi2)!.recordedAt).toBeNull();
    });
  });
});

describe.skipIf(!isLocalDatabase)("Match reporters", () => {
  const reporterEmail = "neo@jahnelgroup.com";

  /** A Heat's reporter columns, straight from the row. */
  async function reporterOf(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    heatId: string,
  ) {
    const [row] = await tx
      .select({
        email: f.schema.heat.reportedByEmail,
        participantId: f.schema.heat.reportedByParticipantId,
      })
      .from(f.schema.heat)
      .where(eq(f.schema.heat.id, heatId));
    return row;
  }

  const NONE = { email: null, participantId: null };

  /** Marks a Heat as self-reported by Neo, as a report would. */
  async function markReported(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    heatId: string,
  ) {
    await tx
      .update(f.schema.heat)
      .set({ reportedByEmail: reporterEmail, reportedByParticipantId: f.neo })
      .where(eq(f.schema.heat.id, heatId));
  }

  /** Captain Clash entered and drawn: Blue v Red, Green v Gold. */
  async function drawn(tx: DBTx) {
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
    const view = (await queries.getBracket(f.competitionId, tx))!;
    const id = (label: string) =>
      view.entrants.find((e) => e.label === label)!.id;
    return {
      f,
      id,
      semi1: heatAt(view, 1, 1).heat.id,
      semi2: heatAt(view, 1, 2).heat.id,
      final: heatAt(view, 2, 1).heat.id,
    };
  }

  it("a Host result leaves both reporter columns null", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1, final } = await drawn(tx);

      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      expect(await reporterOf(tx, f, semi1)).toEqual(NONE);
      expect(await reporterOf(tx, f, final)).toEqual(NONE);
    });
  });

  it("a reported result records its reporter on that Match only", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1, semi2, final } = await drawn(tx);

      await mutations.recordHeatResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      const result = await tx.transaction(async (lockTx) => {
        const found = await mutations.lockedCompetition(
          lockTx,
          f.competitionId,
          f.ctx,
        );
        return mutations.writeHeatResult(
          lockTx,
          found,
          semi1,
          { order: [id("Red"), id("Blue")] },
          { email: reporterEmail, participantId: f.neo },
        );
      });
      expect(result).toEqual({ ok: true, resetHeatIds: [] });
      expect(await reporterOf(tx, f, semi1)).toEqual({
        email: reporterEmail,
        participantId: f.neo,
      });
      // The Final it filled changed too, but wasn't reported.
      expect(await reporterOf(tx, f, final)).toEqual(NONE);
    });
  });

  it("a Host overwrite with a different result clears the reporter; an identical re-save keeps it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1 } = await drawn(tx);
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await markReported(tx, f, semi1);

      // The same result again changes no Heat: it's still the reporter's.
      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      expect(await reporterOf(tx, f, semi1)).toEqual({
        email: reporterEmail,
        participantId: f.neo,
      });

      // A different result is the Host's now.
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Blue"), id("Red")] },
        f.ctx,
        tx,
      );
      expect(await reporterOf(tx, f, semi1)).toEqual(NONE);
    });
  });

  it("single elimination: re-recording an earlier Match clears the reporter of a later Match it refills", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1, semi2, final } = await drawn(tx);
      await mutations.recordHeatResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      await mutations.recordHeatResult(
        f.competitionId,
        final,
        { order: [id("Gold"), id("Red")] },
        f.ctx,
        tx,
      );
      await markReported(tx, f, final);

      expect(
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [final] });
      expect(await reporterOf(tx, f, final)).toEqual(NONE);
    });
  });

  it("Matches: re-recording an earlier Match clears the reporter of the Final it refills", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);
      const view = (await queries.getBracket(f.relayId, tx))!;
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
      await markReported(tx, f, final.id);

      expect(
        await mutations.recordHeatResult(
          f.relayId,
          first.id,
          { order: [a2, a1, a0, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [final.id] });
      expect(await reporterOf(tx, f, final.id)).toEqual(NONE);
    });
  });
});

describe.skipIf(!isLocalDatabase)("Squads", () => {
  /**
   * The fixture plus four Participants on Red (Ashley, Sam, Ryan, Alex) and
   * four on Blue (Graham, Brandon, Alec, Victoria); Tug, another team
   * Bracket; Stairs, a team Competition run on Points Entries; and a
   * Participant of the other War Week.
   */
  async function squadFixture(tx: DBTx) {
    const f = await fixture(tx);
    const { schema } = f;
    const people = await tx
      .insert(schema.participant)
      .values(
        [
          ["Ashley Schuliger", f.red],
          ["Sam Schantz", f.red],
          ["Ryan Shendler", f.red],
          ["Alex Kelly", f.red],
          ["Graham Macbeth", f.blue],
          ["Brandon Badgett", f.blue],
          ["Alec Haring", f.blue],
          ["Victoria Campbell", f.blue],
        ].map(([displayName, teamId]) => ({
          warWeekId: f.ctx.warWeekId,
          displayName,
          teamId,
        })),
      )
      .returning({
        id: schema.participant.id,
        name: schema.participant.displayName,
      });
    const p = (name: string) => people.find((x) => x.name === name)!.id;
    const [tug, stairs] = await tx
      .insert(schema.competition)
      .values([
        {
          warWeekId: f.ctx.warWeekId,
          name: "Tug",
          scoring: "team",
          format: "bracket",
        },
        {
          warWeekId: f.ctx.warWeekId,
          name: "Stairs",
          scoring: "team",
          format: "placement",
        },
      ])
      .returning({ id: schema.competition.id });
    const [stranger] = await tx
      .insert(schema.participant)
      .values({
        warWeekId: f.otherCtx.warWeekId,
        displayName: "Stranger",
        teamId: f.outsider,
      })
      .returning({ id: schema.participant.id });
    return {
      ...f,
      p,
      tugId: tug.id,
      stairsId: stairs.id,
      stranger: stranger.id,
    };
  }

  type SquadFixture = Awaited<ReturnType<typeof squadFixture>>;

  /** Red Alpha, Red Bravo, Blue Alpha and Blue Bravo on Captain Clash. */
  async function fourSquads(tx: DBTx, f: SquadFixture) {
    const { mutations } = await modules();
    for (const [name, teamId, a, b] of [
      ["Red Alpha", f.red, "Ashley Schuliger", "Sam Schantz"],
      ["Red Bravo", f.red, "Ryan Shendler", "Alex Kelly"],
      ["Blue Alpha", f.blue, "Graham Macbeth", "Brandon Badgett"],
      ["Blue Bravo", f.blue, "Alec Haring", "Victoria Campbell"],
    ] as const) {
      expect(
        await mutations.createSquad(
          f.competitionId,
          { name, teamId, participantIds: [f.p(a), f.p(b)] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
    }
    const { getSquads } = await modules().then((m) => m.queries);
    const squads = await getSquads(f.competitionId, tx);
    return (name: string) => squads.find((s) => s.name === name)!.id;
  }

  it("creates, edits and deletes a Squad", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await squadFixture(tx);

      expect(
        await mutations.createSquad(
          f.competitionId,
          {
            name: "Red Alpha",
            teamId: f.red,
            participantIds: [f.p("Sam Schantz"), f.p("Ashley Schuliger")],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      let [squad] = await queries.getSquads(f.competitionId, tx);
      expect(squad).toMatchObject({
        name: "Red Alpha",
        teamId: f.red,
        teamName: "Red",
        participants: [
          { id: f.p("Ashley Schuliger"), displayName: "Ashley Schuliger" },
          { id: f.p("Sam Schantz"), displayName: "Sam Schantz" },
        ],
      });

      expect(
        await mutations.updateSquad(
          f.competitionId,
          squad.id,
          {
            name: "Red Prime",
            teamId: f.red,
            participantIds: [f.p("Ryan Shendler")],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      [squad] = await queries.getSquads(f.competitionId, tx);
      expect(squad).toMatchObject({
        name: "Red Prime",
        participants: [{ displayName: "Ryan Shendler" }],
      });

      expect(
        await mutations.deleteSquad(f.competitionId, squad.id, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await queries.getSquads(f.competitionId, tx)).toEqual([]);
    });
  });

  it("refuses a Squad spanning Teams, a Participant already in one, a name taken, more than 16 and a Participant of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await squadFixture(tx);
      await fourSquads(tx, f);
      const create = (
        name: string,
        teamId: string | null,
        participantIds: string[],
      ) =>
        mutations.createSquad(
          f.competitionId,
          { name, teamId, participantIds },
          f.ctx,
          tx,
        );
      const participantsRefusal = (error: string) => ({
        ok: false,
        error,
        fieldErrors: { participantIds: error },
      });

      expect(
        await create("Mixed", f.red, [f.neo, f.p("Graham Macbeth")]),
      ).toEqual(
        participantsRefusal(
          "Every Participant in a Squad must be on the same Team.",
        ),
      );
      expect(
        await create("Red Charlie", f.red, [f.neo, f.p("Sam Schantz")]),
      ).toEqual(participantsRefusal("Sam Schantz is already in Red Alpha."));
      expect(await create("Red Alpha", f.red, [f.neo])).toEqual({
        ok: false,
        error: 'A Squad named "Red Alpha" already exists.',
        fieldErrors: { name: 'A Squad named "Red Alpha" already exists.' },
      });
      expect(await create("Red Charlie", f.red, [f.stranger])).toEqual(
        participantsRefusal("Choose Participants of this War Week."),
      );
      expect(await create("Nobody", f.red, [])).toEqual(
        participantsRefusal("Add at least one Participant."),
      );
      expect(await create("Teamless", null, [f.neo])).toEqual({
        ok: false,
        error: "Choose a Team.",
        fieldErrors: { teamId: "Choose a Team." },
      });

      const crowd = await tx
        .insert(f.schema.participant)
        .values(
          Array.from({ length: 17 }, (_, i) => ({
            warWeekId: f.ctx.warWeekId,
            displayName: `Red ${i}`,
            teamId: f.red,
          })),
        )
        .returning({ id: f.schema.participant.id });
      expect(
        await create(
          "Red Crowd",
          f.red,
          crowd.map((c) => c.id),
        ),
      ).toEqual(participantsRefusal("A Squad has at most 16 Participants."));

      // Another Competition's Squad doesn't count: Sam may be in Tug's.
      expect(
        await mutations.createSquad(
          f.tugId,
          {
            name: "Red Alpha",
            teamId: f.red,
            participantIds: [f.p("Sam Schantz")],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await queries.getSquads(f.competitionId, tx)).toHaveLength(4);
    });
  });

  it("refuses Squads on an individual, a points or a closed Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await squadFixture(tx);
      const values = { name: "Solo", teamId: f.red, participantIds: [f.neo] };

      expect(await mutations.createSquad(f.chessId, values, f.ctx, tx)).toEqual(
        { ok: false, error: "Squads are only for team Competitions." },
      );
      expect(
        await mutations.createSquad(f.stairsId, values, f.ctx, tx),
      ).toEqual({
        ok: false,
        error: "This Competition isn't run as a Bracket.",
      });
      expect(
        await mutations.createSquad(f.competitionId, values, f.otherCtx, tx),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });

      await mutations.createSquad(f.competitionId, values, f.ctx, tx);
      const [squad] = await (
        await modules()
      ).queries.getSquads(f.competitionId, tx);
      await tx
        .update(f.schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(f.schema.competition.id, f.competitionId));
      const finalized = {
        ok: false,
        error: "Reopen the Bracket before changing it.",
      };
      expect(
        await mutations.createSquad(
          f.competitionId,
          { ...values, name: "Duo" },
          f.ctx,
          tx,
        ),
      ).toEqual(finalized);
      expect(
        await mutations.updateSquad(
          f.competitionId,
          squad.id,
          values,
          f.ctx,
          tx,
        ),
      ).toEqual(finalized);
      expect(
        await mutations.deleteSquad(f.competitionId, squad.id, f.ctx, tx),
      ).toEqual(finalized);
    });
  });

  it("won't touch a Squad through another Competition's id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await squadFixture(tx);
      const squadId = (await fourSquads(tx, f))("Red Alpha");
      const before = await queries.getSquads(f.competitionId, tx);
      const gone = { ok: false, error: "That Squad no longer exists." };

      expect(
        await mutations.updateSquad(
          f.tugId,
          squadId,
          { name: "Hijacked", teamId: f.red, participantIds: [f.neo] },
          f.ctx,
          tx,
        ),
      ).toEqual(gone);
      expect(await mutations.deleteSquad(f.tugId, squadId, f.ctx, tx)).toEqual(
        gone,
      );
      expect(await queries.getSquads(f.competitionId, tx)).toEqual(before);
      expect(await queries.getSquads(f.tugId, tx)).toEqual([]);
    });
  });

  it("enters Squads only as a team Competition's whole Entrant list", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await squadFixture(tx);
      const squad = await fourSquads(tx, f);
      await mutations.createSquad(
        f.tugId,
        { name: "Tug Red", teamId: f.red, participantIds: [f.neo] },
        f.ctx,
        tx,
      );
      const [tugSquad] = await (await modules()).queries.getSquads(f.tugId, tx);

      expect(
        await mutations.replaceEntrants(
          f.chessId,
          { kind: "squad", targetIds: [squad("Red Alpha")] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "An individual Competition's Entrants are Participants.",
      });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { kind: "participant", targetIds: [f.neo] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "A team Competition's Entrants are Teams or Squads.",
      });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { kind: "squad", targetIds: [squad("Red Alpha"), tugSquad.id] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Enter Squads of this Competition." });
      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          { kind: "squad", targetIds: [squad("Red Alpha"), f.red] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Enter Squads of this Competition." });
      expect(
        await tx.$count(
          f.schema.entrant,
          eq(f.schema.entrant.competitionId, f.competitionId),
        ),
      ).toBe(0);
    });
  });

  it("four Squads of two Teams generate, play out and close into two Team Points Entries per Team", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const setup = await import("@/mutations/setup");
      const f = await squadFixture(tx);
      const squad = await fourSquads(tx, f);
      const { schema } = f;

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          {
            kind: "squad",
            targetIds: [
              "Red Alpha",
              "Red Bravo",
              "Blue Alpha",
              "Blue Bravo",
            ].map(squad),
          },
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

      // An entered Squad can't be deleted, but can be renamed.
      expect(
        await mutations.deleteSquad(
          f.competitionId,
          squad("Red Alpha"),
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Squad is an Entrant. Remove it from the Entrants first.",
      });

      // Seeded Red Bravo 1, Blue Alpha 2, Blue Bravo 3, Red Alpha 4: Red
      // Bravo and Blue Alpha win the semifinals, Red Bravo the final.
      let view = (await queries.getBracket(f.competitionId, tx))!;
      expect(heatAt(view, 1, 1).labels).toEqual(["Red Bravo", "Red Alpha"]);
      expect(heatAt(view, 1, 2).labels).toEqual(["Blue Alpha", "Blue Bravo"]);
      const id = (label: string) =>
        view.entrants.find((e) => e.label === label)!.id;
      for (const [position, round, winner] of [
        [1, 1, "Red Bravo"],
        [2, 1, "Blue Alpha"],
        [1, 2, "Red Bravo"],
      ] as const) {
        view = (await queries.getBracket(f.competitionId, tx))!;
        const heat = heatAt(view, round, position).heat;
        const ids = heat.slots.map((s) => s.entrantId!);
        expect(
          await mutations.recordHeatResult(
            f.competitionId,
            heat.id,
            { order: [id(winner), ...ids.filter((i) => i !== id(winner))] },
            f.ctx,
            tx,
          ),
        ).toMatchObject({ ok: true });
      }

      const generated = async () =>
        (
          await tx
            .select({
              teamId: schema.pointsEntry.teamId,
              participantId: schema.pointsEntry.participantId,
              points: schema.pointsEntry.points,
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
        { teamId: f.red, participantId: null, points: 10 },
        { teamId: f.blue, participantId: null, points: 6 },
        ...[
          { teamId: f.red, participantId: null, points: 3 },
          { teamId: f.blue, participantId: null, points: 3 },
        ].sort((a, b) => a.teamId.localeCompare(b.teamId)),
      ];

      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual(expected);

      expect(
        await mutations.unfinalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual([]);
      expect(
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual(expected);

      // Red's Squads and their generated Points Entries hold its Team.
      expect(await setup.deleteTeam(f.red, f.ctx, tx)).toMatchObject({
        ok: false,
      });
    });
  });

  it("refuses changing an entered Squad's Team, but not one that isn't entered", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await squadFixture(tx);
      const squad = await fourSquads(tx, f);

      expect(
        await mutations.replaceEntrants(
          f.competitionId,
          {
            kind: "squad",
            targetIds: [squad("Red Alpha"), squad("Blue Alpha")],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      const before = await queries.getSquads(f.competitionId, tx);

      const teamChange = {
        ok: false,
        error:
          "This Squad is an Entrant. Remove it from the Entrants before changing its Team.",
        fieldErrors: {
          teamId:
            "This Squad is an Entrant. Remove it from the Entrants before changing its Team.",
        },
      };
      expect(
        await mutations.updateSquad(
          f.competitionId,
          squad("Red Alpha"),
          {
            name: "Red Alpha",
            teamId: f.blue,
            participantIds: [f.p("Ashley Schuliger"), f.p("Sam Schantz")],
          },
          f.ctx,
          tx,
        ),
      ).toEqual(teamChange);
      expect(await queries.getSquads(f.competitionId, tx)).toEqual(before);

      // A Squad that isn't entered (Red Bravo) may have its Team changed,
      // moved along with its Participants onto that Team.
      const [greta, gary] = await tx
        .insert(f.schema.participant)
        .values([
          { warWeekId: f.ctx.warWeekId, displayName: "Greta", teamId: f.green },
          { warWeekId: f.ctx.warWeekId, displayName: "Gary", teamId: f.green },
        ])
        .returning({ id: f.schema.participant.id });
      expect(
        await mutations.updateSquad(
          f.competitionId,
          squad("Red Bravo"),
          {
            name: "Red Bravo",
            teamId: f.green,
            participantIds: [greta.id, gary.id],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      const [redBravo] = (await queries.getSquads(f.competitionId, tx)).filter(
        (s) => s.name === "Red Bravo",
      );
      expect(redBravo.teamId).toBe(f.green);
    });
  });

  it("deletes a Bracket's Squads when it changes Format (none is an Entrant)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await squadFixture(tx);
      for (const [name, person] of [
        ["Red Alpha", "Ashley Schuliger"],
        ["Red Bravo", "Sam Schantz"],
      ] as const) {
        await mutations.createSquad(
          f.competitionId,
          { name, teamId: f.red, participantIds: [f.p(person)] },
          f.ctx,
          tx,
        );
      }

      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "placement" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await tx.$count(
          f.schema.squad,
          eq(f.schema.squad.competitionId, f.competitionId),
        ),
      ).toBe(0);
    });
  });
});

/**
 * The fixture plus two Head-to-head or Best score Competitions made by `createCompetition`:
 * "Bouncy Pong" (individual, head-to-head) and "Stairs" (team,
 * best-score), and a helper that logs a Game straight into the tables.
 */
async function gamesFixture(tx: DBTx) {
  const f = await fixture(tx);
  const setup = await import("@/mutations/setup");
  const create = async (
    name: string,
    scoring: "team" | "individual",
    format: "head-to-head" | "best-score",
  ) => {
    const created = await setup.createCompetition(
      {
        name,
        description: null,
        scoring,
        placementPoints: null,
        countsTowardTeam: false,
        competitionGroup: null,
        format,
      },
      f.ctx,
      tx,
    );
    if (!created.ok) throw new Error(created.error);
    return created.id;
  };
  const pongId = await create("Bouncy Pong", "individual", "head-to-head");
  const stairsId = await create("Stairs", "team", "best-score");
  const logGame = async (
    competitionId: string,
    players: { teamId?: string; participantId?: string }[],
  ) => {
    const [row] = await tx
      .insert(f.schema.game)
      .values({ competitionId, loggedByEmail: actorEmail })
      .returning({ id: f.schema.game.id });
    await tx.insert(f.schema.gamePlayer).values(
      players.map((p, i) => ({
        gameId: row.id,
        teamId: p.teamId ?? null,
        participantId: p.participantId ?? null,
        place: i + 1,
      })),
    );
  };
  return { ...f, setup, pongId, stairsId, logGame };
}

describe.skipIf(!isLocalDatabase)(
  "Head-to-head or Best score Competitions",
  () => {
    it("creates a Head-to-head Competition with its default settings", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await gamesFixture(tx);
        const [row] = await tx
          .select({
            format: f.schema.competition.format,
            gameConfig: f.schema.competition.gameConfig,
            entrantsOpen: f.schema.competition.entrantsOpen,
            bracketConfig: f.schema.competition.bracketConfig,
          })
          .from(f.schema.competition)
          .where(eq(f.schema.competition.id, f.pongId));
        expect(row).toEqual({
          format: "head-to-head",
          gameConfig: { drawsAllowed: false, bestOf: null },
          entrantsOpen: true,
          bracketConfig: null,
        });
      });
    });

    it("won't delete a Head-to-head or Best score Competition that has Games", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await gamesFixture(tx);
        await f.logGame(f.stairsId, [{ teamId: f.blue }]);
        expect(await f.setup.deleteCompetition(f.stairsId, f.ctx, tx)).toEqual({
          ok: false,
          error:
            "This Competition has 1 Match or Attempt. Delete or move them first.",
        });
        expect(await f.setup.deleteCompetition(f.pongId, f.ctx, tx)).toEqual({
          ok: true,
        });
      });
    });

    it("is never a Bracket: getBracket is undefined and the Bracket list leaves it out", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { queries } = await modules();
        const f = await gamesFixture(tx);
        expect(await queries.getBracket(f.pongId, tx)).toBeUndefined();
        const names = (
          await queries.getBracketCompetitions({ id: f.ctx.warWeekId }, tx)
        ).map((c) => c.name);
        expect(names).toEqual(["Captain Clash", "Speed Chess"]);
        expect(
          (
            await (
              await import("@/queries/games")
            ).getGamesCompetitions({ id: f.ctx.warWeekId }, tx)
          ).map((c) => c.name),
        ).toEqual(["Bouncy Pong", "Stairs"]);
      });
    });

    it("changes Format to and from Head-to-head or Best score, with the new Format's create defaults", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await gamesFixture(tx);
        const row = async (id: string) => {
          const [found] = await tx
            .select({
              format: f.schema.competition.format,
              gameConfig: f.schema.competition.gameConfig,
              entrantsOpen: f.schema.competition.entrantsOpen,
              bracketConfig: f.schema.competition.bracketConfig,
            })
            .from(f.schema.competition)
            .where(eq(f.schema.competition.id, id));
          return found;
        };
        expect(
          await mutations.setCompetitionFormat(
            f.pongId,
            { format: "bracket" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        expect(await row(f.pongId)).toEqual({
          format: "bracket",
          gameConfig: null,
          entrantsOpen: false,
          bracketConfig: {
            entrantsPerHeat: 2,
            advancePerHeat: 1,
            thirdPlaceGame: false,
          },
        });
        expect(
          await mutations.setCompetitionFormat(
            f.competitionId,
            { format: "best-score" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        expect(await row(f.competitionId)).toEqual({
          format: "best-score",
          gameConfig: { count: "best", betterIs: "higher", unit: "" },
          entrantsOpen: true,
          bracketConfig: null,
        });
        // A logged Game is a result: the Format locks.
        await f.logGame(f.stairsId, [{ teamId: f.blue }]);
        expect(
          await mutations.setCompetitionFormat(
            f.stairsId,
            { format: "placement" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "Locked once the Competition has a result.",
        });
      });
    });

    it("sets Entrants only for the Format the caller names", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await gamesFixture(tx);
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity], format: "bracket" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "This Competition isn't run as a Bracket.",
        });
        expect(
          await mutations.replaceEntrants(
            f.competitionId,
            { targetIds: [], format: "games" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "This Competition isn't run as Head-to-head or Best score.",
        });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity], format: "games" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("has no Entrants for an id that isn't a row id", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { queries } = await modules();
        expect(await queries.getBracketEntrants("not-a-uuid", tx)).toEqual([]);
      });
    });

    it("refuses Bracket writes on a Head-to-head or Best score Competition", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await gamesFixture(tx);
        expect(
          await mutations.generateBracket(f.pongId, {}, f.ctx, tx),
        ).toEqual({
          ok: false,
          error: "This Competition isn't run as a Bracket.",
        });
      });
    });

    it("enters Participants of an individual Head-to-head or Best score Competition, never Squads or Teams", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations, queries } = await modules();
        const f = await gamesFixture(tx);
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity] },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        expect(
          (await queries.getBracketEntrants(f.pongId, tx)).map((e) => e.label),
        ).toEqual(["Neo", "Trinity"]);
        expect(
          await mutations.replaceEntrants(
            f.stairsId,
            { targetIds: [], kind: "squad" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error:
            "Squads aren't entered in a Head-to-head or Best score Competition.",
        });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.red], kind: "team" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "An individual Competition's Entrants are Participants.",
        });
        expect(
          await mutations.replaceEntrants(
            f.stairsId,
            { targetIds: [f.outsider] },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error:
            '"Stairs" is a team Competition, so its Entrants must be Teams of this War Week.',
        });
      });
    });

    it("takes exactly 2 Entrants while Best of is on", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await gamesFixture(tx);
        await tx
          .update(f.schema.competition)
          .set({ gameConfig: { drawsAllowed: false, bestOf: 5 } })
          .where(eq(f.schema.competition.id, f.pongId));
        const [third] = await tx
          .insert(f.schema.participant)
          .values({ warWeekId: f.ctx.warWeekId, displayName: "Morpheus" })
          .returning({ id: f.schema.participant.id });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity, third.id] },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: false, error: "A Best of needs exactly 2 Entrants." });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity] },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("won't remove an Entrant who has logged Games, but keeps one who has", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await gamesFixture(tx);
        await mutations.replaceEntrants(
          f.stairsId,
          { targetIds: [f.red, f.blue, f.green] },
          f.ctx,
          tx,
        );
        await f.logGame(f.stairsId, [{ teamId: f.blue }]);
        expect(
          await mutations.replaceEntrants(
            f.stairsId,
            { targetIds: [f.red, f.green] },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "Blue has logged Matches or Attempts. Delete them first.",
        });
        expect(
          await mutations.replaceEntrants(
            f.stairsId,
            { targetIds: [f.blue, f.gold] },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("refuses a Format change, a scoring change and deleting a player while Games exist", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await gamesFixture(tx);
        await f.logGame(f.pongId, [
          { participantId: f.neo },
          { participantId: f.trinity },
        ]);
        await f.logGame(f.stairsId, [{ teamId: f.gold }]);

        expect(await f.setup.deleteTeam(f.gold, f.ctx, tx)).toEqual({
          ok: false,
          error: "This Team has 1 Match or Attempt. Move or delete them first.",
        });
        expect(await f.setup.deleteParticipant(f.trinity, f.ctx, tx)).toEqual({
          ok: false,
          error:
            "This Participant has 1 Match or Attempt. Delete them or remove the Participant from them first.",
        });
        expect(
          await f.setup.updateCompetition(
            f.pongId,
            {
              name: "Bouncy Pong",
              description: null,
              scoring: "team",
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
            "This Competition has 1 Match or Attempt. Delete them before changing its scoring.",
        });
      });
    });

    it("takes a closed Head-to-head or Best score Competition's Placement Points change", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await gamesFixture(tx);
        await tx
          .update(f.schema.competition)
          .set({ finalizedAt: new Date() })
          .where(eq(f.schema.competition.id, f.pongId));
        expect(
          await f.setup.updateCompetition(
            f.pongId,
            {
              name: "Bouncy Pong",
              description: null,
              scoring: "individual",
              placementPoints: [3, 2, 1],
              countsTowardTeam: false,
              competitionGroup: null,
            },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("refuses a game config on a Competition that isn't Head-to-head or Best score (the database CHECK)", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await gamesFixture(tx);
        await expect(
          tx.transaction((inner) =>
            inner
              .update(f.schema.competition)
              .set({ gameConfig: { drawsAllowed: false, bestOf: null } })
              .where(eq(f.schema.competition.id, f.competitionId)),
          ),
        ).rejects.toThrow();
      });
    });
  },
);
