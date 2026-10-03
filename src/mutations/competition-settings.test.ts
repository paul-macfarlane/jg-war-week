import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import type { CompetitionSettingChange } from "@/lib/competition-settings";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const ORGANIZER = "settings-organizer@jahnelgroup.com";
const HOST = "settings-host@jahnelgroup.com";
const OTHER_HOST = "settings-other-host@jahnelgroup.com";
const PARTICIPANT = "settings-participant@jahnelgroup.com";

const LOCKED_BY_RESULT = {
  ok: false,
  error: "Locked once the Competition has a result.",
};
const LOCKED_BY_HEAT_RESULT = {
  ok: false,
  error: "Locked once a Heat has a result.",
};
const LOCKED_WHILE_FINALIZED = {
  ok: false,
  error:
    "Locked while the Competition is Finalized or Closed. Reopen it first.",
};
const OK = { ok: true };

/**
 * A teams War Week with Teams Red and Blue, Participants Neo (Red) and
 * Trinity (Blue), an Organizer, and one Competition of each Format, made
 * by `createCompetition`. HOST hosts every one of them but "Other";
 * OTHER_HOST hosts only "Other".
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const setup = await import("@/mutations/setup");
  const { saveCompetitionSetting } =
    await import("@/mutations/competition-settings");
  const [week] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "cs1",
      editionNumber: 9301,
      year: 9301,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Competition settings test",
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
  const warWeekId = week.id;
  await tx
    .insert(schema.organizer)
    .values({ email: ORGANIZER })
    .onConflictDoNothing();
  const [red, blue] = (
    await tx
      .insert(schema.team)
      .values([
        { warWeekId, name: "Red", color: "#f00" },
        { warWeekId, name: "Blue", color: "#00f" },
      ])
      .returning({ id: schema.team.id })
  ).map((row) => row.id);
  const [neo, trinity] = (
    await tx
      .insert(schema.participant)
      .values([
        { warWeekId, displayName: "Neo", teamId: red },
        { warWeekId, displayName: "Trinity", teamId: blue },
      ])
      .returning({ id: schema.participant.id })
  ).map((row) => row.id);

  const ctx = (actorEmail: string) => ({ warWeekId, actorEmail });
  const create = async (
    name: string,
    format: "placement" | "bracket" | "head-to-head" | "best-score",
    placementPoints: number[] | null = null,
  ) => {
    const created = await setup.createCompetition(
      {
        name,
        description: null,
        scoring: "individual",
        placementPoints,
        countsTowardTeam: false,
        competitionGroup: null,
        format,
      },
      ctx(ORGANIZER),
      tx,
    );
    if (!created.ok) throw new Error(created.error);
    return created.id;
  };
  const ids = {
    darts: await create("Darts", "placement", [10, 8, 6, 4, 2]),
    chess: await create("Chess", "bracket", [5, 3]),
    pong: await create("Pong", "head-to-head"),
    stairs: await create("Stairs", "best-score"),
    other: await create("Other", "placement"),
    workout: "",
  };
  const workout = await setup.createCompetition(
    {
      name: "Workout",
      description: null,
      scoring: "team",
      placementPoints: null,
      countsTowardTeam: false,
      competitionGroup: null,
      format: "participation",
    },
    ctx(ORGANIZER),
    tx,
  );
  if (!workout.ok) throw new Error(workout.error);
  ids.workout = workout.id;
  await tx
    .insert(schema.competitionHost)
    .values([
      ...[ids.darts, ids.chess, ids.pong, ids.stairs, ids.workout].map(
        (competitionId) => ({ competitionId, email: HOST }),
      ),
      { competitionId: ids.other, email: OTHER_HOST },
    ]);

  const save = (
    competitionId: string,
    change: CompetitionSettingChange,
    actor = ORGANIZER,
  ) => saveCompetitionSetting(competitionId, change, ctx(actor), tx);
  const row = async (competitionId: string) => {
    const [found] = await tx
      .select()
      .from(schema.competition)
      .where(eq(schema.competition.id, competitionId));
    return found;
  };
  /** Logs a Game straight into the tables: a result. */
  const logGame = async (competitionId: string, participantId: string) => {
    const [game] = await tx
      .insert(schema.game)
      .values({ competitionId, loggedByEmail: ORGANIZER })
      .returning({ id: schema.game.id });
    await tx
      .insert(schema.gamePlayer)
      .values({ gameId: game.id, participantId, place: 1, score: 12 });
  };
  return {
    schema,
    tx,
    ids,
    red,
    blue,
    neo,
    trinity,
    ctx,
    save,
    row,
    logGame,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Places Neo 1st in Darts and Finalizes it. */
async function finalizeDarts(f: Fixture) {
  const placements = await import("@/mutations/placements");
  await placements.addPlacement(
    f.ids.darts,
    { participantId: f.neo },
    f.ctx(ORGANIZER),
    f.tx,
  );
  const [row] = await f.tx
    .select({ id: f.schema.placement.id })
    .from(f.schema.placement)
    .where(eq(f.schema.placement.competitionId, f.ids.darts));
  await placements.savePlacements(
    f.ids.darts,
    { rows: [{ id: row.id, place: 1, score: null }] },
    f.ctx(ORGANIZER),
    f.tx,
  );
  const finalized = await placements.finalizePlacements(
    f.ids.darts,
    f.ctx(ORGANIZER),
    f.tx,
  );
  if (!finalized.ok) throw new Error(finalized.error);
}

/** Enters Neo and Trinity in Chess, draws it and plays its one Heat. */
async function playChess(f: Fixture, { finalize = false } = {}) {
  const brackets = await import("@/mutations/brackets");
  const { getBracket } = await import("@/queries/brackets");
  await brackets.replaceEntrants(
    f.ids.chess,
    { targetIds: [f.neo, f.trinity] },
    f.ctx(ORGANIZER),
    f.tx,
  );
  await brackets.generateBracket(
    f.ids.chess,
    { rng: () => 0 },
    f.ctx(ORGANIZER),
    f.tx,
  );
  const view = (await getBracket(f.ids.chess, f.tx))!;
  const heat = view.bracket.heats[0];
  await brackets.recordHeatResult(
    f.ids.chess,
    heat.id,
    { order: heat.slots.map((s) => s.entrantId!) },
    f.ctx(ORGANIZER),
    f.tx,
  );
  if (finalize) {
    const done = await brackets.finalizeBracket(
      f.ids.chess,
      f.ctx(ORGANIZER),
      f.tx,
    );
    if (!done.ok) throw new Error(done.error);
  }
}

describe.skipIf(!isLocalDatabase)("saveCompetitionSetting: who", () => {
  it("lets a Host change their own Competition's settings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.darts, { field: "name", value: "Darts 2" }, HOST),
      ).toEqual(OK);
      expect((await f.row(f.ids.darts)).name).toBe("Darts 2");
    });
  });

  it("refuses a Host changing Hosts, and keeps them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(
          f.ids.darts,
          { field: "hosts", value: ["someone@jahnelgroup.com"] },
          HOST,
        ),
      ).toMatchObject({
        ok: false,
        error: "Only an Organizer can assign Hosts.",
      });
      const hosts = await tx
        .select({ email: f.schema.competitionHost.email })
        .from(f.schema.competitionHost)
        .where(eq(f.schema.competitionHost.competitionId, f.ids.darts));
      expect(hosts).toEqual([{ email: HOST }]);
    });
  });

  const everyField: CompetitionSettingChange[] = [
    { field: "name", value: "Renamed" },
    { field: "description", value: "New words" },
    { field: "group", value: "Games" },
    { field: "hosts", value: [OTHER_HOST] },
    { field: "placementPoints", value: [3, 2, 1] },
    { field: "format", value: "bracket" },
    { field: "scoring", value: "team" },
    { field: "countsTowardTeam", value: true },
    { field: "scoreDirection", value: "higher" },
    { field: "selfEnroll", value: true },
  ];

  it.each([
    ["a Host of another Competition", OTHER_HOST],
    ["a Participant", PARTICIPANT],
  ])("refuses %s any field, writing nothing", async (_who, actor) => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const before = await f.row(f.ids.darts);
      for (const change of everyField) {
        expect(
          await f.save(f.ids.darts, change, actor),
          change.field,
        ).toMatchObject({
          ok: false,
          error: "You're not a Host of that Competition.",
        });
      }
      expect(await f.row(f.ids.darts)).toEqual(before);
    });
  });
});

