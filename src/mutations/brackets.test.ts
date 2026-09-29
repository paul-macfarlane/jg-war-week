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

  it("seeds by the current Standings, with the top-ranked Entrant first", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);

      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      // Red ranks 1st; Blue and Green tie for 2nd (a rank shared by three
      // Points Entries); Gold has none, so it ties Standings' zero-point
      // teams and comes last.
      await tx.insert(f.schema.pointsEntry).values([
        {
          competitionId: f.competitionId,
          teamId: f.red,
          points: 30,
          enteredByEmail: actorEmail,
        },
        {
          competitionId: f.competitionId,
          teamId: f.blue,
          points: 20,
          enteredByEmail: actorEmail,
        },
        {
          competitionId: f.competitionId,
          teamId: f.green,
          points: 20,
          enteredByEmail: actorEmail,
        },
      ]);

      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero, seeding: "standings" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.entrants[0]).toMatchObject({
        label: "Red",
        seedPosition: 1,
      });
      expect(view.entrants.map((e) => e.label).slice(1)).toEqual(
        expect.arrayContaining(["Blue", "Green", "Gold"]),
      );
      // Gold, with no Points Entry, comes after Blue and Green's tied rank.
      expect(
        view.entrants.findIndex((e) => e.label === "Gold"),
      ).toBeGreaterThan(view.entrants.findIndex((e) => e.label === "Blue"));
      expect(
        view.entrants.findIndex((e) => e.label === "Gold"),
      ).toBeGreaterThan(view.entrants.findIndex((e) => e.label === "Green"));
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

  it("refuses to save Heat settings that Generate would refuse, keeping the Heat Results", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedHeats(tx);
      let view = (await queries.getBracket(f.relayId, tx))!;
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
          {
            format: "heats",
            config: { entrantsPerHeat: 3, advancePerHeat: 2 },
            force: true,
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "With 8 Entrants, 3 per Heat and 2 advancing, Round 3 would never end. Lower how many advance.",
      });
      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(heatAt(view, 1, 1).heat.status).toBe("played");
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

  describe("setHeatSchedule", () => {
    /** A Day of the fixture's War Week (or, with `other`, its otherCtx). */
    async function makeDay(
      tx: DBTx,
      f: Awaited<ReturnType<typeof fixture>>,
      warWeekId: string,
    ) {
      const [row] = await tx
        .insert(f.schema.day)
        .values({ warWeekId, date: "2099-01-01", dayTheme: "Kickoff" })
        .returning({ id: f.schema.day.id });
      return row.id;
    }

    it("sets, keeps through a Heat Result, and clears a Heat's time and place", async () => {
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
        const dayId = await makeDay(tx, f, f.ctx.warWeekId);
        let view = (await queries.getBracket(f.competitionId, tx))!;
        const semi1 = heatAt(view, 1, 1).heat.id;

        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            semi1,
            { dayId, startTime: "19:00", location: "Main room" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        view = (await queries.getBracket(f.competitionId, tx))!;
        expect(heatAt(view, 1, 1).heat).toMatchObject({
          dayId,
          startTime: "19:00:00",
          location: "Main room",
        });

        // Recording a Heat Result keeps the time and place.
        const id = (label: string) =>
          view.entrants.find((e) => e.label === label)!.id;
        await mutations.recordHeatResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")] },
          f.ctx,
          tx,
        );
        view = (await queries.getBracket(f.competitionId, tx))!;
        expect(heatAt(view, 1, 1).heat).toMatchObject({
          dayId,
          startTime: "19:00:00",
          location: "Main room",
        });

        // Clearing sets every field back to null.
        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            semi1,
            { dayId: null, startTime: null, location: null },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        view = (await queries.getBracket(f.competitionId, tx))!;
        expect(heatAt(view, 1, 1).heat).toMatchObject({
          dayId: null,
          startTime: null,
          location: null,
        });
      });
    });

    it("a re-generate drops a Heat's time and place", async () => {
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
        const dayId = await makeDay(tx, f, f.ctx.warWeekId);
        let view = (await queries.getBracket(f.competitionId, tx))!;
        const semi1 = heatAt(view, 1, 1).heat.id;
        await mutations.setHeatSchedule(
          f.competitionId,
          semi1,
          { dayId, startTime: "19:00", location: "Main room" },
          f.ctx,
          tx,
        );

        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        );
        view = (await queries.getBracket(f.competitionId, tx))!;
        expect(heatAt(view, 1, 1).heat).toMatchObject({
          dayId: null,
          startTime: null,
          location: null,
        });
      });
    });

    it("refuses a Heat not in this Competition", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
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
        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            "00000000-0000-4000-8000-000000000000",
            { dayId: null, startTime: null, location: "Table 3" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: false, error: "That Heat no longer exists." });
      });
    });

    it("refuses a Day outside the Competition's War Week", async () => {
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
        const otherDayId = await makeDay(tx, f, f.otherCtx.warWeekId);
        const view = (await queries.getBracket(f.competitionId, tx))!;
        const semi1 = heatAt(view, 1, 1).heat.id;

        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            semi1,
            { dayId: otherDayId, startTime: "19:00", location: null },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: false, error: "That Day no longer exists." });
      });
    });

    it("refuses a bye", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations, queries } = await modules();
        const f = await fixture(tx);
        // Three Teams: one gets a bye into the Final.
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
        const view = (await queries.getBracket(f.competitionId, tx))!;
        const bye = view.bracket.heats.find(
          (h) => h.round === 1 && h.slots.some((s) => s.entrantId === null),
        )!;

        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            bye.id,
            { dayId: null, startTime: null, location: "Table 3" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: false, error: "A bye isn't played." });
      });
    });

    it("refuses changing a finalized Bracket's Heat times", async () => {
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
        view = (await queries.getBracket(f.competitionId, tx))!;
        await mutations.recordHeatResult(
          f.competitionId,
          final,
          { order: [id("Red"), id("Gold")] },
          f.ctx,
          tx,
        );
        await mutations.finalizeBracket(f.competitionId, f.ctx, tx);

        expect(
          await mutations.setHeatSchedule(
            f.competitionId,
            final,
            { dayId: null, startTime: null, location: "Table 3" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "Un-finalize the Bracket before changing it.",
        });
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("Heat reporters", () => {
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

  it("a reported result records its reporter on that Heat only", async () => {
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

  it("single elimination: re-recording an earlier Heat clears the reporter of a later Heat it refills", async () => {
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

  it("Heats: re-recording an earlier Heat clears the reporter of the Final it refills", async () => {
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
          format: "single-elimination",
        },
        {
          warWeekId: f.ctx.warWeekId,
          name: "Stairs",
          scoring: "team",
          format: "points",
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

  it("refuses Squads on an individual, a points or a finalized Competition", async () => {
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
        error: "Un-finalize the Bracket before changing it.",
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

  it("four Squads of two Teams generate, play out and finalize into two Team Points Entries per Team", async () => {
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
          { seeding: "standings" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Squads are seeded at random." });
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

  it("refuses setting the Format to points while the Competition has Squads", async () => {
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
          { format: "points" },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition has 2 Squads. Delete them before changing its Format.",
      });
      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "heats" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });
});

/**
 * The fixture plus two `games` Competitions made by `createCompetition`:
 * "Bouncy Pong" (individual, head-to-head) and "Stairs" (team,
 * best-score), and a helper that logs a Game straight into the tables.
 */
async function gamesFixture(tx: DBTx) {
  const f = await fixture(tx);
  const setup = await import("@/mutations/setup");
  const create = async (
    name: string,
    scoring: "team" | "individual",
    gameType: "head-to-head" | "best-score" | "ranked",
  ) => {
    const created = await setup.createCompetition(
      {
        name,
        description: null,
        scoring,
        maxPoints: null,
        placementPoints: null,
        countsTowardTeam: false,
        competitionGroup: null,
        format: "games",
        gameType,
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

describe.skipIf(!isLocalDatabase)("games Competitions", () => {
  it("creates a games Competition with its Game Type and the type's default settings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await gamesFixture(tx);
      const [row] = await tx
        .select({
          format: f.schema.competition.format,
          gameType: f.schema.competition.gameType,
          gameConfig: f.schema.competition.gameConfig,
          entrantsOpen: f.schema.competition.entrantsOpen,
          bracketConfig: f.schema.competition.bracketConfig,
        })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, f.pongId));
      expect(row).toEqual({
        format: "games",
        gameType: "head-to-head",
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: false,
        bracketConfig: null,
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
        (await queries.getGamesCompetitions({ id: f.ctx.warWeekId }, tx)).map(
          (c) => c.name,
        ),
      ).toEqual(["Bouncy Pong", "Stairs"]);
    });
  });

  it("keeps its Format: no change to or from games", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await gamesFixture(tx);
      const keeps = {
        ok: false,
        error:
          "A Games Competition keeps its Format; add a new Competition to run it another way.",
      };
      expect(
        await mutations.setCompetitionFormat(
          f.pongId,
          { format: "single-elimination" },
          f.ctx,
          tx,
        ),
      ).toEqual(keeps);
      expect(
        await mutations.setCompetitionFormat(
          f.pongId,
          { format: "points" },
          f.ctx,
          tx,
        ),
      ).toEqual(keeps);
      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "games" },
          f.ctx,
          tx,
        ),
      ).toEqual(keeps);
    });
  });

  it("refuses Bracket writes on a games Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await gamesFixture(tx);
      expect(await mutations.generateBracket(f.pongId, {}, f.ctx, tx)).toEqual({
        ok: false,
        error: "This Competition isn't run as a Bracket.",
      });
    });
  });

  it("enters Participants of an individual games Competition, never Squads or Teams", async () => {
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
        error: "Squads aren't entered in a Games Competition.",
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
        error: "Blue has logged Games. Delete them first.",
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
        error: "This Team has 1 Game. Move or delete them first.",
      });
      expect(await f.setup.deleteParticipant(f.trinity, f.ctx, tx)).toEqual({
        ok: false,
        error:
          "This Participant has 1 Game. Delete them or remove the Participant from them first.",
      });
      expect(
        await f.setup.updateCompetition(
          f.pongId,
          {
            name: "Bouncy Pong",
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
          "This Competition has 1 Game. Delete them before changing its scoring.",
      });
    });
  });

  it("asks to reopen a closed games Competition before changing its Placement Points", async () => {
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
            maxPoints: null,
            placementPoints: [3, 2, 1],
            countsTowardTeam: false,
            competitionGroup: null,
          },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "This Competition is closed. Reopen the Competition first.",
      });
    });
  });

  it("refuses a gameType on a Competition that isn't games (the database CHECK)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await gamesFixture(tx);
      await expect(
        tx.transaction((inner) =>
          inner
            .update(f.schema.competition)
            .set({ gameType: "ranked" })
            .where(eq(f.schema.competition.id, f.competitionId)),
        ),
      ).rejects.toThrow();
    });
  });
});
