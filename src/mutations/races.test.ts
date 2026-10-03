import { and, eq } from "drizzle-orm";
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

/**
 * A committed single-elimination Competition with self-report on: Red v
 * Blue in its one Heat, the Final, with Neo (Red) and Trinity (Blue)
 * linked by email.
 */
async function committedReportable(edition: string, n: number) {
  const brackets = await import("@/mutations/brackets");
  const { setSelfReport } = await import("@/mutations/heat-reports");
  const { getBracket } = await import("@/queries/brackets");
  const f = await committedWarWeek(edition, n);
  const { competition, participant, team } = f.schema;
  const [blue] = await f.db
    .insert(team)
    .values({ warWeekId: f.ctx.warWeekId, name: "Blue", color: "#00f" })
    .returning({ id: team.id });
  await f.db.insert(participant).values([
    {
      warWeekId: f.ctx.warWeekId,
      displayName: "Neo",
      email: "neo@jahnelgroup.com",
      teamId: f.teamId,
    },
    {
      warWeekId: f.ctx.warWeekId,
      displayName: "Trinity",
      email: "trinity@jahnelgroup.com",
      teamId: blue.id,
    },
  ]);
  const [clash] = await f.db
    .insert(competition)
    .values({
      warWeekId: f.ctx.warWeekId,
      name: "Captain Clash",
      scoring: "team",
      format: "single-elimination",
    })
    .returning({ id: competition.id });
  await brackets.replaceEntrants(
    clash.id,
    { targetIds: [f.teamId, blue.id] },
    f.ctx,
    f.db,
  );
  await brackets.generateBracket(clash.id, {}, f.ctx, f.db);
  await setSelfReport(clash.id, { on: true }, f.ctx, f.db);
  const view = (await getBracket(clash.id, f.db))!;
  const [final] = view.bracket.heats;
  const red = view.entrants.find((e) => e.label === "Red")!.id;
  const blueEntrant = view.entrants.find((e) => e.label === "Blue")!.id;
  const lockRow = (tx: ConnectionTx) =>
    tx
      .select({ id: competition.id })
      .from(competition)
      .where(eq(competition.id, clash.id))
      .for("update");
  /** The Final's winner and its reporter's email, as committed. */
  const saved = async () => {
    const { heat, heatEntrant } = f.schema;
    const [winner] = await f.db
      .select({ entrantId: heatEntrant.entrantId })
      .from(heatEntrant)
      .where(and(eq(heatEntrant.heatId, final.id), eq(heatEntrant.place, 1)));
    const [row] = await f.db
      .select({ email: heat.reportedByEmail })
      .from(heat)
      .where(eq(heat.id, final.id));
    return { winner: winner?.entrantId ?? null, reporter: row.email };
  };
  return {
    ...f,
    brackets,
    competitionId: clash.id,
    finalId: final.id,
    red,
    blue: blueEntrant,
    lockRow,
    saved,
    as: (actorEmail: string) => ({ warWeekId: f.ctx.warWeekId, actorEmail }),
  };
}

describe.skipIf(!isLocalDatabase)(
  "Heat Result reports on two connections",
  () => {
    const edition = "zz-r-hr";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["Neo"], ["Trinity"]])(
      "gives two reports of one Heat exactly one result; the other is told it's decided (%s first)",
      async (first) => {
        const { submitHeatReport } = await import("@/mutations/heat-reports");
        const f = await committedReportable(edition, 6);

        const results = await withConnections(2, async ([a, b]) => {
          const neo = () =>
            submitHeatReport(
              f.competitionId,
              f.finalId,
              { order: [f.red, f.blue] },
              f.as("neo@jahnelgroup.com"),
              a,
            );
          const trinity = () =>
            submitHeatReport(
              f.competitionId,
              f.finalId,
              { order: [f.blue, f.red] },
              f.as("trinity@jahnelgroup.com"),
              b,
            );
          return first === "Neo"
            ? staggered(f.lockRow, neo, trinity)
            : (await staggered(f.lockRow, trinity, neo)).reverse();
        });

        // [Neo's, Trinity's]: the one that queued first wins.
        const decided = {
          ok: false,
          error: "This Heat already has a result.",
        };
        expect(results).toEqual(
          first === "Neo"
            ? [{ ok: true, resetHeatIds: [] }, decided]
            : [decided, { ok: true, resetHeatIds: [] }],
        );
        expect(await f.saved()).toEqual(
          first === "Neo"
            ? { winner: f.red, reporter: "neo@jahnelgroup.com" }
            : { winner: f.blue, reporter: "trinity@jahnelgroup.com" },
        );
      },
    );
  },
);

