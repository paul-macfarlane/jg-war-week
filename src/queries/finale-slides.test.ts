import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { DEMO_SEED } from "@/seed/local-files";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/** The XI demo (`DEMO_SEED`), loaded inside the test's transaction. */
async function loadXiDemo(tx: DBTx) {
  const { warWeekSeedSchema } = await import("@/seed/schema");
  const { loadWarWeekSeed } = await import("@/seed/load");
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  // Nothing else live, so the demo's live War Week loads.
  await tx
    .update(schema.warWeek)
    .set({ status: "complete" })
    .where(eq(schema.warWeek.status, "live"));
  const seed = warWeekSeedSchema.parse(
    JSON.parse(
      readFileSync(path.resolve(__dirname, "../..", DEMO_SEED), "utf8"),
    ),
  );
  return loadWarWeekSeed(seed, tx, { reset: true });
}

/** One number from a SQL count, for the figures' independent check. */
async function sqlNumber(
  tx: DBTx,
  query: ReturnType<typeof import("drizzle-orm").sql>,
) {
  const result = await tx.execute<{ n: string | number | null }>(query);
  return Number(result.rows[0]?.n ?? 0);
}

describe.skipIf(!isLocalDatabase)("Finale slide queries", () => {
  it("counts the XI demo's figures as SQL counts them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { sql } = await import("drizzle-orm");
      const { getFinaleCounts } = await import("@/queries/finale-slides");
      const xi = await loadXiDemo(tx);

      const counts = await getFinaleCounts(xi.id, tx);
      expect(counts).toEqual({
        competitionsRun: await sqlNumber(
          tx,
          sql`select count(distinct c.id) as n from competition c
              join points_entry p on p.competition_id = c.id
              where c.war_week_id = ${xi.id}`,
        ),
        gamesLogged: await sqlNumber(
          tx,
          sql`select count(*) as n from game g
              join competition c on c.id = g.competition_id
              where c.war_week_id = ${xi.id}`,
        ),
        heatsPlayed: await sqlNumber(
          tx,
          sql`select count(*) as n from heat h
              join competition c on c.id = h.competition_id
              where c.war_week_id = ${xi.id} and h.status = 'played'`,
        ),
        pointsEntries: await sqlNumber(
          tx,
          sql`select count(*) as n from points_entry p
              join competition c on c.id = p.competition_id
              where c.war_week_id = ${xi.id}`,
        ),
        pointsHandedOut: await sqlNumber(
          tx,
          sql`select coalesce(sum(p.points), 0) as n from points_entry p
              join competition c on c.id = p.competition_id
              where c.war_week_id = ${xi.id}`,
        ),
        participants: await sqlNumber(
          tx,
          sql`select count(*) as n from participant where war_week_id = ${xi.id}`,
        ),
      });
      // The demo has a roster and Points Entries to count.
      expect(counts.participants).toBeGreaterThan(0);
      expect(counts.pointsEntries).toBeGreaterThan(0);
    });
  });

  it("lists a closed Bracket's Winner and a closed Head-to-head or Best score Competition's tied winners", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { asc, eq } = await import("drizzle-orm");
      const { getWinners } = await import("@/queries/finale-slides");
      const xi = await loadXiDemo(tx);

      // As seeded, only the demo's twelve Finalized Placement Competitions
      // have a champion; no Bracket or Games Competition is finalized.
      const seeded = await getWinners(xi, tx);
      expect(seeded).toHaveLength(12);
      expect(seeded.map((champion) => champion.format)).toEqual(
        Array(12).fill("placement"),
      );

      const people = await tx
        .select({ id: schema.participant.id })
        .from(schema.participant)
        .where(eq(schema.participant.warWeekId, xi.id))
        .orderBy(asc(schema.participant.displayName))
        .limit(3);
      const [a, b, c] = people.map((p) => p.id);
      const competition = async (
        name: string,
        format: "head-to-head" | "bracket",
        finalizedAt: Date,
      ) => {
        const [row] = await tx
          .insert(schema.competition)
          .values({
            warWeekId: xi.id,
            name,
            scoring: "individual",
            format,
            finalizedAt,
            ...(format === "head-to-head"
              ? { gameConfig: { drawsAllowed: false, bestOf: null } }
              : {}),
          })
          .returning({ id: schema.competition.id });
        return row.id;
      };
      const generated = (
        competitionId: string,
        participantId: string,
        points: number,
      ) =>
        tx.insert(schema.pointsEntry).values({
          warWeekId: xi.id,
          competitionId,
          participantId,
          points,
          enteredByEmail: "organizer@jahnelgroup.com",
          generatedByBracket: true,
        });

      const pong = await competition(
        "Finale Pong",
        "head-to-head",
        new Date("2026-02-26T18:00:00Z"),
      );
      await generated(pong, a, 3);
      await generated(pong, b, 3);
      await generated(pong, c, 1);
      const foosball = await competition(
        "Finale Foosball",
        "bracket",
        new Date("2026-02-26T17:00:00Z"),
      );
      await generated(foosball, c, 5);
      await generated(foosball, a, 3);

      const champions = (await getWinners(xi, tx)).filter(
        (champion) => champion.format !== "placement",
      );
      expect(
        champions.map((champion) => ({
          competition: champion.competition,
          format: champion.format,
          winners: champion.winners.map((w) => w.id).sort(),
        })),
      ).toEqual([
        {
          competition: "Finale Foosball",
          format: "bracket",
          winners: [c],
        },
        {
          competition: "Finale Pong",
          format: "head-to-head",
          winners: [a, b].sort(),
        },
      ]);
    });
  });
});
