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
        storyTheme: "Timed Matches test",
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

describe.skipIf(!isLocalDatabase)("getSchedule", () => {
  it("lists a Competition's own Schedule Items and no Match, however ready the Matches are", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      // Two ready Heats (Semifinals) and a pending Final.
      const beyblades = await bracket(tx, f, f.ctx, "Beyblades", "team", [
        ...f.teamIds,
      ]);
      await tx.insert(f.schema.scheduleItem).values({
        dayId: f.dayId,
        title: "Beyblades",
        startTime: "19:00:00",
        category: "competition",
        competitionId: beyblades.id,
      });

      const readyHeats = await tx
        .select({ id: f.schema.heat.id })
        .from(f.schema.heat)
        .where(
          and(
            eq(f.schema.heat.competitionId, beyblades.id),
            eq(f.schema.heat.status, "ready"),
          ),
        );
      expect(readyHeats).toHaveLength(2);

      const days = await queries.getSchedule(f.ctx.warWeekId, {}, tx);
      expect(days.flatMap((day) => day.items.map((i) => i.title))).toEqual([
        "Beyblades",
      ]);
      const [item] = days.flatMap((day) => day.items);
      expect(item.competition).toEqual({
        id: beyblades.id,
        name: "Beyblades",
      });
      for (const heat of readyHeats) {
        expect(item.id).not.toBe(heat.id);
      }
      expect(JSON.stringify(days)).not.toMatch(/Semifinal|Round 1/);
    });
  });
});