describe.skipIf(!isLocalDatabase)(
  "Heat Result report beside a Host's result on two connections",
  () => {
    const edition = "zz-r-hh";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["Host"], ["report"]])(
      "never lets a report overwrite the Host's result (%s first)",
      async (first) => {
        const { submitHeatReport } = await import("@/mutations/heat-reports");
        const f = await committedReportable(edition, 7);

        const [hosted, reported] = await withConnections(2, async ([a, b]) => {
          const host = () =>
            f.brackets.recordHeatResult(
              f.competitionId,
              f.finalId,
              { order: [f.blue, f.red] },
              f.ctx,
              a,
            );
          const report = () =>
            submitHeatReport(
              f.competitionId,
              f.finalId,
              { order: [f.red, f.blue] },
              f.as("neo@jahnelgroup.com"),
              b,
            );
          return first === "Host"
            ? staggered(f.lockRow, host, report)
            : (await staggered(f.lockRow, report, host)).reverse();
        });

        expect(hosted).toEqual({ ok: true, resetHeatIds: [] });
        expect(reported).toEqual(
          first === "Host"
            ? { ok: false, error: "This Heat already has a result." }
            : { ok: true, resetHeatIds: [] },
        );
        // The Host's result stands either way, and it's the Host's: no reporter.
        expect(await f.saved()).toEqual({ winner: f.blue, reporter: null });
      },
    );
  },
);

describe.skipIf(!isLocalDatabase)(
  "Squad create races on two connections",
  () => {
    const edition = "zz-r-sq";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["Red Alpha"], ["Red Bravo"]])(
      "gives two Squad creates naming the same Participant exactly one ok; the other is told they're already in it (%s first)",
      async (first) => {
        const { createSquad } = await import("@/mutations/brackets");
        const f = await committedWarWeek(edition, 8);
        const { competition, participant, squad } = f.schema;
        const [clash] = await f.db
          .insert(competition)
          .values({
            warWeekId: f.ctx.warWeekId,
            name: "Captain Clash",
            scoring: "team",
            format: "single-elimination",
          })
          .returning({ id: competition.id });
        const [neo] = await f.db
          .insert(participant)
          .values({
            warWeekId: f.ctx.warWeekId,
            displayName: "Neo",
            teamId: f.teamId,
          })
          .returning({ id: participant.id });

        const results = await withConnections(2, async ([a, b]) => {
          const alpha = () =>
            createSquad(
              clash.id,
              {
                name: "Red Alpha",
                teamId: f.teamId,
                participantIds: [neo.id],
              },
              f.ctx,
              a,
            );
          const bravo = () =>
            createSquad(
              clash.id,
              {
                name: "Red Bravo",
                teamId: f.teamId,
                participantIds: [neo.id],
              },
              f.ctx,
              b,
            );
          const lockRow = (tx: ConnectionTx) =>
            tx
              .select({ id: competition.id })
              .from(competition)
              .where(eq(competition.id, clash.id))
              .for("update");
          return first === "Red Alpha"
            ? staggered(lockRow, alpha, bravo)
            : (await staggered(lockRow, bravo, alpha)).reverse();
        });

        // [Red Alpha's, Red Bravo's]: the one that queued first wins.
        const takenBy = (name: string) => ({
          ok: false,
          error: `Neo is already in ${name}.`,
          fieldErrors: { participantIds: `Neo is already in ${name}.` },
        });
        expect(results).toEqual(
          first === "Red Alpha"
            ? [{ ok: true }, takenBy("Red Alpha")]
            : [takenBy("Red Bravo"), { ok: true }],
        );
        expect(
          await f.db.$count(squad, eq(squad.competitionId, clash.id)),
        ).toBe(1);
      },
    );
  },
);

