import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

// The action runs for real (authorize, `can`, the mutation) against a
// rolled-back transaction: `@/db` hands out the test's transaction, and the
// session email is the one boundary stubbed.
const { session, current } = vi.hoisted(() => ({
  session: { email: null as string | null },
  current: { tx: null as unknown },
}));
vi.mock("@/auth/server", () => ({
  getSessionEmail: async () => session.email,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/db")>();
  const db = new Proxy(real.db, {
    get(target, property) {
      const source = (current.tx ?? target) as object;
      const value = Reflect.get(source, property);
      return typeof value === "function" ? value.bind(source) : value;
    },
  });
  return { ...real, db };
});

afterEach(() => {
  session.email = null;
  current.tx = null;
});

const HOST = "placement-action-host@jahnelgroup.com";
const OTHER_HOST = "placement-action-other-host@jahnelgroup.com";
const PARTICIPANT = "placement-action-participant@jahnelgroup.com";
const NOT_HOST = "You're not a Host of that Competition.";

/** A War Week with Red (Neo), Darts (individual Placement, hosted by HOST), Quiz (hosted by OTHER_HOST) and Neo placed 1st on Darts. */
async function fixture(tx: DBTx) {
  current.tx = tx;
  const schema = await import("@/db/schema");
  const [w] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "plact",
      editionNumber: 9700,
      year: 9700,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Placement action test",
      status: "upcoming",
      mode: "teams",
      teamLabel: "House",
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
  const [red] = await tx
    .insert(schema.team)
    .values({ warWeekId: w.id, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  const [neo, trinity] = await tx
    .insert(schema.participant)
    .values([
      {
        warWeekId: w.id,
        displayName: "Neo",
        teamId: red.id,
        email: PARTICIPANT,
      },
      { warWeekId: w.id, displayName: "Trinity", teamId: red.id },
    ])
    .returning({ id: schema.participant.id });
  const [darts, quiz] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId: w.id,
        name: "Darts",
        scoring: "individual" as const,
        format: "placement" as const,
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId: w.id,
        name: "Quiz",
        scoring: "individual" as const,
        format: "placement" as const,
      },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.competitionHost).values([
    { competitionId: darts.id, email: HOST },
    { competitionId: quiz.id, email: OTHER_HOST },
  ]);
  const [row] = await tx
    .insert(schema.placement)
    .values({ competitionId: darts.id, participantId: neo.id, place: 1 })
    .returning({ id: schema.placement.id });

  /** Everything a placement write could change, to compare before and after. */
  const snapshot = async () => ({
    rows: await tx
      .select()
      .from(schema.placement)
      .where(eq(schema.placement.competitionId, darts.id)),
    entries: await tx
      .select()
      .from(schema.pointsEntry)
      .where(eq(schema.pointsEntry.competitionId, darts.id)),
    competition: await tx
      .select({
        scoreDirection: schema.competition.scoreDirection,
        finalizedAt: schema.competition.finalizedAt,
      })
      .from(schema.competition)
      .where(eq(schema.competition.id, darts.id)),
  });
  return {
    schema,
    ids: {
      neo: neo.id,
      trinity: trinity.id,
      darts: darts.id,
      quiz: quiz.id,
      row: row.id,
    },
    snapshot,
  };
}

async function actions() {
  return import("@/actions/placements");
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Every placement action, called on Darts. */
async function everyAction(f: Fixture) {
  const a = await actions();
  return [
    [
      "addPlacement",
      () => a.addPlacement(f.ids.darts, { participantId: f.ids.trinity }),
    ],
    ["addEveryone", () => a.addEveryone(f.ids.darts)],
    [
      "removePlacement",
      () => a.removePlacement(f.ids.darts, { placementId: f.ids.row }),
    ],
    [
      "savePlacements",
      () =>
        a.savePlacements(f.ids.darts, {
          scoreDirection: "higher",
          rows: [{ id: f.ids.row, place: "2", score: "5" }],
        }),
    ],
    ["finalizePlacements", () => a.finalizePlacements(f.ids.darts)],
    ["reopenPlacements", () => a.reopenPlacements(f.ids.darts)],
  ] as const;
}

describe.skipIf(!isLocalDatabase)("the placement actions' refusals", () => {
  it.each([
    ["a Participant", PARTICIPANT],
    ["a Host of another Competition", OTHER_HOST],
  ])(
    "called as %s, each returns the refusal and writes nothing",
    async (_who, email) => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx);
        const before = await f.snapshot();
        session.email = email;
        for (const [name, run] of await everyAction(f)) {
          expect(await run(), name).toEqual({ ok: false, error: NOT_HOST });
        }
        expect(await f.snapshot()).toEqual(before);
      });
    },
  );

  it("anonymous is asked to sign in, and writes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const before = await f.snapshot();
      for (const [name, run] of await everyAction(f)) {
        expect(await run(), name).toEqual({
          ok: false,
          error: "Sign in to continue.",
        });
      }
      expect(await f.snapshot()).toEqual(before);
    });
  });

  it("the Competition's Host gets through: Finalize writes its Points Entries", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      session.email = HOST;
      const a = await actions();
      expect(await a.finalizePlacements(f.ids.darts)).toEqual({ ok: true });
      const { entries } = await f.snapshot();
      expect(
        entries.map(({ participantId, points }) => ({ participantId, points })),
      ).toEqual([{ participantId: f.ids.neo, points: 10 }]);
      // …and a row change is refused until Reopen.
      expect(
        await a.addPlacement(f.ids.darts, { participantId: f.ids.trinity }),
      ).toEqual({ ok: false, error: "Reopen the Competition first." });
    });
  });

  it("refuses malformed input once authorized, writing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const before = await f.snapshot();
      session.email = HOST;
      const a = await actions();
      expect(
        await a.savePlacements(f.ids.darts, {
          scoreDirection: "none",
          rows: [{ id: f.ids.row, place: "0", score: "" }],
        }),
      ).toEqual({
        ok: false,
        error: "Each Place must be a whole number from 1.",
      });
      expect(await a.addPlacement(f.ids.darts, { teamId: "nope" })).toEqual({
        ok: false,
        error: "Choose someone to add.",
      });
      expect(await f.snapshot()).toEqual(before);
    });
  });
});
