import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createDiscretionaryPoints,
  deleteDiscretionaryPoints,
  updateDiscretionaryPoints,
} from "@/actions/discretionary-points";
import { isLocalDatabaseUrl } from "@/db/local-url";
import type { Actor } from "@/lib/access";

// Runs only against a local Postgres (CI's service or docker compose; see
// vitest.config.ts), never a hosted database. These commit, so the test
// owns two War Weeks (test-only editions) and deletes them before and after.
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

// The session is the one thing faked: who is asking. `authorize`, `can` and
// the database are the real ones.
const { session } = vi.hoisted(() => ({
  session: { actor: null as Actor },
}));
vi.mock("@/auth/actor", () => ({ getActor: async () => session.actor }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const EDITIONS = ["zz-da-a", "zz-da-b"];
const ORGANIZER = "organizer@jahnelgroup.com";

async function clear() {
  const { db } = await import("@/db");
  const { warWeek } = await import("@/db/schema");
  for (const edition of EDITIONS) {
    await db.delete(warWeek).where(eq(warWeek.edition, edition));
  }
}

async function committedWarWeek(edition: string, n: number) {
  const { db } = await import("@/db");
  const schema = await import("@/db/schema");
  const [row] = await db
    .insert(schema.warWeek)
    .values({
      edition,
      editionNumber: 9800 + n,
      year: 9800 + n,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Discretionary action test",
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
  const [competition] = await db
    .insert(schema.competition)
    .values({ warWeekId: row.id, name: "Tug of War", scoring: "team" })
    .returning({ id: schema.competition.id });
  return { warWeekId: row.id, teamId: team.id, competitionId: competition.id };
}

async function allEntries() {
  const { db } = await import("@/db");
  const { pointsEntry } = await import("@/db/schema");
  const { inArray } = await import("drizzle-orm");
  const { warWeek } = await import("@/db/schema");
  const weeks = await db
    .select({ id: warWeek.id })
    .from(warWeek)
    .where(inArray(warWeek.edition, EDITIONS));
  return db
    .select()
    .from(pointsEntry)
    .where(
      inArray(
        pointsEntry.warWeekId,
        weeks.map((w) => w.id),
      ),
    );
}

const asOrganizer = () => {
  session.actor = { email: ORGANIZER, isOrganizer: true, hosts: [] };
};

describe.skipIf(!isLocalDatabase)("Discretionary points actions", () => {
  beforeEach(clear);
  afterEach(clear);

  it("as a Host (of any Competition) each action returns the Organizer-only refusal and writes nothing", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    const { db } = await import("@/db");
    const { pointsEntry } = await import("@/db/schema");
    const [entry] = await db
      .insert(pointsEntry)
      .values({
        warWeekId: home.warWeekId,
        competitionId: null,
        teamId: home.teamId,
        points: 3,
        note: "Spirit",
        enteredByEmail: ORGANIZER,
      })
      .returning({ id: pointsEntry.id });
    session.actor = {
      email: "host@jahnelgroup.com",
      isOrganizer: false,
      hosts: [{ competitionId: home.competitionId, warWeekId: home.warWeekId }],
    };
    const input = { targetId: home.teamId, points: "9", reason: "Hijack" };

    expect(await createDiscretionaryPoints(home.warWeekId, input)).toEqual({
      ok: false,
      error: "Only an Organizer can give Discretionary points.",
    });
    expect(await updateDiscretionaryPoints(entry.id, input)).toEqual({
      ok: false,
      error: "Only an Organizer can change Discretionary points.",
    });
    expect(await deleteDiscretionaryPoints(entry.id)).toEqual({
      ok: false,
      error: "Only an Organizer can delete Discretionary points.",
    });

    const rows = await allEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: entry.id, points: 3, note: "Spirit" });
  });

  it("as a signed-in Participant or anonymous each action is refused too", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    const input = { targetId: home.teamId, points: "9", reason: "Hijack" };

    session.actor = {
      email: "p@jahnelgroup.com",
      isOrganizer: false,
      hosts: [],
    };
    expect(await createDiscretionaryPoints(home.warWeekId, input)).toEqual({
      ok: false,
      error: "Only an Organizer can give Discretionary points.",
    });
    session.actor = null;
    expect(await createDiscretionaryPoints(home.warWeekId, input)).toEqual({
      ok: false,
      error: "Sign in to continue.",
    });
    expect(await allEntries()).toEqual([]);
  });

  it("as an Organizer creates, edits (marking it edited) and deletes", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    const { getDiscretionaryLedger } =
      await import("@/queries/discretionary-points");
    const { db } = await import("@/db");
    const { pointsEntry } = await import("@/db/schema");
    asOrganizer();

    expect(
      await createDiscretionaryPoints(home.warWeekId, {
        targetId: home.teamId,
        points: "3",
        reason: "Spirit award",
      }),
    ).toEqual({ ok: true });
    const [created] = await allEntries();
    expect(created).toMatchObject({
      competitionId: null,
      points: 3,
      note: "Spirit award",
      enteredByEmail: ORGANIZER,
    });
    expect(
      (await getDiscretionaryLedger({ id: home.warWeekId }))[0].editedAt,
    ).toBeNull();

    // Saved a while ago, so the edit shows as an edit.
    await db
      .update(pointsEntry)
      .set({ createdAt: new Date(Date.now() - 3_600_000) })
      .where(eq(pointsEntry.id, created.id));
    session.actor = {
      email: "second@jahnelgroup.com",
      isOrganizer: true,
      hosts: [],
    };
    expect(
      await updateDiscretionaryPoints(created.id, {
        targetId: home.teamId,
        points: "4",
        reason: "Spirit award",
      }),
    ).toEqual({ ok: true });
    const [edited] = await getDiscretionaryLedger({ id: home.warWeekId });
    expect(edited).toMatchObject({
      points: 4,
      enteredByEmail: ORGANIZER,
    });
    expect(edited.editedAt).not.toBeNull();

    expect(await deleteDiscretionaryPoints(created.id)).toEqual({ ok: true });
    expect(await allEntries()).toEqual([]);
  });

  it("refuses a Team from another War Week on create and on edit", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    const other = await committedWarWeek(EDITIONS[1], 2);
    asOrganizer();
    const refusal = {
      ok: false,
      error: "Choose a Team or Participant of this War Week.",
    };

    expect(
      await createDiscretionaryPoints(home.warWeekId, {
        targetId: other.teamId,
        points: "5",
        reason: "Foreign",
      }),
    ).toEqual(refusal);
    expect(await allEntries()).toEqual([]);

    await createDiscretionaryPoints(home.warWeekId, {
      targetId: home.teamId,
      points: "1",
      reason: "Mine",
    });
    const [mine] = await allEntries();
    expect(
      await updateDiscretionaryPoints(mine.id, {
        targetId: other.teamId,
        points: "5",
        reason: "Foreign",
      }),
    ).toEqual(refusal);
    const [still] = await allEntries();
    expect(still).toMatchObject({ teamId: home.teamId, points: 1 });
  });

  it("refuses to edit or delete a generated or Competition entry, writing nothing", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    const { db } = await import("@/db");
    const { pointsEntry } = await import("@/db/schema");
    const [generated] = await db
      .insert(pointsEntry)
      .values({
        warWeekId: home.warWeekId,
        competitionId: home.competitionId,
        teamId: home.teamId,
        points: 5,
        note: "From bracket",
        enteredByEmail: ORGANIZER,
        generatedByBracket: true,
      })
      .returning({ id: pointsEntry.id });
    asOrganizer();
    const refusal = {
      ok: false,
      error: "That Points Entry comes from a Competition. Change it there.",
    };

    expect(
      await updateDiscretionaryPoints(generated.id, {
        targetId: home.teamId,
        points: "99",
        reason: "Hijack",
      }),
    ).toEqual(refusal);
    expect(await deleteDiscretionaryPoints(generated.id)).toEqual(refusal);
    const rows = await allEntries();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ points: 5, note: "From bracket" });
  });

  it("returns the generic error when the mutation throws", async () => {
    const home = await committedWarWeek(EDITIONS[0], 1);
    asOrganizer();
    vi.spyOn(console, "error").mockImplementation(() => {});
    const mutations = await import("@/mutations/discretionary-points");
    vi.spyOn(mutations, "createDiscretionaryPoints").mockRejectedValueOnce(
      new Error("boom"),
    );

    expect(
      await createDiscretionaryPoints(home.warWeekId, {
        targetId: home.teamId,
        points: "1",
        reason: "x",
      }),
    ).toEqual({ ok: false, error: "Something went wrong. Try again." });
    expect(console.error).toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
