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
      // A Team with Discretionary points, so End records a non-null Winner;
      // the point of this test is that a reload never overwrites either
      // field once End War Week has set them.
      const seeded = await seed("sa", 1, "live", {
        teams: [{ name: "Red", color: "#ff0000" }],
        discretionaryPoints: [
          {
            key: "sa-red",
            team: "Red",
            points: 10,
            reason: "Best banner",
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

  it("sets a Best score Competition's direction, unit and Team score on insert only", async () => {
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
            format: "best-score",
            scoreUnit: "trips",
            bestScoreConfig: { teamScore: "sum-of-members" },
          },
        ],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      const read = async () =>
        (
          await tx
            .select({
              format: schema.competition.format,
              scoreDirection: schema.competition.scoreDirection,
              scoreUnit: schema.competition.scoreUnit,
              bestScoreConfig: schema.competition.bestScoreConfig,
            })
            .from(schema.competition)
            .where(eq(schema.competition.warWeekId, first.id))
        )[0];
      expect(await read()).toEqual({
        format: "best-score",
        scoreDirection: "higher",
        scoreUnit: "trips",
        bestScoreConfig: { teamScore: "sum-of-members" },
      });

      // A Host's change survives a reload.
      await tx
        .update(schema.competition)
        .set({
          scoreDirection: "lower",
          scoreUnit: "s",
          bestScoreConfig: { teamScore: "best-member" },
        })
        .where(eq(schema.competition.warWeekId, first.id));
      await loadWarWeekSeed(seeded, tx);
      expect(await read()).toMatchObject({
        scoreDirection: "lower",
        scoreUnit: "s",
        bestScoreConfig: { teamScore: "best-member" },
      });
    });
  });

  it("enters a Head-to-head's two seeded Entrants once, with its Best of; a reload adds no row", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const seeded = await seed("sh", 5, "upcoming", {
        participants: [
          { displayName: "Ana" },
          { displayName: "Ben" },
          { displayName: "Cal" },
        ],
        competitions: [
          {
            name: "Pong",
            scoring: "individual",
            format: "head-to-head",
            seriesConfig: { drawsAllowed: false, bestOf: 5 },
            entrants: ["Ben", "Ana"],
          },
        ],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      const [pong] = await tx
        .select({
          id: schema.competition.id,
          seriesConfig: schema.competition.seriesConfig,
        })
        .from(schema.competition)
        .where(eq(schema.competition.warWeekId, first.id));
      expect(pong.seriesConfig).toEqual({ drawsAllowed: false, bestOf: 5 });
      const entrants = () =>
        tx
          .select({
            name: schema.participant.displayName,
            seedPosition: schema.entrant.seedPosition,
          })
          .from(schema.entrant)
          .innerJoin(
            schema.participant,
            eq(schema.participant.id, schema.entrant.participantId),
          )
          .where(eq(schema.entrant.competitionId, pong.id))
          .orderBy(schema.entrant.seedPosition);
      expect(await entrants()).toEqual([
        { name: "Ben", seedPosition: 1 },
        { name: "Ana", seedPosition: 2 },
      ]);
      await loadWarWeekSeed(seeded, tx);
      expect(await entrants()).toHaveLength(2);
    });
  });

  it("sets a participation Competition's settings on insert only, and its N or Placement Points by the seed's scoring", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const workout = {
        name: "Workout",
        scoring: "team",
        format: "participation",
        placementPoints: [5, 3, 1],
        selfCheckIn: true,
      };
      const seeded = await seed("sp", 4, "upcoming", {
        competitions: [workout],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      const read = async () =>
        (
          await tx
            .select({
              format: schema.competition.format,
              scoring: schema.competition.scoring,
              participationPoints: schema.competition.participationPoints,
              placementPoints: schema.competition.placementPoints,
              selfCheckIn: schema.competition.selfCheckIn,
            })
            .from(schema.competition)
            .where(eq(schema.competition.warWeekId, first.id))
        )[0];
      expect(await read()).toEqual({
        format: "participation",
        scoring: "team",
        participationPoints: null,
        placementPoints: [5, 3, 1],
        selfCheckIn: true,
      });

      // A reload that makes it individual gives N (1 by default) and no
      // Placement Points; making it team again clears N.
      const individual = await seed("sp", 4, "upcoming", {
        competitions: [
          { ...workout, scoring: "individual", placementPoints: undefined },
        ],
      });
      await loadWarWeekSeed(individual, tx);
      expect(await read()).toMatchObject({
        scoring: "individual",
        participationPoints: 1,
        placementPoints: null,
        selfCheckIn: true,
      });

      // A Host's N and switch survive a reload with the same scoring.
      await tx
        .update(schema.competition)
        .set({ participationPoints: 3, selfCheckIn: false })
        .where(eq(schema.competition.warWeekId, first.id));
      await loadWarWeekSeed(individual, tx);
      expect(await read()).toMatchObject({
        participationPoints: 3,
        selfCheckIn: false,
      });

      await loadWarWeekSeed(seeded, tx);
      expect(await read()).toMatchObject({
        scoring: "team",
        participationPoints: null,
        placementPoints: [5, 3, 1],
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

    it("seeds a Competition's Hosts by Participant name, keeps an Organizer's added Host on a reload, and refuses a name off the roster", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { loadWarWeekSeed } = await import("@/seed/load");
        const { setCompetitionHosts } = await import("@/mutations/setup");
        const schema = await import("@/db/schema");
        const { eq } = await import("drizzle-orm");
        const hostNames = async (competitionId: string) =>
          (
            await tx
              .select({ name: schema.participant.displayName })
              .from(schema.competitionHost)
              .innerJoin(
                schema.participant,
                eq(schema.participant.id, schema.competitionHost.participantId),
              )
              .where(eq(schema.competitionHost.competitionId, competitionId))
          )
            .map((row) => row.name)
            .sort();
        const withCatan = await seed("sa", 1, "upcoming", {
          participants: [
            { displayName: "Tony" },
            { displayName: "Tom" },
            { displayName: "Ana" },
          ],
          competitions: [
            { name: "Catan", scoring: "individual", hosts: ["Tony"] },
          ],
        });
        const warWeek = await loadWarWeekSeed(withCatan, tx);
        const [catan] = await tx
          .select({ id: schema.competition.id })
          .from(schema.competition)
          .where(eq(schema.competition.warWeekId, warWeek.id));
        expect(await hostNames(catan.id)).toEqual(["Tony"]);

        // An Organizer adds Tom in the app; a plain reload keeps both.
        const [tom] = await tx
          .select({ id: schema.participant.id })
          .from(schema.participant)
          .where(eq(schema.participant.displayName, "Tom"));
        const [tony] = await tx
          .select({ id: schema.participant.id })
          .from(schema.participant)
          .where(eq(schema.participant.displayName, "Tony"));
        await setCompetitionHosts(
          catan.id,
          [tony.id, tom.id],
          { warWeekId: warWeek.id, actorEmail: "jason@jahnelgroup.com" },
          tx,
        );
        await loadWarWeekSeed(withCatan, tx);
        expect(await hostNames(catan.id)).toEqual(["Tom", "Tony"]);

        const { warWeekSeedSchema } = await import("@/seed/schema");
        expect(() =>
          warWeekSeedSchema.parse({
            ...withCatan,
            competitions: [
              { name: "Catan", scoring: "individual", hosts: ["Nobody"] },
            ],
          }),
        ).toThrow(/not on this War Week's roster/);
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Schedule Items", () => {
  /** A seed with Catan, a roster of one, and the given Day 2099-01-02 items. */
  const withItems = (scheduleItems: object[]) =>
    seed("si", 7, "upcoming", {
      participants: [{ displayName: "Ana" }],
      competitions: [{ name: "Catan", scoring: "individual" }],
      days: [{ date: "2099-01-02", dayTheme: "One", scheduleItems }],
    });

  async function helpers(tx: DBTx, warWeekId: string) {
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const [ana] = await tx
      .select({ id: schema.participant.id })
      .from(schema.participant)
      .where(eq(schema.participant.warWeekId, warWeekId));
    const items = async () =>
      tx
        .select({
          id: schema.scheduleItem.id,
          title: schema.scheduleItem.title,
          startTime: schema.scheduleItem.startTime,
          competitionId: schema.scheduleItem.competitionId,
        })
        .from(schema.scheduleItem)
        .innerJoin(schema.day, eq(schema.day.id, schema.scheduleItem.dayId))
        .where(eq(schema.day.warWeekId, warWeekId))
        .orderBy(schema.scheduleItem.title);
    const addHost = (scheduleItemId: string) =>
      tx
        .insert(schema.scheduleItemHost)
        .values({ scheduleItemId, participantId: ana.id });
    const hostsOf = async (scheduleItemId: string) =>
      (
        await tx
          .select({ participantId: schema.scheduleItemHost.participantId })
          .from(schema.scheduleItemHost)
          .where(eq(schema.scheduleItemHost.scheduleItemId, scheduleItemId))
      ).map((row) => row.participantId);
    return { anaId: ana.id, items, addHost, hostsOf };
  }

  it("keeps an untimed item on reload: the same id, with the Host an Organizer added", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const untimed = await withItems([
        { title: "Step Challenge", category: "other" },
      ]);
      const warWeek = await loadWarWeekSeed(untimed, tx);
      const h = await helpers(tx, warWeek.id);
      const [first] = await h.items();
      expect(first).toMatchObject({ title: "Step Challenge", startTime: null });
      await h.addHost(first.id);

      await loadWarWeekSeed(untimed, tx);
      expect(await h.items()).toEqual([first]);
      expect(await h.hostsOf(first.id)).toEqual([h.anaId]);
    });
  });

  it("deletes an item's Hosts when a reload links it to a Competition, and keeps an unlinked item's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const games = { startTime: "18:00", title: "Game night" };
      const lego = { title: "Drop-in Lego", category: "other" };
      const warWeek = await loadWarWeekSeed(
        await withItems([{ ...games, category: "competition" }, lego]),
        tx,
      );
      const h = await helpers(tx, warWeek.id);
      const [legoRow, gamesRow] = await h.items();
      await h.addHost(gamesRow.id);
      await h.addHost(legoRow.id);

      await loadWarWeekSeed(
        await withItems([
          { ...games, category: "competition", competition: "Catan" },
          lego,
        ]),
        tx,
      );
      const [, linked] = await h.items();
      expect(linked.id).toBe(gamesRow.id);
      expect(linked.competitionId).not.toBeNull();
      expect(await h.hostsOf(gamesRow.id)).toEqual([]);
      expect(await h.hostsOf(legoRow.id)).toEqual([h.anaId]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Awards", () => {
  it("loads an Award by name and a reload changes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const awards = async () =>
        (
          await tx.select({ name: schema.award.name }).from(schema.award)
        ).filter((a) => a.name === "Billable Hours Champ").length;
      const withAwards = async () =>
        seed("sa", 1, "upcoming", {
          teams: [{ name: "Red", color: "#ff0000" }],
          participants: [{ displayName: "Neo", team: "Red" }],
          awards: [
            {
              key: "billable",
              name: "Billable Hours Champ",
              participants: ["Neo"],
            },
          ],
        });
      await clearLive(tx);
      await loadWarWeekSeed(await withAwards(), tx);
      const once = await awards();
      await loadWarWeekSeed(await withAwards(), tx);
      expect(once).toBeGreaterThanOrEqual(1);
      expect(await awards()).toBe(once);
    });
  });
});

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Finale slides", () => {
  const list = (slides: Record<string, unknown>[]) => ({
    finaleSlides: slides,
  });
  const defaults = [
    { kind: "title" },
    { kind: "numbers" },
    { kind: "awards" },
    { kind: "winners" },
    { kind: "standings" },
    { kind: "winner" },
  ];
  const thanks = {
    kind: "custom",
    heading: "Thank you",
    backgroundColor: "#112233",
    body: {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "See you" }] },
      ],
    },
  };

  async function slidesOf(warWeekId: string, tx: DBTx) {
    const { getFinaleSlides } = await import("@/queries/finale-slides");
    return getFinaleSlides(warWeekId, tx);
  }

  it("saves the seed's list in order, and a second load keeps the same ids", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const file = await seed(
        "sf",
        21,
        "upcoming",
        list([...defaults, thanks]),
      );

      const first = await loadWarWeekSeed(file, tx);
      const loaded = await slidesOf(first.id, tx);
      expect(loaded.map((s) => s.name)).toEqual([
        "Title",
        "By the numbers",
        "Awards",
        "Winners",
        "Standings countdown",
        "Winner",
        "Thank you",
      ]);
      expect(loaded[6]).toMatchObject({
        kind: "custom",
        backgroundColor: "#112233",
        body: thanks.body,
      });

      await loadWarWeekSeed(file, tx);
      const reloaded = await slidesOf(first.id, tx);
      expect(reloaded.map((s) => s.id)).toEqual(loaded.map((s) => s.id));
      expect(reloaded.every((s) => s.id !== null)).toBe(true);
    });
  });

  it("makes the saved list match the seed on reload: order, hidden, and absent slides deleted", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const first = await loadWarWeekSeed(
        await seed("sf", 22, "upcoming", list([...defaults, thanks])),
        tx,
      );
      await loadWarWeekSeed(
        await seed(
          "sf",
          22,
          "upcoming",
          list([
            { kind: "standings" },
            { kind: "title", hidden: true },
            { kind: "winner" },
          ]),
        ),
        tx,
      );
      expect(
        (await slidesOf(first.id, tx)).map((s) =>
          s.id === null ? `${s.name}*` : s.hidden ? `(${s.name})` : s.name,
        ),
      ).toEqual([
        "Standings countdown",
        "(Title)",
        "Winner",
        // Not in the seed's list: unsaved, at the end in the default order.
        "By the numbers*",
        "Awards*",
        "Winners*",
      ]);
    });
  });

  it("leaves a saved list alone when the seed has none", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const first = await loadWarWeekSeed(await seed("sf", 23, "upcoming"), tx);
      await setFinaleSlideHidden({ kind: "awards" }, true, ctxOf(first.id), tx);
      const saved = await slidesOf(first.id, tx);

      await loadWarWeekSeed(await seed("sf", 23, "upcoming"), tx);
      expect(await slidesOf(first.id, tx)).toEqual(saved);
    });
  });

  it("loads Discretionary points once, however many times the seed loads, and never overwrites an edit", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const seeded = await seed("sh", 26, "upcoming", {
        teams: [{ name: "Red", color: "#ff0000" }],
        discretionaryPoints: [
          {
            key: "sh-subjective-red",
            team: "Red",
            points: 6,
            reason: "Subjective Points",
            enteredByEmail: "organizer@jahnelgroup.com",
            enteredAt: "2099-01-02T00:00:00Z",
          },
        ],
      });
      const first = await loadWarWeekSeed(seeded, tx);
      await loadWarWeekSeed(seeded, tx);

      const rows = () =>
        tx
          .select({
            competitionId: schema.pointsEntry.competitionId,
            teamId: schema.pointsEntry.teamId,
            points: schema.pointsEntry.points,
            note: schema.pointsEntry.note,
            seedKey: schema.pointsEntry.seedKey,
            enteredBy: schema.pointsEntry.enteredByEmail,
          })
          .from(schema.pointsEntry)
          .where(eq(schema.pointsEntry.warWeekId, first.id));
      expect(await rows()).toEqual([
        {
          competitionId: null,
          teamId: expect.any(String),
          points: 6,
          note: "Subjective Points",
          seedKey: "sh-subjective-red",
          enteredBy: "organizer@jahnelgroup.com",
        },
      ]);

      // An Organizer's edit survives a reload.
      await tx
        .update(schema.pointsEntry)
        .set({ points: 7, note: "Edited reason" })
        .where(eq(schema.pointsEntry.warWeekId, first.id));
      await loadWarWeekSeed(seeded, tx);
      expect(await rows()).toMatchObject([
        { points: 7, note: "Edited reason" },
      ]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Placements", () => {
  const HOST = "seed-placement-host@jahnelgroup.com";
  const CLOSED_AT = "2099-01-03T18:00:00.000Z";

  /** Darts (individual, Closed by HOST at CLOSED_AT) and Quiz (team, open), each with seeded Placements. */
  async function placementSeed() {
    return seed("spl", 7, "upcoming", {
      teams: [
        { name: "Red", color: "#ff0000" },
        { name: "Blue", color: "#0000ff" },
      ],
      participants: [
        { displayName: "Neo", team: "Red" },
        { displayName: "Trinity", team: "Blue" },
        { displayName: "Tank", team: "Blue" },
      ],
      competitions: [
        {
          name: "Darts",
          scoring: "individual",
          countsTowardTeam: true,
          placementPoints: [10, 6, 3],
          scoreDirection: "higher",
          closed: true,
          closedAt: CLOSED_AT,
          closedByEmail: HOST,
        },
        { name: "Quiz", scoring: "team", placementPoints: [5, 3] },
      ],
      placements: [
        {
          key: "darts-neo",
          competition: "Darts",
          participant: "Neo",
          place: 1,
          score: 30,
        },
        {
          key: "darts-trinity",
          competition: "Darts",
          participant: "Trinity",
          place: 1,
          score: 30,
        },
        {
          key: "darts-tank",
          competition: "Darts",
          participant: "Tank",
          place: 3,
        },
        { key: "quiz-blue", competition: "Quiz", team: "Blue", place: 1 },
      ],
    });
  }

  async function read(tx: DBTx, warWeekId: string) {
    const schema = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const competitions = await tx
      .select({
        id: schema.competition.id,
        name: schema.competition.name,
        scoreDirection: schema.competition.scoreDirection,
        closedAt: schema.competition.closedAt,
      })
      .from(schema.competition)
      .where(eq(schema.competition.warWeekId, warWeekId));
    const byName = (name: string) => competitions.find((c) => c.name === name)!;
    const rows = await tx
      .select({
        id: schema.placement.id,
        competitionId: schema.placement.competitionId,
        seedKey: schema.placement.seedKey,
        place: schema.placement.place,
        score: schema.placement.score,
        teamId: schema.placement.teamId,
        participantId: schema.placement.participantId,
      })
      .from(schema.placement)
      .innerJoin(
        schema.competition,
        eq(schema.competition.id, schema.placement.competitionId),
      )
      .where(eq(schema.competition.warWeekId, warWeekId));
    const entries = await tx
      .select({
        id: schema.pointsEntry.id,
        competitionId: schema.pointsEntry.competitionId,
        participantId: schema.pointsEntry.participantId,
        points: schema.pointsEntry.points,
        seedKey: schema.pointsEntry.seedKey,
        enteredByEmail: schema.pointsEntry.enteredByEmail,
        enteredAt: schema.pointsEntry.enteredAt,
        note: schema.pointsEntry.note,
        generated: schema.pointsEntry.generated,
      })
      .from(schema.pointsEntry)
      .where(eq(schema.pointsEntry.warWeekId, warWeekId));
    const bySeedKey = <T extends { seedKey: string | null }>(list: T[]) =>
      [...list].sort((a, b) =>
        String(a.seedKey).localeCompare(String(b.seedKey)),
      );
    return {
      darts: byName("Darts"),
      quiz: byName("Quiz"),
      rows: bySeedKey(rows),
      entries: bySeedKey(entries),
    };
  }

  it("writes the Placements and a Closed Competition's entries with the seed's time and author; a reload changes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      const first = await loadWarWeekSeed(await placementSeed(), tx);
      const loaded = await read(tx, first.id);

      expect(loaded.darts).toMatchObject({
        scoreDirection: "higher",
        closedAt: new Date(CLOSED_AT),
      });
      expect(loaded.quiz).toMatchObject({
        scoreDirection: "none",
        closedAt: null,
      });
      expect(
        loaded.rows.map(({ seedKey, place, score, competitionId }) => ({
          seedKey,
          place,
          score,
          competition: competitionId === loaded.darts.id ? "Darts" : "Quiz",
        })),
      ).toEqual([
        { seedKey: "darts-neo", place: 1, score: 30, competition: "Darts" },
        { seedKey: "darts-tank", place: 3, score: null, competition: "Darts" },
        { seedKey: "darts-trinity", place: 1, score: 30, competition: "Darts" },
        { seedKey: "quiz-blue", place: 1, score: null, competition: "Quiz" },
      ]);
      // The tie shares 1st's 10; Tank's 3rd earns 3; the open Quiz none.
      expect(
        loaded.entries.map((e) => ({
          competitionId: e.competitionId,
          points: e.points,
          seedKey: e.seedKey,
          enteredByEmail: e.enteredByEmail,
          enteredAt: e.enteredAt,
          note: e.note,
          generated: e.generated,
        })),
      ).toEqual(
        [
          ["placement:darts-neo", 10],
          ["placement:darts-tank", 3],
          ["placement:darts-trinity", 10],
        ].map(([seedKey, points]) => ({
          competitionId: loaded.darts.id,
          points,
          seedKey,
          enteredByEmail: HOST,
          enteredAt: new Date(CLOSED_AT),
          note: "From placement",
          generated: true,
        })),
      );

      await loadWarWeekSeed(await placementSeed(), tx);
      expect(await read(tx, first.id)).toEqual(loaded);
    });
  });

  it("a reload after the Host reopens and edits the sheet keeps their changes and writes no entries", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const { savePlacements } = await import("@/mutations/placements");
      const { reopenCompetition: reopenPlacements } =
        await import("@/mutations/close");
      await clearLive(tx);
      const first = await loadWarWeekSeed(await placementSeed(), tx);
      const loaded = await read(tx, first.id);
      const ctx = ctxOf(first.id);
      expect(await reopenPlacements(loaded.darts.id, ctx, tx)).toEqual({
        ok: true,
      });
      const tank = loaded.rows.find((r) => r.seedKey === "darts-tank")!;
      await savePlacements(
        loaded.darts.id,
        {
          rows: [{ id: tank.id, place: 2, score: 4 }],
        },
        ctx,
        tx,
      );
      const edited = await read(tx, first.id);

      await loadWarWeekSeed(await placementSeed(), tx);
      const reloaded = await read(tx, first.id);
      expect(reloaded).toEqual(edited);
      expect(reloaded.darts.closedAt).toBeNull();
      expect(reloaded.entries).toEqual([]);
    });
  });
});

