import { asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
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
    hostIds: [],
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

/** The fixture plus roster Participants: Ana and Ben at home, Cal elsewhere. */
async function hostFixture(tx: DBTx) {
  const f = await fixture(tx);
  const { participant, scheduleItem, scheduleItemHost } = f.schema;
  const [ana, ben] = await tx
    .insert(participant)
    .values([
      {
        warWeekId: f.home.warWeekId,
        displayName: "Ana",
        email: "ana@jahnelgroup.com",
      },
      { warWeekId: f.home.warWeekId, displayName: "Ben" },
    ])
    .returning({ id: participant.id });
  const [cal] = await tx
    .insert(participant)
    .values({ warWeekId: f.other.warWeekId, displayName: "Cal" })
    .returning({ id: participant.id });
  /** An unlinked item, so it may have its own Hosts. */
  const social: ScheduleItemValues = {
    ...f.item,
    title: "Board games",
    category: "social",
    competitionId: null,
  };
  const itemId = async (title: string) =>
    (
      await tx
        .select({ id: scheduleItem.id })
        .from(scheduleItem)
        .where(eq(scheduleItem.title, title))
    )[0]?.id;
  const hostIdsOf = async (id: string) =>
    (
      await tx
        .select({ participantId: scheduleItemHost.participantId })
        .from(scheduleItemHost)
        .where(eq(scheduleItemHost.scheduleItemId, id))
    )
      .map((row) => row.participantId)
      .sort();
  return {
    ...f,
    anaId: ana.id,
    benId: ben.id,
    calId: cal.id,
    social,
    itemId,
    hostIdsOf,
  };
}

describe.skipIf(!isLocalDatabase)("Schedule Item Hosts", () => {
  it("saves an unlinked item's Hosts, replaces them on edit, and getSchedule shows them by name, never an email", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { getSchedule } = await import("@/queries/schedule");
      const f = await hostFixture(tx);

      expect(
        await createScheduleItem(
          { ...f.social, hostIds: [f.anaId, f.benId] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      const id = await f.itemId("Board games");
      expect(await f.hostIdsOf(id)).toEqual([f.anaId, f.benId].sort());

      const [day] = await getSchedule(f.home.warWeekId, {}, tx);
      expect(day.items[0].hosts).toEqual([
        { id: f.anaId, displayName: "Ana", image: null, teamColor: null },
        { id: f.benId, displayName: "Ben", image: null, teamColor: null },
      ]);
      expect(JSON.stringify(day)).not.toContain("ana@jahnelgroup.com");

      expect(
        await updateScheduleItem(
          id,
          { ...f.social, hostIds: [f.benId] },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.hostIdsOf(id)).toEqual([f.benId]);
    });
  });

  it("refuses a Host from another War Week's roster, on create and on edit", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const f = await hostFixture(tx);
      const refusal = {
        ok: false,
        error: "A Host must be on this War Week's roster.",
      };

      expect(
        await createScheduleItem(
          { ...f.social, hostIds: [f.anaId, f.calId] },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);
      expect(await f.itemId("Board games")).toBeUndefined();

      await createScheduleItem({ ...f.social, hostIds: [f.anaId] }, f.ctx, tx);
      const id = await f.itemId("Board games");
      expect(
        await updateScheduleItem(
          id,
          { ...f.social, hostIds: [f.calId] },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);
      expect(await f.hostIdsOf(id)).toEqual([f.anaId]);
    });
  });

  it("discards Hosts posted with a Competition, and linking a Competition deletes the item's Hosts", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { getSchedule } = await import("@/queries/schedule");
      const f = await hostFixture(tx);
      const linked = { ...f.item, hostIds: [f.anaId] };

      // Posted with a Competition: saved, but no Host row.
      expect(await createScheduleItem(linked, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(await f.hostIdsOf(await f.itemId("Kickoff"))).toEqual([]);

      // An unlinked item with Hosts, then linked to the Competition.
      await createScheduleItem(
        { ...f.social, hostIds: [f.anaId, f.benId] },
        f.ctx,
        tx,
      );
      const id = await f.itemId("Board games");
      expect(await f.hostIdsOf(id)).toHaveLength(2);
      expect(
        await updateScheduleItem(
          id,
          {
            ...f.social,
            category: "competition",
            competitionId: f.home.competitionId,
            hostIds: [f.anaId],
          },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(await f.hostIdsOf(id)).toEqual([]);

      // A linked item shows its Competition's Hosts instead.
      await tx.insert(f.schema.competitionHost).values({
        competitionId: f.home.competitionId,
        participantId: f.benId,
      });
      const [day] = await getSchedule(f.home.warWeekId, {}, tx);
      expect(day.items.map((item) => item.hosts.map((h) => h.id))).toEqual([
        [f.benId],
        [f.benId],
      ]);
    });
  });

  it("refuses a second untimed item with the same title on a Day, in the untimed wording", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const { getSchedule } = await import("@/queries/schedule");
      const f = await hostFixture(tx);
      const untimed = { ...f.social, startTime: null, endTime: null };

      expect(await createScheduleItem(untimed, f.ctx, tx)).toEqual({
        ok: true,
      });
      const [day] = await getSchedule(f.home.warWeekId, {}, tx);
      expect(day.items[0]).toMatchObject({
        title: "Board games",
        startTime: null,
      });

      const refusal = {
        ok: false,
        error:
          'There\'s already a Schedule Item "Board games" with no start time on that Day.',
      };
      expect(await createScheduleItem(untimed, f.ctx, tx)).toEqual(refusal);

      // A timed "Board games" is another key, but can't become untimed.
      await createScheduleItem(f.social, f.ctx, tx);
      const timed = (await getSchedule(f.home.warWeekId, {}, tx))[0].items.find(
        (item) => item.startTime !== null,
      )!;
      expect(await updateScheduleItem(timed.id, untimed, f.ctx, tx)).toEqual(
        refusal,
      );
    });
  });

  it("refuses a Competition on any category but Competition", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createScheduleItem, updateScheduleItem } =
        await import("@/mutations/setup-schedule-faq");
      const f = await hostFixture(tx);
      const refusal = {
        ok: false,
        error: "Only a Competition item can link a Competition.",
      };

      expect(
        await createScheduleItem({ ...f.item, category: "social" }, f.ctx, tx),
      ).toEqual(refusal);
      expect(await f.itemId("Kickoff")).toBeUndefined();

      await createScheduleItem(f.item, f.ctx, tx);
      expect(
        await updateScheduleItem(
          await f.itemId("Kickoff"),
          { ...f.item, category: "meal" },
          f.ctx,
          tx,
        ),
      ).toEqual(refusal);
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
