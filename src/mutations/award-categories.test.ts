import { eq } from "drizzle-orm";
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

/** A War Week with one Participant, to give Awards in. */
async function warWeekWithParticipant(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [row] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "ac1",
      editionNumber: 9500,
      year: 9500,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Category test",
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
  const [neo] = await tx
    .insert(schema.participant)
    .values({ warWeekId: row.id, displayName: "Neo" })
    .returning({ id: schema.participant.id });
  return { warWeekId: row.id, neoId: neo.id };
}

async function categoryNamed(tx: DBTx, name: string) {
  const { getAwardCategories } = await import("@/queries/award-categories");
  const found = (await getAwardCategories(tx)).find((c) => c.name === name);
  if (!found) throw new Error(`No Category named ${name}`);
  return found;
}

describe.skipIf(!isLocalDatabase)("Award Category mutations", () => {
  it("adds a Category, listed by name beside the seeded ones", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAwardCategory } =
        await import("@/mutations/award-categories");
      const { getAwardCategories } = await import("@/queries/award-categories");

      expect(await createAwardCategory("Zz Crossword", tx)).toEqual({
        ok: true,
      });

      const all = await getAwardCategories(tx);
      expect(all.find((c) => c.name === "Zz Crossword")).toMatchObject({
        archived: false,
      });
      expect(all.map((c) => c.name)).toContain("War Week MVP");
      expect(all.map((c) => c.name)).toEqual(
        [...all.map((c) => c.name)].sort((a, b) => a.localeCompare(b)),
      );
    });
  });

  it("refuses a name already taken, ignoring case, on add and on rename", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAwardCategory, renameAwardCategory } =
        await import("@/mutations/award-categories");

      expect(await createAwardCategory("war WEEK mvp", tx)).toEqual({
        ok: false,
        error: "There's already a Category named war WEEK mvp.",
      });

      await createAwardCategory("Zz Crossword", tx);
      const { id } = await categoryNamed(tx, "Zz Crossword");
      expect(await renameAwardCategory(id, "grind", tx)).toEqual({
        ok: false,
        error: "There's already a Category named grind.",
      });
      // Changing only its own case is not a clash.
      expect(await renameAwardCategory(id, "ZZ CROSSWORD", tx)).toEqual({
        ok: true,
      });
      expect((await categoryNamed(tx, "ZZ CROSSWORD")).id).toBe(id);
    });
  });

  it("renames a seeded Category and keeps its key", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { renameAwardCategory } =
        await import("@/mutations/award-categories");
      const schema = await import("@/db/schema");
      const { id } = await categoryNamed(tx, "Grow");

      expect(await renameAwardCategory(id, "Zz Growth", tx)).toEqual({
        ok: true,
      });

      const [row] = await tx
        .select({
          name: schema.awardCategory.name,
          key: schema.awardCategory.key,
        })
        .from(schema.awardCategory)
        .where(eq(schema.awardCategory.id, id));
      expect(row).toEqual({ name: "Zz Growth", key: "grow" });
    });
  });

  it("says so when the Category no longer exists", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { archiveAwardCategory, renameAwardCategory } =
        await import("@/mutations/award-categories");
      const missing = "00000000-0000-4000-8000-000000000000";
      expect(await renameAwardCategory(missing, "Zz Gone", tx)).toEqual({
        ok: false,
        error: "That Category no longer exists.",
      });
      expect(await archiveAwardCategory(missing, tx)).toEqual({
        ok: false,
        error: "That Category no longer exists.",
      });
    });
  });

  it("archives a Category: it leaves the form options but stays on its Award", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { archiveAwardCategory } =
        await import("@/mutations/award-categories");
      const { createAward, updateAward } = await import("@/mutations/awards");
      const { getAwardFormOptions, getAwards } =
        await import("@/queries/awards");
      const { warWeekId, neoId } = await warWeekWithParticipant(tx);
      const ctx = { warWeekId, actorEmail: "organizer@jahnelgroup.com" };
      const { id: serve } = await categoryNamed(tx, "Serve");
      const { id: grow } = await categoryNamed(tx, "Grow");
      const base = { description: null, teamId: null, participantIds: [neoId] };

      await createAward(
        { ...base, name: "Helper", categoryId: serve },
        ctx,
        tx,
      );
      expect(await archiveAwardCategory(serve, tx)).toEqual({ ok: true });
      expect(await archiveAwardCategory(serve, tx)).toEqual({ ok: true });

      const options = await getAwardFormOptions({ id: warWeekId }, tx);
      expect(options.categories.map((c) => c.name)).not.toContain("Serve");
      expect(options.categories.map((c) => c.name)).toContain("Grow");

      const [award] = await getAwards({ id: warWeekId }, tx);
      expect(award.category).toEqual({
        id: serve,
        name: "Serve",
        archived: true,
      });

      // Saving the Award with its archived Category is fine; another Award
      // can't newly pick it; switching away is fine too.
      expect(
        await updateAward(
          award.id,
          { ...base, name: "Helper", categoryId: serve },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await createAward(
          { ...base, name: "Other", categoryId: serve },
          ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "That Category is archived. Choose another.",
      });
      expect(
        await updateAward(
          award.id,
          { ...base, name: "Helper", categoryId: grow },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("restores an archived Category, and refuses one that isn't archived", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { archiveAwardCategory, restoreAwardCategory } =
        await import("@/mutations/award-categories");
      const { getAwardFormOptions } = await import("@/queries/awards");
      const { warWeekId } = await warWeekWithParticipant(tx);
      const { id } = await categoryNamed(tx, "Inspire");

      expect(await restoreAwardCategory(id, tx)).toEqual({
        ok: false,
        error: "That Category isn't archived.",
      });
      await archiveAwardCategory(id, tx);
      expect(await restoreAwardCategory(id, tx)).toEqual({ ok: true });
      expect((await categoryNamed(tx, "Inspire")).archived).toBe(false);
      const options = await getAwardFormOptions({ id: warWeekId }, tx);
      expect(options.categories.map((c) => c.name)).toContain("Inspire");
      expect(
        await restoreAwardCategory("00000000-0000-4000-8000-000000000000", tx),
      ).toEqual({ ok: false, error: "That Category no longer exists." });
    });
  });

  it("refuses an unknown Category on an Award and saves one with none", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAward } = await import("@/mutations/awards");
      const { getAwards } = await import("@/queries/awards");
      const { warWeekId, neoId } = await warWeekWithParticipant(tx);
      const ctx = { warWeekId, actorEmail: "organizer@jahnelgroup.com" };
      const base = { description: null, teamId: null, participantIds: [neoId] };

      expect(
        await createAward(
          {
            ...base,
            name: "MVP",
            categoryId: "00000000-0000-4000-8000-000000000000",
          },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "Choose a Category from the list." });
      expect(
        await createAward(
          { ...base, name: "Plain", categoryId: null },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect((await getAwards({ id: warWeekId }, tx))[0].category).toBeNull();
    });
  });
});
