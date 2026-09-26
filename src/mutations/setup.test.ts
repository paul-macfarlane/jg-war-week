import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import type { WarWeekSettingsValues } from "@/lib/setup";

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

const actorEmail = "organizer@jahnelgroup.com";

const settings: WarWeekSettingsValues = {
  storyTheme: "Setup test",
  startDate: "2099-01-01",
  endDate: "2099-01-05",
  mode: "teams",
  teamLabel: "House",
  leaderTitle: "Captain",
  slackChannelUrl: "https://example.slack.com/archives/x",
  wikiUrl: null,
  primaryColor: "#123456",
  primaryForegroundColor: "#ffffff",
  accentColor: "#000000",
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  logoUrl: null,
  bannerUrl: null,
  fontPreset: "serif",
  winner: null,
  highlights: [],
};

/** Two War Weeks; home has two Days, one with a Schedule Item. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        ...settings,
        status: "upcoming" as const,
        edition: `s${n}`,
        editionNumber: 9200 + n,
        year: 9200 + n,
        organizerEmails: [actorEmail],
      })
      .returning({ id: schema.warWeek.id });
    return row.id;
  };
  const home = await warWeek(1);
  const other = await warWeek(2);
  const [busy] = await tx
    .insert(schema.day)
    .values({ warWeekId: home, date: "2099-01-02", dayTheme: "Busy" })
    .returning({ id: schema.day.id });
  await tx.insert(schema.scheduleItem).values({
    dayId: busy.id,
    startTime: "09:00",
    title: "Kickoff",
    category: "social",
  });
  const [quiet] = await tx
    .insert(schema.day)
    .values({ warWeekId: home, date: "2099-01-03", dayTheme: "Quiet" })
    .returning({ id: schema.day.id });
  const ctx = { warWeekId: home, actorEmail };
  return { schema, home, other, busyId: busy.id, quietId: quiet.id, ctx };
}

describe.skipIf(!isLocalDatabase)("updateWarWeekSettings", () => {
  it("saves the settings and Appearance Theme of only this War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettings } = await import("@/mutations/setup");
      const { schema, home, other, ctx } = await fixture(tx);

      const result = await updateWarWeekSettings(
        { ...settings, storyTheme: "Renamed", primaryColor: "#ff0000" },
        ctx,
        tx,
      );
      expect(result).toEqual({ ok: true });

      const rows = await tx.select().from(schema.warWeek);
      const byId = new Map(rows.map((r) => [r.id, r]));
      expect(byId.get(home)).toMatchObject({
        storyTheme: "Renamed",
        primaryColor: "#ff0000",
        fontPreset: "serif",
      });
      expect(byId.get(other)).toMatchObject({
        storyTheme: "Setup test",
        primaryColor: "#123456",
      });
    });
  });

  it("refuses free-for-all while the War Week has Teams", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettings } = await import("@/mutations/setup");
      const { schema, home, ctx } = await fixture(tx);
      await tx
        .insert(schema.team)
        .values({ warWeekId: home, name: "Red", color: "#f00" });

      expect(
        await updateWarWeekSettings(
          { ...settings, mode: "free-for-all" },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This War Week has 1 Team. Delete it before switching to free-for-all.",
      });
      const [row] = await tx
        .select({ mode: schema.warWeek.mode })
        .from(schema.warWeek)
        .where(eq(schema.warWeek.id, home));
      expect(row.mode).toBe("teams");
    });
  });

  it("refuses dates that leave a Day outside the War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettings } = await import("@/mutations/setup");
      const { ctx } = await fixture(tx);
      expect(
        await updateWarWeekSettings(
          { ...settings, startDate: "2099-01-03" },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "The Day on 2099-01-02 falls outside the new dates. Move or delete it first.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("Day mutations", () => {
  it("creates, edits and deletes a Day of this War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDay, updateDay, deleteDay } =
        await import("@/mutations/setup");
      const { getSetupDays } = await import("@/queries/setup");
      const { home, quietId, ctx } = await fixture(tx);

      expect(
        await createDay({ date: "2099-01-05", dayTheme: "Finale" }, ctx, tx),
      ).toEqual({ ok: true });
      expect(
        await updateDay(
          quietId,
          { date: "2099-01-04", dayTheme: "Moved" },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const days = await getSetupDays({ id: home }, tx);
      expect(
        days.map(({ date, dayTheme, scheduleItemCount }) => ({
          date,
          dayTheme,
          scheduleItemCount,
        })),
      ).toEqual([
        { date: "2099-01-02", dayTheme: "Busy", scheduleItemCount: 1 },
        { date: "2099-01-04", dayTheme: "Moved", scheduleItemCount: 0 },
        { date: "2099-01-05", dayTheme: "Finale", scheduleItemCount: 0 },
      ]);

      expect(await deleteDay(quietId, ctx, tx)).toEqual({ ok: true });
      expect(await getSetupDays({ id: home }, tx)).toHaveLength(2);
    });
  });

  it("refuses a duplicate date, a date outside the War Week, and deleting a Day with Schedule Items", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDay, updateDay, deleteDay } =
        await import("@/mutations/setup");
      const { busyId, quietId, ctx } = await fixture(tx);

      expect(
        await createDay({ date: "2099-01-02", dayTheme: "Again" }, ctx, tx),
      ).toEqual({ ok: false, error: "There's already a Day on 2099-01-02." });
      expect(
        await updateDay(
          quietId,
          { date: "2099-01-09", dayTheme: "Late" },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A Day must fall within the War Week (2099-01-01 to 2099-01-05).",
      });
      expect(await deleteDay(busyId, ctx, tx)).toEqual({
        ok: false,
        error: "This Day has 1 Schedule Item. Delete or move it first.",
      });
    });
  });

  it("won't touch another War Week's Day", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateDay, deleteDay } = await import("@/mutations/setup");
      const { other, quietId } = await fixture(tx);
      const ctx = { warWeekId: other, actorEmail };

      expect(
        await updateDay(
          quietId,
          { date: "2099-01-04", dayTheme: "Hijack" },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "That Day no longer exists." });
      expect(await deleteDay(quietId, ctx, tx)).toEqual({
        ok: false,
        error: "That Day no longer exists.",
      });
    });
  });
});

/**
 * Home has Teams Red (with Neo, who has a Points Entry and an Award) and
 * Blue (empty), and Competitions Catan (individual, with Neo's Points Entry
 * and a Schedule Item) and Relay (team, unused).
 */
