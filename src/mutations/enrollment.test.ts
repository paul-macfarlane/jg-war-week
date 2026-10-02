import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const HOST = "host@jahnelgroup.com";
const NEO = "neo@jahnelgroup.com";
const TRINITY = "trinity@jahnelgroup.com";
const MORPHEUS = "morpheus@jahnelgroup.com";
/** Matches no Participant: Tank has no email, so nothing links him. */
const TANK = "tank@jahnelgroup.com";

const PAST = new Date("2020-01-01T00:00:00Z");
const FUTURE = new Date("2099-12-31T00:00:00Z");

/**
 * A War Week with Red (Neo, Trinity) and Blue (Morpheus), Tank on no Team
 * and with no email, and Competitions with the enroll switch on: Cypher
 * (individual Bracket), Tug of War (team Bracket), Relay (team Bracket with
 * the Squads Red One: Trinity, and Blue One: Morpheus), Pong (individual
 * fixed-list head-to-head `games`), and Trivia (points).
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `enroll${n}`,
        editionNumber: 9800 + n,
        year: 9800 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Enrollment test",
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
  const [neo, trinity, morpheus, tank] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: red.id },
      { warWeekId, displayName: "Trinity", email: TRINITY, teamId: red.id },
      {
        warWeekId,
        displayName: "Morpheus",
        email: MORPHEUS,
        teamId: blue.id,
      },
      { warWeekId, displayName: "Tank", email: null, teamId: null },
    ])
    .returning({ id: schema.participant.id });
  const [cypher, tug, relay, pong, trivia] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Cypher",
        scoring: "individual",
        format: "single-elimination",
        selfEnroll: true,
      },
      {
        warWeekId,
        name: "Tug of War",
        scoring: "team",
        format: "single-elimination",
        selfEnroll: true,
      },
      {
        warWeekId,
        name: "Relay",
        scoring: "team",
        format: "single-elimination",
        selfEnroll: true,
      },
      {
        warWeekId,
        name: "Pong",
        scoring: "individual",
        format: "games",
        gameType: "head-to-head",
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: false,
        selfEnroll: true,
      },
      { warWeekId, name: "Trivia", scoring: "team", format: "points" },
    ])
    .returning({ id: schema.competition.id });
  const [redOne, blueOne] = await tx
    .insert(schema.squad)
    .values([
      { competitionId: relay.id, teamId: red.id, name: "Red One" },
      { competitionId: relay.id, teamId: blue.id, name: "Blue One" },
    ])
    .returning({ id: schema.squad.id });
  await tx.insert(schema.squadParticipant).values([
    { squadId: redOne.id, participantId: trinity.id },
    { squadId: blueOne.id, participantId: morpheus.id },
  ]);

  const as = (actorEmail: string) => ({ warWeekId, actorEmail });
  const set = (
    id: string,
    values: Partial<typeof schema.competition.$inferInsert>,
  ) =>
    tx
      .update(schema.competition)
      .set(values)
      .where(eq(schema.competition.id, id));
  /** The Competition's Entrants, in Seed Position order. */
  const entrantsOf = (competitionId: string) =>
    tx
      .select({
        teamId: schema.entrant.teamId,
        participantId: schema.entrant.participantId,
        seedPosition: schema.entrant.seedPosition,
      })
      .from(schema.entrant)
      .where(eq(schema.entrant.competitionId, competitionId))
      .orderBy(asc(schema.entrant.seedPosition));
  const enter = (
    competitionId: string,
    seedPosition: number,
    who: { teamId?: string; participantId?: string },
  ) =>
    tx.insert(schema.entrant).values({ competitionId, seedPosition, ...who });
  const inSquad = async (squadId: string, participantId: string) =>
    (
      await tx
        .select({ squadId: schema.squadParticipant.squadId })
        .from(schema.squadParticipant)
        .where(
          and(
            eq(schema.squadParticipant.squadId, squadId),
            eq(schema.squadParticipant.participantId, participantId),
          ),
        )
    ).length === 1;
  const competitionRow = async (id: string) =>
    (
      await tx
        .select({
          selfEnroll: schema.competition.selfEnroll,
          entrantLimit: schema.competition.entrantLimit,
          enrollClosesAt: schema.competition.enrollClosesAt,
        })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0];

  return {
    schema,
    warWeekId,
    otherWarWeekId,
    red: red.id,
    blue: blue.id,
    neo: neo.id,
    trinity: trinity.id,
    morpheus: morpheus.id,
    tank: tank.id,
    cypher: cypher.id,
    tug: tug.id,
    relay: relay.id,
    pong: pong.id,
    trivia: trivia.id,
    redOne: redOne.id,
    blueOne: blueOne.id,
    as,
    set,
    entrantsOf,
    enter,
    inSquad,
    competitionRow,
  };
}

