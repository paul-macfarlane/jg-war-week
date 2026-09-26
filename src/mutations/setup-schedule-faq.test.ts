import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import type {
  FaqItemValues,
  ScheduleItemValues,
} from "@/lib/setup-schedule-faq";

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

const doc = (text: string) => ({
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [{ type: "text" as const, text }],
    },
  ],
});

/** Two War Weeks, each with one Day and one Competition. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [ww] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `f${n}`,
        editionNumber: 9300 + n,
        year: 9300 + n,
        storyTheme: "Schedule test",
        startDate: "2099-02-01",
        endDate: "2099-02-05",
        status: "upcoming",
        mode: "teams",
        teamLabel: "Team",
        leaderTitle: "Captain",
        slackChannelUrl: "https://example.slack.com/archives/x",
        primaryColor: "#123456",
        primaryForegroundColor: "#ffffff",
        accentColor: "#000000",
        backgroundColor: "#ffffff",
        foregroundColor: "#000000",
        fontPreset: "sans",
        organizerEmails: [actorEmail],
      })
      .returning({ id: schema.warWeek.id });
    const [d] = await tx
      .insert(schema.day)
      .values({ warWeekId: ww.id, date: "2099-02-02", dayTheme: "Day" })
      .returning({ id: schema.day.id });
    const [c] = await tx
      .insert(schema.competition)
      .values({
        warWeekId: ww.id,
        name: `Chess ${n}`,
        scoring: "team",
      })
      .returning({ id: schema.competition.id });
    return { warWeekId: ww.id, dayId: d.id, competitionId: c.id };
  };
  const home = await warWeek(1);
  const other = await warWeek(2);
  const ctx = { warWeekId: home.warWeekId, actorEmail };
  const item: ScheduleItemValues = {
    dayId: home.dayId,
    startTime: "09:00",
    endTime: "10:00",
    title: "Kickoff",
    host: null,
    location: null,
    virtualLink: null,
    category: "competition",
    competitionId: home.competitionId,
    description: doc("Hello"),
  };
  return { schema, home, other, ctx, item };
}

describe.skipIf(!isLocalDatabase)("Schedule Item mutations", () => {
  it("creates, edits and deletes a Schedule Item that getSchedule shows", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem, deleteScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { getSchedule } = await import("@/queries/schedule");
      const { home, ctx, item } = await fixture(tx);

      expect(await createScheduleItem(item, ctx, tx)).toEqual({ ok: true });
      const [day] = await getSchedule(home.warWeekId, {}, tx);
      expect(day.items).toMatchObject([
        {
          title: "Kickoff",
          startTime: "09:00:00",
          competition: { id: home.competitionId },
        },
      ]);

      const id = day.items[0].id;
      expect(
        await updateScheduleItem(
          id,
          { ...item, title: "Opening", competitionId: null },
          ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      const [edited] = await getSchedule(home.warWeekId, {}, tx);
      expect(edited.items).toMatchObject([
        { title: "Opening", competition: null },
      ]);

      expect(await deleteScheduleItem(id, ctx, tx)).toEqual({ ok: true });
      const [emptied] = await getSchedule(home.warWeekId, {}, tx);
      expect(emptied.items).toEqual([]);
    });
  });

  it("refuses a duplicate key and another War Week's Day or Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { other, ctx, item } = await fixture(tx);

      await createScheduleItem(item, ctx, tx);
      expect(await createScheduleItem(item, ctx, tx)).toEqual({
        ok: false,
        error:
          'There\'s already a Schedule Item "Kickoff" at 9:00 AM on that Day.',
      });
      expect(
        await createScheduleItem({ ...item, dayId: other.dayId }, ctx, tx),
      ).toEqual({ ok: false, error: "That Day no longer exists." });
      expect(
        await createScheduleItem(
          { ...item, title: "Other", competitionId: other.competitionId },
          ctx,
          tx,
        ),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
    });
  });

  it("won't touch another War Week's Schedule Item", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem, deleteScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { schema, other, ctx, item } = await fixture(tx);
      const otherCtx = { warWeekId: other.warWeekId, actorEmail };
      await createScheduleItem(
        { ...item, dayId: other.dayId, competitionId: null },
        otherCtx,
        tx,
      );
      const [row] = await tx
        .select({ id: schema.scheduleItem.id })
        .from(schema.scheduleItem)
        .where(eq(schema.scheduleItem.dayId, other.dayId));

      const refusal = {
        ok: false,
        error: "That Schedule Item no longer exists.",
      };
      expect(
        await updateScheduleItem(
          row.id,
          { ...item, competitionId: null },
          ctx,
          tx,
        ),
      ).toEqual(refusal);
      expect(await deleteScheduleItem(row.id, ctx, tx)).toEqual(refusal);
    });
  });
});

describe.skipIf(!isLocalDatabase)("FAQ Item mutations", () => {
  const faq = (question: string): FaqItemValues => ({
    question,
    answer: doc("Answer"),
  });

  it("appends, edits, reorders and deletes FAQ Items", async () => {
    await inRolledBackTransaction(async (tx) => {
      const m = await import("@/mutations/setup-schedule-faq");
      const { getFaqItems } = await import("@/queries/faq");
      const { home, ctx } = await fixture(tx);
      const ww = { id: home.warWeekId };
      const questions = async () =>
        (await getFaqItems(ww, tx)).map((f) => f.question);

      for (const q of ["A?", "B?", "C?"]) {
        expect(await m.createFaqItem(faq(q), ctx, tx)).toEqual({ ok: true });
      }
      expect(await questions()).toEqual(["A?", "B?", "C?"]);

      const [, b, c] = await getFaqItems(ww, tx);
      expect(await m.moveFaqItem(c.id, "up", ctx, tx)).toEqual({ ok: true });
      expect(await questions()).toEqual(["A?", "C?", "B?"]);
      expect(await m.moveFaqItem(b.id, "down", ctx, tx)).toEqual({
        ok: true,
      });
      expect(await questions()).toEqual(["A?", "C?", "B?"]);

      expect(await m.updateFaqItem(b.id, faq("Bee?"), ctx, tx)).toEqual({
        ok: true,
      });
      expect(await m.deleteFaqItem(c.id, ctx, tx)).toEqual({ ok: true });
      expect(await questions()).toEqual(["A?", "Bee?"]);
    });
  });

  it("refuses a duplicate question and another War Week's FAQ Item", async () => {
    await inRolledBackTransaction(async (tx) => {
      const m = await import("@/mutations/setup-schedule-faq");
      const { schema, other, ctx } = await fixture(tx);

      await m.createFaqItem(faq("Parking?"), ctx, tx);
      expect(await m.createFaqItem(faq("Parking?"), ctx, tx)).toEqual({
        ok: false,
        error: 'There\'s already an FAQ Item "Parking?".',
      });

      await m.createFaqItem(
        faq("Theirs?"),
        { warWeekId: other.warWeekId, actorEmail },
        tx,
      );
      const [theirs] = await tx
        .select({ id: schema.faqItem.id })
        .from(schema.faqItem)
        .where(eq(schema.faqItem.warWeekId, other.warWeekId))
        .orderBy(asc(schema.faqItem.sortOrder));
      const refusal = { ok: false, error: "That FAQ Item no longer exists." };
      expect(await m.updateFaqItem(theirs.id, faq("Mine?"), ctx, tx)).toEqual(
        refusal,
      );
      expect(await m.moveFaqItem(theirs.id, "up", ctx, tx)).toEqual(refusal);
      expect(await m.deleteFaqItem(theirs.id, ctx, tx)).toEqual(refusal);
    });
  });
});