async function rosterFixture(tx: DBTx) {
  const base = await fixture(tx);
  const { schema, home, busyId } = base;
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId: home, name: "Red", color: "#f00" },
      { warWeekId: home, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  const [neo, trinity] = await tx
    .insert(schema.participant)
    .values([
      {
        warWeekId: home,
        displayName: "Neo",
        email: "neo@jahnelgroup.com",
        teamId: red.id,
        isLeader: true,
      },
      { warWeekId: home, displayName: "Trinity" },
    ])
    .returning({ id: schema.participant.id });
  const [catan, relay] = await tx
    .insert(schema.competition)
    .values([
      { warWeekId: home, name: "Catan", scoring: "individual" as const },
      { warWeekId: home, name: "Relay", scoring: "team" as const },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.pointsEntry).values({
    competitionId: catan.id,
    participantId: neo.id,
    points: 5,
    enteredByEmail: actorEmail,
  });
  const [mvp] = await tx
    .insert(schema.award)
    .values({ warWeekId: home, name: "MVP" })
    .returning({ id: schema.award.id });
  await tx
    .insert(schema.awardParticipant)
    .values({ awardId: mvp.id, participantId: neo.id });
  await tx.insert(schema.scheduleItem).values({
    dayId: busyId,
    startTime: "13:00",
    title: "Catan",
    category: "competition",
    competitionId: catan.id,
  });
  return {
    ...base,
    redId: red.id,
    blueId: blue.id,
    neoId: neo.id,
    trinityId: trinity.id,
    catanId: catan.id,
    relayId: relay.id,
  };
}

const participantValues = {
  displayName: "Morpheus",
  companyTag: "LTI",
  email: "morpheus@jahnelgroup.com",
  teamId: null,
  isLeader: false,
};

const competitionValues = {
  name: "Chess",
  description: null,
  scoring: "individual" as const,
  maxPoints: 10,
  placementPoints: [5, 3, 1],
  countsTowardTeam: true,
  competitionGroup: "Board games",
};

describe.skipIf(!isLocalDatabase)("Team mutations", () => {
  it("creates, edits and deletes a Team of this War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createTeam, updateTeam, deleteTeam } =
        await import("@/mutations/setup");
      const { schema, home, blueId, ctx } = await rosterFixture(tx);

      expect(
        await createTeam(
          { name: "Green", color: "#0f0", logoUrl: null },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await updateTeam(
          blueId,
          { name: "Navy", color: "#008", logoUrl: "/navy.svg" },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await deleteTeam(blueId, ctx, tx)).toEqual({ ok: true });

      const names = await tx
        .select({ name: schema.team.name })
        .from(schema.team)
        .where(eq(schema.team.warWeekId, home));
      expect(names.map((t) => t.name).sort()).toEqual(["Green", "Red"]);
    });
  });

  it("refuses a duplicate name, Teams in a free-for-all and deleting a Team in use", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createTeam, deleteTeam } = await import("@/mutations/setup");
      const { schema, home, redId, ctx } = await rosterFixture(tx);

      expect(
        await createTeam(
          { name: "Red", color: "#f00", logoUrl: null },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: 'There\'s already a Team named "Red".' });

      await tx.insert(schema.pointsEntry).values({
        competitionId: (
          await tx
            .select({ id: schema.competition.id })
            .from(schema.competition)
            .where(eq(schema.competition.name, "Relay"))
        )[0].id,
        teamId: redId,
        points: 3,
        enteredByEmail: actorEmail,
      });
      expect(await deleteTeam(redId, ctx, tx)).toEqual({
        ok: false,
        error:
          "This Team has 1 Participant and 1 Points Entry. Move or delete them first.",
      });

      await tx
        .update(schema.warWeek)
        .set({ mode: "free-for-all" })
        .where(eq(schema.warWeek.id, home));
      expect(
        await createTeam(
          { name: "Green", color: "#0f0", logoUrl: null },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "A free-for-all War Week has no Teams. Switch the mode to teams first.",
      });
    });
  });

  it("won't touch another War Week's Team", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateTeam, deleteTeam } = await import("@/mutations/setup");
      const { other, blueId } = await rosterFixture(tx);
      const ctx = { warWeekId: other, actorEmail };
      expect(
        await updateTeam(
          blueId,
          { name: "Hijack", color: "#000", logoUrl: null },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "That Team no longer exists." });
      expect(await deleteTeam(blueId, ctx, tx)).toEqual({
        ok: false,
        error: "That Team no longer exists.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("Participant mutations", () => {
  it("creates, edits and deletes a Participant", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createParticipant, updateParticipant, deleteParticipant } =
        await import("@/mutations/setup");
      const { schema, home, blueId, trinityId, ctx } = await rosterFixture(tx);

      expect(
        await createParticipant(
          { ...participantValues, teamId: blueId, isLeader: true },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      // Keeping your own email isn't a duplicate.
      expect(
        await updateParticipant(
          trinityId,
          {
            ...participantValues,
            displayName: "Trinity",
            email: "trinity@jahnelgroup.com",
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await updateParticipant(
          trinityId,
          {
            ...participantValues,
            displayName: "Trinity",
            email: "trinity@jahnelgroup.com",
            teamId: blueId,
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const rows = await tx
        .select({
          displayName: schema.participant.displayName,
          teamId: schema.participant.teamId,
          isLeader: schema.participant.isLeader,
        })
        .from(schema.participant)
        .where(eq(schema.participant.warWeekId, home));
      expect(rows).toEqual(
        expect.arrayContaining([
          { displayName: "Morpheus", teamId: blueId, isLeader: true },
          { displayName: "Trinity", teamId: blueId, isLeader: false },
        ]),
      );

      expect(await deleteParticipant(trinityId, ctx, tx)).toEqual({ ok: true });
    });
  });

  it("refuses a duplicate email as a field error, naming who has it", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createParticipant, updateParticipant } =
        await import("@/mutations/setup");
      const { trinityId, ctx } = await rosterFixture(tx);
      const refusal = {
        ok: false,
        error: "neo@jahnelgroup.com is already Neo's email.",
      };

      expect(
        await createParticipant(
          { ...participantValues, email: "neo@jahnelgroup.com" },
          ctx,
          tx,
        ),
      ).toEqual(refusal);
      expect(
        await updateParticipant(
          trinityId,
          {
            ...participantValues,
            displayName: "Trinity",
            email: "neo@jahnelgroup.com",
          },
          ctx,
          tx,
        ),
      ).toEqual(refusal);
    });
  });

  it("allows the same email in another War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createParticipant } = await import("@/mutations/setup");
      const { other } = await rosterFixture(tx);
      expect(
        await createParticipant(
          { ...participantValues, email: "neo@jahnelgroup.com" },
          { warWeekId: other, actorEmail },
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("refuses a duplicate name, another War Week's Team and deleting a Participant with scoring data", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createParticipant, deleteParticipant } =
        await import("@/mutations/setup");
      const { schema, other, neoId, ctx } = await rosterFixture(tx);
      const [otherTeam] = await tx
        .insert(schema.team)
        .values({ warWeekId: other, name: "Elsewhere", color: "#000" })
        .returning({ id: schema.team.id });

      expect(
        await createParticipant(
          { ...participantValues, displayName: "Neo", email: null },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: 'There\'s already a Participant named "Neo".',
      });
      expect(
        await createParticipant(
          { ...participantValues, teamId: otherTeam.id },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "That Team no longer exists." });
      expect(await deleteParticipant(neoId, ctx, tx)).toEqual({
        ok: false,
        error:
          "This Participant has 1 Points Entry and 1 Award. Delete them or remove the Participant from them first.",
      });
    });
  });
});

