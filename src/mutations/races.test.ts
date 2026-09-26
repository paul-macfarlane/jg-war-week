import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { isLocalDatabaseUrl } from "@/db/local-url";
import type * as Schema from "@/db/schema";
import type { MutationResult } from "@/mutations/types";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/**
 * Check-then-write races across two connections. These commit, so each test
 * commits its fixtures under its own War Week (a test-only edition, at most
 * 8 characters) and deletes it before and after; the cascade removes the
 * rest.
 */
const actorEmail = "organizer@jahnelgroup.com";

/** A connection of its own, beside the app's `db`. */
type Connection = NodePgDatabase<typeof Schema>;
type ConnectionTx = Parameters<Parameters<Connection["transaction"]>[0]>[0];

async function clearWarWeek(edition: string) {
  const { db } = await import("@/db");
  const { warWeek } = await import("@/db/schema");
  await db.delete(warWeek).where(eq(warWeek.edition, edition));
}

async function committedWarWeek(edition: string, n: number) {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const [row] = await db
    .insert(schema.warWeek)
    .values({
      edition,
      editionNumber: 9700 + n,
      year: 9700 + n,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Race test",
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
  const [team] = await db
    .insert(schema.team)
    .values({ warWeekId: row.id, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  const [tug] = await db
    .insert(schema.competition)
    .values({ warWeekId: row.id, name: "Tug of War", scoring: "team" })
    .returning({ id: schema.competition.id });
  const [day] = await db
    .insert(schema.day)
    .values({ warWeekId: row.id, date: "2099-01-02", dayTheme: "Race day" })
    .returning({ id: schema.day.id });
  return {
    db,
    schema,
    ctx: { warWeekId: row.id, actorEmail },
    teamId: team.id,
    competitionId: tug.id,
    dayId: day.id,
  };
}

/** Opens `n` more connections, runs `body`, and closes them. */
async function withConnections<T>(
  n: number,
  body: (connections: Connection[]) => Promise<T>,
): Promise<T> {
  const schema = await import("@/db/schema");
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const connections = Array.from({ length: n }, () =>
    drizzle(process.env.DATABASE_URL!, { schema }),
  );
  try {
    return await body(connections);
  } finally {
    await Promise.all(connections.map((c) => c.$client.end()));
  }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 300));

describe.skipIf(!isLocalDatabase)(
  "Points Entry edit on two connections",
  () => {
    const edition = "zz-r-pe";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it("refuses an edit or delete of an entry that became bracket-generated after its check", async () => {
      const { updatePointsEntry, deletePointsEntry } =
        await import("@/mutations/points-entries");
      const f = await committedWarWeek(edition, 1);
      const { pointsEntry } = f.schema;
      const [edited, deleted] = await f.db
        .insert(pointsEntry)
        .values(
          ["edited", "deleted"].map((note) => ({
            competitionId: f.competitionId,
            teamId: f.teamId,
            points: 3,
            note,
            enteredByEmail: actorEmail,
          })),
        )
        .returning({ id: pointsEntry.id });

      const results = await withConnections(2, async ([bracket, second]) => {
        // Connection A marks both entries bracket-generated and holds them:
        // the edit and the delete pass their check (A hasn't committed) and
        // then wait on A's row lock for their write.
        let writes: Promise<MutationResult[]> | undefined;
        await bracket.transaction(async (tx) => {
          await tx
            .update(pointsEntry)
            .set({ generatedByBracket: true })
            .where(eq(pointsEntry.competitionId, f.competitionId));
          writes = Promise.all([
            updatePointsEntry(
              edited.id,
              {
                competitionId: f.competitionId,
                targetId: f.teamId,
                points: 5,
                note: "edited",
              },
              f.ctx,
              f.db,
            ),
            deletePointsEntry(deleted.id, f.ctx, second),
          ]);
          await settle();
        });
        return writes!;
      });

      const refusal = {
        ok: false,
        error: "This Points Entry comes from a bracket. Change it there.",
      };
      expect(results).toEqual([refusal, refusal]);
      const rows = await f.db
        .select({ points: pointsEntry.points })
        .from(pointsEntry)
        .where(eq(pointsEntry.competitionId, f.competitionId));
      expect(rows).toEqual([{ points: 3 }, { points: 3 }]);
    });
  },
);

/**
 * Starts `first`, then `second` a moment later, while a third connection
 * holds `row` locked; both are in flight together before either can
 * commit, and whichever queued first on the lock goes first. Running both
 * orders catches a missing lock on either side.
 */
async function staggered(
  lockRow: (tx: ConnectionTx) => Promise<unknown>,
  first: () => Promise<MutationResult>,
  second: () => Promise<MutationResult>,
): Promise<MutationResult[]> {
  return withConnections(1, async ([blocker]) => {
    let writes: Promise<MutationResult[]> | undefined;
    await blocker.transaction(async (tx) => {
      await lockRow(tx);
      const firstWrite = first();
      await new Promise((resolve) => setTimeout(resolve, 100));
      writes = Promise.all([firstWrite, second()]);
      await settle();
    });
    return writes!;
  });
}

describe.skipIf(!isLocalDatabase)(
  "Competition scoring change on two connections",
  () => {
    const edition = "zz-r-cs";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["scoring change"], ["Points Entry create"]])(
      "ends a scoring change and a Points Entry create with the refusal or the entry, never both (%s first)",
      async (first) => {
        const { updateCompetition } = await import("@/mutations/setup");
        const { createPointsEntry } =
          await import("@/mutations/points-entries");
        const f = await committedWarWeek(edition, 2);
        const { competition, pointsEntry } = f.schema;

        const results = await withConnections(1, async ([second]) => {
          const change = () =>
            updateCompetition(
              f.competitionId,
              {
                name: "Tug of War",
                description: null,
                scoring: "individual",
                maxPoints: null,
                placementPoints: null,
                countsTowardTeam: false,
                competitionGroup: null,
              },
              f.ctx,
              f.db,
            );
          const create = () =>
            createPointsEntry(
              {
                competitionId: f.competitionId,
                targetId: f.teamId,
                points: 3,
                note: null,
              },
              f.ctx,
              second,
            );
          const lockRow = (tx: ConnectionTx) =>
            tx
              .select({ id: competition.id })
              .from(competition)
              .where(eq(competition.id, f.competitionId))
              .for("update");
          const [changed, created] =
            first === "scoring change"
              ? await staggered(lockRow, change, create)
              : (await staggered(lockRow, create, change)).reverse();
          return [changed, created];
        });

        expect(results.filter((r) => r.ok)).toHaveLength(1);
        const [found] = await f.db
          .select({ scoring: competition.scoring })
          .from(competition)
          .where(eq(competition.id, f.competitionId));
        const entries = await f.db.$count(
          pointsEntry,
          eq(pointsEntry.competitionId, f.competitionId),
        );
        // Individual scoring with no entry, or team scoring with the entry.
        expect([found.scoring, entries]).toEqual(
          results[0].ok ? ["individual", 0] : ["team", 1],
        );
      },
    );
  },
);

describe.skipIf(!isLocalDatabase)(
  "Points Entry move during a scoring change on two connections",
  () => {
    const edition = "zz-r-pm";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["scoring change"], ["Points Entry edit"]])(
      "ends a scoring change and an edit moving an entry into that Competition with the refusal or the move, never both (%s first)",
      async (first) => {
        const { updateCompetition } = await import("@/mutations/setup");
        const { updatePointsEntry } =
          await import("@/mutations/points-entries");
        const f = await committedWarWeek(edition, 4);
        const { competition, pointsEntry } = f.schema;
        const [relay] = await f.db
          .insert(competition)
          .values({
            warWeekId: f.ctx.warWeekId,
            name: "Relay",
            scoring: "team",
          })
          .returning({ id: competition.id });
        const [entry] = await f.db
          .insert(pointsEntry)
          .values({
            competitionId: relay.id,
            teamId: f.teamId,
            points: 3,
            note: "moved",
            enteredByEmail: actorEmail,
          })
          .returning({ id: pointsEntry.id });

        const results = await withConnections(1, async ([second]) => {
          const change = () =>
            updateCompetition(
              f.competitionId,
              {
                name: "Tug of War",
                description: null,
                scoring: "individual",
                maxPoints: null,
                placementPoints: null,
                countsTowardTeam: false,
                competitionGroup: null,
              },
              f.ctx,
              f.db,
            );
          const move = () =>
            updatePointsEntry(
              entry.id,
              {
                competitionId: f.competitionId,
                targetId: f.teamId,
                points: 3,
                note: "moved",
              },
              f.ctx,
              second,
            );
          const lockRow = (tx: ConnectionTx) =>
            tx
              .select({ id: competition.id })
              .from(competition)
              .where(eq(competition.id, f.competitionId))
              .for("update");
          const [changed, moved] =
            first === "scoring change"
              ? await staggered(lockRow, change, move)
              : (await staggered(lockRow, move, change)).reverse();
          return [changed, moved];
        });

        expect(results.filter((r) => r.ok)).toHaveLength(1);
        const [found] = await f.db
          .select({ scoring: competition.scoring })
          .from(competition)
          .where(eq(competition.id, f.competitionId));
        const entries = await f.db.$count(
          pointsEntry,
          eq(pointsEntry.competitionId, f.competitionId),
        );
        // Individual scoring with the entry left behind, or team scoring
        // with the entry moved in.
        expect([found.scoring, entries]).toEqual(
          results[0].ok ? ["individual", 0] : ["team", 1],
        );
      },
    );
  },
);

