import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import type { Content } from "@/lib/rich-text/content";
import type { NextWarWeekValues } from "@/lib/war-week-lifecycle";

const paragraphs = (text: string): Content => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});
const ONE_V_ONE = paragraphs("1v1");
const CUP = paragraphs("Cup");

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

function warWeekValues(
  n: number,
  status: "upcoming" | "live" | "complete",
  overrides: Record<string, unknown> = {},
) {
  return {
    edition: `t${"i".repeat(n)}`,
    editionNumber: 9300 + n,
    year: 9300 + n,
    startDate: "2099-01-01",
    endDate: "2099-01-05",
    storyTheme: `Lifecycle ${n}`,
    status,
    mode: "teams" as const,
    teamLabel: "House",
    leaderTitle: "Head of House",
    slackChannelUrl: "https://example.slack.com/archives/lifecycle",
    primaryColor: "#123456",
    primaryForegroundColor: "#fefefe",
    accentColor: "#abcdef",
    backgroundColor: "#101010",
    foregroundColor: "#efefef",
    fontPreset: "serif" as const,
    logoUrl: "/themes/t/logo.svg",
    bannerUrl: "/themes/t/banner.svg",
    wikiUrl: "https://example.com/wiki",
    ...overrides,
  };
}

/**
 * A live War Week with one of everything: a Team, a Participant, a Day with
 * a Schedule Item, a Competition with a Points Entry, an FAQ Item, an Award
 * and an Announcement. Whatever the database already has live is set complete
 * first (rolled back with the test), so the one-live index doesn't bite.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await tx
    .update(schema.warWeek)
    .set({ status: "complete" })
    .where(eq(schema.warWeek.status, "live"));
  const [live] = await tx
    .insert(schema.warWeek)
    .values(warWeekValues(1, "live"))
    .returning();
  const [red] = await tx
    .insert(schema.team)
    .values({ warWeekId: live.id, name: "Red", color: "#f00" })
    .returning();
  await tx.insert(schema.participant).values({
    warWeekId: live.id,
    displayName: "Alice",
    teamId: red.id,
  });
  const [kickoff] = await tx
    .insert(schema.day)
    .values({ warWeekId: live.id, date: "2099-01-02", dayTheme: "Kickoff" })
    .returning();
  await tx.insert(schema.scheduleItem).values({
    dayId: kickoff.id,
    startTime: "09:00",
    title: "Opening",
    category: "social",
  });
  await tx.insert(schema.award).values({ warWeekId: live.id, name: "MVP" });
  await tx.insert(schema.announcement).values({
    warWeekId: live.id,
    title: "Welcome",
    body: { type: "doc", content: [] },
    authorEmail: "lead@jahnelgroup.com",
  });
  const [chess] = await tx
    .insert(schema.competition)
    .values({
      warWeekId: live.id,
      name: "Chess",
      description: ONE_V_ONE,
      placementPoints: [10, 5],
      scoring: "team",
      competitionGroup: "Tabletop",
    })
    .returning();
  await tx.insert(schema.pointsEntry).values({
    warWeekId: live.id,
    competitionId: chess.id,
    teamId: red.id,
    points: 10,
    enteredByEmail: "lead@jahnelgroup.com",
  });
  await tx.insert(schema.faqItem).values({
    warWeekId: live.id,
    question: "Where?",
    answer: { type: "doc", content: [] },
    sortOrder: 0,
  });
  const byId = async (id: string) =>
    (
      await tx.select().from(schema.warWeek).where(eq(schema.warWeek.id, id))
    )[0];
  /** How many of each War Week-owned row `warWeekId` has. */
  const counts = async (warWeekId: string) => {
    const count = async (rows: Promise<unknown[]>): Promise<number> =>
      (await rows).length;
    const { day, competition } = schema;
    return {
      team: await count(
        tx
          .select()
          .from(schema.team)
          .where(eq(schema.team.warWeekId, warWeekId)),
      ),
      participant: await count(
        tx
          .select()
          .from(schema.participant)
          .where(eq(schema.participant.warWeekId, warWeekId)),
      ),
      day: await count(
        tx.select().from(day).where(eq(day.warWeekId, warWeekId)),
      ),
      scheduleItem: await count(
        tx
          .select({ id: schema.scheduleItem.id })
          .from(schema.scheduleItem)
          .innerJoin(day, eq(day.id, schema.scheduleItem.dayId))
          .where(eq(day.warWeekId, warWeekId)),
      ),
      competition: await count(
        tx
          .select()
          .from(competition)
          .where(eq(competition.warWeekId, warWeekId)),
      ),
      pointsEntry: await count(
        tx
          .select({ id: schema.pointsEntry.id })
          .from(schema.pointsEntry)
          .innerJoin(
            competition,
            eq(competition.id, schema.pointsEntry.competitionId),
          )
          .where(eq(competition.warWeekId, warWeekId)),
      ),
      faqItem: await count(
        tx
          .select()
          .from(schema.faqItem)
          .where(eq(schema.faqItem.warWeekId, warWeekId)),
      ),
      award: await count(
        tx
          .select()
          .from(schema.award)
          .where(eq(schema.award.warWeekId, warWeekId)),
      ),
      announcement: await count(
        tx
          .select()
          .from(schema.announcement)
          .where(eq(schema.announcement.warWeekId, warWeekId)),
      ),
    };
  };
  return { live, chess, byId, counts, schema };
}

