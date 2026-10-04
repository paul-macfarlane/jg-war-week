import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import type { WarWeekSettingsInput, WarWeekSettingsValues } from "@/lib/setup";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

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

/** The same settings as the form sends them: every field a string. */
const settingsInput: WarWeekSettingsInput = {
  storyTheme: "Setup test",
  startDate: "2099-01-01",
  endDate: "2099-01-05",
  mode: "teams",
  teamLabel: "House",
  leaderTitle: "Captain",
  slackChannelUrl: "https://example.slack.com/archives/x",
  wikiUrl: "",
  primaryColor: "#123456",
  primaryForegroundColor: "#ffffff",
  accentColor: "#000000",
  backgroundColor: "#ffffff",
  foregroundColor: "#000000",
  overridePrimaryColor: "",
  overridePrimaryForegroundColor: "",
  overrideAccentColor: "",
  overrideBackgroundColor: "",
  overrideForegroundColor: "",
  logoUrl: "",
  bannerUrl: "",
  fontPreset: "serif",
  winner: "",
  highlights: "",
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

describe.skipIf(!isLocalDatabase)("updateWarWeekSettingsFields", () => {
  it("writes only the fields sent, so a newer stored value survives", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettingsFields } = await import("@/mutations/setup");
      const { schema, home, ctx } = await fixture(tx);
      // Written after the form loaded (End War Week, another tab).
      await tx
        .update(schema.warWeek)
        .set({ winner: "Red", highlights: ["Won it"] })
        .where(eq(schema.warWeek.id, home));

      const result = await updateWarWeekSettingsFields(
        { storyTheme: "Renamed" },
        ctx,
        tx,
      );
      expect(result).toEqual({ ok: true });
      const [row] = await tx
        .select()
        .from(schema.warWeek)
        .where(eq(schema.warWeek.id, home));
      expect(row).toMatchObject({
        storyTheme: "Renamed",
        winner: "Red",
        highlights: ["Won it"],
      });
    });
  });

  it("refuses a field at that field, checked against the stored row", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettingsFields } = await import("@/mutations/setup");
      const { ctx } = await fixture(tx);
      // The stored end date is 2099-01-05.
      expect(
        await updateWarWeekSettingsFields({ startDate: "2099-01-09" }, ctx, tx),
      ).toMatchObject({
        ok: false,
        fieldErrors: {
          startDate: "Start date must not be after the end date.",
        },
      });
    });
  });

  it("refuses dates that would strand a Day", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateWarWeekSettingsFields } = await import("@/mutations/setup");
      const { ctx } = await fixture(tx);
      const result = await updateWarWeekSettingsFields(
        { startDate: "2099-01-04", endDate: "2099-01-05" },
        ctx,
        tx,
      );
      expect(result.ok).toBe(false);
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "updateWarWeekSettingsFields with the whole form",
  () => {
    it("saves the settings and Appearance Theme of only this War Week", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { schema, home, other, ctx } = await fixture(tx);

        const result = await updateWarWeekSettingsFields(
          { ...settingsInput, storyTheme: "Renamed", primaryColor: "#ff0000" },
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

    /** The home War Week's five override columns. */
    async function overridesOf(tx: DBTx, id: string) {
      const schema = await import("@/db/schema");
      const [row] = await tx
        .select({
          primary: schema.warWeek.overridePrimaryColor,
          primaryForeground: schema.warWeek.overridePrimaryForegroundColor,
          accent: schema.warWeek.overrideAccentColor,
          background: schema.warWeek.overrideBackgroundColor,
          foreground: schema.warWeek.overrideForegroundColor,
        })
        .from(schema.warWeek)
        .where(eq(schema.warWeek.id, id));
      return row;
    }

    const noOverrides = {
      overridePrimaryColor: "",
      overridePrimaryForegroundColor: "",
      overrideAccentColor: "",
      overrideBackgroundColor: "",
      overrideForegroundColor: "",
    };

    it("saves the derived palette's overrides", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { home, ctx } = await fixture(tx);

        const result = await updateWarWeekSettingsFields(
          {
            ...settingsInput,
            ...noOverrides,
            overridePrimaryColor: "#0a7a1f",
            overrideBackgroundColor: "#111111",
          },
          ctx,
          tx,
        );
        expect(result).toEqual({ ok: true });
        expect(await overridesOf(tx, home)).toEqual({
          primary: "#0a7a1f",
          primaryForeground: null,
          accent: null,
          background: "#111111",
          foreground: null,
        });
      });
    });

    it("leaves the overrides alone when a save carries none", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { home, ctx } = await fixture(tx);
        await updateWarWeekSettingsFields(
          { ...settingsInput, ...noOverrides, overrideAccentColor: "#445566" },
          ctx,
          tx,
        );

        await updateWarWeekSettingsFields({ storyTheme: "Renamed" }, ctx, tx);
        expect(await overridesOf(tx, home)).toMatchObject({
          accent: "#445566",
        });
      });
    });

    it("clears untouched overrides when the background crosses light and dark, keeping ones set in the same save", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { home, ctx } = await fixture(tx);
        // The fixture's base background is white: its overrides dress dark.
        await updateWarWeekSettingsFields(
          {
            ...settingsInput,
            ...noOverrides,
            overridePrimaryColor: "#aaaaaa",
            overrideAccentColor: "#cccccc",
          },
          ctx,
          tx,
        );

        // A black background: the overrides would now dress light. The
        // accent is posted as stored (untouched); the primary was set anew.
        const result = await updateWarWeekSettingsFields(
          {
            ...settingsInput,
            ...noOverrides,
            backgroundColor: "#000000",
            foregroundColor: "#ffffff",
            overridePrimaryColor: "#0a7a1f",
            overrideAccentColor: "#cccccc",
          },
          ctx,
          tx,
        );
        expect(result).toEqual({ ok: true });
        expect(await overridesOf(tx, home)).toEqual({
          primary: "#0a7a1f",
          primaryForeground: null,
          accent: null,
          background: null,
          foreground: null,
        });
      });
    });

    it("keeps untouched overrides when the background stays in its scheme", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { home, ctx } = await fixture(tx);
        const kept = {
          ...settingsInput,
          ...noOverrides,
          overrideAccentColor: "#cccccc",
        };
        await updateWarWeekSettingsFields(kept, ctx, tx);

        await updateWarWeekSettingsFields(
          { ...kept, backgroundColor: "#f5ecd7" },
          ctx,
          tx,
        );
        expect(await overridesOf(tx, home)).toMatchObject({
          accent: "#cccccc",
        });
      });
    });

    it("refuses free-for-all while the War Week has Teams", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { schema, home, ctx } = await fixture(tx);
        await tx
          .insert(schema.team)
          .values({ warWeekId: home, name: "Red", color: "#f00" });

        expect(
          await updateWarWeekSettingsFields(
            { ...settingsInput, mode: "free-for-all" },
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
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { ctx } = await fixture(tx);
        expect(
          await updateWarWeekSettingsFields(
            { ...settingsInput, startDate: "2099-01-03" },
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
  },
);

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

  it("saves and edits a Day's description", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createDay, updateDay } = await import("@/mutations/setup");
      const { getSetupDays } = await import("@/queries/setup");
      const { home, quietId, ctx } = await fixture(tx);

      await createDay(
        { date: "2099-01-05", dayTheme: "Finale", description: "Wear red." },
        ctx,
        tx,
      );
      await updateDay(
        quietId,
        { date: "2099-01-03", dayTheme: "Quiet", description: "Shh." },
        ctx,
        tx,
      );
      const byDate = async () =>
        Object.fromEntries(
          (await getSetupDays({ id: home }, tx)).map((d) => [
            d.date,
            d.description,
          ]),
        );
      expect(await byDate()).toEqual({
        "2099-01-02": null,
        "2099-01-03": "Shh.",
        "2099-01-05": "Wear red.",
      });
      await updateDay(
        quietId,
        { date: "2099-01-03", dayTheme: "Quiet", description: null },
        ctx,
        tx,
      );
      expect((await byDate())["2099-01-03"]).toBeNull();
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
    warWeekId: home,
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
        warWeekId: home,
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

describe.skipIf(!isLocalDatabase)("importParticipants", () => {
  const text = [
    "Name\tEmail\tTeam\tCompany tag",
    "Smith\tsmith@jahnelgroup.com\tBlue\tIL",
    "Neo\tNEO@jahnelgroup.com\tBlue\t",
  ].join("\n");
  // What the preview showed: Smith added, Neo moved to Blue.
  const expected = [
    { row: 2, kind: "add" as const, changes: [] },
    { row: 3, kind: "update" as const, changes: ["House: Red → Blue"] },
  ];

  it("adds and updates the previewed rows in one transaction", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { importParticipants } = await import("@/mutations/setup");
      const { schema, home, blueId, ctx } = await rosterFixture(tx);

      expect(await importParticipants({ text, expected }, ctx, tx)).toEqual({
        ok: true,
        added: 1,
        updated: 1,
      });
      const rows = await tx
        .select({
          displayName: schema.participant.displayName,
          email: schema.participant.email,
          companyTag: schema.participant.companyTag,
          teamId: schema.participant.teamId,
          isLeader: schema.participant.isLeader,
        })
        .from(schema.participant)
        .where(eq(schema.participant.warWeekId, home));
      expect(rows).toEqual(
        expect.arrayContaining([
          {
            displayName: "Smith",
            email: "smith@jahnelgroup.com",
            companyTag: "IL",
            teamId: blueId,
            isLeader: false,
          },
          {
            displayName: "Neo",
            email: "neo@jahnelgroup.com",
            companyTag: null,
            teamId: blueId,
            isLeader: true,
          },
        ]),
      );
      expect(rows).toHaveLength(3);
    });
  });

  it("refuses, writing nothing, when the roster changed since the preview", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { importParticipants } = await import("@/mutations/setup");
      const { schema, home, neoId, blueId, ctx } = await rosterFixture(tx);
      // Another tab moved Neo to Blue after the preview.
      await tx
        .update(schema.participant)
        .set({ teamId: blueId })
        .where(eq(schema.participant.id, neoId));

      expect(await importParticipants({ text, expected }, ctx, tx)).toEqual({
        ok: false,
        error: "The roster changed since the preview. Review it again.",
      });
      expect(
        await tx.$count(
          schema.participant,
          eq(schema.participant.warWeekId, home),
        ),
      ).toBe(2);
    });
  });

  it("refuses a file with nothing to import", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { importParticipants } = await import("@/mutations/setup");
      const { ctx } = await rosterFixture(tx);

      expect(
        await importParticipants({ text: "", expected: [] }, ctx, tx),
      ).toEqual({ ok: false, error: "Paste some rows or upload a CSV first." });
      expect(
        await importParticipants(
          {
            text: "Neo\tneo@jahnelgroup.com",
            expected: [{ row: 1, kind: "unchanged", changes: [] }],
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "There's nothing to add or update." });
    });
  });
});