describe.skipIf(!isLocalDatabase)("Day delete on two connections", () => {
  const edition = "zz-r-dd";
  beforeEach(() => clearWarWeek(edition));
  afterEach(() => clearWarWeek(edition));

  it.each([["Day delete"], ["Schedule Item create"]])(
    "ends a Day delete and a Schedule Item create with the refusal or the item, never a lost item (%s first)",
    async (first) => {
      const { deleteDay } = await import("@/mutations/setup");
      const { createScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const f = await committedWarWeek(edition, 3);
      const { day, scheduleItem } = f.schema;

      const results = await withConnections(1, async ([second]) => {
        const remove = () => deleteDay(f.dayId, f.ctx, f.db);
        const create = () =>
          createScheduleItem(
            {
              dayId: f.dayId,
              startTime: "09:00",
              endTime: null,
              title: "Kickoff",
              host: null,
              location: null,
              virtualLink: null,
              category: "other",
              competitionId: null,
              description: null,
            },
            f.ctx,
            second,
          );
        const lockRow = (tx: ConnectionTx) =>
          tx
            .select({ id: day.id })
            .from(day)
            .where(eq(day.id, f.dayId))
            .for("update");
        return first === "Day delete"
          ? staggered(lockRow, remove, create)
          : (await staggered(lockRow, create, remove)).reverse();
      });

      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const days = await f.db.$count(day, eq(day.id, f.dayId));
      const items = await f.db.$count(
        scheduleItem,
        eq(scheduleItem.dayId, f.dayId),
      );
      // The Day deleted with no item, or the Day kept with its item.
      expect([days, items]).toEqual(results[0].ok ? [0, 0] : [1, 1]);
    },
  );
});