describe.skipIf(!isLocalDatabase)("saveCompetitionSetting: locks", () => {
  it("accepts name, description, Group, Hosts and Placement Points while Finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await finalizeDarts(f);
      for (const change of [
        { field: "name", value: "Darts Final" },
        { field: "description", value: "Three darts each." },
        { field: "group", value: "Pub games" },
        { field: "hosts", value: [OTHER_HOST] },
        { field: "placementPoints", value: [12, 9] },
      ] as CompetitionSettingChange[]) {
        expect(await f.save(f.ids.darts, change), change.field).toEqual(OK);
      }
      const after = await f.row(f.ids.darts);
      expect(after).toMatchObject({
        name: "Darts Final",
        description: "Three darts each.",
        competitionGroup: "Pub games",
        placementPoints: [12, 9],
      });
      expect(after.finalizedAt).toBeInstanceOf(Date);
      // Applies at the next Finalize: the generated Points Entry stands.
      const entries = await tx
        .select({ points: f.schema.pointsEntry.points })
        .from(f.schema.pointsEntry)
        .where(eq(f.schema.pointsEntry.competitionId, f.ids.darts));
      expect(entries).toEqual([{ points: 10 }]);
    });
  });

  it("accepts Format, scoring and counts toward team before any result, and refuses them once one exists", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.other, { field: "countsTowardTeam", value: true }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.other, { field: "scoring", value: "team" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.other)).toMatchObject({
        scoring: "team",
        countsTowardTeam: false,
      });
      expect(
        await f.save(f.ids.other, { field: "format", value: "best-score" }),
      ).toEqual(OK);

      // A logged Game is a result.
      await f.logGame(f.ids.stairs, f.neo);
      const before = await f.row(f.ids.stairs);
      expect(
        await f.save(f.ids.stairs, { field: "format", value: "placement" }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(
        await f.save(f.ids.stairs, { field: "scoring", value: "team" }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(
        await f.save(f.ids.stairs, {
          field: "countsTowardTeam",
          value: true,
        }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(await f.row(f.ids.stairs)).toEqual(before);
    });
  });

  it("accepts the Score direction before any result, and refuses it once a Placement exists", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.darts, { field: "scoreDirection", value: "lower" }),
      ).toEqual(OK);
      expect((await f.row(f.ids.darts)).scoreDirection).toBe("lower");
      const placements = await import("@/mutations/placements");
      await placements.addPlacement(
        f.ids.darts,
        { participantId: f.neo },
        f.ctx(ORGANIZER),
        tx,
      );
      expect(
        await f.save(f.ids.darts, { field: "scoreDirection", value: "higher" }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect((await f.row(f.ids.darts)).scoreDirection).toBe("lower");
    });
  });

  it("accepts Best score direction and attempts before any result, and refuses them once a Game exists", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const lowerTotal = { count: "total", betterIs: "lower", unit: "s" };
      expect(
        await f.save(f.ids.stairs, { field: "gameConfig", value: lowerTotal }),
      ).toEqual(OK);
      expect((await f.row(f.ids.stairs)).gameConfig).toEqual(lowerTotal);
      await f.logGame(f.ids.stairs, f.neo);
      expect(
        await f.save(f.ids.stairs, {
          field: "gameConfig",
          value: { count: "best", betterIs: "higher", unit: "" },
        }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect((await f.row(f.ids.stairs)).gameConfig).toEqual(lowerTotal);
    });
  });

  it("accepts heat size, advancing, 3rd place game, Entrants and building the Bracket until a Heat has a result, then refuses them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const threeOne = {
        entrantsPerHeat: 3,
        advancePerHeat: 1,
        thirdPlaceGame: false,
      };
      const headToHead = {
        entrantsPerHeat: 2,
        advancePerHeat: 1,
        thirdPlaceGame: false,
      };
      expect(
        await f.save(f.ids.chess, { field: "bracketConfig", value: threeOne }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.chess, {
          field: "entrants",
          value: { targetIds: [f.neo, f.trinity] },
        }),
      ).toEqual(OK);
      // Entrants are a result, but no Heat has one yet.
      expect(
        await f.save(f.ids.chess, {
          field: "bracketConfig",
          value: headToHead,
        }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.chess, { field: "bracket", value: null }),
      ).toEqual(OK);

      await playChess(f);
      const before = await f.row(f.ids.chess);
      expect(
        await f.save(f.ids.chess, { field: "bracketConfig", value: threeOne }),
      ).toMatchObject(LOCKED_BY_HEAT_RESULT);
      expect(
        await f.save(f.ids.chess, {
          field: "bracketConfig",
          value: { ...headToHead, thirdPlaceGame: true },
        }),
      ).toMatchObject(LOCKED_BY_HEAT_RESULT);
      expect(
        await f.save(f.ids.chess, {
          field: "entrants",
          value: { targetIds: [f.neo] },
        }),
      ).toMatchObject(LOCKED_BY_HEAT_RESULT);
      expect(
        await f.save(f.ids.chess, { field: "bracket", value: null }),
      ).toMatchObject(LOCKED_BY_HEAT_RESULT);
      expect(await f.row(f.ids.chess)).toEqual(before);
    });
  });

  it("accepts self-enroll, Entrant limit, close times and self-report mid-run, and refuses them while Finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await playChess(f);
      const closesAt = new Date("2099-01-03T17:00:00Z");
      const joining: CompetitionSettingChange[] = [
        { field: "selfEnroll", value: true },
        { field: "entrantLimit", value: 8 },
        { field: "enrollClosesAt", value: closesAt },
        { field: "selfReport", value: true },
      ];
      for (const change of joining) {
        expect(await f.save(f.ids.chess, change), change.field).toEqual(OK);
      }
      expect(await f.row(f.ids.chess)).toMatchObject({
        selfEnroll: true,
        entrantLimit: 8,
        enrollClosesAt: closesAt,
        selfReport: true,
      });

      const brackets = await import("@/mutations/brackets");
      expect(
        await brackets.finalizeBracket(f.ids.chess, f.ctx(ORGANIZER), tx),
      ).toEqual(OK);
      const before = await f.row(f.ids.chess);
      for (const change of [
        { field: "selfEnroll", value: false },
        { field: "entrantLimit", value: null },
        { field: "enrollClosesAt", value: null },
        { field: "selfReport", value: false },
      ] as CompetitionSettingChange[]) {
        expect(await f.save(f.ids.chess, change), change.field).toMatchObject(
          LOCKED_WHILE_FINALIZED,
        );
      }
      expect(await f.row(f.ids.chess)).toEqual(before);
    });
  });

  it("accepts the logging close time with Games logged, and refuses it while Closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await f.logGame(f.ids.stairs, f.neo);
      const closesAt = new Date("2099-01-04T17:00:00Z");
      expect(
        await f.save(f.ids.stairs, {
          field: "loggingClosesAt",
          value: closesAt,
        }),
      ).toEqual(OK);
      expect((await f.row(f.ids.stairs)).loggingClosesAt).toEqual(closesAt);
      const games = await import("@/mutations/games");
      expect(
        await games.closeGames(f.ids.stairs, f.ctx(ORGANIZER), tx),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.stairs, { field: "loggingClosesAt", value: null }),
      ).toMatchObject(LOCKED_WHILE_FINALIZED);
    });
  });

  it("accepts check-in settings with someone checked in, and refuses them while Closed; Placement Points still change", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const participation = await import("@/mutations/participation");
      expect(
        await participation.markParticipant(
          f.ids.workout,
          f.neo,
          f.ctx(ORGANIZER),
          tx,
        ),
      ).toEqual(OK);
      const closesAt = new Date("2099-01-02T17:00:00Z");
      expect(
        await f.save(f.ids.workout, { field: "selfCheckIn", value: true }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.workout, {
          field: "checkInClosesAt",
          value: closesAt,
        }),
      ).toEqual(OK);
      expect(await f.row(f.ids.workout)).toMatchObject({
        selfCheckIn: true,
        checkInClosesAt: closesAt,
      });

      expect(
        await participation.closeParticipation(
          f.ids.workout,
          f.ctx(ORGANIZER),
          tx,
        ),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.workout, { field: "selfCheckIn", value: false }),
      ).toMatchObject(LOCKED_WHILE_FINALIZED);
      expect(
        await f.save(f.ids.workout, { field: "checkInClosesAt", value: null }),
      ).toMatchObject(LOCKED_WHILE_FINALIZED);
      expect(
        await f.save(f.ids.workout, {
          field: "placementPoints",
          value: [6, 4, 2],
        }),
      ).toEqual(OK);
      expect((await f.row(f.ids.workout)).placementPoints).toEqual([6, 4, 2]);
    });
  });

  it("refuses everything but the never-locked fields while Finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await finalizeDarts(f);
      expect(
        await f.save(f.ids.darts, { field: "format", value: "bracket" }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(
        await f.save(f.ids.darts, { field: "selfEnroll", value: true }),
      ).toMatchObject(LOCKED_WHILE_FINALIZED);
    });
  });
});