const mutations = () => import("@/mutations/enrollment");
const rule = () => import("@/lib/games/enroll-rule");

describe.skipIf(!isLocalDatabase)("enroll (individual scoring)", () => {
  it("enters the linked Participant at the next Seed Position, once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ALREADY_ENTERED } = await rule();
      const f = await fixture(tx);
      await f.enter(f.cypher, 1, { participantId: f.morpheus });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({ ok: true });
      expect(await f.entrantsOf(f.cypher)).toEqual([
        { teamId: null, participantId: f.morpheus, seedPosition: 1 },
        { teamId: null, participantId: f.neo, seedPosition: 2 },
      ]);

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ALREADY_ENTERED,
      });
    });
  });

  it("links by email ignoring case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const f = await fixture(tx);

      expect(await enroll(f.cypher, f.as("NEO@JahnelGroup.com"), tx)).toEqual({
        ok: true,
      });
      expect(await f.entrantsOf(f.cypher)).toEqual([
        { teamId: null, participantId: f.neo, seedPosition: 1 },
      ]);
    });
  });

  it("refuses when the switch is off", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ENROLL_OFF } = await rule();
      const f = await fixture(tx);
      await f.set(f.cypher, { selfEnroll: false });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_OFF,
      });
      expect(await f.entrantsOf(f.cypher)).toEqual([]);
    });
  });

  it("refuses an actor no Participant's email matches: nothing links them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { NOT_LINKED } = await rule();
      const f = await fixture(tx);

      expect(await enroll(f.cypher, f.as(TANK), tx)).toEqual({
        ok: false,
        error: NOT_LINKED,
      });
      expect(await f.entrantsOf(f.cypher)).toEqual([]);
    });
  });

  it("refuses a Competition of another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const f = await fixture(tx);

      expect(
        await enroll(
          f.cypher,
          { warWeekId: f.otherWarWeekId, actorEmail: NEO },
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
    });
  });

  it("refuses once the Bracket is built", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ENROLL_CLOSED_BUILT } = await rule();
      const f = await fixture(tx);
      await tx
        .insert(f.schema.heat)
        .values({ competitionId: f.cypher, round: 1, position: 1 });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_BUILT,
      });
    });
  });

  it("refuses once the close time has passed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ENROLL_CLOSED_TIME } = await rule();
      const f = await fixture(tx);
      await f.set(f.cypher, { enrollClosesAt: PAST });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_TIME,
      });
    });
  });

  it("refuses a finalized Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ENROLL_CLOSED_BY_HOST } = await rule();
      const f = await fixture(tx);
      await f.set(f.cypher, { finalizedAt: new Date() });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_BY_HOST,
      });
    });
  });

  it("at the Entrant limit, the second of two enrollments is refused under the lock", async () => {
    // Run one after the other in one rolled-back transaction: the second
    // re-counts the Entrants under the Competition's row lock.
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { ENROLL_CLOSED_FULL } = await rule();
      const f = await fixture(tx);
      await f.set(f.cypher, { entrantLimit: 2 });
      await f.enter(f.cypher, 1, { participantId: f.morpheus });

      expect(await enroll(f.cypher, f.as(NEO), tx)).toEqual({ ok: true });
      expect(await enroll(f.cypher, f.as(TRINITY), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_FULL,
      });
      expect(
        (await f.entrantsOf(f.cypher)).map((e) => e.participantId),
      ).toEqual([f.morpheus, f.neo]);
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "enroll (a fixed-list games Competition)",
  () => {
    it("enrolls before the first Game and refuses after it", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { enroll } = await mutations();
        const { ENROLL_CLOSED_GAME_LOGGED } = await rule();
        const f = await fixture(tx);

        expect(await enroll(f.pong, f.as(NEO), tx)).toEqual({ ok: true });
        await tx
          .insert(f.schema.game)
          .values({ competitionId: f.pong, loggedByEmail: HOST });

        expect(await enroll(f.pong, f.as(TRINITY), tx)).toEqual({
          ok: false,
          error: ENROLL_CLOSED_GAME_LOGGED,
        });
      });
    });

    it("is off on a Best of or open-to-everyone games Competition, whatever the switch", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { enroll } = await mutations();
        const { ENROLL_OFF } = await rule();
        const f = await fixture(tx);

        await f.set(f.pong, { gameConfig: { drawsAllowed: false, bestOf: 3 } });
        expect(await enroll(f.pong, f.as(NEO), tx)).toEqual({
          ok: false,
          error: ENROLL_OFF,
        });

        await f.set(f.pong, {
          gameConfig: { drawsAllowed: false, bestOf: null },
          entrantsOpen: true,
        });
        expect(await enroll(f.pong, f.as(NEO), tx)).toEqual({
          ok: false,
          error: ENROLL_OFF,
        });
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("withdraw", () => {
  it("removes the Entrant and keeps Seed Positions 1..n in order", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { withdraw } = await mutations();
      const f = await fixture(tx);
      await f.enter(f.cypher, 1, { participantId: f.morpheus });
      await f.enter(f.cypher, 2, { participantId: f.neo });
      await f.enter(f.cypher, 3, { participantId: f.trinity });
      await f.enter(f.cypher, 4, { participantId: f.tank });

      expect(await withdraw(f.cypher, f.as(NEO), tx)).toEqual({ ok: true });
      expect(await f.entrantsOf(f.cypher)).toEqual([
        { teamId: null, participantId: f.morpheus, seedPosition: 1 },
        { teamId: null, participantId: f.trinity, seedPosition: 2 },
        { teamId: null, participantId: f.tank, seedPosition: 3 },
      ]);
    });
  });

  it("is allowed at the Entrant limit, before close", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { withdraw } = await mutations();
      const f = await fixture(tx);
      await f.set(f.cypher, { entrantLimit: 2, enrollClosesAt: FUTURE });
      await f.enter(f.cypher, 1, { participantId: f.neo });
      await f.enter(f.cypher, 2, { participantId: f.morpheus });

      expect(await withdraw(f.cypher, f.as(NEO), tx)).toEqual({ ok: true });
      expect(await f.entrantsOf(f.cypher)).toEqual([
        { teamId: null, participantId: f.morpheus, seedPosition: 1 },
      ]);
    });
  });

  it("is refused after enrollment closes, and when not entered", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { withdraw } = await mutations();
      const { ENROLL_CLOSED_TIME, NOT_ENTERED } = await rule();
      const f = await fixture(tx);
      await f.enter(f.cypher, 1, { participantId: f.neo });

      expect(await withdraw(f.cypher, f.as(TRINITY), tx)).toEqual({
        ok: false,
        error: NOT_ENTERED,
      });

      await f.set(f.cypher, { enrollClosesAt: PAST });
      expect(await withdraw(f.cypher, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_TIME,
      });
      expect(await f.entrantsOf(f.cypher)).toHaveLength(1);
    });
  });
});

