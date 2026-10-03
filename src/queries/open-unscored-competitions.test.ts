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

/**
 * A War Week with two Teams, plus a Team of another War Week, for building
 * `games` Competitions in various states.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `o${n}`,
        editionNumber: 9200 + n,
        year: 9200 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Open Games Competitions test",
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
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  const [otherTeam] = await tx
    .insert(schema.team)
    .values({ warWeekId: otherWarWeekId, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  await tx
    .insert(schema.organizer)
    .values({ email: actorEmail })
    .onConflictDoNothing();
  /** A head-to-head, team-scored `games` Competition open to everyone. */
  const pong = async (inWarWeek: string, name = "Pong") => {
    const [row] = await tx
      .insert(schema.competition)
      .values({
        warWeekId: inWarWeek,
        name,
        scoring: "team",
        format: "head-to-head",
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: true,
      })
      .returning({ id: schema.competition.id });
    return row.id;
  };
  return {
    schema,
    pong,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    red: red.id,
    blue: blue.id,
    otherTeam: otherTeam.id,
  };
}

async function modules() {
  return {
    mutations: await import("@/mutations/games"),
    queries: await import("@/queries/open-unscored-competitions"),
  };
}

/** A head-to-head Game the Red Team won against Blue. */
const redBeatsBlue = (red: string, blue: string) => ({
  players: [
    { id: red, place: 1, score: null },
    { id: blue, place: 2, score: null },
  ],
});

describe.skipIf(!isLocalDatabase)("getOpenUnscoredCompetitions", () => {
  it("lists an open games Competition with a Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const pong = await f.pong(f.ctx.warWeekId);
      await mutations.logGame(pong, redBeatsBlue(f.red, f.blue), f.ctx, tx);

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([{ id: pong, name: "Pong", format: "head-to-head" }]);
    });
  });

  it("excludes a games Competition with no Game", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      await f.pong(f.ctx.warWeekId);

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a closed games Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const pong = await f.pong(f.ctx.warWeekId);
      await mutations.logGame(pong, redBeatsBlue(f.red, f.blue), f.ctx, tx);
      await tx
        .update(f.schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(f.schema.competition.id, pong));

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a games Competition of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const pong = await f.pong(f.otherCtx.warWeekId);
      await mutations.logGame(
        pong,
        redBeatsBlue(f.red, f.otherTeam),
        f.otherCtx,
        tx,
      );

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("excludes a Bracket-Format Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const f = await fixture(tx);
      const [pool] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Pool",
          scoring: "team",
          format: "single-elimination",
        })
        .returning({ id: f.schema.competition.id });
      // A Game row no mutation would write, so the Format is what excludes it.
      await tx
        .insert(f.schema.game)
        .values({ competitionId: pool.id, loggedByEmail: actorEmail });

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([]);
    });
  });

  it("orders by name", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { mutations, queries } = await modules();
      const f = await fixture(tx);
      const zed = await f.pong(f.ctx.warWeekId, "Zed Games");
      const alpha = await f.pong(f.ctx.warWeekId, "Alpha Games");
      await mutations.logGame(zed, redBeatsBlue(f.red, f.blue), f.ctx, tx);
      await mutations.logGame(alpha, redBeatsBlue(f.red, f.blue), f.ctx, tx);

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([
        { id: alpha, name: "Alpha Games", format: "head-to-head" },
        { id: zed, name: "Zed Games", format: "head-to-head" },
      ]);
    });
  });

  it("lists an open participation Competition with anyone marked, never one closed or with nobody", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { queries } = await modules();
      const participation = await import("@/mutations/participation");
      const f = await fixture(tx);
      const [participant] = await tx
        .insert(f.schema.participant)
        .values({
          warWeekId: f.ctx.warWeekId,
          displayName: "Neo",
          teamId: f.red,
        })
        .returning({ id: f.schema.participant.id });
      const make = async (name: string) => {
        const [row] = await tx
          .insert(f.schema.competition)
          .values({
            warWeekId: f.ctx.warWeekId,
            name,
            scoring: "team",
            format: "participation",
            placementPoints: [3, 2, 1],
          })
          .returning({ id: f.schema.competition.id });
        return row.id;
      };
      const workout = await make("Workout");
      const closed = await make("Closed Workout");
      await make("Empty Workout");
      for (const id of [workout, closed]) {
        await participation.markParticipant(id, participant.id, f.ctx, tx);
      }
      await participation.closeParticipation(closed, f.ctx, tx);

      expect(
        await queries.getOpenUnscoredCompetitions({ id: f.ctx.warWeekId }, tx),
      ).toEqual([{ id: workout, name: "Workout", format: "participation" }]);
    });
  });
});
