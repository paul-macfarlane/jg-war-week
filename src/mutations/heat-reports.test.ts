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

const actorEmail = "organizer@jahnelgroup.com";

/** A War Week with a team single-elimination Competition and a points one. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `t${n}`,
        editionNumber: 9100 + n,
        year: 9100 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Self-report test",
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
  const [bracket, points] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Cypher",
        scoring: "team",
        format: "single-elimination",
      },
      { warWeekId, name: "Trivia", scoring: "team", format: "points" },
    ])
    .returning({ id: schema.competition.id });
  const selfReportOf = async (id: string) =>
    (
      await tx
        .select({ selfReport: schema.competition.selfReport })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0].selfReport;
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    competitionId: bracket.id,
    pointsId: points.id,
    selfReportOf,
  };
}

describe.skipIf(!isLocalDatabase)("setSelfReport", () => {
  it("is off by default, and turns on and off", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);
      expect(await f.selfReportOf(f.competitionId)).toBe(false);

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(true);

      expect(
        await setSelfReport(f.competitionId, { on: false }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(false);
    });
  });

  it("is allowed while the Bracket is finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);
      await tx
        .update(f.schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(f.schema.competition.id, f.competitionId));

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(true);
    });
  });

  it("refuses a points Competition and one of another War Week, changing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);

      expect(await setSelfReport(f.pointsId, { on: true }, f.ctx, tx)).toEqual({
        ok: false,
        error: "This Competition isn't run as a Bracket.",
      });
      expect(await f.selfReportOf(f.pointsId)).toBe(false);

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.otherCtx, tx),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
      expect(await f.selfReportOf(f.competitionId)).toBe(false);
    });
  });
});

class Rollback extends Error {}

// Every draw 0 shuffles [a, b, c, d] to [b, c, d, a] (see seeding.test.ts).
const rngZero = () => 0;

const NEO = "neo@jahnelgroup.com";
const TRINITY = "trinity@jahnelgroup.com";
const NOBODY = "nobody@jahnelgroup.com";
const NONE = { email: null, participantId: null };

/**
 * The fixture's War Week with Red, Blue, Green and Gold, a linked
 * Participant on each (Neo is Red, Trinity Blue), and three Brackets with
 * self-report on: Cypher drawn Blue v Red, Green v Gold; Tug of War, Red,
 * Blue and Green (so one Semifinal is a bye); and Relay Heats, eight
 * linked runners, 4 per Heat, 2 advancing.
 */
