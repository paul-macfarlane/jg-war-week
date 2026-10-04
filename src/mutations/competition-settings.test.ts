import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { insertHosts } from "@/db/test-hosts";
import { inRolledBackTransaction } from "@/db/test-transaction";
import {
  type CompetitionSettingChange,
  parseCompetitionSetting,
} from "@/lib/competition-settings";
import type { Content } from "@/lib/rich-text/content";

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
const LOCKED_BY_MATCH = {
  ok: false,
  error: "Locked once the Competition has a Match or Attempt.",
};
const LOCKED_BY_MATCH_RESULT = {
  ok: false,
  error: "Locked once a Match has a result.",
};
const LOCKED_WHILE_CLOSED = {
  ok: false,
  error: "Locked while the Competition is Closed. Reopen it first.",
};
const OK = { ok: true };

const words = (text: string): Content => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

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
  const hostIds = await insertHosts(tx, [
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
  /** Logs an Attempt straight into the tables: a result. */
  const logAttempt = async (competitionId: string, participantId: string) => {
    await tx.insert(schema.attempt).values({
      competitionId,
      participantId,
      score: 12,
      loggedByEmail: ORGANIZER,
    });
  };
  /** Logs a Match between a Head-to-head's two Entrants straight into the tables. */
  const logMatch = async (competitionId: string) => {
    const [match] = await tx
      .insert(schema.seriesMatch)
      .values({ competitionId, loggedByEmail: ORGANIZER })
      .returning({ id: schema.seriesMatch.id });
    const sides = await tx
      .select({ id: schema.entrant.id })
      .from(schema.entrant)
      .where(eq(schema.entrant.competitionId, competitionId));
    await tx.insert(schema.seriesMatchEntrant).values(
      sides.map((side, i) => ({
        seriesMatchId: match.id,
        entrantId: side.id,
        place: i + 1,
      })),
    );
  };
  return {
    schema,
    tx,
    ids,
    hostIds,
    red,
    blue,
    neo,
    trinity,
    ctx,
    save,
    row,
    logAttempt,
    logMatch,
  };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Places Neo 1st in Darts and Closes it. */
async function closeDarts(f: Fixture) {
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
  const closed = await (
    await import("@/mutations/close")
  ).closeCompetition(f.ids.darts, f.ctx(ORGANIZER), f.tx);
  if (!closed.ok) throw new Error(closed.error);
}

/** Enters Neo and Trinity in Chess, draws it and plays its one Match. */
async function playChess(f: Fixture, { close = false } = {}) {
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
  const match = view.bracket.matches[0];
  await brackets.recordMatchResult(
    f.ids.chess,
    match.id,
    { order: match.slots.map((s) => s.entrantId!) },
    f.ctx(ORGANIZER),
    f.tx,
  );
  if (close) {
    const done = await (
      await import("@/mutations/close")
    ).closeCompetition(f.ids.chess, f.ctx(ORGANIZER), f.tx);
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
          { field: "hosts", value: [f.hostIds.get(OTHER_HOST)!] },
          HOST,
        ),
      ).toMatchObject({
        ok: false,
        error: "Only an Organizer can assign Hosts.",
      });
      const hosts = await tx
        .select({ participantId: f.schema.competitionHost.participantId })
        .from(f.schema.competitionHost)
        .where(eq(f.schema.competitionHost.competitionId, f.ids.darts));
      expect(hosts).toEqual([{ participantId: f.hostIds.get(HOST) }]);
    });
  });

  const everyField: CompetitionSettingChange[] = [
    { field: "name", value: "Renamed" },
    { field: "description", value: words("New words") },
    { field: "group", value: "Contests" },
    {
      field: "hosts",
      value: ["00000000-0000-4000-8000-000000000001"],
    },
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

describe.skipIf(!isLocalDatabase)("saveCompetitionSetting: description", () => {
  it("stores rich text, and strips an unsafe link and a script node as an Announcement body does", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const unsafe = {
        type: "doc",
        content: [
          {
            type: "heading",
            attrs: { level: 2 },
            content: [{ type: "text", text: "Rules" }],
          },
          {
            type: "paragraph",
            content: [
              {
                type: "text",
                text: "Click me",
                marks: [
                  {
                    type: "link",
                    attrs: {
                      href: "javascript:alert(1)",
                      rel: "noopener noreferrer",
                    },
                  },
                ],
              },
            ],
          },
          {
            type: "script",
            content: [{ type: "text", text: "alert(1)" }],
          },
        ],
      };
      // The action parses the posted value before the mutation writes it.
      const parsed = parseCompetitionSetting({
        field: "description",
        value: unsafe,
      });
      if (!parsed.ok) throw new Error(parsed.error);
      expect(await f.save(f.ids.darts, parsed.value)).toEqual(OK);
      const stored = JSON.stringify((await f.row(f.ids.darts)).description);
      expect(stored).not.toContain("javascript:");
      expect(stored).not.toContain("script");
      expect(stored).toContain("Rules");
      expect(stored).toContain("Click me");
    });
  });

  it("clears a blank description", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.darts, {
          field: "description",
          value: words("Words"),
        }),
      ).toEqual(OK);
      const blank = parseCompetitionSetting({
        field: "description",
        value: { type: "doc", content: [] },
      });
      if (!blank.ok) throw new Error(blank.error);
      expect(await f.save(f.ids.darts, blank.value)).toEqual(OK);
      expect((await f.row(f.ids.darts)).description).toBeNull();
    });
  });
});