describe.skipIf(!isLocalDatabase)("saveCompetitionSetting: Format", () => {
  it("applies the new Format's create defaults, clears the old Format's settings, and keeps 4 Placement Points for a Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.darts, { field: "scoreDirection", value: "higher" }),
      ).toEqual(OK);

      expect(
        await f.save(f.ids.darts, { field: "format", value: "bracket" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "bracket",
        scoreDirection: "none",
        bracketConfig: {
          entrantsPerHeat: 2,
          advancePerHeat: 1,
          thirdPlaceGame: false,
        },
        gameConfig: null,
        entrantsOpen: false,
        placementPoints: [10, 8, 6, 4],
      });

      expect(
        await f.save(f.ids.darts, { field: "selfReport", value: true }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.darts, { field: "format", value: "head-to-head" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "head-to-head",
        bracketConfig: null,
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: true,
        selfReport: false,
        placementPoints: [10, 8, 6, 4],
      });

      expect(
        await f.save(f.ids.darts, { field: "format", value: "participation" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "participation",
        gameConfig: null,
        entrantsOpen: false,
        // Individual: points per Participant, no Placement Points.
        participationPoints: 1,
        placementPoints: null,
        selfCheckIn: false,
      });

      expect(
        await f.save(f.ids.darts, { field: "format", value: "placement" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "placement",
        participationPoints: null,
        scoreDirection: "none",
      });
    });
  });
});