describe.skipIf(!isLocalDatabase)("team scoring", () => {
  it("any Participant on the Team enrolls it, and any withdraws it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll, withdraw } = await mutations();
      const { TEAM_ALREADY_ENTERED, TEAM_NOT_ENTERED } = await rule();
      const f = await fixture(tx);

      expect(await enroll(f.tug, f.as(NEO), tx)).toEqual({ ok: true });
      expect(await f.entrantsOf(f.tug)).toEqual([
        { teamId: f.red, participantId: null, seedPosition: 1 },
      ]);
      expect(await enroll(f.tug, f.as(TRINITY), tx)).toEqual({
        ok: false,
        error: TEAM_ALREADY_ENTERED,
      });

      expect(await withdraw(f.tug, f.as(TRINITY), tx)).toEqual({ ok: true });
      expect(await f.entrantsOf(f.tug)).toEqual([]);
      expect(await withdraw(f.tug, f.as(NEO), tx)).toEqual({
        ok: false,
        error: TEAM_NOT_ENTERED,
      });
    });
  });

  it("refuses a Participant on no Team", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { NOT_ON_A_TEAM } = await rule();
      const f = await fixture(tx);
      await tx
        .update(f.schema.participant)
        .set({ teamId: null })
        .where(eq(f.schema.participant.id, f.neo));

      expect(await enroll(f.tug, f.as(NEO), tx)).toEqual({
        ok: false,
        error: NOT_ON_A_TEAM,
      });
    });
  });

  it("refuses Team enrollment in a Squads Bracket", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { enroll } = await mutations();
      const { JOIN_A_SQUAD } = await rule();
      const f = await fixture(tx);

      expect(await enroll(f.relay, f.as(NEO), tx)).toEqual({
        ok: false,
        error: JOIN_A_SQUAD,
      });
      expect(await f.entrantsOf(f.relay)).toEqual([]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("Squads", () => {
  it("joins the own Team's Squad, once", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { joinSquad } = await mutations();
      const { ALREADY_IN_A_SQUAD } = await rule();
      const f = await fixture(tx);

      expect(await joinSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.inSquad(f.redOne, f.neo)).toBe(true);

      expect(await joinSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ALREADY_IN_A_SQUAD,
      });
    });
  });

  it("refuses another Team's Squad and a Squad of another Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { joinSquad } = await mutations();
      const { NOT_YOUR_TEAMS_SQUAD, SQUAD_MISSING } = await rule();
      const f = await fixture(tx);

      expect(await joinSquad(f.relay, f.blueOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: NOT_YOUR_TEAMS_SQUAD,
      });
      expect(await joinSquad(f.tug, f.redOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: SQUAD_MISSING,
      });
      expect(await f.inSquad(f.blueOne, f.neo)).toBe(false);
      expect(await f.inSquad(f.redOne, f.neo)).toBe(false);
    });
  });

  it("refuses a join on a finalized Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { joinSquad } = await mutations();
      const { ENROLL_CLOSED_BY_HOST } = await rule();
      const f = await fixture(tx);
      await f.set(f.relay, { finalizedAt: new Date() });

      expect(await joinSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_BY_HOST,
      });
    });
  });

  it("leaves a Squad; the last Participant can't", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { joinSquad, leaveSquad } = await mutations();
      const { LAST_IN_SQUAD, NOT_IN_SQUAD } = await rule();
      const f = await fixture(tx);
      await joinSquad(f.relay, f.redOne, f.as(NEO), tx);

      expect(await leaveSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.inSquad(f.redOne, f.neo)).toBe(false);
      expect(await leaveSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: NOT_IN_SQUAD,
      });

      expect(await leaveSquad(f.relay, f.redOne, f.as(TRINITY), tx)).toEqual({
        ok: false,
        error: LAST_IN_SQUAD,
      });
      expect(await f.inSquad(f.redOne, f.trinity)).toBe(true);
    });
  });

  it("refuses a leave on a finalized Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { joinSquad, leaveSquad } = await mutations();
      const { ENROLL_CLOSED_BY_HOST } = await rule();
      const f = await fixture(tx);
      await joinSquad(f.relay, f.redOne, f.as(NEO), tx);
      await f.set(f.relay, { finalizedAt: new Date() });

      expect(await leaveSquad(f.relay, f.redOne, f.as(NEO), tx)).toEqual({
        ok: false,
        error: ENROLL_CLOSED_BY_HOST,
      });
      expect(await f.inSquad(f.redOne, f.neo)).toBe(true);
    });
  });
});