describe.skipIf(!isLocalDatabase)("loadWarWeekSeed Leagues", () => {
  const HOST = "seed-league-host@jahnelgroup.com";
  const CLOSED_AT = "2099-01-03T18:00:00.000Z";
  const LOGGED_AT = "2099-01-02T12:00:00.000Z";

  /** A round robin of Ana, Ben and Cal, all played, Closed by HOST at CLOSED_AT. */
  async function leagueSeed(
    competition: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) {
    const m = (
      key: string,
      round: number,
      a: string,
      b: string | null,
      result: "a" | "b" | "draw" | null,
      more: Record<string, unknown> = {},
    ) => ({
      key,
      competition: "Chess",
      round,
      position: 0,
      a,
      b,
      result,
      ...more,
    });
    return seed("slg", 8, "upcoming", {
      participants: [
        { displayName: "Ana" },
        { displayName: "Ben" },
        { displayName: "Cal" },
      ],
      competitions: [
        {
          name: "Chess",
          scoring: "individual",
          format: "league",
          leagueConfig: { pairing: "round-robin", rounds: null },
          entrants: ["Ana", "Ben", "Cal"],
          placementPoints: [5, 3, 1],
          closed: true,
          closedAt: CLOSED_AT,
          closedByEmail: HOST,
          ...competition,
        },
      ],
      leagueMatches: [
        m("r1", 1, "Ana", "Ben", "a", { recordedAt: LOGGED_AT }),
        m("r1-sit", 1, "Cal", null, null, { position: 1 }),
        m("r2", 2, "Ana", "Cal", "draw"),
        m("r2-sit", 2, "Ben", null, null, { position: 1 }),
        m("r3", 3, "Ben", "Cal", "a"),
        m("r3-sit", 3, "Ana", null, null, { position: 1 }),
      ],
      ...extra,
    });
  }

  async function read(tx: DBTx, warWeekId: string) {
    const schema = await import("@/db/schema");
    const { and, asc, eq } = await import("drizzle-orm");
    const [league] = await tx
      .select({
        id: schema.competition.id,
        format: schema.competition.format,
        leagueConfig: schema.competition.leagueConfig,
        closedAt: schema.competition.closedAt,
      })
      .from(schema.competition)
      .where(eq(schema.competition.warWeekId, warWeekId));
    const entrants = await tx
      .select({
        name: schema.participant.displayName,
        seedPosition: schema.entrant.seedPosition,
      })
      .from(schema.entrant)
      .innerJoin(
        schema.participant,
        eq(schema.participant.id, schema.entrant.participantId),
      )
      .where(eq(schema.entrant.competitionId, league.id))
      .orderBy(asc(schema.entrant.seedPosition));
    const matches = await tx
      .select({
        round: schema.leagueMatch.round,
        position: schema.leagueMatch.position,
        a: schema.leagueMatch.entrantAId,
        b: schema.leagueMatch.entrantBId,
        result: schema.leagueMatch.result,
        recordedAt: schema.leagueMatch.recordedAt,
        seedKey: schema.leagueMatch.seedKey,
      })
      .from(schema.leagueMatch)
      .where(eq(schema.leagueMatch.competitionId, league.id))
      .orderBy(asc(schema.leagueMatch.round), asc(schema.leagueMatch.position));
    const entries = await tx
      .select({
        points: schema.pointsEntry.points,
        seedKey: schema.pointsEntry.seedKey,
        note: schema.pointsEntry.note,
        generated: schema.pointsEntry.generated,
        enteredByEmail: schema.pointsEntry.enteredByEmail,
        enteredAt: schema.pointsEntry.enteredAt,
      })
      .from(schema.pointsEntry)
      .where(
        and(
          eq(schema.pointsEntry.warWeekId, warWeekId),
          eq(schema.pointsEntry.competitionId, league.id),
        ),
      )
      .orderBy(asc(schema.pointsEntry.seedKey));
    return { league, entrants, matches, entries };
  }

  it("loads a League's Entrants, Matches and a Closed League's points; a reload changes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      await clearLive(tx);
      const first = await loadWarWeekSeed(await leagueSeed(), tx);
      const loaded = await read(tx, first.id);

      expect(loaded.league).toMatchObject({
        format: "league",
        leagueConfig: { pairing: "round-robin", rounds: null },
        closedAt: new Date(CLOSED_AT),
      });
      expect(loaded.entrants).toEqual([
        { name: "Ana", seedPosition: 1 },
        { name: "Ben", seedPosition: 2 },
        { name: "Cal", seedPosition: 3 },
      ]);
      // A result without `recordedAt` gets the League's `closedAt`; a sit-out has none.
      expect(
        loaded.matches.map((x) => [
          x.round,
          x.position,
          x.result,
          x.recordedAt?.toISOString() ?? null,
          x.seedKey,
          x.b === null,
        ]),
      ).toEqual([
        [1, 0, "a", LOGGED_AT, "r1", false],
        [1, 1, null, null, "r1-sit", true],
        [2, 0, "draw", CLOSED_AT, "r2", false],
        [2, 1, null, null, "r2-sit", true],
        [3, 0, "a", CLOSED_AT, "r3", false],
        [3, 1, null, null, "r3-sit", true],
      ]);
      // Ana 1.5, Ben 1, Cal 0.5: places 1, 2, 3 earn 5, 3, 1.
      expect(loaded.entries).toEqual(
        [
          ["league:Chess:Ana", 5],
          ["league:Chess:Ben", 3],
          ["league:Chess:Cal", 1],
        ].map(([seedKey, points]) => ({
          seedKey,
          points,
          note: "From league",
          generated: true,
          enteredByEmail: HOST,
          enteredAt: new Date(CLOSED_AT),
        })),
      );

      await loadWarWeekSeed(await leagueSeed(), tx);
      expect(await read(tx, first.id)).toEqual(loaded);
    });
  });

  it("never restores pairings an Organizer cleared, nor adds to a League that already has Entrants", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { loadWarWeekSeed } = await import("@/seed/load");
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      await clearLive(tx);
      const open = {
        closed: undefined,
        closedAt: undefined,
        closedByEmail: undefined,
      };
      const first = await loadWarWeekSeed(await leagueSeed(open), tx);
      const before = await read(tx, first.id);
      expect(before.matches).toHaveLength(6);
      expect(before.entries).toEqual([]);

      // Clear pairings: the Entrants stay, the Matches go; a reload adds none.
      await tx
        .delete(schema.leagueMatch)
        .where(eq(schema.leagueMatch.competitionId, before.league.id));
      await loadWarWeekSeed(await leagueSeed(open), tx);
      const cleared = await read(tx, first.id);
      expect(cleared.matches).toEqual([]);
      expect(cleared.entrants).toEqual(before.entrants);

      // No Entrants and no Matches (the Organizer removed them): the seed loads again.
      await tx
        .delete(schema.entrant)
        .where(eq(schema.entrant.competitionId, before.league.id));
      await loadWarWeekSeed(await leagueSeed(open), tx);
      expect((await read(tx, first.id)).matches).toHaveLength(6);
    });
  });
});