describe("importParticipants when a Team is deleted mid-import", () => {
  it("refuses as a changed roster on a foreign-key violation", async () => {
    const { importParticipants } = await import("@/mutations/setup");
    // The database boundary: the write hits Postgres 23503.
    const db = {
      transaction: async () => {
        throw Object.assign(new Error("fk"), { code: "23503" });
      },
    } as unknown as DBTx;

    expect(
      await importParticipants(
        { text: "Neo", expected: [] },
        { warWeekId: "w", actorEmail: "organizer@jahnelgroup.com" },
        db,
      ),
    ).toEqual({
      ok: false,
      error: "The roster changed since the preview. Review it again.",
    });
  });
});

describe.skipIf(!isLocalDatabase)("Competition mutations", () => {
  it("creates, edits and deletes a Competition with Placement Points", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCompetition, updateCompetition, deleteCompetition } =
        await import("@/mutations/setup");
      const { schema, relayId, ctx } = await rosterFixture(tx);

      expect(await createCompetition(competitionValues, ctx, tx)).toMatchObject(
        { ok: true },
      );
      const [chess] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.name, "Chess"));
      expect(chess).toMatchObject({
        placementPoints: [5, 3, 1],
        countsTowardTeam: true,
        competitionGroup: "Board games",
        format: "placement",
        bracketConfig: null,
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

  it("creates a Bracket with the default config: 2 per Match, 1 advancing, no 3rd place Match", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCompetition } = await import("@/mutations/setup");
      const { schema, ctx } = await rosterFixture(tx);

      const created = await createCompetition(
        {
          ...competitionValues,
          name: "Chess Bracket",
          format: "bracket",
        },
        ctx,
        tx,
      );
      expect(created).toMatchObject({ ok: true });
      const [row] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.name, "Chess Bracket"));
      expect(row).toMatchObject({
        format: "bracket",
        bracketConfig: {
          entrantsPerHeat: 2,
          advancePerHeat: 1,
          thirdPlaceGame: false,
        },
      });
    });
  });

  it("gives a Placement Competition no Bracket config", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCompetition } = await import("@/mutations/setup");
      const { schema, ctx } = await rosterFixture(tx);

      const created = await createCompetition(
        { ...competitionValues, name: "Chess Sheet", format: "placement" },
        ctx,
        tx,
      );
      expect(created).toMatchObject({ ok: true });
      const [row] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.name, "Chess Sheet"));
      expect(row).toMatchObject({ format: "placement", bracketConfig: null });
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

  it("refuses a scoring change while the Bracket is closed, but not Placement Points or other fields", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { updateCompetition } = await import("@/mutations/setup");
      const { schema, home, ctx } = await rosterFixture(tx);
      const [bracket] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: home,
          name: "Knockout",
          scoring: "individual" as const,
          format: "bracket" as const,
          placementPoints: [5, 3, 1],
        })
        .returning({ id: schema.competition.id });
      await tx
        .update(schema.competition)
        .set({ closedAt: new Date() })
        .where(eq(schema.competition.id, bracket.id));

      expect(
        await updateCompetition(
          bracket.id,
          { ...competitionValues, name: "Knockout", placementPoints: [10, 5] },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await updateCompetition(
          bracket.id,
          {
            ...competitionValues,
            name: "Knockout",
            scoring: "team",
            countsTowardTeam: false,
            placementPoints: [10, 5],
          },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error:
          "This Competition's Bracket is closed. Reopen the Bracket first.",
      });
      const [saved] = await tx
        .select()
        .from(schema.competition)
        .where(eq(schema.competition.id, bracket.id));
      expect(saved).toMatchObject({
        name: "Knockout",
        scoring: "individual",
        placementPoints: [10, 5],
      });

      expect(
        await updateCompetition(
          bracket.id,
          {
            ...competitionValues,
            name: "Renamed Knockout",
            description: {
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "Single elimination" }],
                },
              ],
            },
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      await tx
        .update(schema.competition)
        .set({ closedAt: null })
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
  "updateWarWeekSettingsFields and the Organizer list",
  () => {
    it("saves for an actor on no War Week's organizer emails", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateWarWeekSettingsFields } =
          await import("@/mutations/setup");
        const { schema, home } = await fixture(tx);

        const result = await updateWarWeekSettingsFields(
          { ...settingsInput, storyTheme: "Corrected" },
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
    const { competitionHost } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const rows = await tx
      .select({ email: competitionHost.email })
      .from(competitionHost)
      .where(eq(competitionHost.competitionId, competitionId))
      .orderBy(competitionHost.email);
    return rows.map((row) => row.email);
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
        error: "Use an @jahnelgroup.com email.",
      });
      expect(await hostsOf(tx, catanId)).toEqual(["tony@jahnelgroup.com"]);
    });
  });

  it("refuses a 255-character Host email with the validation message", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setCompetitionHosts } = await import("@/mutations/setup");
      const { catanId, ctx } = await rosterFixture(tx);
      const tooLong = `${"a".repeat(255 - "@jahnelgroup.com".length)}@jahnelgroup.com`;

      expect(await setCompetitionHosts(catanId, [tooLong], ctx, tx)).toEqual({
        ok: false,
        error: "Use an @jahnelgroup.com email.",
      });
      expect(await hostsOf(tx, catanId)).toEqual([]);
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