const ONE_OF_EVERYTHING = {
  team: 1,
  participant: 1,
  day: 1,
  scheduleItem: 1,
  competition: 1,
  pointsEntry: 1,
  faqItem: 1,
  award: 1,
  announcement: 1,
};

function next(overrides: Partial<NextWarWeekValues> = {}): NextWarWeekValues {
  return {
    edition: "tii",
    editionNumber: 9302,
    year: 9302,
    startDate: "2100-01-01",
    endDate: "2100-01-05",
    storyTheme: "Next one",
    ...overrides,
  };
}

/** An Organizer acting on the War Week `warWeekId`. */
const ctxOf = (warWeekId: string) => ({
  warWeekId,
  actorEmail: "organizer@jahnelgroup.com",
});

describe.skipIf(!isLocalDatabase)("war_week_one_live index", () => {
  it("rejects a second live War Week in the database itself", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { schema } = await fixture(tx);
      const { isUniqueViolation } = await import("@/mutations/setup");
      const second = tx.transaction(async (sp) => {
        await sp.insert(schema.warWeek).values(warWeekValues(2, "live"));
      });
      await expect(second).rejects.toSatisfy(isUniqueViolation);
    });
  });
});

describe.skipIf(!isLocalDatabase)("Start, End and Reopen", () => {
  it("ends a live War Week, computing the Winner from its Standings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { live, byId } = await fixture(tx);

      const result = await endWarWeek(
        { highlights: ["Red won Chess"] },
        ctxOf(live.id),
        tx,
      );

      expect(result).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "complete",
        winner: "Red",
        highlights: ["Red won Chess"],
      });
    });
  });

  it("records a shared rank 1 as a tie, ignoring any client-supplied Winner", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { live, chess, schema, byId } = await fixture(tx);
      const [blue] = await tx
        .insert(schema.team)
        .values({ warWeekId: live.id, name: "Blue", color: "#00f" })
        .returning();
      await tx.insert(schema.pointsEntry).values({
        warWeekId: live.id,
        competitionId: chess.id,
        teamId: blue.id,
        points: 10,
        enteredByEmail: "lead@jahnelgroup.com",
      });

      const result = await endWarWeek(
        // A client-supplied `winner` isn't part of the input type; casting
        // stands in for a forged request that tries to send one anyway.
        { winner: "Nope", highlights: [] } as never,
        ctxOf(live.id),
        tx,
      );

      expect(result).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "complete",
        winner: "Tie: Blue & Red",
      });
    });
  });

  it("records no Winner when nobody has points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { live, schema, byId } = await fixture(tx);
      const { eq } = await import("drizzle-orm");
      // No Team at all, not just no points: an empty leaderboard is one way
      // to get a blank Winner (a Team left on 0 points is the other, covered
      // below).
      await tx.delete(schema.team).where(eq(schema.team.warWeekId, live.id));

      const result = await endWarWeek({ highlights: [] }, ctxOf(live.id), tx);

      expect(result).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "complete",
        winner: null,
      });
    });
  });

  it("records no Winner when every Team is left on 0 points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { live, schema, byId } = await fixture(tx);
      const { eq } = await import("drizzle-orm");
      const [red] = await tx
        .select({ id: schema.team.id })
        .from(schema.team)
        .where(eq(schema.team.warWeekId, live.id));
      // Fixture's Red Team already has a Points Entry; strip it back to 0
      // points so the only Team on the board is tied at the bottom.
      await tx
        .delete(schema.pointsEntry)
        .where(eq(schema.pointsEntry.teamId, red.id));

      const result = await endWarWeek({ highlights: [] }, ctxOf(live.id), tx);

      expect(result).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "complete",
        winner: null,
      });
    });
  });

  it("refuses to start a War Week while another is live", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { startWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { schema, byId } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();

      expect(await startWarWeek(ctxOf(upcoming.id), tx)).toEqual({
        ok: false,
        error: "End TI first.",
      });
      expect((await byId(upcoming.id)).status).toBe("upcoming");
    });
  });

  it("starts the next War Week once the live one has ended", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek, startWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema, byId } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();

      await endWarWeek({ highlights: [] }, ctxOf(live.id), tx);
      expect(await startWarWeek(ctxOf(upcoming.id), tx)).toEqual({ ok: true });
      expect((await byId(upcoming.id)).status).toBe("live");
    });
  });

  it("reopens a complete War Week only when nothing else is live", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek, reopenWarWeek, startWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema, byId } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();
      await endWarWeek({ highlights: [] }, ctxOf(live.id), tx);
      await startWarWeek(ctxOf(upcoming.id), tx);

      expect(await reopenWarWeek(ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "End TII first.",
      });

      await endWarWeek({ highlights: [] }, ctxOf(upcoming.id), tx);
      expect(await reopenWarWeek(ctxOf(live.id), tx)).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "live",
        winner: "Red",
      });
    });
  });

  it("won't let Start reopen an ended War Week, or Reopen start one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek, reopenWarWeek, startWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema, byId } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();
      await endWarWeek({ highlights: [] }, ctxOf(live.id), tx);

      expect(await startWarWeek(ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "This War Week has ended. Reopen it instead.",
      });
      expect(await reopenWarWeek(ctxOf(upcoming.id), tx)).toEqual({
        ok: false,
        error: "This War Week hasn't started. Start it instead.",
      });
      expect((await byId(live.id)).status).toBe("complete");
      expect((await byId(upcoming.id)).status).toBe("upcoming");
    });
  });

  it("unstarts a live War Week with nothing scored", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { unstartWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { schema, byId } = await fixture(tx);
      await tx.update(schema.warWeek).set({ status: "complete" });
      const [empty] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "live"))
        .returning();

      expect(await unstartWarWeek(ctxOf(empty.id), tx)).toEqual({ ok: true });
      expect((await byId(empty.id)).status).toBe("upcoming");
    });
  });

  it("re-checks under the lock: a Points Entry entered after the action's check refuses Unstart", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { unstartWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { getScoredCounts } = await import("@/queries/scored-counts");
      const { schema, byId } = await fixture(tx);
      await tx.update(schema.warWeek).set({ status: "complete" });
      const [empty] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "live"))
        .returning();
      const [cup] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: empty.id,
          name: "Cup",
          description: CUP,
          placementPoints: [10, 5],
          scoring: "team",
        })
        .returning();
      const [blue] = await tx
        .insert(schema.team)
        .values({ warWeekId: empty.id, name: "Blue", color: "#00f" })
        .returning();
      // The action's check sees nothing scored...
      expect(await getScoredCounts(empty.id, tx)).toEqual({
        pointsEntries: 0,
        matchResults: 0,
        logged: 0,
      });
      // ...then a Points Entry lands before the mutation locks the row.
      await tx.insert(schema.pointsEntry).values({
        warWeekId: empty.id,
        competitionId: cup.id,
        teamId: blue.id,
        points: 5,
        enteredByEmail: "lead@jahnelgroup.com",
      });

      expect(await unstartWarWeek(ctxOf(empty.id), tx)).toEqual({
        ok: false,
        error: "Points have been entered; Unstart isn't available.",
      });
      expect((await byId(empty.id)).status).toBe("live");
    });
  });

  it("refuses Unstart once a Match has a result, or a Match or Attempt is logged", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { unstartWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { schema, byId } = await fixture(tx);
      await tx.update(schema.warWeek).set({ status: "complete" });
      const [live] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "live"))
        .returning();
      const [cup] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: live.id,
          name: "Cup",
          description: CUP,
          placementPoints: [10, 5],
          scoring: "team",
        })
        .returning();
      const [match] = await tx
        .insert(schema.bracketMatch)
        .values({
          competitionId: cup.id,
          round: 1,
          position: 1,
          advanceCount: 1,
        })
        .returning();
      // A pending Match isn't a result.
      expect(await unstartWarWeek(ctxOf(live.id), tx)).toEqual({ ok: true });
      await tx
        .update(schema.warWeek)
        .set({ status: "live" })
        .where(eq(schema.warWeek.id, live.id));
      await tx
        .update(schema.bracketMatch)
        .set({ status: "played" })
        .where(eq(schema.bracketMatch.id, match.id));
      expect(await unstartWarWeek(ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "A Match has a result; Unstart isn't available.",
      });
      await tx
        .delete(schema.bracketMatch)
        .where(eq(schema.bracketMatch.id, match.id));
      await tx.insert(schema.seriesMatch).values({
        competitionId: cup.id,
        loggedByEmail: "lead@jahnelgroup.com",
      });
      expect(await unstartWarWeek(ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "A Match or Attempt has been logged; Unstart isn't available.",
      });
      expect((await byId(live.id)).status).toBe("live");
    });
  });

  it("refuses to Unstart a reopened War Week, which has been ended before", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { unstartWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { schema, byId } = await fixture(tx);
      await tx.update(schema.warWeek).set({ status: "complete" });
      // Ended with a Winner, then reopened: live, Winner kept, nothing scored.
      const [reopened] = await tx
        .insert(schema.warWeek)
        .values({ ...warWeekValues(2, "live"), winner: "Red" })
        .returning();

      expect(await unstartWarWeek(ctxOf(reopened.id), tx)).toEqual({
        ok: false,
        error: "This War Week has been ended; Unstart isn't available.",
      });
      expect((await byId(reopened.id)).status).toBe("live");
    });
  });

  it("refuses to Unstart an upcoming or ended War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { unstartWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { schema } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();
      const [ended] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(3, "complete"))
        .returning();
      const refusal = {
        ok: false,
        error: "Only a live War Week can be unstarted.",
      };
      expect(await unstartWarWeek(ctxOf(upcoming.id), tx)).toEqual(refusal);
      expect(await unstartWarWeek(ctxOf(ended.id), tx)).toEqual(refusal);
    });
  });

  it("refuses moves that aren't Start, End or Reopen", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek, startWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema } = await fixture(tx);
      const [upcoming] = await tx
        .insert(schema.warWeek)
        .values(warWeekValues(2, "upcoming"))
        .returning();

      expect(await startWarWeek(ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "This War Week is already live.",
      });
      expect(
        await endWarWeek({ highlights: [] }, ctxOf(upcoming.id), tx),
      ).toEqual({ ok: false, error: "Start this War Week before ending it." });
      expect(
        await startWarWeek(ctxOf("00000000-0000-4000-8000-000000000000"), tx),
      ).toEqual({ ok: false, error: "That War Week no longer exists." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("createNextWarWeek", () => {
  /**
   * Another test file may have committed a later War Week, so the fixture's
   * is moved past every other: it is the latest by start date.
   */
  async function makeLatest(tx: DBTx, id: string) {
    const { warWeek } = await import("@/db/schema");
    await tx
      .update(warWeek)
      .set({ startDate: "9998-01-01", endDate: "9998-01-05" })
      .where(eq(warWeek.id, id));
  }

  /** End the fixture's War Week (`makeLatest` first). */
  async function endFixtureWarWeek(tx: DBTx, id: string) {
    const { warWeek } = await import("@/db/schema");
    await tx
      .update(warWeek)
      .set({ status: "complete" })
      .where(eq(warWeek.id, id));
  }

  it("creates an upcoming War Week with default settings and nothing copied", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema, counts } = await fixture(tx);
      await makeLatest(tx, live.id);
      await endFixtureWarWeek(tx, live.id);
      expect(await counts(live.id)).toEqual(ONE_OF_EVERYTHING);

      const result = await createNextWarWeek(next(), ctxOf(live.id), tx);
      expect(result).toEqual({ ok: true, edition: "tii" });

      const [created] = await tx
        .select()
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      // The source has House, serif and its own colors; none carries over.
      expect(created).toMatchObject({
        editionNumber: 9302,
        year: 9302,
        startDate: "2100-01-01",
        endDate: "2100-01-05",
        storyTheme: "Next one",
        status: "upcoming",
        winner: null,
        highlights: [],
        mode: "teams",
        teamLabel: "Team",
        leaderTitle: "Captain",
        slackChannelUrl: "https://jahnelgroup.slack.com/",
        wikiUrl: null,
        primaryColor: "#1d4ed8",
        primaryForegroundColor: "#ffffff",
        accentColor: "#f59e0b",
        backgroundColor: "#ffffff",
        foregroundColor: "#111827",
        overridePrimaryColor: null,
        fontPreset: "sans",
        logoUrl: null,
        bannerUrl: null,
      });
      // No Competitions, no FAQ, and none of the rest either.
      expect(await counts(created.id)).toEqual({
        team: 0,
        participant: 0,
        day: 0,
        scheduleItem: 0,
        competition: 0,
        pointsEntry: 0,
        faqItem: 0,
        award: 0,
        announcement: 0,
      });
    });
  });

  it("refuses while the latest War Week is live, and writes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema } = await fixture(tx);
      await makeLatest(tx, live.id);

      expect(await createNextWarWeek(next(), ctxOf(live.id), tx)).toEqual({
        ok: false,
        error: "End War Week TI before creating the next one.",
      });
      const created = await tx
        .select()
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      expect(created).toEqual([]);
    });
  });

  it("refuses while the latest War Week is upcoming", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema } = await fixture(tx);
      await makeLatest(tx, live.id);
      await tx
        .update(schema.warWeek)
        .set({ status: "upcoming" })
        .where(eq(schema.warWeek.id, live.id));

      expect(await createNextWarWeek(next(), ctxOf(live.id), tx)).toEqual({
        ok: false,
        error:
          "War Week TI hasn't happened yet. Create the next one after it ends.",
      });
    });
  });

  it("turns a taken edition, edition number or year into a friendly error", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live } = await fixture(tx);
      await makeLatest(tx, live.id);
      await endFixtureWarWeek(tx, live.id);

      expect(
        await createNextWarWeek(next({ edition: "ti" }), ctxOf(live.id), tx),
      ).toEqual({ ok: false, error: "War Week TI already exists." });
      expect(
        await createNextWarWeek(
          next({ editionNumber: 9301 }),
          ctxOf(live.id),
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "Edition number 9301 is already War Week TI.",
      });
      expect(
        await createNextWarWeek(next({ year: 9301 }), ctxOf(live.id), tx),
      ).toEqual({ ok: false, error: "9301 already has War Week TI." });
    });
  });

  it("refuses a source War Week that doesn't exist", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      expect(
        await createNextWarWeek(
          next(),
          ctxOf("00000000-0000-4000-8000-000000000000"),
          tx,
        ),
      ).toEqual({ ok: false, error: "That War Week no longer exists." });
    });
  });
});