describe.skipIf(!isLocalDatabase)(
  "Finale slide changes on two connections",
  () => {
    const edition = "zz-r-fs";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it("saves the default list once when two first changes race, and keeps both", async () => {
      const { moveFinaleSlide, setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const { getFinaleSlides } = await import("@/queries/finale-slides");
      const f = await committedWarWeek(edition, 9);
      const { warWeek, finaleSlide } = f.schema;

      for (const order of ["move first", "hide first"] as const) {
        await f.db
          .delete(finaleSlide)
          .where(eq(finaleSlide.warWeekId, f.ctx.warWeekId));
        await withConnections(1, async ([other]) => {
          const move = () =>
            moveFinaleSlide({ kind: "standings" }, 0, f.ctx, f.db);
          const hide = () =>
            setFinaleSlideHidden({ kind: "numbers" }, true, f.ctx, other);
          const results = await staggered(
            (tx) =>
              tx
                .select({ id: warWeek.id })
                .from(warWeek)
                .where(eq(warWeek.id, f.ctx.warWeekId))
                .for("update"),
            order === "move first" ? move : hide,
            order === "move first" ? hide : move,
          );
          expect(results, order).toEqual([{ ok: true }, { ok: true }]);
        });

        const slides = await getFinaleSlides(f.ctx.warWeekId, f.db);
        expect(
          slides.map((s) => (s.hidden ? `(${s.kind})` : s.kind)),
          order,
        ).toEqual([
          "standings",
          "title",
          "(numbers)",
          "awards",
          "champions",
          "winner",
        ]);
        expect(
          await f.db.$count(
            finaleSlide,
            eq(finaleSlide.warWeekId, f.ctx.warWeekId),
          ),
          order,
        ).toBe(6);
      }
    });
  },
);

describe.skipIf(!isLocalDatabase)(
  "Placement add beside a scoring change on two connections",
  () => {
    const edition = "zz-r-pl";
    beforeEach(() => clearWarWeek(edition));
    afterEach(() => clearWarWeek(edition));

    it.each([["add"], ["scoring change"]])(
      "lets exactly one of a Participant's add and a switch to team scoring through, never a Participant row in a team Competition (%s first)",
      async (first) => {
        const { addPlacement } = await import("@/mutations/placements");
        const { updateCompetition } = await import("@/mutations/setup");
        const f = await committedWarWeek(edition, 10);
        const { competition, participant, placement } = f.schema;
        const [darts] = await f.db
          .insert(competition)
          .values({
            warWeekId: f.ctx.warWeekId,
            name: "Darts",
            scoring: "individual",
            format: "placement",
          })
          .returning({ id: competition.id });
        const [neo] = await f.db
          .insert(participant)
          .values({
            warWeekId: f.ctx.warWeekId,
            displayName: "Neo",
            teamId: f.teamId,
          })
          .returning({ id: participant.id });

        const [added, switched] = await withConnections(2, async ([a, b]) => {
          const add = () =>
            addPlacement(darts.id, { participantId: neo.id }, f.ctx, a);
          const toTeam = () =>
            updateCompetition(
              darts.id,
              {
                name: "Darts",
                description: null,
                scoring: "team",
                placementPoints: null,
                countsTowardTeam: false,
                competitionGroup: null,
              },
              f.ctx,
              b,
            );
          const lockRow = (tx: ConnectionTx) =>
            tx
              .select({ id: competition.id })
              .from(competition)
              .where(eq(competition.id, darts.id))
              .for("update");
          return first === "add"
            ? staggered(lockRow, add, toTeam)
            : (await staggered(lockRow, toTeam, add)).reverse();
        });

        // The one that queued first wins; the other is refused.
        expect([added, switched]).toEqual(
          first === "add"
            ? [
                { ok: true },
                {
                  ok: false,
                  error:
                    "This Competition has 1 Placement. Remove them before changing its scoring.",
                },
              ]
            : [
                {
                  ok: false,
                  error: "A team Competition takes Teams, not Participants.",
                },
                { ok: true },
              ],
        );
        const [saved] = await f.db
          .select({ scoring: competition.scoring })
          .from(competition)
          .where(eq(competition.id, darts.id));
        const rows = await f.db
          .select({ participantId: placement.participantId })
          .from(placement)
          .where(eq(placement.competitionId, darts.id));
        // Individual with Neo's row, or team with no Participant row.
        expect({ scoring: saved.scoring, rows }).toEqual(
          first === "add"
            ? { scoring: "individual", rows: [{ participantId: neo.id }] }
            : { scoring: "team", rows: [] },
        );
      },
    );
  },
);
