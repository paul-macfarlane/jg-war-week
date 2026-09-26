import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import type { NextWarWeekValues } from "@/lib/war-week-lifecycle";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

class Rollback extends Error {}

/** Runs `body` in a transaction that is always rolled back. */
async function inRolledBackTransaction(body: (tx: DBTx) => Promise<void>) {
  const { withTransaction } = await import("@/db");
  await withTransaction(async (tx) => {
    await body(tx);
    throw new Rollback();
  }).catch((error) => {
    if (!(error instanceof Rollback)) throw error;
  });
}

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
    organizerEmails: ["lead@jahnelgroup.com", "other@jahnelgroup.com"],
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
      description: "1v1",
      maxPoints: 10,
      placementPoints: [10, 5],
      scoring: "team",
      competitionGroup: "Board games",
    })
    .returning();
  await tx.insert(schema.pointsEntry).values({
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
    copySettings: true,
    copyCompetitions: false,
    copyFaq: false,
    ...overrides,
  };
}

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
  it("ends a live War Week with its Winner and highlights", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      const { live, byId } = await fixture(tx);

      const result = await endWarWeek(
        live.id,
        { winner: "Red & Blue", highlights: ["Red won Chess"] },
        tx,
      );

      expect(result).toEqual({ ok: true });
      expect(await byId(live.id)).toMatchObject({
        status: "complete",
        winner: "Red & Blue",
        highlights: ["Red won Chess"],
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

      expect(await startWarWeek(upcoming.id, tx)).toEqual({
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

      await endWarWeek(live.id, { winner: "Red", highlights: [] }, tx);
      expect(await startWarWeek(upcoming.id, tx)).toEqual({ ok: true });
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
      await endWarWeek(live.id, { winner: "Red", highlights: [] }, tx);
      await startWarWeek(upcoming.id, tx);

      expect(await reopenWarWeek(live.id, tx)).toEqual({
        ok: false,
        error: "End TII first.",
      });

      await endWarWeek(upcoming.id, { winner: null, highlights: [] }, tx);
      expect(await reopenWarWeek(live.id, tx)).toEqual({ ok: true });
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
      await endWarWeek(live.id, { winner: null, highlights: [] }, tx);

      expect(await startWarWeek(live.id, tx)).toEqual({
        ok: false,
        error: "This War Week has ended. Reopen it instead.",
      });
      expect(await reopenWarWeek(upcoming.id, tx)).toEqual({
        ok: false,
        error: "This War Week hasn't started. Start it instead.",
      });
      expect((await byId(live.id)).status).toBe("complete");
      expect((await byId(upcoming.id)).status).toBe("upcoming");
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

      expect(await startWarWeek(live.id, tx)).toEqual({
        ok: false,
        error: "This War Week is already live.",
      });
      expect(
        await endWarWeek(upcoming.id, { winner: null, highlights: [] }, tx),
      ).toEqual({ ok: false, error: "Start this War Week before ending it." });
      expect(
        await startWarWeek("00000000-0000-4000-8000-000000000000", tx),
      ).toEqual({ ok: false, error: "That War Week no longer exists." });
    });
  });
});

