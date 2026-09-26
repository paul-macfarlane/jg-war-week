import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

class Rollback extends Error {}

async function inRolledBackTransaction(body: (tx: DBTx) => Promise<void>) {
  const { withTransaction } = await import("@/db");
  await withTransaction(async (tx) => {
    await body(tx);
    throw new Rollback();
  }).catch((error) => {
    if (!(error instanceof Rollback)) throw error;
  });
}

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

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed lifecycle fields", () => {
  it("sets status, Winner and highlights on insert and never overwrites them", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { endWarWeek } = await import("@/mutations/war-week-lifecycle");
      await clearLive(tx);
      const first = await loadWarWeekSeed(await seed("sa", 1, "live"), tx);
      expect(first.status).toBe("live");

      await endWarWeek(first.id, { winner: "Red", highlights: ["gg"] }, tx);
      const reloaded = await loadWarWeekSeed(await seed("sa", 1, "live"), tx);

      expect(reloaded).toMatchObject({
        status: "complete",
        winner: "Red",
        highlights: ["gg"],
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
      ).rejects.toThrow("must be an @jahnelgroup.com email");
    });

    it("keeps a Competition's Hosts on a plain reload", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { loadWarWeekSeed } = await import("@/seed/load");
        const { getCompetitionHosts } = await import("@/queries/organizers");
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
