import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { DEFAULT_BRACKET_CONFIG } from "@/lib/bracket/config";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const actorEmail = "organizer@jahnelgroup.com";

// Every draw near 1 leaves the Entrants in the order given (Fisher–Yates
// swaps each with itself), so Seed Positions follow `targetIds`.
const rngKeep = () => 0.999;

/**
 * A War Week with a Day, four Teams and two Participants, plus a War Week
 * of its own for a Competition that must not show.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `t${n}`,
        editionNumber: 9200 + n,
        year: 9200 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Timed Heats test",
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
  const [day, otherDay] = await tx
    .insert(schema.day)
    .values([
      { warWeekId, date: "2099-01-01", dayTheme: "Kickoff" },
      { warWeekId: otherWarWeekId, date: "2099-01-01", dayTheme: "Kickoff" },
    ])
    .returning({ id: schema.day.id });
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
    .returning({ id: schema.team.id });
  const participants = await tx
    .insert(schema.participant)
    .values(
      ["Ashley Schuliger", "Sam Schantz"].map((displayName) => ({
        warWeekId,
        displayName,
      })),
    )
    .returning({ id: schema.participant.id });
  const [otherTeamA, otherTeamB] = await tx
    .insert(schema.team)
    .values(
      ["Red", "Blue"].map((name) => ({
        warWeekId: otherWarWeekId,
        name,
        color: "#f00",
      })),
    )
    .returning({ id: schema.team.id });
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    dayId: day.id,
    otherDayId: otherDay.id,
    teamIds: teams.map((t) => t.id),
    participantIds: participants.map((p) => p.id),
    otherTeamIds: [otherTeamA.id, otherTeamB.id],
  };
}

async function modules() {
  return {
    mutations: await import("@/mutations/brackets"),
    queries: await import("@/queries/schedule"),
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** A generated single-elimination Competition, its Seed Positions in order. */
async function bracket(
  tx: DBTx,
  f: Fixture,
  ctx: Fixture["ctx"],
  name: string,
  scoring: "team" | "individual",
  targetIds: string[],
) {
  const { mutations } = await modules();
  const [row] = await tx
    .insert(f.schema.competition)
    .values({
      warWeekId: ctx.warWeekId,
      name,
      scoring,
      format: "bracket",
    })
    .returning({ id: f.schema.competition.id });
  expect(
    await mutations.replaceEntrants(row.id, { targetIds }, ctx, tx),
  ).toEqual({ ok: true });
  expect(
    await mutations.generateBracket(row.id, { rng: rngKeep }, ctx, tx),
  ).toEqual({ ok: true });
  const heatId = async (round: number, position: number) => {
    const [heat] = await tx
      .select({ id: f.schema.heat.id })
      .from(f.schema.heat)
      .where(
        and(
          eq(f.schema.heat.competitionId, row.id),
          eq(f.schema.heat.round, round),
          eq(f.schema.heat.position, position),
        ),
      );
    return heat.id;
  };
  return { id: row.id, heatId };
}

