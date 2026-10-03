import { eq } from "drizzle-orm";
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

// Every draw 0 shuffles [a, b, c] to [b, c, a] (see seeding.test.ts).
const rngZero = () => 0;

/**
 * A War Week with four Teams, plus a Team of another War Week, for building
 * Brackets in various states.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `u${n}`,
        editionNumber: 9100 + n,
        year: 9100 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Unfinalized Brackets test",
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
    .returning({ id: schema.team.id });
  const [red, blue, green, gold] = teams.map((t) => t.id);
  const [otherTeam] = await tx
    .insert(schema.team)
    .values({ warWeekId: otherWarWeekId, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    red,
    blue,
    green,
    gold,
    otherTeam: otherTeam.id,
  };
}

async function modules() {
  return {
    mutations: await import("@/mutations/brackets"),
    queries: await import("@/queries/unfinalized-brackets"),
  };
}

describe.skipIf(!isLocalDatabase)("getUnfinalizedBrackets", () => {
  it("lists a generated, unfinalized single-elimination Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const [pool] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Pool",
          scoring: "team",
          format: "bracket",
        })
        .returning({ id: f.schema.competition.id });
      await mutations.replaceEntrants(
        pool.id,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(pool.id, { rng: rngZero }, f.ctx, tx);

      expect(
        await queries.getUnfinalizedBrackets({ id: f.ctx.warWeekId }, tx),
      ).toEqual([{ id: pool.id, name: "Pool" }]);
    });
  });

  it("excludes a finalized Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const [pool] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Pool",
          scoring: "team",
          format: "bracket",
          placementPoints: [10, 6, 3],
        })
        .returning({ id: f.schema.competition.id });
      await mutations.replaceEntrants(
        pool.id,
        { targetIds: [f.red, f.blue, f.green, f.gold] },
        f.ctx,
        tx,
      );
      await mutations.generateBracket(pool.id, { rng: rngZero }, f.ctx, tx);
      await tx
        .update(f.schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(f.schema.competition.id, pool.id));

      expect(
        await queries.getUnfinalizedBrackets({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a points Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      await tx.insert(f.schema.competition).values({
        warWeekId: f.ctx.warWeekId,
        name: "Trivia",
        scoring: "team",
        format: "placement",
      });

      expect(
        await queries.getUnfinalizedBrackets({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a single-elimination Competition with Entrants but no Heats", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const [pool] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Pool",
          scoring: "team",
          format: "bracket",
        })
        .returning({ id: f.schema.competition.id });
      await mutations.replaceEntrants(
        pool.id,
        { targetIds: [f.red, f.blue] },
        f.ctx,
        tx,
      );

      expect(
        await queries.getUnfinalizedBrackets({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a Competition of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      const [pool] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.otherCtx.warWeekId,
          name: "Pool",
          scoring: "team",
          format: "bracket",
        })
        .returning({ id: f.schema.competition.id });
      await tx
        .insert(f.schema.heat)
        .values({ competitionId: pool.id, round: 1, position: 1 });

      expect(
        await queries.getUnfinalizedBrackets({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });
});
