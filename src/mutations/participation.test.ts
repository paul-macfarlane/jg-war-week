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
 * (points) and Pong (games).
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
        participationPoints: 1,
        participationTeamScoring: "ranked" as const,
        selfCheckIn: true,
        placementPoints: [5, 3, 1],
      },
      {
        warWeekId,
        name: "Stairs",
        scoring: "team" as const,
        format: "participation" as const,
        participationPoints: 2,
        participationTeamScoring: "per-person" as const,
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
        format: "games" as const,
        gameType: "head-to-head" as const,
        entrantsOpen: true,
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
          generated: schema.pointsEntry.generatedByBracket,
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
  const finalizedAt = async (id: string) =>
    (
      await tx
        .select({ at: schema.competition.finalizedAt })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0].at;

  return {
    schema,
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
    finalizedAt,
  };
}

async function load() {
  return import("@/mutations/participation");
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

  it("refuses an unlinked sign-in, check-in off, a passed close time and a Participant on no House", async () => {
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
      await f.setCompetition(f.ids.workout, {
        checkInClosesAt: new Date(Date.now() - 60_000),
      });
      expect(await checkIn(f.ids.workout, f.ctx(NEO), tx)).toEqual({
        ok: false,
        error: "Check-in is closed: the close time has passed.",
      });
      await f.setCompetition(f.ids.workout, { checkInClosesAt: null });
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
        expect(await f.finalizedAt(f.ids.workout)).not.toBeNull();
        const after = await teamTotals();
        expect(after.Red - before.Red).toBe(5);
        expect(after.Blue - before.Blue).toBe(3);
        expect(after.Green - before.Green).toBe(3);

        expect(
          await closeParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: false, error: "This Competition is already closed." });
        expect(
          await reopenParticipation(f.ids.workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await f.generated(f.ids.workout)).toEqual([]);
        expect(await f.finalizedAt(f.ids.workout)).toBeNull();
        expect(await teamTotals()).toEqual(before);
      });
    });

    it("team per person: N times the headcount; uses each Participant's House at Close", async () => {
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
        expect(
          (await f.generated(f.ids.stairs)).map((e) => [e.teamId, e.points]),
        ).toEqual([
          [f.ids.blue, 4],
          [f.ids.red, 2],
        ]);
      });
    });

    it("individual: N to each, counting toward the House; a hand-entered entry stays through Reopen", async () => {
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

    it("refuses a Competition not run as Participation", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { closeParticipation, reopenParticipation } = await load();
        const f = await fixture(tx);
        const refused = { ok: false, error: NOT_PARTICIPATION };
        expect(await closeParticipation(f.ids.trivia, f.ctx(HOST), tx)).toEqual(
          refused,
        );
        expect(await reopenParticipation(f.ids.pong, f.ctx(HOST), tx)).toEqual(
          refused,
        );
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("setParticipationSettings", () => {
  const settings = {
    participationPoints: 2,
    participationTeamScoring: "per-person" as const,
    placementPoints: [9, 6, 3],
    selfCheckIn: false,
    checkInClosesAt: new Date("2099-01-05T22:00:00Z"),
  };

  it("saves N, the team scoring, the switch and the close time; Placement Points only when ranked", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setParticipationSettings } = await load();
      const f = await fixture(tx);
      expect(
        await setParticipationSettings(
          f.ids.workout,
          settings,
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      const read = async () =>
        (
          await tx
            .select({
              participationPoints: f.schema.competition.participationPoints,
              participationTeamScoring:
                f.schema.competition.participationTeamScoring,
              placementPoints: f.schema.competition.placementPoints,
              selfCheckIn: f.schema.competition.selfCheckIn,
              checkInClosesAt: f.schema.competition.checkInClosesAt,
            })
            .from(f.schema.competition)
            .where(eq(f.schema.competition.id, f.ids.workout))
        )[0];
      expect(await read()).toEqual({
        participationPoints: 2,
        participationTeamScoring: "per-person",
        placementPoints: [5, 3, 1],
        selfCheckIn: false,
        checkInClosesAt: new Date("2099-01-05T22:00:00Z"),
      });
      await setParticipationSettings(
        f.ids.workout,
        { ...settings, participationTeamScoring: "ranked" },
        f.ctx(HOST),
        tx,
      );
      expect((await read()).placementPoints).toEqual([9, 6, 3]);
    });
  });

  it("refuses a team scoring that doesn't fit the Competition's scoring, 1st over Max points, and while closed", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setParticipationSettings, closeParticipation } = await load();
      const f = await fixture(tx);
      expect(
        await setParticipationSettings(f.ids.spirit, settings, f.ctx(HOST), tx),
      ).toEqual({
        ok: false,
        error: "An individual Competition doesn't score Teams.",
      });
      expect(
        await setParticipationSettings(
          f.ids.workout,
          { ...settings, participationTeamScoring: null },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose how Teams score." });
      await f.setCompetition(f.ids.workout, { maxPoints: 5 });
      expect(
        await setParticipationSettings(
          f.ids.workout,
          { ...settings, participationTeamScoring: "ranked" },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "1st place's Placement Points can't be more than Max points.",
      });
      await closeParticipation(f.ids.workout, f.ctx(HOST), tx);
      expect(
        await setParticipationSettings(
          f.ids.workout,
          settings,
          f.ctx(HOST),
          tx,
        ),
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
      maxPoints: null,
      placementPoints: [5, 3, 1],
      countsTowardTeam: false,
      competitionGroup: null,
    };

    it("is created with N of 1, ranked by headcount in team scoring, self check-in off", async () => {
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
                participationTeamScoring:
                  f.schema.competition.participationTeamScoring,
                selfCheckIn: f.schema.competition.selfCheckIn,
              })
              .from(f.schema.competition)
              .where(eq(f.schema.competition.id, id))
          )[0];
        expect(await read((created as { id: string }).id)).toEqual({
          format: "participation",
          participationPoints: 1,
          participationTeamScoring: "ranked",
          selfCheckIn: false,
        });
        expect(await read((individual as { id: string }).id)).toEqual({
          format: "participation",
          participationPoints: 1,
          participationTeamScoring: null,
          selfCheckIn: false,
        });
      });
    });

    it("changes scoring only with nobody marked, setting the team scoring to match", async () => {
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
                teamScoring: f.schema.competition.participationTeamScoring,
              })
              .from(f.schema.competition)
              .where(eq(f.schema.competition.id, f.ids.workout))
          )[0];
        expect(await scoringOf()).toEqual({
          scoring: "individual",
          teamScoring: null,
        });
        expect(
          await updateCompetition(f.ids.workout, workout, f.ctx(HOST), tx),
        ).toEqual({ ok: true });
        expect(await scoringOf()).toEqual({
          scoring: "team",
          teamScoring: "ranked",
        });
        // A save that keeps team scoring keeps the Host's choice.
        await f.setCompetition(f.ids.workout, {
          participationTeamScoring: "per-person",
        });
        await updateCompetition(f.ids.workout, workout, f.ctx(HOST), tx);
        expect(await scoringOf()).toEqual({
          scoring: "team",
          teamScoring: "per-person",
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

    it("keeps its Format: no change to or from participation", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { setCompetitionFormat } = await import("@/mutations/brackets");
        const f = await fixture(tx);
        const keeps =
          "A Participation Competition keeps its Format; add a new Competition to run it another way.";
        expect(
          await setCompetitionFormat(
            f.ids.workout,
            { format: "heats" },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: false, error: keeps });
        expect(
          await setCompetitionFormat(
            f.ids.trivia,
            { format: "participation" },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: false, error: keeps });
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("the database CHECK", () => {
  it("refuses Participation settings on another Format, and a team one without its team scoring", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await fixture(tx);
      const attempt = async (
        values: Partial<typeof f.schema.competition.$inferInsert>,
      ) => {
        try {
          await tx.execute("savepoint attempt");
          await f.setCompetition(f.ids.trivia, values);
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
      expect(await attempt({ selfCheckIn: true })).toBe(
        "competition_participation_columns",
      );
      expect(await attempt({ participationPoints: 1 })).toBe(
        "competition_participation_columns",
      );
      expect(
        await attempt({ format: "participation", participationPoints: 1 }),
      ).toBe("competition_participation_columns");
      expect(
        await attempt({
          format: "participation",
          participationPoints: 1,
          participationTeamScoring: "ranked",
        }),
      ).toBe("saved");
    });
  });
});
