import { and, asc, eq } from "drizzle-orm";
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
const ROUND_LOCKED =
  "Editing a round is locked once any Match in it has a result.";

async function modules() {
  return {
    schema: await import("@/db/schema"),
    brackets: await import("@/mutations/brackets"),
    edits: await import("@/mutations/bracket-edits"),
    close: await import("@/mutations/close"),
    queries: await import("@/queries/brackets"),
  };
}

/**
 * A War Week with an individual Group Bracket of 11 Participants, 4 per
 * Match with 2 advancing and Placement Points 5 · 3 · 1, generated: AC 13's
 * Bracket (spec R21).
 */
async function elevenFixture(tx: DBTx) {
  const { schema, brackets } = await modules();
  const [ww] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "t1",
      editionNumber: 9001,
      year: 9001,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Group test",
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
  const ctx = { warWeekId: ww.id, actorEmail };
  const people = await tx
    .insert(schema.participant)
    .values(
      Array.from({ length: 11 }, (_, i) => ({
        warWeekId: ww.id,
        displayName: `P${i + 1}`,
      })),
    )
    .returning({ id: schema.participant.id });
  const [created] = await tx
    .insert(schema.competition)
    .values({
      warWeekId: ww.id,
      name: "Group of 11",
      scoring: "individual",
      format: "bracket",
      placementPoints: [5, 3, 1],
    })
    .returning({ id: schema.competition.id });
  const id = created.id;
  expect(
    await brackets.setCompetitionFormat(
      id,
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
      ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  expect(
    await brackets.replaceEntrants(
      id,
      { targetIds: people.map((p) => p.id) },
      ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  expect(await brackets.generateBracket(id, { rng: () => 0 }, ctx, tx)).toEqual(
    { ok: true },
  );
  return { id, ctx };
}

/** The stored Matches: per Round, each Match's slot count, advancing and status. */
async function storedShape(tx: DBTx, competitionId: string) {
  const { schema } = await modules();
  const rows = await tx
    .select({
      round: schema.bracketMatch.round,
      slotCount: schema.bracketMatch.slotCount,
      advanceCount: schema.bracketMatch.advanceCount,
      status: schema.bracketMatch.status,
    })
    .from(schema.bracketMatch)
    .where(eq(schema.bracketMatch.competitionId, competitionId))
    .orderBy(asc(schema.bracketMatch.round), asc(schema.bracketMatch.position));
  const rounds: string[][] = [];
  for (const row of rows) {
    (rounds[row.round - 1] ??= []).push(
      `${row.slotCount}/${row.advanceCount} ${row.status}`,
    );
  }
  return rounds;
}

/** The Bracket as loaded, its Matches of a Round in position order. */
async function roundOf(tx: DBTx, competitionId: string, round: number) {
  const { queries } = await modules();
  const bracket = await queries.loadBracket(competitionId, tx);
  return bracket.matches
    .filter((h) => h.round === round)
    .sort((a, b) => a.position - b.position);
}

/** Records a Match with its Entrants finishing in slot order. */
async function recordInSlotOrder(
  tx: DBTx,
  competitionId: string,
  ctx: { warWeekId: string; actorEmail: string },
  matchId: string,
) {
  const { brackets, queries } = await modules();
  const bracket = await queries.loadBracket(competitionId, tx);
  const match = bracket.matches.find((h) => h.id === matchId)!;
  const result = await brackets.recordMatchResult(
    competitionId,
    matchId,
    { order: match.slots.map((s) => s.entrantId!) },
    ctx,
    tx,
  );
  expect(result.ok).toBe(true);
}

describe.skipIf(!isLocalDatabase)("Group Bracket edits", () => {
  it("runs AC 13: a move, an override to 3 Entrants and 1 advancing, a bye, the next Round from summed advancers, Close into points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { edits, close, schema, queries } = await modules();
      const { id, ctx } = await elevenFixture(tx);
      expect(await storedShape(tx, id)).toEqual([
        ["3/2 ready", "4/2 ready", "4/2 ready"],
        ["3/2 pending", "3/2 pending"],
        ["4/1 pending"],
      ]);

      // Match 2's last Entrant moves to Match 1: Matches of 4, 3 and 4.
      let [m1, m2] = await roundOf(tx, id, 1);
      expect(
        await edits.moveMatchEntrant(
          id,
          { entrantId: m2.slots[3].entrantId!, toMatchId: m1.id },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await edits.setMatchAdvance(id, m2.id, { advanceCount: 1 }, ctx, tx),
      ).toEqual({ ok: true });
      // 2 + 1 + 2 = 5 go on: Matches of 3 and 2, the 2 a bye once filled.
      expect(await storedShape(tx, id)).toEqual([
        ["4/2 ready", "3/1 ready", "4/2 ready"],
        ["3/2 pending", "2/2 pending"],
        ["4/1 pending"],
      ]);

      [m1, m2] = await roundOf(tx, id, 1);
      const m3 = (await roundOf(tx, id, 1))[2];
      await recordInSlotOrder(tx, id, ctx, m1.id);
      // Round 1 has a result: every edit to it is refused, with the reason.
      expect(
        await edits.setMatchAdvance(id, m3.id, { advanceCount: 1 }, ctx, tx),
      ).toEqual({ ok: false, error: ROUND_LOCKED });
      expect(
        await edits.moveMatchEntrant(
          id,
          { entrantId: m3.slots[0].entrantId!, toMatchId: m2.id },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: ROUND_LOCKED });
      expect(
        await edits.setRoundDefaults(
          id,
          1,
          { entrantsPerMatch: 3, advancePerMatch: 1 },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: ROUND_LOCKED });

      await recordInSlotOrder(tx, id, ctx, m2.id);
      await recordInSlotOrder(tx, id, ctx, m3.id);
      expect(await storedShape(tx, id)).toEqual([
        ["4/2 played", "3/1 played", "4/2 played"],
        ["3/2 ready", "2/2 played"],
        ["4/1 pending"],
      ]);
      const [r2m1] = await roundOf(tx, id, 2);
      await recordInSlotOrder(tx, id, ctx, r2m1.id);
      const [final] = await roundOf(tx, id, 3);
      expect(final.slots.every((s) => s.entrantId !== null)).toBe(true);
      await recordInSlotOrder(tx, id, ctx, final.id);

      expect(await close.closeCompetition(id, ctx, tx)).toEqual({ ok: true });
      const placed = final.slots.map((s) => s.entrantId!);
      const view = (await queries.getBracket(id, tx))!;
      expect(view.winner).toBe(placed[0]);
      const entries = await tx
        .select({
          participantId: schema.pointsEntry.participantId,
          points: schema.pointsEntry.points,
        })
        .from(schema.pointsEntry)
        .where(
          and(
            eq(schema.pointsEntry.competitionId, id),
            eq(schema.pointsEntry.generated, true),
          ),
        );
      const participantOf = (entrantId: string) =>
        view.entrants.find((e) => e.id === entrantId)!.participantId;
      // Places 1–3 earn 5 · 3 · 1; the final's 4th place earns nothing.
      expect(entries.sort((a, b) => b.points - a.points)).toEqual([
        { participantId: participantOf(placed[0]), points: 5 },
        { participantId: participantOf(placed[1]), points: 3 },
        { participantId: participantOf(placed[2]), points: 1 },
      ]);

      // Closed: no edit at all.
      expect(
        await edits.setMatchAdvance(id, r2m1.id, { advanceCount: 1 }, ctx, tx),
      ).toEqual({ ok: false, error: "Reopen the Bracket before changing it." });
    });
  });

  it("saves a Round's defaults and re-plans the later Rounds, dropping defaults beyond the final", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { edits, schema } = await modules();
      const { id, ctx } = await elevenFixture(tx);
      expect(
        await edits.setRoundDefaults(
          id,
          2,
          { entrantsPerMatch: 3, advancePerMatch: 1 },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await storedShape(tx, id)).toEqual([
        ["3/2 ready", "4/2 ready", "4/2 ready"],
        ["3/1 pending", "3/1 pending"],
        ["2/1 pending"],
      ]);
      const [row] = await tx
        .select({ bracketConfig: schema.competition.bracketConfig })
        .from(schema.competition)
        .where(eq(schema.competition.id, id));
      expect(row.bracketConfig).toMatchObject({
        rounds: { "2": { entrantsPerMatch: 3, advancePerMatch: 1 } },
      });

      // Round 1's 6 advancers fit one Match of 8: Round 2 is the final.
      expect(
        await edits.setRoundDefaults(
          id,
          2,
          { entrantsPerMatch: 8, advancePerMatch: 2 },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await storedShape(tx, id)).toEqual([
        ["3/2 ready", "4/2 ready", "4/2 ready"],
        ["6/1 pending"],
      ]);
      const [after] = await tx
        .select({ bracketConfig: schema.competition.bracketConfig })
        .from(schema.competition)
        .where(eq(schema.competition.id, id));
      expect(after.bracketConfig).toMatchObject({
        rounds: { "2": { entrantsPerMatch: 8, advancePerMatch: 2 } },
      });

      expect(
        await edits.setRoundDefaults(
          id,
          1,
          { entrantsPerMatch: 4, advancePerMatch: 4 },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Fewer must advance than play in a Match.",
      });
    });
  });

  it("re-fills the next Round from its defaults when a changed result changes who advances (D1f)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { edits, brackets } = await modules();
      const { id, ctx } = await elevenFixture(tx);
      for (const match of await roundOf(tx, id, 1)) {
        await recordInSlotOrder(tx, id, ctx, match.id);
      }
      const [r2m1, r2m2] = await roundOf(tx, id, 2);
      // Moved: Round 2 becomes Matches of 2 (a bye) and 4.
      expect(
        await edits.moveMatchEntrant(
          id,
          { entrantId: r2m1.slots[2].entrantId!, toMatchId: r2m2.id },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await storedShape(tx, id)).toEqual([
        ["3/2 played", "4/2 played", "4/2 played"],
        ["2/2 played", "4/2 ready"],
        ["4/1 pending"],
      ]);

      // Round 1 Match 1's 3rd now finishes 1st: Round 2 is re-filled from
      // its defaults, the move lost.
      const [m1] = await roundOf(tx, id, 1);
      const [a, b, c] = m1.slots.map((s) => s.entrantId!);
      expect(
        await brackets.recordMatchResult(
          id,
          m1.id,
          { order: [c, a, b] },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true, resetMatchIds: [] });
      expect(await storedShape(tx, id)).toEqual([
        ["3/2 played", "4/2 played", "4/2 played"],
        ["3/2 ready", "3/2 ready"],
        ["4/1 pending"],
      ]);
      const round2 = (await roundOf(tx, id, 2)).flatMap((h) =>
        h.slots.map((s) => s.entrantId),
      );
      expect(round2).toContain(c);
      expect(round2).not.toContain(b);
    });
  });

  it("refuses edits to a head-to-head Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { edits, brackets } = await modules();
      const { id, ctx } = await elevenFixture(tx);
      await brackets.setCompetitionFormat(
        id,
        {
          format: "bracket",
          config: {
            kind: "head-to-head",
            entrantsPerMatch: 2,
            advancePerMatch: 1,
            thirdPlaceMatch: false,
            rounds: {},
          },
        },
        ctx,
        tx,
      );
      await brackets.generateBracket(id, { rng: () => 0 }, ctx, tx);
      const [m1] = await roundOf(tx, id, 1);
      expect(
        await edits.setMatchAdvance(id, m1.id, { advanceCount: 1 }, ctx, tx),
      ).toEqual({
        ok: false,
        error: "Only a Group Bracket's Matches can be edited.",
      });
    });
  });
});
