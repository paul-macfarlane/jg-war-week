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

/** The Match at `round`/`position` and its Entrants' labels. */
function matchAt(
  view: NonNullable<
    Awaited<ReturnType<typeof import("@/queries/brackets").getBracket>>
  >,
  round: number,
  position: number,
) {
  const match = view.bracket.matches.find(
    (h) => h.round === round && h.position === position,
  )!;
  const label = (id: string | null) =>
    view.entrants.find((e) => e.id === id)?.label ?? null;
  return { match, labels: match.slots.map((s) => label(s.entrantId)) };
}

/**
 * The fixture plus an individual Competition, "Relay Matches", with eight
 * Participants and Placement Points 5 · 3 · 1, still single elimination.
 */
async function matchesFixture(tx: DBTx) {
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
  kind: "group" as const,
  entrantsPerMatch: 4,
  advancePerMatch: 2,
  thirdPlaceMatch: false,
  rounds: {},
};

/** Relay Matches set to 4 per Match, 2 advancing, entered and generated. */
async function generatedMatches(tx: DBTx) {
  const { mutations } = await modules();
  const f = await matchesFixture(tx);
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
      expect(matchAt(view, 1, 1).labels).toEqual(["Blue", "Red"]);
      expect(matchAt(view, 1, 2).labels).toEqual(["Green", "Gold"]);
      expect(matchAt(view, 2, 1).match.status).toBe("pending");
      expect(view.winner).toBeNull();
      expect(view.closed).toBe(false);
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

  it("records Match Results and advances winners; a result the final used can't change until the final is cleared (D1c)", async () => {
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
      const semi1 = matchAt(view, 1, 1).match.id;
      const semi2 = matchAt(view, 1, 2).match.id;
      const final = matchAt(view, 2, 1).match.id;

      expect(
        await mutations.recordMatchResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")], scores: { [id("Red")]: "21" } },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      await mutations.recordMatchResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(matchAt(view, 1, 1).match.slots[1]).toMatchObject({
        place: 1,
        score: "21",
      });
      expect(matchAt(view, 1, 2).match.status).toBe("played");
      expect(matchAt(view, 2, 1).labels).toEqual(["Red", "Gold"]);
      expect(matchAt(view, 2, 1).match.status).toBe("ready");

      await mutations.recordMatchResult(
        f.competitionId,
        final,
        { order: [id("Gold"), id("Red")] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.winner).toBe(id("Gold"));

      // The final used both semifinals: no edit, not even a Score, until
      // the final is cleared (spec R21, D1c). Nothing is reset.
      const used = {
        ok: false,
        error:
          "A later Match already used this result. Change that Match first.",
      };
      for (const order of [
        [id("Red"), id("Blue")],
        [id("Blue"), id("Red")],
      ]) {
        expect(
          await mutations.recordMatchResult(
            f.competitionId,
            semi1,
            { order, scores: { [id("Red")]: "25" } },
            f.ctx,
            tx,
          ),
        ).toEqual(used);
      }
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(matchAt(view, 1, 1).match.slots[1]).toMatchObject({ score: "21" });
      expect(view.winner).toBe(id("Gold"));

      expect(
        await mutations.clearMatchResult(f.competitionId, final, f.ctx, tx),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(matchAt(view, 2, 1).match.status).toBe("ready");
      expect(matchAt(view, 2, 1).match.recordedAt).toBeNull();
      expect(view.winner).toBeNull();

      // Now the first Match's winner changes, and the final takes Blue.
      expect(
        await mutations.recordMatchResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(matchAt(view, 2, 1).labels).toEqual(["Blue", "Gold"]);
      expect(matchAt(view, 2, 1).match.status).toBe("ready");
      expect(view.winner).toBeNull();

      expect(
        await mutations.recordMatchResult(
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
      // Regenerating before any Match Result is fine (byes don't count).
      expect(
        await mutations.generateBracket(
          f.competitionId,
          { rng: rngZero },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      let view = (await queries.getBracket(f.competitionId, tx))!;
      const played = view.bracket.matches.find((h) => h.status === "ready")!;
      await mutations.recordMatchResult(
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
      expect(view.bracket.matches.find((h) => h.id === played.id)!.status).toBe(
        "played",
      );
    });
  });

  it("closes into generated Points Entries, and reopening removes only those", async () => {
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
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: false,
        error: "Finish every Match before closing.",
      });

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
        const match = matchAt(view, round, position).match;
        const ids = match.slots.map((s) => s.entrantId!);
        await mutations.recordMatchResult(
          f.competitionId,
          match.id,
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
                eq(schema.pointsEntry.generated, true),
              ),
            )
        ).sort(
          (a, b) => b.points - a.points || a.teamId!.localeCompare(b.teamId!),
        );
      // No 3rd place Match: only 1st and 2nd are placed, so the semifinal
      // losers (Gold, Red) get no Placement Points.
      const expected = [
        { teamId: f.green, points: 10, note: "From bracket" },
        { teamId: f.blue, points: 6, note: "From bracket" },
      ];

      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });
      expect(await generated()).toEqual(expected);
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.closed).toBe(true);
      expect(view.winner).toBe(id("Green"));

      // A closed Bracket can't change until it's reopened.
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

      // Re-closing replaces the generated entries with the same ones.
      await (
        await import("@/mutations/close")
      ).closeCompetition(f.competitionId, f.ctx, tx);
      expect(await generated()).toEqual(expected);

      // The non-generated entry sits beside the two generated ones.
      const all = await tx
        .select({ generated: schema.pointsEntry.generated })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, f.competitionId));
      expect(all.filter((e) => e.generated)).toHaveLength(2);
      expect(all.filter((e) => !e.generated)).toHaveLength(1);

      expect(
        await (
          await import("@/mutations/close")
        ).reopenCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual([]);
      const remaining = await tx
        .select({ note: schema.pointsEntry.note })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, f.competitionId));
      expect(remaining).toEqual([{ note: "Spirit bonus" }]);
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(view.closed).toBe(false);
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
      const only = bracket.bracket.matches[0];
      await mutations.recordMatchResult(
        f.competitionId,
        only.id,
        { order: only.slots.map((s) => s.entrantId!) },
        f.ctx,
        tx,
      );
      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });

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
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });
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

  it("runs a matches Bracket from Generate to generated Points Entries", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedMatches(tx);
      const { schema } = f;

      expect(await savedConfig(tx, f, f.relayId)).toEqual(fourTwo);
      const rows = await tx
        .select({
          round: schema.bracketMatch.round,
          slotCount: schema.bracketMatch.slotCount,
          winnerToMatchId: schema.bracketMatch.winnerToMatchId,
        })
        .from(schema.bracketMatch)
        .where(eq(schema.bracketMatch.competitionId, f.relayId))
        .orderBy(schema.bracketMatch.round, schema.bracketMatch.position);
      // Two Matches of four, then a final of the four who advance.
      expect(rows).toEqual([
        { round: 1, slotCount: 4, winnerToMatchId: null },
        { round: 1, slotCount: 4, winnerToMatchId: null },
        { round: 2, slotCount: 4, winnerToMatchId: null },
      ]);

      let view = (await queries.getBracket(f.relayId, tx))!;
      const first = matchAt(view, 1, 1).match;
      const second = matchAt(view, 1, 2).match;
      const final = matchAt(view, 2, 1).match;
      const [a0, a1, a2, a3] = first.slots.map((s) => s.entrantId!);
      const [b0, b1, b2, b3] = second.slots.map((s) => s.entrantId!);
      expect(final.slots.every((s) => s.entrantId === null)).toBe(true);

      expect(
        await mutations.recordMatchResult(
          f.relayId,
          first.id,
          { order: [a0, a1, a2, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      // The Entrant listed last finishes last.
      expect(
        await mutations.recordMatchResult(
          f.relayId,
          second.id,
          { order: [b1, b2, b3, b0] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      view = (await queries.getBracket(f.relayId, tx))!;
      const played = matchAt(view, 1, 2).match;
      expect(played.status).toBe("played");
      expect(played.slots.map((s) => [s.entrantId, s.place])).toEqual([
        [b0, 4],
        [b1, 1],
        [b2, 2],
        [b3, 3],
      ]);
      const filled = matchAt(view, 2, 1).match;
      expect(filled.status).toBe("ready");
      expect(filled.slots.map((s) => s.entrantId).sort()).toEqual(
        [a0, a1, b1, b2].sort(),
      );
      expect(view.winner).toBeNull();

      expect(
        await mutations.recordMatchResult(
          f.relayId,
          final.id,
          { order: [a1, b1, a0, b2] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.winner).toBe(a1);

      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.relayId, f.ctx, tx),
      ).toEqual({
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
            eq(schema.pointsEntry.generated, true),
          ),
        );
      expect(generated.sort((x, y) => y.points - x.points)).toEqual([
        { participantId: participantOf(a1), points: 5, note: "From bracket" },
        { participantId: participantOf(b1), points: 3, note: "From bracket" },
        { participantId: participantOf(a0), points: 1, note: "From bracket" },
      ]);

      // A closed Bracket's config can't change: it has Match Results.
      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          {
            format: "bracket",
            config: {
              kind: "group" as const,
              entrantsPerMatch: 4,
              advancePerMatch: 1,
              thirdPlaceMatch: false,
              rounds: {},
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

  it("refuses a re-record that changes who advances once the final has a result; cleared, the final re-fills (D1c)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedMatches(tx);
      let view = (await queries.getBracket(f.relayId, tx))!;
      const first = matchAt(view, 1, 1).match;
      const second = matchAt(view, 1, 2).match;
      const final = matchAt(view, 2, 1).match;
      const [a0, a1, a2, a3] = first.slots.map((s) => s.entrantId!);
      const [b0, b1, b2, b3] = second.slots.map((s) => s.entrantId!);
      await mutations.recordMatchResult(
        f.relayId,
        first.id,
        { order: [a0, a1, a2, a3] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.relayId,
        second.id,
        { order: [b0, b1, b2, b3] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.relayId,
        final.id,
        { order: [a0, b0, a1, b1] },
        f.ctx,
        tx,
      );
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.winner).toBe(a0);

      // a2 would advance in place of a0, but the final used the result.
      expect(
        await mutations.recordMatchResult(
          f.relayId,
          first.id,
          { order: [a2, a1, a0, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A later Match already used this result. Change that Match first.",
      });
      view = (await queries.getBracket(f.relayId, tx))!;
      expect(view.winner).toBe(a0);

      expect(
        await mutations.clearMatchResult(f.relayId, final.id, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(
        await mutations.recordMatchResult(
          f.relayId,
          first.id,
          { order: [a2, a1, a0, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      view = (await queries.getBracket(f.relayId, tx))!;
      const after = matchAt(view, 2, 1).match;
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
            kind: "group" as const,
            entrantsPerMatch: 3,
            advancePerMatch: 2,
            thirdPlaceMatch: false,
            rounds: {},
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
        (await queries.getBracket(f.competitionId, tx))!.bracket.matches,
      ).toEqual([]);
    });
  });

  it("saves a matches config, and a different one clears the Matches until a Match has a result, then locks it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedMatches(tx);

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

      // No Match Result yet: a different config clears the drawn Matches.
      const fourOne = {
        kind: "group" as const,
        entrantsPerMatch: 4,
        advancePerMatch: 1,
        thirdPlaceMatch: false,
        rounds: {},
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
      expect(view.bracket.matches).toEqual([]);
      expect(view.entrants).toHaveLength(8);

      // Drawn again and a Match played: the config is locked.
      await mutations.generateBracket(f.relayId, { rng: rngZero }, f.ctx, tx);
      view = (await queries.getBracket(f.relayId, tx))!;
      const first = matchAt(view, 1, 1).match;
      await mutations.recordMatchResult(
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
      expect(matchAt(view, 1, 1).match.status).toBe("played");
    });
  });

  it("refuses to save Match settings that Generate would refuse, keeping the drawn Matches", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedMatches(tx);

      expect(
        await mutations.setCompetitionFormat(
          f.relayId,
          {
            format: "bracket",
            config: {
              kind: "group" as const,
              entrantsPerMatch: 3,
              advancePerMatch: 2,
              thirdPlaceMatch: false,
              rounds: {},
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
        (await queries.getBracket(f.relayId, tx))!.bracket.matches,
      ).toHaveLength(3);
    });
  });

  it("runs a 3rd place Match: refused under 4 Entrants or off 2 / 1, locked once a Match has a result, placed from the final", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const withGame = {
        kind: "head-to-head" as const,
        entrantsPerMatch: 2,
        advancePerMatch: 1,
        thirdPlaceMatch: true,
        rounds: {},
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
        await setGame({ ...withGame, entrantsPerMatch: 4, advancePerMatch: 2 }),
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
      const third = matchAt(view, 2, 2).match;
      expect(third.thirdPlace).toBe(true);
      expect(matchAt(view, 2, 1).match.thirdPlace).toBe(false);
      expect(matchAt(view, 1, 1).match.loserTo).toEqual({
        matchId: third.id,
        slot: 0,
      });
      expect(matchAt(view, 1, 2).match.loserTo).toEqual({
        matchId: third.id,
        slot: 1,
      });

      const record = async (
        round: number,
        position: number,
        winner: string,
      ) => {
        view = (await queries.getBracket(f.competitionId, tx))!;
        const match = matchAt(view, round, position).match;
        const ids = match.slots.map((s) => s.entrantId!);
        return mutations.recordMatchResult(
          f.competitionId,
          match.id,
          { order: [id(winner), ...ids.filter((i) => i !== id(winner))] },
          f.ctx,
          tx,
        );
      };
      await record(1, 1, "Blue");
      view = (await queries.getBracket(f.competitionId, tx))!;
      expect(matchAt(view, 2, 2).labels).toEqual(["Red", null]);

      // Locked once a Match Result exists.
      expect(await setGame({ ...withGame, thirdPlaceMatch: false })).toEqual({
        ok: false,
        error: "Locked once a Match has a result.",
      });
      expect(await savedConfig(tx, f, f.competitionId)).toEqual(withGame);
      expect(
        (await queries.getBracket(f.competitionId, tx))!.bracket.matches,
      ).toHaveLength(4);

      await record(1, 2, "Green");
      await record(2, 1, "Green");
      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: false,
        error: "Finish every Match before closing.",
      });
      expect((await queries.getBracket(f.competitionId, tx))!.winner).toBe(
        id("Green"),
      );
      await record(2, 2, "Gold");
      expect((await queries.getBracket(f.competitionId, tx))!.winner).toBe(
        id("Green"),
      );
      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });

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
      const { bracketMatch, bracketMatchEntrant, entrant } = f.schema;
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
        .insert(bracketMatch)
        .values({
          competitionId: f.competitionId,
          round: 1,
          position: 1,
          advanceCount: 1,
        })
        .returning({ id: bracketMatch.id });

      /** The Postgres error code an insert fails with, or null. */
      const insertError = async (
        row: Omit<typeof bracketMatchEntrant.$inferInsert, "matchId">,
      ) =>
        tx
          .transaction(async (savepoint) => {
            await savepoint
              .insert(bracketMatchEntrant)
              .values({ matchId: final.id, ...row });
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
      // A Match may hold more than two Entrants (the matches Format).
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
  /** A Match's `recorded_at`, straight from the row. */
  async function recordedAtOf(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    matchId: string,
  ) {
    const [row] = await tx
      .select({ recordedAt: f.schema.bracketMatch.recordedAt })
      .from(f.schema.bracketMatch)
      .where(eq(f.schema.bracketMatch.id, matchId));
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
      semi1: matchAt(view, 1, 1).match.id,
      semi2: matchAt(view, 1, 2).match.id,
      final: matchAt(view, 2, 1).match.id,
    };
  }

  const LONG_AGO = new Date("2000-01-01T00:00:00Z");

  it("is null for a Match that isn't played, and set when an Organizer saves its result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2 } = await generated(tx);
      expect(await recordedAtOf(tx, f, semi1)).toBeNull();

      const before = Date.now();
      await mutations.recordMatchResult(
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
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        result,
        f.ctx,
        tx,
      );
      await tx
        .update(f.schema.bracketMatch)
        .set({ recordedAt: LONG_AGO })
        .where(eq(f.schema.bracketMatch.id, semi1));

      // A score-only edit.
      await mutations.recordMatchResult(
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
        .update(f.schema.bracketMatch)
        .set({ recordedAt: LONG_AGO })
        .where(eq(f.schema.bracketMatch.id, semi1));
      await mutations.recordMatchResult(
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

  it("is cleared on a Match whose result is cleared, and kept on the Match that was saved", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2, final } = await generated(tx);
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.competitionId,
        final,
        { order: [id("Red"), id("Gold")] },
        f.ctx,
        tx,
      );
      expect(await recordedAtOf(tx, f, final)).toBeInstanceOf(Date);

      // The Final is cleared, then Blue wins the first Semifinal.
      expect(
        await mutations.clearMatchResult(f.competitionId, final, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await recordedAtOf(tx, f, final)).toBeNull();
      expect(
        await mutations.recordMatchResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await recordedAtOf(tx, f, final)).toBeNull();
      expect(await recordedAtOf(tx, f, semi1)).toBeInstanceOf(Date);
      expect(await recordedAtOf(tx, f, semi2)).toBeInstanceOf(Date);
    });
  });

  it("reaches the Bracket view as recordedAt on a played Match", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { f, mutations, id, semi1, semi2 } = await generated(tx);
      const { queries } = await modules();
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      const view = (await queries.getBracket(f.competitionId, tx))!;
      const byId = new Map(view.bracket.matches.map((h) => [h.id, h]));
      expect(byId.get(semi1)!.recordedAt).toBeInstanceOf(Date);
      expect(byId.get(semi2)!.recordedAt).toBeNull();
    });
  });
});

describe.skipIf(!isLocalDatabase)("Match reporters", () => {
  const reporterEmail = "neo@jahnelgroup.com";

  /** A Match's reporter columns, straight from the row. */
  async function reporterOf(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    matchId: string,
  ) {
    const [row] = await tx
      .select({
        email: f.schema.bracketMatch.reportedByEmail,
        participantId: f.schema.bracketMatch.reportedByParticipantId,
      })
      .from(f.schema.bracketMatch)
      .where(eq(f.schema.bracketMatch.id, matchId));
    return row;
  }

  const NONE = { email: null, participantId: null };

  /** Marks a Match as self-reported by Neo, as a report would. */
  async function markReported(
    tx: DBTx,
    f: Awaited<ReturnType<typeof fixture>>,
    matchId: string,
  ) {
    await tx
      .update(f.schema.bracketMatch)
      .set({ reportedByEmail: reporterEmail, reportedByParticipantId: f.neo })
      .where(eq(f.schema.bracketMatch.id, matchId));
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
      semi1: matchAt(view, 1, 1).match.id,
      semi2: matchAt(view, 1, 2).match.id,
      final: matchAt(view, 2, 1).match.id,
    };
  }

  it("a Host result leaves both reporter columns null", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1, final } = await drawn(tx);

      await mutations.recordMatchResult(
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

      await mutations.recordMatchResult(
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
        return mutations.writeMatchResult(
          lockTx,
          found,
          semi1,
          { order: [id("Red"), id("Blue")] },
          { email: reporterEmail, participantId: f.neo },
        );
      });
      expect(result).toEqual({ ok: true });
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
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await markReported(tx, f, semi1);

      // The same result again changes no Match: it's still the reporter's.
      expect(
        await mutations.recordMatchResult(
          f.competitionId,
          semi1,
          { order: [id("Red"), id("Blue")] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await reporterOf(tx, f, semi1)).toEqual({
        email: reporterEmail,
        participantId: f.neo,
      });

      // A different result is the Host's now.
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        { order: [id("Blue"), id("Red")] },
        f.ctx,
        tx,
      );
      expect(await reporterOf(tx, f, semi1)).toEqual(NONE);
    });
  });

  it("single elimination: a refused re-record keeps the reported Final's reporter; clearing the Final clears it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const { f, id, semi1, semi2, final } = await drawn(tx);
      await mutations.recordMatchResult(
        f.competitionId,
        semi1,
        { order: [id("Red"), id("Blue")] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.competitionId,
        semi2,
        { order: [id("Gold"), id("Green")] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.competitionId,
        final,
        { order: [id("Gold"), id("Red")] },
        f.ctx,
        tx,
      );
      await markReported(tx, f, final);
      const reported = await reporterOf(tx, f, final);

      expect(
        await mutations.recordMatchResult(
          f.competitionId,
          semi1,
          { order: [id("Blue"), id("Red")] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A later Match already used this result. Change that Match first.",
      });
      expect(await reporterOf(tx, f, final)).toEqual(reported);
      expect(
        await mutations.clearMatchResult(f.competitionId, final, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await reporterOf(tx, f, final)).toEqual(NONE);
    });
  });

  it("Matches: a refused re-record keeps the reported Final's reporter; clearing the Final clears it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await generatedMatches(tx);
      const view = (await queries.getBracket(f.relayId, tx))!;
      const first = matchAt(view, 1, 1).match;
      const second = matchAt(view, 1, 2).match;
      const final = matchAt(view, 2, 1).match;
      const [a0, a1, a2, a3] = first.slots.map((s) => s.entrantId!);
      const [b0, b1, b2, b3] = second.slots.map((s) => s.entrantId!);
      await mutations.recordMatchResult(
        f.relayId,
        first.id,
        { order: [a0, a1, a2, a3] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.relayId,
        second.id,
        { order: [b0, b1, b2, b3] },
        f.ctx,
        tx,
      );
      await mutations.recordMatchResult(
        f.relayId,
        final.id,
        { order: [a0, b0, a1, b1] },
        f.ctx,
        tx,
      );
      await markReported(tx, f, final.id);
      const reported = await reporterOf(tx, f, final.id);

      expect(
        await mutations.recordMatchResult(
          f.relayId,
          first.id,
          { order: [a2, a1, a0, a3] },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A later Match already used this result. Change that Match first.",
      });
      expect(await reporterOf(tx, f, final.id)).toEqual(reported);
      expect(
        await mutations.clearMatchResult(f.relayId, final.id, f.ctx, tx),
      ).toEqual({ ok: true });
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
        .set({ closedAt: new Date() })
        .where(eq(f.schema.competition.id, f.competitionId));
      const closed = {
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
      ).toEqual(closed);
      expect(
        await mutations.updateSquad(
          f.competitionId,
          squad.id,
          values,
          f.ctx,
          tx,
        ),
      ).toEqual(closed);
      expect(
        await mutations.deleteSquad(f.competitionId, squad.id, f.ctx, tx),
      ).toEqual(closed);
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

  it("four Squads of two Teams generate, play out and close into a Team Points Entry for each finalist", async () => {
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
      expect(matchAt(view, 1, 1).labels).toEqual(["Red Bravo", "Red Alpha"]);
      expect(matchAt(view, 1, 2).labels).toEqual(["Blue Alpha", "Blue Bravo"]);
      const id = (label: string) =>
        view.entrants.find((e) => e.label === label)!.id;
      for (const [position, round, winner] of [
        [1, 1, "Red Bravo"],
        [2, 1, "Blue Alpha"],
        [1, 2, "Red Bravo"],
      ] as const) {
        view = (await queries.getBracket(f.competitionId, tx))!;
        const match = matchAt(view, round, position).match;
        const ids = match.slots.map((s) => s.entrantId!);
        expect(
          await mutations.recordMatchResult(
            f.competitionId,
            match.id,
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
                eq(schema.pointsEntry.generated, true),
              ),
            )
        ).sort(
          (a, b) => b.points - a.points || a.teamId!.localeCompare(b.teamId!),
        );
      // No 3rd place Match: the semifinal losers (Red Alpha, Blue Bravo)
      // aren't placed and get no Placement Points.
      const expected = [
        { teamId: f.red, participantId: null, points: 10 },
        { teamId: f.blue, participantId: null, points: 6 },
      ];

      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });
      expect(await generated()).toEqual(expected);

      expect(
        await (
          await import("@/mutations/close")
        ).reopenCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await generated()).toEqual([]);
      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.competitionId, f.ctx, tx),
      ).toEqual({
        ok: true,
      });
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
 * The fixture plus two Competitions made by `createCompetition`: "Bouncy
 * Pong" (individual Head-to-head) and "Stairs" (team Best score), and
 * helpers that log a Match or an Attempt straight into the tables.
 */
async function loggedFixture(tx: DBTx) {
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
  /** An Attempt by `participantId`, credited to `teamId`. */
  const logAttempt = async (participantId: string, teamId: string) => {
    await tx.insert(f.schema.attempt).values({
      competitionId: stairsId,
      participantId,
      teamId,
      score: 3,
      loggedByEmail: actorEmail,
    });
  };
  /** A Match between Bouncy Pong's two Entrants. */
  const logMatch = async () => {
    const [row] = await tx
      .insert(f.schema.seriesMatch)
      .values({ competitionId: pongId, loggedByEmail: actorEmail })
      .returning({ id: f.schema.seriesMatch.id });
    const sides = await tx
      .select({ id: f.schema.entrant.id })
      .from(f.schema.entrant)
      .where(eq(f.schema.entrant.competitionId, pongId));
    await tx.insert(f.schema.seriesMatchEntrant).values(
      sides.map((side, i) => ({
        seriesMatchId: row.id,
        entrantId: side.id,
        place: i + 1,
      })),
    );
  };
  return { ...f, setup, pongId, stairsId, logAttempt, logMatch };
}

describe.skipIf(!isLocalDatabase)(
  "Head-to-head and Best score Competitions",
  () => {
    const settingsOf = async (tx: DBTx, id: string) => {
      const schema = await import("@/db/schema");
      const [found] = await tx
        .select({
          format: schema.competition.format,
          scoreDirection: schema.competition.scoreDirection,
          seriesConfig: schema.competition.seriesConfig,
          bestScoreConfig: schema.competition.bestScoreConfig,
          bracketConfig: schema.competition.bracketConfig,
        })
        .from(schema.competition)
        .where(eq(schema.competition.id, id));
      return found;
    };

    it("creates a Head-to-head with Best of 3 and a Best score Competition with higher is better", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await loggedFixture(tx);
        expect(await settingsOf(tx, f.pongId)).toEqual({
          format: "head-to-head",
          scoreDirection: "none",
          seriesConfig: { drawsAllowed: false, bestOf: 3 },
          bestScoreConfig: null,
          bracketConfig: null,
        });
        expect(await settingsOf(tx, f.stairsId)).toEqual({
          format: "best-score",
          scoreDirection: "higher",
          seriesConfig: null,
          bestScoreConfig: { teamScore: "best-member" },
          bracketConfig: null,
        });
      });
    });

    it("won't delete a Competition that has Matches or Attempts", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await loggedFixture(tx);
        await f.logAttempt(f.neo, f.red);
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
        const f = await loggedFixture(tx);
        expect(await queries.getBracket(f.pongId, tx)).toBeUndefined();
        const names = (
          await queries.getBracketCompetitions({ id: f.ctx.warWeekId }, tx)
        ).map((c) => c.name);
        expect(names).toEqual(["Captain Clash", "Speed Chess"]);
      });
    });

    it("changes Format to and from Head-to-head or Best score, with the new Format's create defaults", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await loggedFixture(tx);
        expect(
          await mutations.setCompetitionFormat(
            f.pongId,
            { format: "bracket" },
            f.ctx,
            tx,
          ),
        ).toEqual({ ok: true });
        expect(await settingsOf(tx, f.pongId)).toEqual({
          format: "bracket",
          scoreDirection: "none",
          seriesConfig: null,
          bestScoreConfig: null,
          bracketConfig: {
            kind: "head-to-head",
            entrantsPerMatch: 2,
            advancePerMatch: 1,
            thirdPlaceMatch: false,
            rounds: {},
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
        expect(await settingsOf(tx, f.competitionId)).toEqual({
          format: "best-score",
          scoreDirection: "higher",
          seriesConfig: null,
          bestScoreConfig: { teamScore: "best-member" },
          bracketConfig: null,
        });
        // A logged Attempt is a result: the Format locks.
        await f.logAttempt(f.neo, f.red);
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

    it("sets Entrants only for the Format the caller names, and never on Best score", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await loggedFixture(tx);
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
            { targetIds: [], format: "head-to-head" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "This Competition isn't run as Head-to-head.",
        });
        expect(
          await mutations.replaceEntrants(
            f.stairsId,
            { targetIds: [f.red] },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "Best score has no Entrant list: anyone can log an Attempt.",
        });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.neo, f.trinity], format: "head-to-head" },
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
        const f = await loggedFixture(tx);
        expect(
          await mutations.generateBracket(f.pongId, {}, f.ctx, tx),
        ).toEqual({
          ok: false,
          error: "This Competition isn't run as a Bracket.",
        });
      });
    });

    it("enters exactly 2 Participants in an individual Head-to-head, never Squads or Teams", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations, queries } = await modules();
        const f = await loggedFixture(tx);
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
            f.pongId,
            { targetIds: [], kind: "squad" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "Squads aren't entered in a Head-to-head.",
        });
        expect(
          await mutations.replaceEntrants(
            f.pongId,
            { targetIds: [f.red, f.blue], kind: "team" },
            f.ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "An individual Competition's Entrants are Participants.",
        });
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
        ).toEqual({
          ok: false,
          error: "A Head-to-head needs exactly 2 Entrants.",
        });
      });
    });

    it("refuses a scoring change and deleting a player while Matches or Attempts exist", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { mutations } = await modules();
        const f = await loggedFixture(tx);
        await mutations.replaceEntrants(
          f.pongId,
          { targetIds: [f.neo, f.trinity] },
          f.ctx,
          tx,
        );
        await f.logMatch();
        await f.logAttempt(f.neo, f.gold);

        expect(await f.setup.deleteTeam(f.gold, f.ctx, tx)).toEqual({
          ok: false,
          error: "This Team has 1 Attempt. Move or delete them first.",
        });
        expect(await f.setup.deleteParticipant(f.neo, f.ctx, tx)).toMatchObject(
          { ok: false },
        );
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
        ).toMatchObject({ ok: false });
      });
    });

    it("takes a closed Head-to-head's Placement Points change", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await loggedFixture(tx);
        await tx
          .update(f.schema.competition)
          .set({ closedAt: new Date() })
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

    it.each([
      [
        "a series config on a Bracket",
        "bracket",
        { seriesConfig: { drawsAllowed: false, bestOf: 3 } },
      ],
      ["a Head-to-head with no series config", "pong", { seriesConfig: null }],
      [
        "a Best score config on a Head-to-head",
        "pong",
        { bestScoreConfig: { teamScore: "best-member" } },
      ],
      ["Max attempts on a Head-to-head", "pong", { maxAttempts: 3 }],
      ["Max attempts of 0", "stairs", { maxAttempts: 0 }],
      ["enrollment on Best score", "stairs", { selfEnroll: true }],
      ["an Entrant limit on a Head-to-head", "pong", { entrantLimit: 4 }],
      ["Best score with no direction", "stairs", { scoreDirection: "none" }],
    ] as const)("refuses %s (the database CHECK)", async (_, which, values) => {
      await inRolledBackTransaction(async (tx) => {
        const f = await loggedFixture(tx);
        const target = {
          bracket: f.competitionId,
          pong: f.pongId,
          stairs: f.stairsId,
        }[which];
        await expect(
          tx.transaction((inner) =>
            inner
              .update(f.schema.competition)
              .set(values as Partial<typeof f.schema.competition.$inferInsert>)
              .where(eq(f.schema.competition.id, target)),
          ),
        ).rejects.toThrow();
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("each Match's advancing count", () => {
  it("is 1 in a head-to-head Bracket and the final, else the config's, and Scores are stored as numbers", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations } = await modules();
      const f = await fixture(tx);
      const people = await tx
        .insert(f.schema.participant)
        .values(
          Array.from({ length: 8 }, (_, i) => ({
            warWeekId: f.ctx.warWeekId,
            displayName: `Player ${i + 1}`,
          })),
        )
        .returning({ id: f.schema.participant.id });
      const counts = async () =>
        (
          await tx
            .select({
              round: f.schema.bracketMatch.round,
              advanceCount: f.schema.bracketMatch.advanceCount,
            })
            .from(f.schema.bracketMatch)
            .where(eq(f.schema.bracketMatch.competitionId, f.chessId))
            .orderBy(
              f.schema.bracketMatch.round,
              f.schema.bracketMatch.position,
            )
        ).map((m) => [m.round, m.advanceCount]);

      expect(
        await mutations.setCompetitionFormat(
          f.chessId,
          {
            format: "bracket",
            config: {
              kind: "group",
              entrantsPerMatch: 4,
              advancePerMatch: 2,
              thirdPlaceMatch: false,
              rounds: {},
            },
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      await mutations.replaceEntrants(
        f.chessId,
        { targetIds: people.map((p) => p.id) },
        f.ctx,
        tx,
      );
      expect(
        await mutations.generateBracket(f.chessId, { rng: () => 0 }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await counts()).toEqual([
        [1, 2],
        [1, 2],
        [2, 1],
      ]);

      const [first] = await tx
        .select({ id: f.schema.bracketMatch.id })
        .from(f.schema.bracketMatch)
        .where(eq(f.schema.bracketMatch.competitionId, f.chessId))
        .orderBy(f.schema.bracketMatch.round, f.schema.bracketMatch.position)
        .limit(1);
      const slots = await tx
        .select({ entrantId: f.schema.bracketMatchEntrant.entrantId })
        .from(f.schema.bracketMatchEntrant)
        .where(eq(f.schema.bracketMatchEntrant.matchId, first.id))
        .orderBy(f.schema.bracketMatchEntrant.slot);
      const order = slots.map((s) => s.entrantId);
      expect(
        await mutations.recordMatchResult(
          f.chessId,
          first.id,
          { order, scores: { [order[0]]: "21.5", [order[1]]: "9" } },
          f.ctx,
          tx,
        ),
      ).toMatchObject({ ok: true });
      const scores = await tx
        .select({ score: f.schema.bracketMatchEntrant.score })
        .from(f.schema.bracketMatchEntrant)
        .where(eq(f.schema.bracketMatchEntrant.matchId, first.id))
        .orderBy(f.schema.bracketMatchEntrant.place);
      expect(scores.map((s) => s.score).slice(0, 2)).toEqual([21.5, 9]);

      expect(
        await mutations.setCompetitionFormat(
          f.competitionId,
          { format: "bracket" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      await mutations.replaceEntrants(
        f.competitionId,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(f.competitionId, {}, f.ctx, tx);
      const headToHead = await tx
        .select({ advanceCount: f.schema.bracketMatch.advanceCount })
        .from(f.schema.bracketMatch)
        .where(eq(f.schema.bracketMatch.competitionId, f.competitionId));
      expect(headToHead.map((m) => m.advanceCount)).toEqual([1, 1, 1]);
    });
  });
});
