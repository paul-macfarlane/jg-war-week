import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const NEO = "neo@jahnelgroup.com";
const TRINITY = "trinity@jahnelgroup.com";
const MORPHEUS = "morpheus@jahnelgroup.com";
const TANK = "tank@jahnelgroup.com";
const NOBODY = "nobody@jahnelgroup.com";
const HOST = "participation-test-host@jahnelgroup.com";

const NOT_LINKED = "Your sign-in doesn't match a Participant of this War Week.";
const CLOSED = "This Competition is closed.";
const REOPEN_FIRST = "Reopen the Competition first.";
const NOT_PARTICIPATION = "This Competition isn't run as Participation.";

/**
 * A War Week (Team Label "House") with Red (Neo, Morpheus), Blue
 * (Trinity), Green (Tank) and Cypher on no House and with no email; a
 * second War Week with Smith; and five Competitions: Workout (team,
 * ranked by headcount, 5/3/1, self check-in on), Stairs (team, 2 per
 * person), Spirit (individual, 1 each, counts toward the House), Trivia
 * (points) and Pong (head-to-head).
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `pt${n}`,
        editionNumber: 9300 + n,
        year: 9300 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Participation test",
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
    return row.id;
  };
  const warWeekId = await warWeek(1);
  const otherWarWeekId = await warWeek(2);
  const [red, blue, green] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
      { warWeekId, name: "Green", color: "#0f0" },
    ])
    .returning({ id: schema.team.id });
  const [neo, trinity, morpheus, tank, cypher] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: red.id },
      { warWeekId, displayName: "Trinity", email: TRINITY, teamId: blue.id },
      { warWeekId, displayName: "Morpheus", email: MORPHEUS, teamId: red.id },
      { warWeekId, displayName: "Tank", email: TANK, teamId: green.id },
      { warWeekId, displayName: "Cypher" },
    ])
    .returning({ id: schema.participant.id });
  const [smith] = await tx
    .insert(schema.participant)
    .values({ warWeekId: otherWarWeekId, displayName: "Smith", email: NEO })
    .returning({ id: schema.participant.id });
  const [workout, stairs, spirit, trivia, pong] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Workout",
        scoring: "team" as const,
        format: "participation" as const,
        selfCheckIn: true,
        placementPoints: [5, 3, 1],
      },
      {
        warWeekId,
        name: "Stairs",
        scoring: "team" as const,
        format: "participation" as const,
        placementPoints: [3, 2, 1],
      },
      {
        warWeekId,
        name: "Spirit",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "participation" as const,
        participationPoints: 1,
        selfCheckIn: true,
      },
      { warWeekId, name: "Trivia", scoring: "team" as const },
      {
        warWeekId,
        name: "Pong",
        scoring: "individual" as const,
        format: "head-to-head" as const,
        seriesConfig: { drawsAllowed: false, bestOf: 3 as const },
      },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.competitionHost).values(
    [workout.id, stairs.id, spirit.id].map((competitionId) => ({
      competitionId,
      email: HOST,
    })),
  );

  const setCompetition = (
    id: string,
    values: Partial<typeof schema.competition.$inferInsert>,
  ) =>
    tx
      .update(schema.competition)
      .set(values)
      .where(eq(schema.competition.id, id));
  const marks = (competitionId: string) =>
    tx
      .select({
        participantId: schema.participation.participantId,
        checkedIn: schema.participation.checkedIn,
        markedByEmail: schema.participation.markedByEmail,
      })
      .from(schema.participation)
      .where(eq(schema.participation.competitionId, competitionId));
  const generated = async (competitionId: string) =>
    (
      await tx
        .select({
          teamId: schema.pointsEntry.teamId,
          participantId: schema.pointsEntry.participantId,
          points: schema.pointsEntry.points,
          note: schema.pointsEntry.note,
          generated: schema.pointsEntry.generated,
        })
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, competitionId))
    ).sort(
      (a, b) =>
        b.points - a.points ||
        String(a.teamId ?? a.participantId).localeCompare(
          String(b.teamId ?? b.participantId),
        ),
    );
  const closedAt = async (id: string) =>
    (
      await tx
        .select({ at: schema.competition.closedAt })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0].at;

  return {
    schema,
    tx,
    warWeekId,
    ctx: (actorEmail: string) => ({ warWeekId, actorEmail }),
    ids: {
      red: red.id,
      blue: blue.id,
      green: green.id,
      neo: neo.id,
      trinity: trinity.id,
      morpheus: morpheus.id,
      tank: tank.id,
      cypher: cypher.id,
      smith: smith.id,
      workout: workout.id,
      stairs: stairs.id,
      spirit: spirit.id,
      trivia: trivia.id,
      pong: pong.id,
    },
    setCompetition,
    marks,
    generated,
    closedAt,
  };
}

async function load() {
  const close = await import("@/mutations/close");
  return {
    ...(await import("@/mutations/participation")),
    closeParticipation: close.closeCompetition,
    reopenParticipation: close.reopenCompetition,
  };
}

describe.skipIf(!isLocalDatabase)("checkIn and checkOut", () => {
  it("lets a linked Participant check in and out, recording who for audit", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { checkIn, checkOut } = await load();
      const f = await fixture(tx);
      expect(await checkIn(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.marks(f.ids.workout)).toEqual([
        { participantId: f.ids.neo, checkedIn: true, markedByEmail: NEO },
      ]);
      expect(await checkIn(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: "You're already checked in.",
      });
      expect(await checkOut(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: true,
      });
      expect(await f.marks(f.ids.workout)).toEqual([]);
      expect(await checkOut(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: "You're not checked in.",
      });
    });
  });

  it("refuses an unlinked sign-in, check-in off and a Participant on no House", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { checkIn } = await load();
      const f = await fixture(tx);
      expect(await checkIn(f.ids.workout, f.ctx(NOBODY), tx)).toEqual({
        ok: false,
        error: NOT_LINKED,
      });
      expect(await checkIn(f.ids.stairs, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: "Check-in is off for this Competition.",
      });
      await tx
        .update(f.schema.participant)
        .set({ teamId: null })
        .where(eq(f.schema.participant.id, f.ids.neo));
      expect(await checkIn(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error:
          "Only Participants on a House can take part in a team Competition.",
      });
      expect(await f.marks(f.ids.workout)).toEqual([]);
    });
  });

  it("refuses checking out of the Host's mark, and anything once closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { checkIn, checkOut, markParticipant, closeParticipation } =
        await load();
      const f = await fixture(tx);
      await markParticipant(f.ids.workout, f.ids.neo, f.ctx(HOST), tx);
      expect(await checkOut(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: "The Host marked you; ask them to remove it.",
      });
      expect(await closeParticipation(f.ids.workout, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(await checkIn(f.ids.workout, f.ctx(TRINITY), tx)).toEqual({
        ok: false,
        error: CLOSED,
      });
    });
  });

  it("refuses a Competition not run as Participation", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { checkIn } = await load();
      const f = await fixture(tx);
      expect(await checkIn(f.ids.trivia, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: NOT_PARTICIPATION,
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "markParticipant and unmarkParticipant",
  () => {
    it("lets the Host tick and untick anyone of this War Week, a check-in included", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { checkIn, markParticipant, unmarkParticipant } = await load();
        const f = await fixture(tx);
        expect(
          await markParticipant(f.ids.workout, f.ids.tank, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        // Ticking again changes nothing.
        expect(
          await markParticipant(f.ids.workout, f.ids.tank, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        await checkIn(f.ids.workout, f.ctx(NEO), tx);
        expect(
          (await f.marks(f.ids.workout)).sort((a, b) =>
            a.participantId.localeCompare(b.participantId),
          ),
        ).toEqual(
          [
            {
              participantId: f.ids.tank,
              checkedIn: false,
              markedByEmail: HOST,
            },
            { participantId: f.ids.neo, checkedIn: true, markedByEmail: NEO },
          ].sort((a, b) => a.participantId.localeCompare(b.participantId)),
        );
        expect(
          await unmarkParticipant(f.ids.workout, f.ids.neo, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await f.marks(f.ids.workout)).toEqual([
          { participantId: f.ids.tank, checkedIn: false, markedByEmail: HOST },
        ]);
      });
    });

    it("refuses another War Week's Participant, one on no House in team scoring, and any change once closed", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { markParticipant, unmarkParticipant, closeParticipation } =
          await load();
        const f = await fixture(tx);
        expect(
          await markParticipant(f.ids.workout, f.ids.smith, f.ctx(HOST), tx),
        ).toEqual({ ok: false, error: "That Participant no longer exists." });
        expect(
          await markParticipant(f.ids.workout, f.ids.cypher, f.ctx(HOST), tx),
        ).toEqual({
          ok: false,
          error:
            "Only Participants on a House can take part in a team Competition.",
        });
        // Individual scoring takes anyone on the roster.
        expect(
          await markParticipant(f.ids.spirit, f.ids.cypher, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        await closeParticipation(f.ids.spirit, f.ctx(HOST), tx);
        expect(
          await markParticipant(f.ids.spirit, f.ids.neo, f.ctx(HOST), tx),
        ).toEqual({ ok: false, error: REOPEN_FIRST });
        expect(
          await unmarkParticipant(f.ids.spirit, f.ids.cypher, f.ctx(HOST), tx),
        ).toEqual({ ok: false, error: REOPEN_FIRST });
        expect(
          await markParticipant(f.ids.pong, f.ids.neo, f.ctx(HOST), tx),
        ).toEqual({ ok: false, error: NOT_PARTICIPATION });
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)(
  "closeParticipation and reopenParticipation",
  () => {
    it("team ranked by headcount: ties share the higher place, and the Standings move", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { markParticipant, closeParticipation, reopenParticipation } =
          await load();
        const { getStandings } = await import("@/queries/standings");
        const f = await fixture(tx);
        // Red 2 (Neo, Morpheus), Blue 1 (Trinity), Green 1 (Tank).
        for (const id of [
          f.ids.neo,
          f.ids.morpheus,
          f.ids.trinity,
          f.ids.tank,
        ]) {
          await markParticipant(f.ids.workout, id, f.ctx(HOST), tx);
        }
        const teamTotals = async () =>
          Object.fromEntries(
            (
              await getStandings({ id: f.warWeekId, mode: "teams" }, tx)
            ).team.map((r) => [r.name, r.total]),
          );
        const before = await teamTotals();

        expect(
          await closeParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        const [blueOrGreen, greenOrBlue] = [f.ids.blue, f.ids.green].sort();
        expect(await f.generated(f.ids.workout)).toEqual([
          {
            teamId: f.ids.red,
            participantId: null,
            points: 5,
            note: "From participation",
            generated: true,
          },
          {
            teamId: blueOrGreen,
            participantId: null,
            points: 3,
            note: "From participation",
            generated: true,
          },
          {
            teamId: greenOrBlue,
            participantId: null,
            points: 3,
            note: "From participation",
            generated: true,
          },
        ]);
        expect(await f.closedAt(f.ids.workout)).not.toBeNull();
        const after = await teamTotals();
        expect(after.Red - before.Red).toBe(5);
        expect(after.Blue - before.Blue).toBe(3);
        expect(after.Green - before.Green).toBe(3);

        expect(
          await closeParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(
          await reopenParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await f.generated(f.ids.workout)).toEqual([]);
        expect(await f.closedAt(f.ids.workout)).toBeNull();
        expect(await teamTotals()).toEqual(before);
      });
    });

    it("team: ranked by headcount, using each Participant's House at Close", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { markParticipant, closeParticipation } = await load();
        const f = await fixture(tx);
        for (const id of [f.ids.neo, f.ids.morpheus, f.ids.trinity]) {
          await markParticipant(f.ids.stairs, id, f.ctx(HOST), tx);
        }
        // Morpheus moves to Blue before Close.
        await tx
          .update(f.schema.participant)
          .set({ teamId: f.ids.blue })
          .where(eq(f.schema.participant.id, f.ids.morpheus));
        await closeParticipation(f.ids.stairs, f.ctx(HOST), tx);
        // Blue now has two who took part, Red one: Blue 1st, Red 2nd.
        expect(
          (await f.generated(f.ids.stairs)).map((e) => [e.teamId, e.points]),
        ).toEqual([
          [f.ids.blue, 3],
          [f.ids.red, 2],
        ]);
      });
    });

    it("individual: N to each, counting toward the House; a non-generated entry stays through Reopen", async () => {
      await inRolledBackTransaction(async (tx) => {
        const {
          checkIn,
          markParticipant,
          closeParticipation,
          reopenParticipation,
        } = await load();
        const f = await fixture(tx);
        await checkIn(f.ids.spirit, f.ctx(NEO), tx);
        await markParticipant(f.ids.spirit, f.ids.cypher, f.ctx(HOST), tx);
        await tx.insert(f.schema.pointsEntry).values({
          warWeekId: f.ctx(HOST).warWeekId,
          competitionId: f.ids.spirit,
          participantId: f.ids.tank,
          points: 4,
          note: "Best costume",
          enteredByEmail: HOST,
        });
        await closeParticipation(f.ids.spirit, f.ctx(HOST), tx);
        const generatedOnly = async () =>
          (await f.generated(f.ids.spirit))
            .filter((e) => e.generated)
            .map((e) => [e.participantId, e.points])
            .sort((a, b) => String(a[0]).localeCompare(String(b[0])));
        expect(await generatedOnly()).toEqual(
          [
            [f.ids.neo, 1],
            [f.ids.cypher, 1],
          ].sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
        );
        await reopenParticipation(f.ids.spirit, f.ctx(HOST), tx);
        expect(await f.generated(f.ids.spirit)).toEqual([
          {
            teamId: null,
            participantId: f.ids.tank,
            points: 4,
            note: "Best costume",
            generated: false,
          },
        ]);
      });
    });

    it("Close, Reopen, Close writes the same entries; nobody marked writes none", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { markParticipant, closeParticipation, reopenParticipation } =
          await load();
        const f = await fixture(tx);
        expect(
          await closeParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await f.generated(f.ids.workout)).toEqual([]);
        await reopenParticipation(f.ids.workout, f.ctx(HOST), tx);
        for (const id of [f.ids.neo, f.ids.trinity, f.ids.morpheus]) {
          await markParticipant(f.ids.workout, id, f.ctx(HOST), tx);
        }
        await closeParticipation(f.ids.workout, f.ctx(HOST), tx);
        const first = await f.generated(f.ids.workout);
        expect(first.map((e) => [e.teamId, e.points])).toEqual([
          [f.ids.red, 5],
          [f.ids.blue, 3],
        ]);
        await reopenParticipation(f.ids.workout, f.ctx(HOST), tx);
        await closeParticipation(f.ids.workout, f.ctx(HOST), tx);
        expect(await f.generated(f.ids.workout)).toEqual(first);
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("setParticipationSettings", () => {
  const team = {
    participationPoints: null,
    placementPoints: [9, 6, 3],
    selfCheckIn: false,
  };
  const individual = {
    participationPoints: 2,
    placementPoints: null,
    selfCheckIn: false,
  };

  const read = async (f: Awaited<ReturnType<typeof fixture>>, id: string) =>
    (
      await f.tx
        .select({
          participationPoints: f.schema.competition.participationPoints,
          placementPoints: f.schema.competition.placementPoints,
          selfCheckIn: f.schema.competition.selfCheckIn,
        })
        .from(f.schema.competition)
        .where(eq(f.schema.competition.id, id))
    )[0];

  it("a team Competition saves its Placement Points and the switch, and keeps no N", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setParticipationSettings } = await load();
      const f = await fixture(tx);
      expect(
        await setParticipationSettings(f.ids.workout, team, f.ctx(HOST), tx),
      ).toEqual({ ok: true });
      expect(await read(f, f.ids.workout)).toEqual({
        participationPoints: null,
        placementPoints: [9, 6, 3],
        selfCheckIn: false,
      });
    });
  });

  it("an individual Competition saves N and the switch, and keeps no Placement Points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setParticipationSettings } = await load();
      const f = await fixture(tx);
      expect(
        await setParticipationSettings(
          f.ids.spirit,
          individual,
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await read(f, f.ids.spirit)).toEqual({
        participationPoints: 2,
        placementPoints: null,
        selfCheckIn: false,
      });
    });
  });

  it("refuses the field that doesn't fit the Competition's scoring, a missing one, and a save while closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setParticipationSettings, closeParticipation } = await load();
      const f = await fixture(tx);
      expect(
        await setParticipationSettings(
          f.ids.spirit,
          { ...individual, placementPoints: [3, 2] },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "An individual Competition gives points to each Participant, not Placement Points.",
      });
      expect(
        await setParticipationSettings(
          f.ids.spirit,
          { ...individual, participationPoints: null },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Enter the points per Participant." });
      expect(
        await setParticipationSettings(
          f.ids.workout,
          { ...team, participationPoints: 2 },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A team Competition awards Placement Points, not points per Participant.",
      });
      expect(
        await setParticipationSettings(
          f.ids.workout,
          { ...team, placementPoints: null },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Enter the Placement Points." });
      await closeParticipation(f.ids.workout, f.ctx(HOST), tx);
      expect(
        await setParticipationSettings(f.ids.workout, team, f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: REOPEN_FIRST });
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "a participation Competition in setup",
  () => {
    const values = {
      name: "Black Midnight",
      description: null,
      scoring: "team" as const,
      placementPoints: [5, 3, 1],
      countsTowardTeam: false,
      competitionGroup: null,
    };

    it("is created with N of 1 when individual, ranked by headcount for its Placement Points when team, self check-in off", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { createCompetition } = await import("@/mutations/setup");
        const f = await fixture(tx);
        const created = await createCompetition(
          { ...values, format: "participation" },
          f.ctx(HOST),
          tx,
        );
        expect(created).toMatchObject({ ok: true });
        const individual = await createCompetition(
          {
            ...values,
            name: "Spirit Week",
            scoring: "individual",
            format: "participation",
          },
          f.ctx(HOST),
          tx,
        );
        const read = async (id: string) =>
          (
            await tx
              .select({
                format: f.schema.competition.format,
                participationPoints: f.schema.competition.participationPoints,
                placementPoints: f.schema.competition.placementPoints,
                selfCheckIn: f.schema.competition.selfCheckIn,
              })
              .from(f.schema.competition)
              .where(eq(f.schema.competition.id, id))
          )[0];
        expect(await read((created as { id: string }).id)).toEqual({
          format: "participation",
          participationPoints: null,
          placementPoints: [5, 3, 1],
          selfCheckIn: false,
        });
        expect(await read((individual as { id: string }).id)).toEqual({
          format: "participation",
          participationPoints: 1,
          placementPoints: null,
          selfCheckIn: false,
        });
      });
    });

    it("changes scoring only with nobody marked, swapping N and Placement Points to match", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateCompetition } = await import("@/mutations/setup");
        const { markParticipant, unmarkParticipant } = await load();
        const f = await fixture(tx);
        const workout = { ...values, name: "Workout" };
        await markParticipant(f.ids.workout, f.ids.neo, f.ctx(HOST), tx);
        expect(
          await updateCompetition(
            f.ids.workout,
            { ...workout, scoring: "individual", placementPoints: [5, 3, 1] },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({
          ok: false,
          error:
            "This Competition has 1 Participant who took part. Remove who took part before changing its scoring.",
        });
        await unmarkParticipant(f.ids.workout, f.ids.neo, f.ctx(HOST), tx);
        expect(
          await updateCompetition(
            f.ids.workout,
            { ...workout, scoring: "individual" },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: true });
        const scoringOf = async () =>
          (
            await tx
              .select({
                scoring: f.schema.competition.scoring,
                participationPoints: f.schema.competition.participationPoints,
                placementPoints: f.schema.competition.placementPoints,
              })
              .from(f.schema.competition)
              .where(eq(f.schema.competition.id, f.ids.workout))
          )[0];
        expect(await scoringOf()).toEqual({
          scoring: "individual",
          participationPoints: 1,
          placementPoints: null,
        });
        expect(
          await updateCompetition(f.ids.workout, workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await scoringOf()).toEqual({
          scoring: "team",
          participationPoints: null,
          placementPoints: [5, 3, 1],
        });
      });
    });

    it("refuses a closed one's scoring change, and deleting one with anyone marked", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateCompetition, deleteCompetition } =
          await import("@/mutations/setup");
        const { markParticipant, closeParticipation } = await load();
        const f = await fixture(tx);
        await markParticipant(f.ids.stairs, f.ids.neo, f.ctx(HOST), tx);
        expect(await deleteCompetition(f.ids.stairs, f.ctx(HOST), tx)).toEqual({
          ok: false,
          error:
            "This Competition has 1 Participant who took part. Remove who took part first.",
        });
        await closeParticipation(f.ids.stairs, f.ctx(HOST), tx);
        expect(
          await updateCompetition(
            f.ids.stairs,
            {
              ...values,
              name: "Stairs",
              scoring: "individual",
              placementPoints: null,
            },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "This Competition is closed. Reopen the Competition first.",
        });
      });
    });

    it("changes Format to and from participation while it has no result", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { setCompetitionFormat } = await import("@/mutations/brackets");
        const f = await fixture(tx);
        expect(
          await setCompetitionFormat(
            f.ids.workout,
            { format: "bracket" },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: true });
        const [row] = await tx
          .select({
            format: f.schema.competition.format,
            participationPoints: f.schema.competition.participationPoints,
            selfCheckIn: f.schema.competition.selfCheckIn,
          })
          .from(f.schema.competition)
          .where(eq(f.schema.competition.id, f.ids.workout));
        expect(row).toEqual({
          format: "bracket",
          participationPoints: null,
          selfCheckIn: false,
        });
        expect(
          await setCompetitionFormat(
            f.ids.trivia,
            { format: "participation" },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("the database CHECK", () => {
  it("takes N only on an individual participation Competition and Placement Points only on a team one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const attempt = async (
        id: string,
        values: Partial<typeof f.schema.competition.$inferInsert>,
      ) => {
        try {
          await tx.execute("savepoint attempt");
          await f.setCompetition(id, values);
          await tx.execute("rollback to savepoint attempt");
          return "saved";
        } catch (error) {
          await tx.execute("rollback to savepoint attempt");
          return String(
            (error as { cause?: { constraint?: string } }).cause?.constraint ??
              error,
          );
        }
      };
      const refused = "competition_participation_columns";
      // Participation settings on another Format.
      expect(await attempt(f.ids.trivia, { selfCheckIn: true })).toBe(refused);
      expect(await attempt(f.ids.trivia, { participationPoints: 1 })).toBe(
        refused,
      );
      // An individual one: N, no Placement Points.
      expect(await attempt(f.ids.spirit, { placementPoints: [3] })).toBe(
        refused,
      );
      expect(await attempt(f.ids.spirit, { participationPoints: null })).toBe(
        refused,
      );
      expect(await attempt(f.ids.spirit, { participationPoints: 3 })).toBe(
        "saved",
      );
      // A team one: Placement Points, no N.
      expect(await attempt(f.ids.workout, { participationPoints: 1 })).toBe(
        refused,
      );
      expect(await attempt(f.ids.workout, { placementPoints: null })).toBe(
        refused,
      );
      expect(await attempt(f.ids.workout, { placementPoints: [7, 4] })).toBe(
        "saved",
      );
    });
  });
});