describe.skipIf(!isLocalDatabase)("saveCompetitionSetting: locks", () => {
  it("accepts name, description, Group, Hosts and Placement Points while Closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await closeDarts(f);
      for (const change of [
        { field: "name", value: "Darts Final" },
        { field: "description", value: words("Three darts each.") },
        { field: "group", value: "Pub contests" },
        { field: "hosts", value: [f.hostIds.get(OTHER_HOST)!] },
        { field: "placementPoints", value: [12, 9] },
      ] as CompetitionSettingChange[]) {
        expect(await f.save(f.ids.darts, change), change.field).toEqual(OK);
      }
      const after = await f.row(f.ids.darts);
      expect(after).toMatchObject({
        name: "Darts Final",
        description: words("Three darts each."),
        competitionGroup: "Pub contests",
        placementPoints: [12, 9],
      });
      expect(after.closedAt).toBeInstanceOf(Date);
      // Applies at the next Close: the generated Points Entry stands.
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

      // A logged Attempt is a result.
      await f.logAttempt(f.ids.stairs, f.neo);
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

  it("accepts Best score's direction, unit and Team score before any result, then locks all but the unit", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.stairs, { field: "scoreDirection", value: "lower" }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.stairs, { field: "scoreUnit", value: "s" }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.stairs, {
          field: "bestScoreConfig",
          value: { teamScore: "sum-of-members" },
        }),
      ).toEqual(OK);
      expect(await f.row(f.ids.stairs)).toMatchObject({
        scoreDirection: "lower",
        scoreUnit: "s",
        bestScoreConfig: { teamScore: "sum-of-members" },
      });
      // Best score is always higher or lower.
      expect(
        await f.save(f.ids.stairs, { field: "scoreDirection", value: "none" }),
      ).toMatchObject({
        ok: false,
        error: "A Best score Competition's Score is higher or lower is better.",
      });

      await f.logAttempt(f.ids.stairs, f.neo);
      expect(
        await f.save(f.ids.stairs, {
          field: "scoreDirection",
          value: "higher",
        }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(
        await f.save(f.ids.stairs, {
          field: "bestScoreConfig",
          value: { teamScore: "best-member" },
        }),
      ).toMatchObject(LOCKED_BY_MATCH);
      expect(
        await f.save(f.ids.stairs, { field: "scoreUnit", value: "sec" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.stairs)).toMatchObject({
        scoreDirection: "lower",
        scoreUnit: "sec",
        bestScoreConfig: { teamScore: "sum-of-members" },
      });
    });
  });

  it("refuses an Entrant list on Best score", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.stairs, {
          field: "entrants",
          value: { targetIds: [f.neo] },
        }),
      ).toMatchObject({
        ok: false,
        error: "Best score has no Entrant list: anyone can log an Attempt.",
      });
    });
  });

  it("accepts a Head-to-head's Best of between its two Entrants, and refuses its settings and Entrants once a Match is logged", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.pong, {
          field: "entrants",
          value: { targetIds: [f.neo, f.trinity] },
        }),
      ).toEqual(OK);
      const bestOf5 = { drawsAllowed: false, bestOf: 5 as const };
      expect(
        await f.save(f.ids.pong, { field: "seriesConfig", value: bestOf5 }),
      ).toEqual(OK);
      expect((await f.row(f.ids.pong)).seriesConfig).toEqual(bestOf5);

      await f.logMatch(f.ids.pong);
      expect(
        await f.save(f.ids.pong, {
          field: "seriesConfig",
          value: { drawsAllowed: true, bestOf: 5 },
        }),
      ).toMatchObject(LOCKED_BY_MATCH);
      expect((await f.row(f.ids.pong)).seriesConfig).toEqual(bestOf5);
    });
  });

  it("accepts match size, advancing, 3rd place Match, Entrants and building the Bracket until a Match has a result, then refuses them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const threeOne = {
        kind: "group" as const,
        entrantsPerMatch: 3,
        advancePerMatch: 1,
        thirdPlaceMatch: false,
        rounds: {},
      };
      const headToHead = {
        kind: "head-to-head" as const,
        entrantsPerMatch: 2,
        advancePerMatch: 1,
        thirdPlaceMatch: false,
        rounds: {},
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
      // Entrants are a result, but no Match has one yet.
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
      ).toMatchObject(LOCKED_BY_MATCH_RESULT);
      expect(
        await f.save(f.ids.chess, {
          field: "bracketConfig",
          value: { ...headToHead, thirdPlaceMatch: true },
        }),
      ).toMatchObject(LOCKED_BY_MATCH_RESULT);
      expect(
        await f.save(f.ids.chess, {
          field: "entrants",
          value: { targetIds: [f.neo] },
        }),
      ).toMatchObject(LOCKED_BY_MATCH_RESULT);
      expect(
        await f.save(f.ids.chess, { field: "bracket", value: null }),
      ).toMatchObject(LOCKED_BY_MATCH_RESULT);
      expect(await f.row(f.ids.chess)).toEqual(before);
    });
  });

  it("accepts self-enroll, Entrant limit and self-report mid-run, and refuses them while Closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await playChess(f);
      const joining: CompetitionSettingChange[] = [
        { field: "selfEnroll", value: true },
        { field: "entrantLimit", value: 8 },
        { field: "selfReport", value: true },
      ];
      for (const change of joining) {
        expect(await f.save(f.ids.chess, change), change.field).toEqual(OK);
      }
      expect(await f.row(f.ids.chess)).toMatchObject({
        selfEnroll: true,
        entrantLimit: 8,
        selfReport: true,
      });

      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.ids.chess, f.ctx(ORGANIZER), tx),
      ).toEqual(OK);
      const before = await f.row(f.ids.chess);
      for (const change of [
        { field: "selfEnroll", value: false },
        { field: "entrantLimit", value: null },
        { field: "selfReport", value: false },
      ] as CompetitionSettingChange[]) {
        expect(await f.save(f.ids.chess, change), change.field).toMatchObject(
          LOCKED_WHILE_CLOSED,
        );
      }
      expect(await f.row(f.ids.chess)).toEqual(before);
    });
  });

  it("is off on a new Competition of every Format, and turns on for a Bracket, Head-to-head and Best score only (AC 3)", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      for (const id of Object.values(f.ids)) {
        expect((await f.row(id)).selfReport).toBe(false);
      }
      for (const id of [f.ids.chess, f.ids.pong, f.ids.stairs]) {
        expect(
          await f.save(id, { field: "selfReport", value: true }, HOST),
        ).toEqual(OK);
        expect((await f.row(id)).selfReport).toBe(true);
      }
      for (const id of [f.ids.darts, f.ids.workout]) {
        expect(
          await f.save(id, { field: "selfReport", value: true }),
        ).toMatchObject({
          ok: false,
          error:
            "Only a Bracket, Head-to-head or Best score Competition lets Participants log their own results.",
        });
        expect((await f.row(id)).selfReport).toBe(false);
      }
    });
  });

  it("sets Max attempts per person on Best score, never below the most anyone has, and not while Closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      expect(
        await f.save(f.ids.stairs, { field: "maxAttempts", value: 3 }),
      ).toEqual(OK);
      expect((await f.row(f.ids.stairs)).maxAttempts).toBe(3);
      await f.logAttempt(f.ids.stairs, f.neo);
      await f.logAttempt(f.ids.stairs, f.neo);
      await f.logAttempt(f.ids.stairs, f.trinity);
      expect(
        await f.save(f.ids.stairs, { field: "maxAttempts", value: 1 }),
      ).toMatchObject({
        ok: false,
        error: "Someone already has 2 Attempts, so the limit can't be below 2.",
      });
      expect(
        await f.save(f.ids.stairs, { field: "maxAttempts", value: 2 }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.stairs, { field: "maxAttempts", value: null }),
      ).toEqual(OK);
      expect((await f.row(f.ids.stairs)).maxAttempts).toBeNull();
      expect(
        await f.save(f.ids.pong, { field: "maxAttempts", value: 3 }),
      ).toMatchObject({
        ok: false,
        error: "This Competition isn't run as Best score.",
      });

      await (
        await import("@/mutations/close")
      ).closeCompetition(f.ids.stairs, f.ctx(ORGANIZER), tx);
      expect(
        await f.save(f.ids.stairs, { field: "maxAttempts", value: 5 }),
      ).toMatchObject(LOCKED_WHILE_CLOSED);
    });
  });

  it("refuses self-enroll on every Format but a Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      for (const id of [f.ids.darts, f.ids.pong, f.ids.stairs, f.ids.workout]) {
        expect(
          await f.save(id, { field: "selfEnroll", value: true }),
        ).toMatchObject({ ok: false });
        expect((await f.row(id)).selfEnroll).toBe(false);
      }
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
      expect(
        await f.save(f.ids.workout, { field: "selfCheckIn", value: true }),
      ).toEqual(OK);
      expect(await f.row(f.ids.workout)).toMatchObject({ selfCheckIn: true });

      expect(
        await (
          await import("@/mutations/close")
        ).closeCompetition(f.ids.workout, f.ctx(ORGANIZER), tx),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.workout, { field: "selfCheckIn", value: false }),
      ).toMatchObject(LOCKED_WHILE_CLOSED);
      expect(
        await f.save(f.ids.workout, {
          field: "placementPoints",
          value: [6, 4, 2],
        }),
      ).toEqual(OK);
      expect((await f.row(f.ids.workout)).placementPoints).toEqual([6, 4, 2]);
    });
  });

  it("refuses everything but the never-locked fields while Closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      await closeDarts(f);
      expect(
        await f.save(f.ids.darts, { field: "format", value: "bracket" }),
      ).toMatchObject(LOCKED_BY_RESULT);
      expect(
        await f.save(f.ids.darts, { field: "selfEnroll", value: true }),
      ).toMatchObject(LOCKED_WHILE_CLOSED);
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
          kind: "head-to-head" as const,
          entrantsPerMatch: 2,
          advancePerMatch: 1,
          thirdPlaceMatch: false,
          rounds: {},
        },
        seriesConfig: null,
        bestScoreConfig: null,
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
        seriesConfig: { drawsAllowed: false, bestOf: 3 },
        selfReport: false,
        placementPoints: [10, 8, 6, 4],
      });

      expect(
        await f.save(f.ids.darts, { field: "format", value: "participation" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "participation",
        seriesConfig: null,
        scoreDirection: "none",
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

  it("moves a Placement with a direction to Best score and back, writing each Format's direction in the same save", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      // Placement: none, then lower is better.
      expect((await f.row(f.ids.darts)).scoreDirection).toBe("none");
      expect(
        await f.save(f.ids.darts, { field: "format", value: "best-score" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "best-score",
        scoreDirection: "higher",
        bestScoreConfig: { teamScore: "best-member" },
        seriesConfig: null,
      });

      expect(
        await f.save(f.ids.darts, { field: "format", value: "placement" }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.darts, { field: "scoreDirection", value: "lower" }),
      ).toEqual(OK);
      expect(
        await f.save(f.ids.darts, { field: "format", value: "best-score" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "best-score",
        scoreDirection: "higher",
      });
      expect(
        await f.save(f.ids.darts, { field: "format", value: "participation" }),
      ).toEqual(OK);
      expect(await f.row(f.ids.darts)).toMatchObject({
        format: "participation",
        scoreDirection: "none",
        bestScoreConfig: null,
      });
    });
  });
});