describe.skipIf(!isLocalDatabase)("Competition mutations", () => {
  it("creates, edits and deletes a Competition with Placement Points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCompetition, updateCompetition, deleteCompetition } =
        await import("@/mutations/setup");
      const { schema, relayId, ctx } = await rosterFixture(tx);

      expect(await createCompetition(competitionValues, ctx, tx)).toEqual({
        ok: true,
      });
      const [chess] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.name, "Chess"));
      expect(chess).toMatchObject({
        placementPoints: [5, 3, 1],
        maxPoints: 10,
        countsTowardTeam: true,
        competitionGroup: "Board games",
      });

      // Relay has no Points Entries, so its scoring can change.
      expect(
        await updateCompetition(
          relayId,
          { ...competitionValues, name: "Relay", countsTowardTeam: false },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await deleteCompetition(relayId, ctx, tx)).toEqual({ ok: true });
    });
  });

  it("refuses a duplicate name, changing scoring under Points Entries and deleting a Competition in use", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCompetition, updateCompetition, deleteCompetition } =
        await import("@/mutations/setup");
      const { catanId, ctx } = await rosterFixture(tx);

      expect(
        await createCompetition(
          { ...competitionValues, name: "Catan" },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: 'There\'s already a Competition named "Catan".',
      });
      expect(
        await updateCompetition(
          catanId,
          {
            ...competitionValues,
            name: "Catan",
            scoring: "team",
            countsTowardTeam: false,
          },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition has 1 Points Entry, so its scoring can't change. Delete them first.",
      });
      expect(await deleteCompetition(catanId, ctx, tx)).toEqual({
        ok: false,
        error:
          "This Competition has 1 Points Entry and 1 Schedule Item. Delete or move them first.",
      });
    });
  });

  it("won't touch another War Week's Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateCompetition, deleteCompetition } =
        await import("@/mutations/setup");
      const { other, relayId } = await rosterFixture(tx);
      const ctx = { warWeekId: other, actorEmail };
      expect(
        await updateCompetition(relayId, competitionValues, ctx, tx),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
      expect(await deleteCompetition(relayId, ctx, tx)).toEqual({
        ok: false,
        error: "That Competition no longer exists.",
      });
    });
  });

  it("refuses Placement Points or scoring changes while the Bracket is finalized, but not other fields", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateCompetition } = await import("@/mutations/setup");
      const { schema, home, ctx } = await rosterFixture(tx);
      const [bracket] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: home,
          name: "Knockout",
          scoring: "individual" as const,
          format: "single-elimination" as const,
          placementPoints: [5, 3, 1],
        })
        .returning({ id: schema.competition.id });
      await tx
        .update(schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(schema.competition.id, bracket.id));

      expect(
        await updateCompetition(
          bracket.id,
          { ...competitionValues, name: "Knockout", placementPoints: [10, 5] },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition's Bracket is finalized. Un-finalize the Bracket first.",
      });
      const [unchanged] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.id, bracket.id));
      expect(unchanged).toMatchObject({
        name: "Knockout",
        placementPoints: [5, 3, 1],
      });

      expect(
        await updateCompetition(
          bracket.id,
          {
            ...competitionValues,
            name: "Renamed Knockout",
            description: "Single elimination",
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      await tx
        .update(schema.competition)
        .set({ finalizedAt: null })
        .where(eq(schema.competition.id, bracket.id));

      expect(
        await updateCompetition(
          bracket.id,
          {
            ...competitionValues,
            name: "Renamed Knockout",
            placementPoints: [10, 5],
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "updateWarWeekSettings and the Organizer list",
  () => {
    it("saves for an actor on no War Week's organizer emails", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettings } = await import("@/mutations/setup");
        const { schema, home } = await fixture(tx);

        const result = await updateWarWeekSettings(
          { ...settings, storyTheme: "Corrected" },
          { warWeekId: home, actorEmail: "unlisted@jahnelgroup.com" },
          tx,
        );
        expect(result).toEqual({ ok: true });
        const [row] = await tx
          .select()
          .from(schema.warWeek)
          .where(eq(schema.warWeek.id, home));
        expect(row.storyTheme).toBe("Corrected");
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("setCompetitionHosts", () => {
  async function hostsOf(tx: DBTx, competitionId: string) {
    const { getCompetitionHosts } = await import("@/queries/organizers");
    return getCompetitionHosts(competitionId, tx);
  }

  it("replaces the Hosts, lowercased and deduplicated", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setCompetitionHosts } = await import("@/mutations/setup");
      const { catanId, relayId, ctx } = await rosterFixture(tx);

      expect(
        await setCompetitionHosts(
          catanId,
          [
            "Tony@JahnelGroup.com",
            " tony@jahnelgroup.com",
            "tom@jahnelgroup.com",
          ],
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await hostsOf(tx, catanId)).toEqual([
        "tom@jahnelgroup.com",
        "tony@jahnelgroup.com",
      ]);

      expect(
        await setCompetitionHosts(catanId, ["amy@jahnelgroup.com"], ctx, tx),
      ).toEqual({ ok: true });
      expect(await hostsOf(tx, catanId)).toEqual(["amy@jahnelgroup.com"]);
      expect(await hostsOf(tx, relayId)).toEqual([]);

      expect(await setCompetitionHosts(catanId, [], ctx, tx)).toEqual({
        ok: true,
      });
      expect(await hostsOf(tx, catanId)).toEqual([]);
    });
  });

  it("refuses an email outside @jahnelgroup.com and changes nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setCompetitionHosts } = await import("@/mutations/setup");
      const { catanId, ctx } = await rosterFixture(tx);
      await setCompetitionHosts(catanId, ["tony@jahnelgroup.com"], ctx, tx);

      expect(
        await setCompetitionHosts(
          catanId,
          ["tom@jahnelgroup.com", "someone@gmail.com"],
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          'Host email "someone@gmail.com" must be an @jahnelgroup.com address.',
      });
      expect(await hostsOf(tx, catanId)).toEqual(["tony@jahnelgroup.com"]);
    });
  });

  it("won't touch another War Week's Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setCompetitionHosts } = await import("@/mutations/setup");
      const { other, catanId } = await rosterFixture(tx);

      expect(
        await setCompetitionHosts(
          catanId,
          ["tony@jahnelgroup.com"],
          { warWeekId: other, actorEmail },
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
      expect(await hostsOf(tx, catanId)).toEqual([]);
    });
  });

  it("leaves the Hosts alone when a Competition setup save carries a hosts key", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setCompetitionHosts, updateCompetition } =
        await import("@/mutations/setup");
      const { parseCompetitionInput } = await import("@/lib/setup");
      const { catanId, ctx } = await rosterFixture(tx);
      await setCompetitionHosts(catanId, ["tony@jahnelgroup.com"], ctx, tx);

      const parsed = parseCompetitionInput({
        name: "Catan",
        description: "",
        scoring: "individual",
        maxPoints: "",
        placementPoints: "",
        countsTowardTeam: false,
        group: "",
        hosts: "tom@jahnelgroup.com",
      } as Parameters<typeof parseCompetitionInput>[0]);
      if (!parsed.ok) throw new Error(parsed.error);
      expect("hosts" in parsed.value).toBe(false);
      expect(await updateCompetition(catanId, parsed.value, ctx, tx)).toEqual({
        ok: true,
      });
      expect(await hostsOf(tx, catanId)).toEqual(["tony@jahnelgroup.com"]);

      // Even a values object carrying hosts past the parser writes none.
      expect(
        await updateCompetition(
          catanId,
          {
            ...parsed.value,
            hosts: ["tom@jahnelgroup.com"],
          } as typeof parsed.value,
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await hostsOf(tx, catanId)).toEqual(["tony@jahnelgroup.com"]);
    });
  });
});