describe.skipIf(!isLocalDatabase)("createNextWarWeek", () => {
  it("copies settings by default and nothing else", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema, counts } = await fixture(tx);
      const { eq } = await import("drizzle-orm");
      expect(await counts(live.id)).toEqual(ONE_OF_EVERYTHING);

      const result = await createNextWarWeek(live.id, next(), tx);
      expect(result).toEqual({ ok: true, edition: "tii" });

      const [created] = await tx
        .select()
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
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
        teamLabel: "House",
        leaderTitle: "Head of House",
        slackChannelUrl: "https://example.slack.com/archives/lifecycle",
        wikiUrl: "https://example.com/wiki",
        primaryColor: "#123456",
        primaryForegroundColor: "#fefefe",
        accentColor: "#abcdef",
        backgroundColor: "#101010",
        foregroundColor: "#efefef",
        fontPreset: "serif",
        logoUrl: "/themes/t/logo.svg",
        bannerUrl: "/themes/t/banner.svg",
        // Deprecated column, left at its default: Organizers are global.
        organizerEmails: [],
      });
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

  it("copies Competitions and the FAQ with new ids when chosen", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, chess, schema, counts } = await fixture(tx);
      const { eq } = await import("drizzle-orm");

      await createNextWarWeek(
        live.id,
        next({ copyCompetitions: true, copyFaq: true }),
        tx,
      );
      const [created] = await tx
        .select({ id: schema.warWeek.id })
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      // Teams, roster, Days, Schedule, Points Entries, Awards and
      // Announcements are never copied, even with everything else on.
      expect(await counts(created.id)).toEqual({
        team: 0,
        participant: 0,
        day: 0,
        scheduleItem: 0,
        competition: 1,
        pointsEntry: 0,
        faqItem: 1,
        award: 0,
        announcement: 0,
      });
      const competitions = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.warWeekId, created.id));
      expect(competitions).toHaveLength(1);
      expect(competitions[0]).toMatchObject({
        name: "Chess",
        description: "1v1",
        maxPoints: 10,
        placementPoints: [10, 5],
        scoring: "team",
        countsTowardTeam: false,
        competitionGroup: "Board games",
      });
      expect(competitions[0].id).not.toBe(chess.id);
      const entries = await tx
        .select()
        .from(schema.pointsEntry)
        .where(eq(schema.pointsEntry.competitionId, competitions[0].id));
      expect(entries).toEqual([]);
      const faq = await tx
        .select({ question: schema.faqItem.question })
        .from(schema.faqItem)
        .where(eq(schema.faqItem.warWeekId, created.id));
      expect(faq).toEqual([{ question: "Where?" }]);
    });
  });

  it("uses defaults without settings", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, schema } = await fixture(tx);
      const { eq } = await import("drizzle-orm");

      await createNextWarWeek(live.id, next({ copySettings: false }), tx);
      const [created] = await tx
        .select()
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      expect(created).toMatchObject({
        mode: "teams",
        teamLabel: "Team",
        leaderTitle: "Captain",
        wikiUrl: null,
        logoUrl: null,
        bannerUrl: null,
        fontPreset: "sans",
      });
      expect(created.primaryColor).not.toBe("#123456");
    });
  });

  it("turns a taken edition, edition number or year into a friendly error", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live } = await fixture(tx);

      expect(
        await createNextWarWeek(live.id, next({ edition: "ti" }), tx),
      ).toEqual({ ok: false, error: "War Week TI already exists." });
      expect(
        await createNextWarWeek(live.id, next({ editionNumber: 9301 }), tx),
      ).toEqual({
        ok: false,
        error: "Edition number 9301 is already War Week TI.",
      });
      expect(
        await createNextWarWeek(live.id, next({ year: 9301 }), tx),
      ).toEqual({ ok: false, error: "9301 already has War Week TI." });
    });
  });

  it("copies each Competition's Hosts with the Competitions", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const getCompetitionHosts = async (
        competitionId: string,
        dbTx: typeof tx,
      ) => {
        const { competitionHost } = await import("@/db/schema");
        const { eq: eqHost } = await import("drizzle-orm");
        const rows = await dbTx
          .select({ email: competitionHost.email })
          .from(competitionHost)
          .where(eqHost(competitionHost.competitionId, competitionId))
          .orderBy(competitionHost.email);
        return rows.map((row) => row.email);
      };
      const { live, chess, schema } = await fixture(tx);
      const { and, eq } = await import("drizzle-orm");
      const [relay] = await tx
        .insert(schema.competition)
        .values({ warWeekId: live.id, name: "Relay", scoring: "team" })
        .returning();
      await tx.insert(schema.competitionHost).values([
        { competitionId: chess.id, email: "tony@jahnelgroup.com" },
        { competitionId: chess.id, email: "tom@jahnelgroup.com" },
        { competitionId: relay.id, email: "amy@jahnelgroup.com" },
      ]);

      await createNextWarWeek(live.id, next({ copyCompetitions: true }), tx);
      const [created] = await tx
        .select({ id: schema.warWeek.id })
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      const copyOf = async (name: string) => {
        const [row] = await tx
          .select({ id: schema.competition.id })
          .from(schema.competition)
          .where(
            and(
              eq(schema.competition.warWeekId, created.id),
              eq(schema.competition.name, name),
            ),
          );
        return row.id;
      };
      expect(await getCompetitionHosts(await copyOf("Chess"), tx)).toEqual([
        "tom@jahnelgroup.com",
        "tony@jahnelgroup.com",
      ]);
      expect(await getCompetitionHosts(await copyOf("Relay"), tx)).toEqual([
        "amy@jahnelgroup.com",
      ]);
      // The source keeps its own Hosts.
      expect(await getCompetitionHosts(chess.id, tx)).toEqual([
        "tom@jahnelgroup.com",
        "tony@jahnelgroup.com",
      ]);
    });
  });

  it("copies no Hosts when Competitions aren't copied", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      const { live, chess, schema } = await fixture(tx);
      const { eq } = await import("drizzle-orm");
      await tx
        .insert(schema.competitionHost)
        .values({ competitionId: chess.id, email: "tony@jahnelgroup.com" });

      await createNextWarWeek(live.id, next(), tx);
      const [created] = await tx
        .select({ id: schema.warWeek.id })
        .from(schema.warWeek)
        .where(eq(schema.warWeek.edition, "tii"));
      const competitionIds = (
        await tx
          .select({ id: schema.competition.id })
          .from(schema.competition)
          .where(eq(schema.competition.warWeekId, created.id))
      ).map((c) => c.id);
      expect(competitionIds).toEqual([]);
      const hosts = await tx
        .select()
        .from(schema.competitionHost)
        .where(eq(schema.competitionHost.email, "tony@jahnelgroup.com"));
      expect(hosts.map((h) => h.competitionId)).toEqual([chess.id]);
    });
  });

  it("refuses a source War Week that doesn't exist", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createNextWarWeek } =
        await import("@/mutations/war-week-lifecycle");
      expect(
        await createNextWarWeek(
          "00000000-0000-4000-8000-000000000000",
          next(),
          tx,
        ),
      ).toEqual({ ok: false, error: "That War Week no longer exists." });
    });
  });
});