async function reportFixture(tx: DBTx) {
  const f = await fixture(tx);
  const { schema } = f;
  const brackets = await import("@/mutations/brackets");
  const { setSelfReport } = await import("@/mutations/heat-reports");
  const { getBracket } = await import("@/queries/brackets");
  const warWeekId = f.ctx.warWeekId;
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
    .returning({ id: schema.team.id, name: schema.team.name });
  const teamId = (name: string) => teams.find((t) => t.name === name)!.id;
  const people = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: teamId("Red") },
      {
        warWeekId,
        displayName: "Trinity",
        email: TRINITY,
        teamId: teamId("Blue"),
      },
      {
        warWeekId,
        displayName: "Morpheus",
        email: "morpheus@jahnelgroup.com",
        teamId: teamId("Green"),
      },
      {
        warWeekId,
        displayName: "Switch",
        email: "switch@jahnelgroup.com",
        teamId: teamId("Gold"),
      },
    ])
    .returning({
      id: schema.participant.id,
      email: schema.participant.email,
      teamId: schema.participant.teamId,
    });
  const runners = await tx
    .insert(schema.participant)
    .values(
      [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({
        warWeekId,
        displayName: `Runner ${n}`,
        email: `runner${n}@jahnelgroup.com`,
      })),
    )
    .returning({
      id: schema.participant.id,
      email: schema.participant.email,
    });
  const [tug, relay] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Tug of War",
        scoring: "team",
        format: "single-elimination",
      },
      {
        warWeekId,
        name: "Relay Heats",
        scoring: "individual",
        format: "single-elimination",
      },
    ])
    .returning({ id: schema.competition.id });
  expect(
    await brackets.setCompetitionFormat(
      relay.id,
      { format: "heats", config: { entrantsPerHeat: 4, advancePerHeat: 2 } },
      f.ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  const draws: [string, string[]][] = [
    [
      f.competitionId,
      [teamId("Red"), teamId("Blue"), teamId("Green"), teamId("Gold")],
    ],
    [tug.id, [teamId("Red"), teamId("Blue"), teamId("Green")]],
    [relay.id, runners.map((r) => r.id)],
  ];
  for (const [id, targetIds] of draws) {
    expect(
      await brackets.replaceEntrants(id, { targetIds }, f.ctx, tx),
    ).toEqual({ ok: true });
    expect(
      await brackets.generateBracket(id, { rng: rngZero }, f.ctx, tx),
    ).toEqual({ ok: true });
    expect(await setSelfReport(id, { on: true }, f.ctx, tx)).toEqual({
      ok: true,
    });
  }

  const view = async (id: string) => (await getBracket(id, tx))!;
  const cypher = await view(f.competitionId);
  const entrantOf = (label: string) =>
    cypher.entrants.find((e) => e.label === label)!.id;
  const heatAt = (
    v: Awaited<ReturnType<typeof view>>,
    round: number,
    position: number,
  ) =>
    v.bracket.heats.find((h) => h.round === round && h.position === position)!
      .id;
  const participantOf = (email: string) =>
    [...people, ...runners].find((p) => p.email === email)!.id;
  return {
    ...f,
    tugId: tug.id,
    relayId: relay.id,
    people,
    runners,
    view,
    entrantOf,
    participantOf,
    semi1: heatAt(cypher, 1, 1),
    semi2: heatAt(cypher, 1, 2),
    final: heatAt(cypher, 2, 1),
    heatAt,
    as: (actorEmail: string) => ({ warWeekId, actorEmail }),
  };
}

/** A Competition's Bracket and every Heat's reporter columns. */
async function snapshot(tx: DBTx, competitionId: string) {
  const { loadBracket } = await import("@/queries/brackets");
  const { heat } = await import("@/db/schema");
  return {
    bracket: await loadBracket(competitionId, tx),
    reporters: await tx
      .select({
        id: heat.id,
        email: heat.reportedByEmail,
        participantId: heat.reportedByParticipantId,
      })
      .from(heat)
      .where(eq(heat.competitionId, competitionId))
      .orderBy(heat.id),
  };
}

/** One Heat's reporter columns. */
async function reporterOf(tx: DBTx, heatId: string) {
  const { heat } = await import("@/db/schema");
  const [row] = await tx
    .select({
      email: heat.reportedByEmail,
      participantId: heat.reportedByParticipantId,
    })
    .from(heat)
    .where(eq(heat.id, heatId));
  return row;
}

/**
 * Reports `result` in a savepoint that's rolled back, then records the same
 * result as the Host on the same draw: returns both Brackets as saved.
 */
async function reportThenHost(
  tx: DBTx,
  competitionId: string,
  heatId: string,
  result: { order: string[] },
  reporter: { email: string; participantId: string },
  hostCtx: { warWeekId: string; actorEmail: string },
) {
  const { submitHeatReport } = await import("@/mutations/heat-reports");
  const { recordHeatResult } = await import("@/mutations/brackets");
  const { loadBracket } = await import("@/queries/brackets");
  let reported: Awaited<ReturnType<typeof loadBracket>> | undefined;
  await tx
    .transaction(async (sp) => {
      expect(
        await submitHeatReport(
          competitionId,
          heatId,
          result,
          { warWeekId: hostCtx.warWeekId, actorEmail: reporter.email },
          sp,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      reported = await loadBracket(competitionId, sp);
      expect(await reporterOf(sp, heatId)).toEqual(reporter);
      throw new Rollback();
    })
    .catch((error) => {
      if (!(error instanceof Rollback)) throw error;
    });
  expect(await reporterOf(tx, heatId)).toEqual(NONE);
  expect(
    await recordHeatResult(competitionId, heatId, result, hostCtx, tx),
  ).toEqual({ ok: true, resetHeatIds: [] });
  return { reported, recorded: await loadBracket(competitionId, tx) };
}

describe.skipIf(!isLocalDatabase)("submitHeatReport", () => {
  it("single elimination: a report saves exactly what the Host's result would, and records its reporter", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await reportFixture(tx);
      const { reported, recorded } = await reportThenHost(
        tx,
        f.competitionId,
        f.semi1,
        { order: [f.entrantOf("Red"), f.entrantOf("Blue")] },
        { email: NEO, participantId: f.participantOf(NEO) },
        f.ctx,
      );

      expect(reported).toEqual(recorded);
      // Red advanced into the Final, as the Host's result does.
      const final = recorded.heats.find((h) => h.id === f.final)!;
      expect(final.slots[0].entrantId).toBe(f.entrantOf("Red"));
    });
  });

  it("Heats: a report saves exactly what the Host's result would, and records its reporter", async () => {
    await inRolledBackTransaction(async (tx) => {
      const f = await reportFixture(tx);
      const relay = await f.view(f.relayId);
      const first = relay.bracket.heats.find(
        (h) => h.id === f.heatAt(relay, 1, 1),
      )!;
      const order = first.slots.map((s) => s.entrantId!);
      const runner = relay.entrants.find(
        (e) => e.id === order[0],
      )!.participantId!;
      const email = f.runners.find((r) => r.id === runner)!.email!;

      const { reported, recorded } = await reportThenHost(
        tx,
        f.relayId,
        first.id,
        { order },
        { email, participantId: runner },
        f.ctx,
      );

      expect(reported).toEqual(recorded);
      expect(
        recorded.heats
          .find((h) => h.id === first.id)!
          .slots.map((s) => s.place),
      ).toEqual([1, 2, 3, 4]);
    });
  });

  it("refuses a second report on the now-decided Heat, changing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { submitHeatReport } = await import("@/mutations/heat-reports");
      const f = await reportFixture(tx);
      const red = f.entrantOf("Red");
      const blue = f.entrantOf("Blue");
      expect(
        await submitHeatReport(
          f.competitionId,
          f.semi1,
          { order: [red, blue] },
          f.as(NEO),
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      const before = await snapshot(tx, f.competitionId);

      expect(
        await submitHeatReport(
          f.competitionId,
          f.semi1,
          { order: [blue, red] },
          f.as(TRINITY),
          tx,
        ),
      ).toEqual({ ok: false, error: "This Heat already has a result." });
      expect(await snapshot(tx, f.competitionId)).toEqual(before);
      expect(await reporterOf(tx, f.semi1)).toEqual({
        email: NEO,
        participantId: f.participantOf(NEO),
      });
    });
  });

  it("refuses self-report off, an unlinked sign-in, a Heat you're not in, an unfilled Heat and a bye, writing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { submitHeatReport, setSelfReport } =
        await import("@/mutations/heat-reports");
      const { recordHeatResult } = await import("@/mutations/brackets");
      const { isBye } = await import("@/lib/bracket/formats");
      const f = await reportFixture(tx);
      const red = f.entrantOf("Red");
      const blue = f.entrantOf("Blue");
      const green = f.entrantOf("Green");
      const gold = f.entrantOf("Gold");
      const refused = async (
        competitionId: string,
        heatId: string,
        order: string[],
        email: string,
        error: string,
      ) => {
        const before = await snapshot(tx, competitionId);
        expect(
          await submitHeatReport(
            competitionId,
            heatId,
            { order },
            f.as(email),
            tx,
          ),
        ).toEqual({ ok: false, error });
        expect(await snapshot(tx, competitionId)).toEqual(before);
      };

      await setSelfReport(f.competitionId, { on: false }, f.ctx, tx);
      await refused(
        f.competitionId,
        f.semi1,
        [red, blue],
        NEO,
        "Self-report is off for this Competition.",
      );
      await setSelfReport(f.competitionId, { on: true }, f.ctx, tx);

      await refused(
        f.competitionId,
        f.semi1,
        [red, blue],
        NOBODY,
        "Your sign-in doesn't match a Participant of this War Week.",
      );
      await refused(
        f.competitionId,
        f.semi2,
        [gold, green],
        NEO,
        "You're not in this Heat.",
      );

      // Red is through to the Final; Green v Gold isn't played yet.
      await recordHeatResult(
        f.competitionId,
        f.semi1,
        { order: [red, blue] },
        f.ctx,
        tx,
      );
      await refused(
        f.competitionId,
        f.final,
        [red],
        NEO,
        "This Heat is still waiting for its Entrants.",
      );

      const tug = await f.view(f.tugId);
      const bye = tug.bracket.heats.find((h) => isBye(tug.bracket, h))!;
      const byeEntrant = bye.slots.find((s) => s.entrantId)!.entrantId!;
      const byeTeam = tug.entrants.find((e) => e.id === byeEntrant)!.teamId;
      const byeEmail = f.people.find((p) => p.teamId === byeTeam)!.email!;
      await refused(
        f.tugId,
        bye.id,
        [byeEntrant],
        byeEmail,
        "A bye isn't played.",
      );
    });
  });

  it("refuses a Heat of another Competition as gone, writing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { submitHeatReport } = await import("@/mutations/heat-reports");
      const f = await reportFixture(tx);
      const tug = await f.view(f.tugId);
      const tugHeat = tug.bracket.heats.find((h) =>
        h.slots.every((s) => s.entrantId),
      )!;
      const before = [
        await snapshot(tx, f.competitionId),
        await snapshot(tx, f.tugId),
      ];

      expect(
        await submitHeatReport(
          f.competitionId,
          tugHeat.id,
          { order: tugHeat.slots.map((s) => s.entrantId!) },
          f.as(NEO),
          tx,
        ),
      ).toEqual({ ok: false, error: "That Heat no longer exists." });
      expect([
        await snapshot(tx, f.competitionId),
        await snapshot(tx, f.tugId),
      ]).toEqual(before);
    });
  });

  it("refuses a malformed finishing order, writing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { submitHeatReport } = await import("@/mutations/heat-reports");
      const f = await reportFixture(tx);
      const before = await snapshot(tx, f.competitionId);

      expect(
        await submitHeatReport(
          f.competitionId,
          f.semi1,
          { order: [f.entrantOf("Red")] },
          f.as(NEO),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Put every Entrant of this Heat in finishing order, once each.",
      });
      expect(await snapshot(tx, f.competitionId)).toEqual(before);
    });
  });

  it("a Host overwrite of a reported Semifinal resets the reported Final and clears both reporters", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { submitHeatReport } = await import("@/mutations/heat-reports");
      const { recordHeatResult } = await import("@/mutations/brackets");
      const { isDecided } = await import("@/lib/bracket/view");
      const f = await reportFixture(tx);
      const red = f.entrantOf("Red");
      const blue = f.entrantOf("Blue");
      const green = f.entrantOf("Green");
      const gold = f.entrantOf("Gold");
      const neo = { email: NEO, participantId: f.participantOf(NEO) };

      expect(
        await submitHeatReport(
          f.competitionId,
          f.semi1,
          { order: [red, blue] },
          f.as(NEO),
          tx,
        ),
      ).toMatchObject({ ok: true });
      await recordHeatResult(
        f.competitionId,
        f.semi2,
        { order: [gold, green] },
        f.ctx,
        tx,
      );
      expect(
        await submitHeatReport(
          f.competitionId,
          f.final,
          { order: [red, gold] },
          f.as(NEO),
          tx,
        ),
      ).toEqual({ ok: true, resetHeatIds: [] });
      expect(await reporterOf(tx, f.semi1)).toEqual(neo);
      expect(await reporterOf(tx, f.final)).toEqual(neo);

      const overwritten = await recordHeatResult(
        f.competitionId,
        f.semi1,
        { order: [blue, red] },
        f.ctx,
        tx,
      );
      expect(overwritten).toMatchObject({ ok: true });
      expect(overwritten.ok && overwritten.resetHeatIds).toContain(f.final);
      const { bracket } = await snapshot(tx, f.competitionId);
      expect(isDecided(bracket.heats.find((h) => h.id === f.final)!)).toBe(
        false,
      );
      expect(await reporterOf(tx, f.semi1)).toEqual(NONE);
      expect(await reporterOf(tx, f.final)).toEqual(NONE);
    });
  });
});