describe.skipIf(!isLocalDatabase)("getTimedHeats", () => {
  it("returns only the timed ready Heats of the War Week, with their Entrant labels", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const at = (dayId: string, startTime: string, location: string | null) =>
        ({ dayId, startTime, location }) as const;

      // Red v Gold (Semifinal 1), Blue v Green (Semifinal 2), the Final.
      const beyblades = await bracket(tx, f, f.ctx, "Beyblades", "team", [
        ...f.teamIds,
      ]);
      const semi1 = await beyblades.heatId(1, 1);
      const semi2 = await beyblades.heatId(1, 2);
      const final = await beyblades.heatId(2, 1);
      // Ashley v Sam: one Heat, the Final.
      const chess = await bracket(
        tx,
        f,
        f.ctx,
        "Chess",
        "individual",
        f.participantIds,
      );
      const chessFinal = await chess.heatId(1, 1);
      // Ready but never timed.
      const darts = await bracket(tx, f, f.ctx, "Darts", "team", [
        ...f.teamIds,
      ]);
      await mutations.setHeatSchedule(
        darts.id,
        await darts.heatId(1, 1),
        { dayId: null, startTime: null, location: "Table 3" },
        f.ctx,
        tx,
      );
      // Another War Week's timed ready Heat.
      const other = await bracket(
        tx,
        f,
        f.otherCtx,
        "Beyblades",
        "team",
        f.otherTeamIds,
      );

      for (const [competitionId, heatId, values, ctx] of [
        [beyblades.id, semi1, at(f.dayId, "19:00", "Main room"), f.ctx],
        [beyblades.id, semi2, at(f.dayId, "19:30", null), f.ctx],
        [beyblades.id, final, at(f.dayId, "21:00", null), f.ctx],
        [chess.id, chessFinal, at(f.dayId, "12:00", null), f.ctx],
        [
          other.id,
          await other.heatId(1, 1),
          at(f.otherDayId, "12:00", null),
          f.otherCtx,
        ],
      ] as const) {
        expect(
          await mutations.setHeatSchedule(
            competitionId,
            heatId,
            values,
            ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      }
      // Semifinal 2 is decided; the Final is still pending.
      const [blueEntrant, greenEntrant] = await Promise.all(
        [f.teamIds[1], f.teamIds[2]].map(async (teamId) => {
          const [row] = await tx
            .select({ id: f.schema.entrant.id })
            .from(f.schema.entrant)
            .where(
              and(
                eq(f.schema.entrant.competitionId, beyblades.id),
                eq(f.schema.entrant.teamId, teamId),
              ),
            );
          return row.id;
        }),
      );
      const recorded = await mutations.recordHeatResult(
        beyblades.id,
        semi2,
        { order: [blueEntrant, greenEntrant] },
        f.ctx,
        tx,
      );
      expect(recorded.ok).toBe(true);

      const rows = await queries.getTimedHeats({ id: f.ctx.warWeekId }, tx);
      const shown = rows
        .map((row) => ({
          competition: row.competition.name,
          config: row.competition.config,
          finalRound: row.finalRound,
          heatId: row.heat.id,
          status: row.heat.status,
          dayId: row.heat.dayId,
          startTime: row.heat.startTime,
          location: row.heat.location,
          entrants: row.heat.slots.map((s) =>
            s.entrantId ? row.labels[s.entrantId] : null,
          ),
        }))
        .sort((a, b) => a.competition.localeCompare(b.competition));

      expect(shown).toEqual([
        {
          competition: "Beyblades",
          config: DEFAULT_BRACKET_CONFIG,
          finalRound: 2,
          heatId: semi1,
          status: "ready",
          dayId: f.dayId,
          startTime: "19:00:00",
          location: "Main room",
          entrants: ["Red", "Gold"],
        },
        {
          competition: "Chess",
          config: DEFAULT_BRACKET_CONFIG,
          finalRound: 1,
          heatId: chessFinal,
          status: "ready",
          dayId: f.dayId,
          startTime: "12:00:00",
          location: null,
          entrants: ["Ashley Schuliger", "Sam Schantz"],
        },
      ]);
    });
  });

  it("labels a timed Squad Heat by its Squads' names", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const [cypher] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Cypher",
          scoring: "team",
          format: "bracket",
        })
        .returning({ id: f.schema.competition.id });
      const squads = await tx
        .insert(f.schema.squad)
        .values([
          { competitionId: cypher.id, teamId: f.teamIds[0], name: "Red Alpha" },
          {
            competitionId: cypher.id,
            teamId: f.teamIds[1],
            name: "Blue Bravo",
          },
        ])
        .returning({ id: f.schema.squad.id });
      await tx.insert(f.schema.entrant).values(
        squads.map((squad, i) => ({
          competitionId: cypher.id,
          squadId: squad.id,
          seedPosition: i + 1,
        })),
      );
      expect(
        await mutations.generateBracket(cypher.id, { rng: rngKeep }, f.ctx, tx),
      ).toEqual({ ok: true });
      const [final] = await tx
        .select({ id: f.schema.heat.id })
        .from(f.schema.heat)
        .where(eq(f.schema.heat.competitionId, cypher.id));
      await mutations.setHeatSchedule(
        cypher.id,
        final.id,
        { dayId: f.dayId, startTime: "19:00", location: null },
        f.ctx,
        tx,
      );

      const [row] = await queries.getTimedHeats({ id: f.ctx.warWeekId }, tx);
      expect(
        row.heat.slots.map((s) =>
          s.entrantId ? row.labels[s.entrantId] : null,
        ),
      ).toEqual(["Red Alpha", "Blue Bravo"]);
    });
  });

  it("returns nothing for a War Week with no timed Heats", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      await bracket(tx, f, f.ctx, "Beyblades", "team", [...f.teamIds]);

      expect(await queries.getTimedHeats({ id: f.ctx.warWeekId }, tx)).toEqual(
        [],
      );
    });
  });
});