describe.skipIf(!isLocalDatabase)(
  "Squads guard their Participants and Team",
  () => {
    /**
     * The roster fixture plus Squads: Relay has Red Alpha (Neo) and Blue
     * Alpha; Tug, another team Competition, has Red Bravo (Neo) and Blue
     * Bravo. So Neo is in 2 Squads, Blue has 2, Relay has 2.
     */
    async function squadFixture(tx: DBTx) {
      const f = await rosterFixture(tx);
      const { schema } = f;
      const [tug] = await tx
        .insert(schema.competition)
        .values({
          warWeekId: f.home,
          name: "Tug",
          scoring: "team",
          format: "bracket",
        })
        .returning({ id: schema.competition.id });
      const squads = await tx
        .insert(schema.squad)
        .values([
          { competitionId: f.relayId, teamId: f.redId, name: "Red Alpha" },
          { competitionId: f.relayId, teamId: f.blueId, name: "Blue Alpha" },
          { competitionId: tug.id, teamId: f.redId, name: "Red Bravo" },
          { competitionId: tug.id, teamId: f.blueId, name: "Blue Bravo" },
        ])
        .returning({ id: schema.squad.id, name: schema.squad.name });
      const byName = (name: string) => squads.find((s) => s.name === name)!.id;
      await tx.insert(schema.squadParticipant).values([
        { squadId: byName("Red Alpha"), participantId: f.neoId },
        { squadId: byName("Red Bravo"), participantId: f.neoId },
      ]);
      return { ...f, tugId: tug.id };
    }

    const neoValues = (teamId: string | null) => ({
      displayName: "Neo",
      companyTag: null,
      email: "neo@jahnelgroup.com",
      teamId,
      isLeader: false,
    });

    it("refuses changing a Participant's Team while they're in a Squad, but not other edits", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateParticipant } = await import("@/mutations/setup");
        const { ctx, neoId, redId, blueId } = await squadFixture(tx);
        const refusal = {
          ok: false,
          error:
            "This Participant has 2 Squads. Remove them from the Squads before changing their Team.",
        };

        expect(
          await updateParticipant(neoId, neoValues(blueId), ctx, tx),
        ).toEqual(refusal);
        expect(
          await updateParticipant(neoId, neoValues(null), ctx, tx),
        ).toEqual(refusal);
        expect(
          await updateParticipant(
            neoId,
            { ...neoValues(redId), displayName: "The One" },
            ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("counts Squads when refusing to delete a Participant or Team", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { deleteParticipant, deleteTeam } =
          await import("@/mutations/setup");
        const { ctx, neoId, blueId } = await squadFixture(tx);

        expect(await deleteParticipant(neoId, ctx, tx)).toEqual({
          ok: false,
          error:
            "This Participant has 1 Points Entry, 1 Award and 2 Squads. Delete them or remove the Participant from them first.",
        });
        expect(await deleteTeam(blueId, ctx, tx)).toEqual({
          ok: false,
          error: "This Team has 2 Squads. Move or delete them first.",
        });
      });
    });

    it("refuses a scoring change while the Competition has Squads", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { updateCompetition } = await import("@/mutations/setup");
        const { ctx, relayId } = await squadFixture(tx);

        expect(
          await updateCompetition(
            relayId,
            { ...competitionValues, name: "Relay", scoring: "individual" },
            ctx,
            tx,
          ),
        ).toEqual({
          ok: false,
          error:
            "This Competition has 2 Squads. Delete them before changing its scoring.",
        });
        expect(
          await updateCompetition(
            relayId,
            {
              ...competitionValues,
              name: "Relay",
              scoring: "team",
              countsTowardTeam: false,
            },
            ctx,
            tx,
          ),
        ).toEqual({ ok: true });
      });
    });

    it("lists each Team's and Participant's Squad count for the setup screens", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { getSetupTeams, getSetupParticipants } =
          await import("@/queries/setup");
        const { home } = await squadFixture(tx);

        expect(
          (await getSetupTeams({ id: home }, tx)).map((t) => [
            t.name,
            t.squadCount,
          ]),
        ).toEqual([
          ["Blue", 2],
          ["Red", 2],
        ]);
        expect(
          (await getSetupParticipants({ id: home }, tx)).map((p) => [
            p.displayName,
            p.squadCount,
          ]),
        ).toEqual([
          ["Neo", 2],
          ["Trinity", 0],
        ]);
      });
    });
  },
);
