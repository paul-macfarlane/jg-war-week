import { eq } from "drizzle-orm";
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

const emptyBody = { type: "doc" as const, content: [] };

/** Two War Weeks, so mutations can be proven scoped by id and War Week. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `t${n}`,
        editionNumber: 9000 + n,
        year: 9000 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Mutation test",
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
    return { warWeekId: row.id };
  };
  return { home: await warWeek(1), other: await warWeek(2), schema };
}

const actorEmail = "organizer@jahnelgroup.com";

describe.skipIf(!isLocalDatabase)("Announcement mutations", () => {
  it("creates an Announcement, recording the author and published-at", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAnnouncement } = await import("@/mutations/announcements");
      const { home, schema } = await fixture(tx);

      const result = await createAnnouncement(
        {
          title: "Kickoff",
          body: emptyBody,
          videoUrls: ["https://youtu.be/abc123"],
          pinned: true,
        },
        { warWeekId: home.warWeekId, actorEmail },
        tx,
      );

      expect(result).toEqual({ ok: true });
      const rows = await tx
        .select()
        .from(schema.announcement)
        .where(eq(schema.announcement.warWeekId, home.warWeekId));
      expect(rows).toMatchObject([
        {
          title: "Kickoff",
          videoUrls: ["https://youtu.be/abc123"],
          pinned: true,
          authorEmail: actorEmail,
          warWeekId: home.warWeekId,
        },
      ]);
      expect(rows[0].publishedAt).toBeInstanceOf(Date);
    });
  });

  it("edits and deletes only Announcements of the War Week, keeping the author", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAnnouncement, deleteAnnouncement, updateAnnouncement } =
        await import("@/mutations/announcements");
      const { home, other, schema } = await fixture(tx);

      await createAnnouncement(
        { title: "Kickoff", body: emptyBody, videoUrls: [], pinned: false },
        { warWeekId: home.warWeekId, actorEmail },
        tx,
      );
      const [{ id }] = await tx
        .select({ id: schema.announcement.id })
        .from(schema.announcement)
        .where(eq(schema.announcement.warWeekId, home.warWeekId));

      const edited = {
        title: "Kickoff (updated)",
        body: emptyBody,
        videoUrls: [],
        pinned: true,
      };
      const editor = {
        warWeekId: home.warWeekId,
        actorEmail: "b@jahnelgroup.com",
      };
      const elsewhere = { warWeekId: other.warWeekId, actorEmail };

      expect(await updateAnnouncement(id, edited, elsewhere, tx)).toEqual({
        ok: false,
        error: "That Announcement no longer exists.",
      });
      expect(await updateAnnouncement(id, edited, editor, tx)).toEqual({
        ok: true,
      });
      const [row] = await tx
        .select()
        .from(schema.announcement)
        .where(eq(schema.announcement.id, id));
      expect(row).toMatchObject({
        title: "Kickoff (updated)",
        pinned: true,
        authorEmail: actorEmail,
      });

      expect(await deleteAnnouncement(id, elsewhere, tx)).toEqual({
        ok: false,
        error: "That Announcement no longer exists.",
      });
      expect(await deleteAnnouncement(id, editor, tx)).toEqual({ ok: true });
      expect(
        await tx
          .select()
          .from(schema.announcement)
          .where(eq(schema.announcement.id, id)),
      ).toEqual([]);
    });
  });

  it("pins and unpins only an Announcement of the War Week", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createAnnouncement, setAnnouncementPinned } =
        await import("@/mutations/announcements");
      const { home, other, schema } = await fixture(tx);

      await createAnnouncement(
        { title: "Kickoff", body: emptyBody, videoUrls: [], pinned: false },
        { warWeekId: home.warWeekId, actorEmail },
        tx,
      );
      const [{ id }] = await tx
        .select({ id: schema.announcement.id })
        .from(schema.announcement)
        .where(eq(schema.announcement.warWeekId, home.warWeekId));

      expect(
        await setAnnouncementPinned(
          id,
          true,
          { warWeekId: other.warWeekId, actorEmail },
          tx,
        ),
      ).toEqual({ ok: false, error: "That Announcement no longer exists." });

      expect(
        await setAnnouncementPinned(
          id,
          true,
          { warWeekId: home.warWeekId, actorEmail },
          tx,
        ),
      ).toEqual({ ok: true });
      const [pinned] = await tx
        .select()
        .from(schema.announcement)
        .where(eq(schema.announcement.id, id));
      expect(pinned.pinned).toBe(true);

      expect(
        await setAnnouncementPinned(
          id,
          false,
          { warWeekId: home.warWeekId, actorEmail },
          tx,
        ),
      ).toEqual({ ok: true });
      const [unpinned] = await tx
        .select()
        .from(schema.announcement)
        .where(eq(schema.announcement.id, id));
      expect(unpinned.pinned).toBe(false);
    });
  });
});
