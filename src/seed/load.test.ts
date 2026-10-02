import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

async function seed(
  edition: string,
  n: number,
  status: string,
  extra: Record<string, unknown> = {},
) {
  const { warWeekSeedSchema } = await import("@/seed/schema");
  return warWeekSeedSchema.parse({
    edition,
    editionNumber: 9400 + n,
    year: 9400 + n,
    startDate: "2099-01-01",
    endDate: "2099-01-05",
    storyTheme: "Seed load test",
    status,
    mode: "teams",
    teamLabel: "Team",
    leaderTitle: "Captain",
    slackChannelUrl: "https://example.slack.com/archives/x",
    primary: "#000000",
    primaryForeground: "#ffffff",
    accent: "#000000",
    background: "#ffffff",
    foreground: "#000000",
    fontPreset: "sans",
    winner: null,
    highlights: [],
    days: [],
    ...extra,
  });
}

/** Nothing else live, so the test's own live War Week is the only one. */
async function clearLive(tx: DBTx) {
  const schema = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");
  await tx
    .update(schema.warWeek)
    .set({ status: "complete" })
    .where(eq(schema.warWeek.status, "live"));
}

/** An Organizer acting on the War Week `warWeekId`. */
const ctxOf = (warWeekId: string) => ({
  warWeekId,
  actorEmail: "organizer@jahnelgroup.com",
});

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed lifecycle fields", () => {
  it("stores a Day's description, nulls a blank one, and updates it on reload", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const days = (a: string | undefined, b: string) => [
        {
          date: "2099-01-02",
          dayTheme: "One",
          description: a,
          scheduleItems: [],
        },
        {
          date: "2099-01-03",
          dayTheme: "Two",
          description: b,
          scheduleItems: [],
        },
      ];
      const read = async (id: string) =>
        (
          await tx
            .select({
              date: schema.day.date,
              description: schema.day.description,
            })
            .from(schema.day)
            .where(eq(schema.day.warWeekId, id))
            .orderBy(schema.day.date)
        ).map((d) => d.description);

      const first = await loadWarWeekSeed(
        await seed("sd", 4, "upcoming", { days: days("Wear red.", "") }),
        tx,
      );
      expect(await read(first.id)).toEqual(["Wear red.", null]);

      await loadWarWeekSeed(
        await seed("sd", 4, "upcoming", {
          days: days(undefined, "Bring lunch."),
        }),
        tx,
      );
      expect(await read(first.id)).toEqual([null, "Bring lunch."]);
    });
  });

  it("sets status, Winner and highlights on insert and never overwrites them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      await clearLive(tx);
      // A Team with a Points Entry, so End records a non-null Winner; the
      // point of this test is that a reload never overwrites either field
      // once End War Week has set them.
      const seeded = await seed("sa", 1, "live", {
        teams: [{ name: "Red", color: "#ff0000" }],
        competitions: [
          {
            name: "Chess",
            scoring: "team",
            placementPoints: [10],
          },
        ],
        pointsEntries: [
          {
            key: "sa-chess-red",
            competition: "Chess",
            team: "Red",
            points: 10,
            enteredByEmail: "organizer@jahnelgroup.com",
            enteredAt: "2099-01-02T00:00:00Z",
          },
        ],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      expect(first.status).toBe("live");

      await endWarWeek({ highlights: ["gg"] }, ctxOf(first.id), tx);
      const reloaded = await loadWarWeekSeed(seeded, tx);

      expect(reloaded).toMatchObject({
        status: "complete",
        winner: "Red",
        highlights: ["gg"],
      });
    });
  });

  it("sets a games Competition's Game Type, settings and Entrants open on insert only", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const seeded = await seed("sg", 3, "upcoming", {
        competitions: [
          {
            name: "Stairs",
            scoring: "team",
            format: "games",
            gameType: "best-score",
            gameConfig: { count: "total", betterIs: "higher", unit: "trips" },
            entrantsOpen: true,
          },
        ],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      const read = async () =>
        (
          await tx
            .select({
              format: schema.competition.format,
              gameType: schema.competition.gameType,
              gameConfig: schema.competition.gameConfig,
              entrantsOpen: schema.competition.entrantsOpen,
            })
            .from(schema.competition)
            .where(eq(schema.competition.warWeekId, first.id))
        )[0];
      expect(await read()).toEqual({
        format: "games",
        gameType: "best-score",
        gameConfig: { count: "total", betterIs: "higher", unit: "trips" },
        entrantsOpen: true,
      });

      // A Host's change survives a reload.
      await tx
        .update(schema.competition)
        .set({
          gameConfig: { count: "best", betterIs: "lower", unit: "s" },
          entrantsOpen: false,
        })
        .where(eq(schema.competition.warWeekId, first.id));
      await loadWarWeekSeed(seeded, tx);
      expect(await read()).toMatchObject({
        gameConfig: { count: "best", betterIs: "lower", unit: "s" },
        entrantsOpen: false,
      });
    });
  });

  it("refuses a seed that would insert a second live War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      await loadWarWeekSeed(await seed("sa", 1, "live"), tx);

      await expect(
        loadWarWeekSeed(await seed("sb", 2, "live"), tx),
      ).rejects.toThrow(
        'Seed "sb" is live, but War Week SA is already live. End it first or give the seed another status.',
      );
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "loadWarWeekSeed Organizers and Hosts",
  () => {
    const kept = "zz-seed-kept@jahnelgroup.com";
    const added = "zz-seed-added@jahnelgroup.com";

    /** The test's own Organizer rows, so other rows never matter. */
    async function ownOrganizers(tx: DBTx) {
      const { getOrganizers } = await import("@/queries/organizers");
      return (await getOrganizers(tx)).filter((o) =>
        [kept, added].includes(o.email),
      );
    }

    it("adds missing Organizers, never removes one, and a reload changes nothing", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { loadWarWeekSeed } = await import("@/seed/load");
        const schema = await import("@/db/schema");
        await tx
          .insert(schema.organizer)
          .values({ email: kept, addedBy: "jason@jahnelgroup.com" });

        const withBoth = await seed("sa", 1, "upcoming", {
          organizers: ["ZZ-Seed-Added@JahnelGroup.com", kept],
        });
        await loadWarWeekSeed(withBoth, tx);
        const afterFirst = await ownOrganizers(tx);
        expect(
          afterFirst.map(({ email, addedBy }) => ({ email, addedBy })),
        ).toEqual([
          { email: added, addedBy: null },
          { email: kept, addedBy: "jason@jahnelgroup.com" },
        ]);

        await loadWarWeekSeed(withBoth, tx);
        expect(await ownOrganizers(tx)).toEqual(afterFirst);

        const without = await seed("sa", 1, "upcoming");
        await loadWarWeekSeed(without, tx);
        await loadWarWeekSeed(without, tx, { reset: true });
        expect(await ownOrganizers(tx)).toEqual(afterFirst);
      });
    });

    it("refuses a seed Organizer outside @jahnelgroup.com", async () => {
      await expect(
        seed("sa", 1, "upcoming", { organizers: ["someone@gmail.com"] }),
      ).rejects.toThrow("Use an @jahnelgroup.com email.");
    });

    it("keeps a Competition's Hosts on a plain reload", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { loadWarWeekSeed } = await import("@/seed/load");
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
        const { setCompetitionHosts } = await import("@/mutations/setup");
        const withCatan = await seed("sa", 1, "upcoming", {
          competitions: [{ name: "Catan", scoring: "individual" }],
        });
        const warWeek = await loadWarWeekSeed(withCatan, tx);
        const schema = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const [catan] = await tx
          .select({ id: schema.competition.id })
          .from(schema.competition)
          .where(eq(schema.competition.warWeekId, warWeek.id));
        await setCompetitionHosts(
          catan.id,
          ["tony@jahnelgroup.com"],
          { warWeekId: warWeek.id, actorEmail: "jason@jahnelgroup.com" },
          tx,
        );

        await loadWarWeekSeed(withCatan, tx);
        expect(await getCompetitionHosts(catan.id, tx)).toEqual([
          "tony@jahnelgroup.com",
        ]);
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Award Categories", () => {
  const awards = (category?: string) => [
    {
      key: "mvp",
      name: "MVP 1st Place",
      participants: ["Neo"],
      ...(category && { category }),
    },
  ];
  const withAwards = (category?: string) =>
    seed("sa", 1, "upcoming", {
      teams: [{ name: "Red", color: "#ff0000" }],
      participants: [{ displayName: "Neo", team: "Red" }],
      awards: awards(category),
    });

  async function categoryOfSeededAward(tx: DBTx) {
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [row] = await tx
      .select({ key: schema.awardCategory.key })
      .from(schema.award)
      .leftJoin(
        schema.awardCategory,
        eq(schema.award.categoryId, schema.awardCategory.id),
      )
      .where(eq(schema.award.seedKey, "mvp"));
    return row.key;
  }

  it("has the seven seeded Categories without any seed load", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { isNotNull } = await import("drizzle-orm");
      const rows = await tx
        .select({ key: schema.awardCategory.key })
        .from(schema.awardCategory)
        .where(isNotNull(schema.awardCategory.key));
      expect(rows.map((r) => r.key).sort()).toEqual([
        "billable-hours-champ",
        "black-midnight",
        "grind",
        "grow",
        "inspire",
        "serve",
        "war-week-mvp",
      ]);
    });
  });

  it("tags a new Award with its Category and a reload changes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      expect(await categoryOfSeededAward(tx)).toBe("war-week-mvp");
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      expect(await categoryOfSeededAward(tx)).toBe("war-week-mvp");
    });
  });

  it("fails on an unknown Category key, naming it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      await expect(
        loadWarWeekSeed(await withAwards("no-such-category"), tx),
      ).rejects.toThrow('Unknown Award Category key "no-such-category"');
    });
  });

  it("fills an untagged, never-edited seeded Award on reload", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      await loadWarWeekSeed(await withAwards(), tx);
      expect(await categoryOfSeededAward(tx)).toBeNull();
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      expect(await categoryOfSeededAward(tx)).toBe("war-week-mvp");
    });
  });

  it("keeps an Organizer's None on an Award edited in the app", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      await loadWarWeekSeed(await withAwards(), tx);
      // A real edit runs in its own transaction, so `updated_at` moves on.
      await tx
        .update(schema.award)
        .set({ updatedAt: new Date("2100-01-01T00:00:00Z") })
        .where(eq(schema.award.seedKey, "mvp"));
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      expect(await categoryOfSeededAward(tx)).toBeNull();
    });
  });

  it("never overwrites a Category an Organizer chose", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      const [grow] = await tx
        .select({ id: schema.awardCategory.id })
        .from(schema.awardCategory)
        .where(eq(schema.awardCategory.key, "grow"));
      await tx
        .update(schema.award)
        .set({ categoryId: grow.id })
        .where(eq(schema.award.seedKey, "mvp"));
      await loadWarWeekSeed(await withAwards("war-week-mvp"), tx);
      expect(await categoryOfSeededAward(tx)).toBe("grow");
    });
  });
});