describe.skipIf(!isLocalDatabase)("setSelfEnroll", () => {
  it("turns the switch on with a limit and close time, and off", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfEnroll } = await mutations();
      const f = await fixture(tx);
      await f.set(f.cypher, { selfEnroll: false });

      expect(
        await setSelfEnroll(
          f.cypher,
          { on: true, entrantLimit: 8, enrollClosesAt: FUTURE },
          f.as(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.competitionRow(f.cypher)).toEqual({
        selfEnroll: true,
        entrantLimit: 8,
        enrollClosesAt: FUTURE,
      });

      expect(
        await setSelfEnroll(
          f.cypher,
          { on: false, entrantLimit: null, enrollClosesAt: null },
          f.as(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.competitionRow(f.cypher)).toEqual({
        selfEnroll: false,
        entrantLimit: null,
        enrollClosesAt: null,
      });
    });
  });

  it("turns it on for a fixed-list games Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfEnroll } = await mutations();
      const f = await fixture(tx);
      await f.set(f.pong, { selfEnroll: false });

      expect(
        await setSelfEnroll(
          f.pong,
          { on: true, entrantLimit: null, enrollClosesAt: null },
          f.as(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect((await f.competitionRow(f.pong)).selfEnroll).toBe(true);
    });
  });

  it("refuses a points, a Best of, an open-to-everyone and a finalized Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfEnroll } = await mutations();
      const { BEST_OF_NO_ENROLL, OPEN_NO_ENROLL, POINTS_NO_ENROLL } =
        await import("@/lib/games/enroll-rule");
      const f = await fixture(tx);
      const on = { on: true, entrantLimit: null, enrollClosesAt: null };

      expect(await setSelfEnroll(f.trivia, on, f.as(HOST), tx)).toEqual({
        ok: false,
        error: POINTS_NO_ENROLL,
      });

      await f.set(f.pong, {
        selfEnroll: false,
        gameConfig: { drawsAllowed: false, bestOf: 5 },
      });
      expect(await setSelfEnroll(f.pong, on, f.as(HOST), tx)).toEqual({
        ok: false,
        error: "A Best of is set by the Host; enrollment is off.",
      });
      expect(BEST_OF_NO_ENROLL).toBe(
        "A Best of is set by the Host; enrollment is off.",
      );

      await f.set(f.pong, {
        gameConfig: { drawsAllowed: false, bestOf: null },
        entrantsOpen: true,
      });
      expect(await setSelfEnroll(f.pong, on, f.as(HOST), tx)).toEqual({
        ok: false,
        error: "Everyone can play already; there's no list to enroll in.",
      });
      expect(OPEN_NO_ENROLL).toBe(
        "Everyone can play already; there's no list to enroll in.",
      );
      expect((await f.competitionRow(f.pong)).selfEnroll).toBe(false);

      await f.set(f.cypher, { finalizedAt: new Date() });
      const finalized = await setSelfEnroll(f.cypher, on, f.as(HOST), tx);
      expect(finalized.ok).toBe(false);
    });
  });

  it("never stores an Entrant limit below 2: the column's CHECK backs the parser", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfEnroll } = await mutations();
      const f = await fixture(tx);

      await expect(
        setSelfEnroll(
          f.cypher,
          { on: true, entrantLimit: 1, enrollClosesAt: null },
          f.as(HOST),
          tx,
        ),
      ).rejects.toThrow();
      expect((await f.competitionRow(f.cypher)).entrantLimit).toBeNull();
    });
  });
});
