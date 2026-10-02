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

const actorEmail = "organizer@jahnelgroup.com";

/** Two War Weeks with no saved slide list. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [ww] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `fs${n}`,
        editionNumber: 9500 + n,
        year: 9500 + n,
        storyTheme: "Finale slides test",
        startDate: "2099-03-01",
        endDate: "2099-03-05",
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
    return ww.id;
  };
  const home = await warWeek(1);
  const other = await warWeek(2);
  return { schema, home, other, ctx: { warWeekId: home, actorEmail } };
}

async function listOf(warWeekId: string, tx: DBTx) {
  const { getFinaleSlides } = await import("@/queries/finale-slides");
  return getFinaleSlides(warWeekId, tx);
}

const names = (slides: { name: string; hidden: boolean }[]) =>
  slides.map((s) => (s.hidden ? `(${s.name})` : s.name));

describe.skipIf(!isLocalDatabase)("Finale slide mutations", () => {
  it("moves a built-in, saving the default list on the first change", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { moveFinaleSlide } = await import("@/mutations/finale-slides");
      const f = await fixture(tx);

      expect(
        await moveFinaleSlide({ kind: "standings" }, 0, f.ctx, tx),
      ).toEqual({ ok: true });

      const slides = await listOf(f.home, tx);
      expect(names(slides)).toEqual([
        "Standings countdown",
        "Title",
        "By the numbers",
        "Awards",
        "Champions",
        "Winner",
      ]);
      expect(slides.every((s) => s.id !== null)).toBe(true);
      // The other War Week still has no saved list.
      expect((await listOf(f.other, tx)).every((s) => s.id === null)).toBe(
        true,
      );
    });
  });

  it("moves a slide up and down by one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { moveFinaleSlide } = await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      await moveFinaleSlide({ kind: "winner" }, 4, f.ctx, tx);
      await moveFinaleSlide({ kind: "title" }, 1, f.ctx, tx);
      expect(names(await listOf(f.home, tx))).toEqual([
        "By the numbers",
        "Title",
        "Awards",
        "Champions",
        "Winner",
        "Standings countdown",
      ]);
    });
  });

  it("hides and shows a slide", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);

      expect(
        await setFinaleSlideHidden({ kind: "numbers" }, true, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(names(await listOf(f.home, tx))).toEqual([
        "Title",
        "(By the numbers)",
        "Awards",
        "Champions",
        "Standings countdown",
        "Winner",
      ]);

      await setFinaleSlideHidden({ kind: "numbers" }, false, f.ctx, tx);
      expect(
        (await listOf(f.home, tx)).every((s) => !s.hidden && s.id !== null),
      ).toBe(true);
    });
  });

  it("fills in a built-in missing from a saved list", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      await tx.insert(f.schema.finaleSlide).values([
        { warWeekId: f.home, kind: "standings", sortOrder: 0 },
        { warWeekId: f.home, kind: "title", sortOrder: 1 },
      ]);

      await setFinaleSlideHidden({ kind: "awards" }, true, f.ctx, tx);

      const slides = await listOf(f.home, tx);
      expect(names(slides)).toEqual([
        "Standings countdown",
        "Title",
        "By the numbers",
        "(Awards)",
        "Champions",
        "Winner",
      ]);
      expect(slides.every((s) => s.id !== null)).toBe(true);
    });
  });

  it("moves and hides a Custom slide by id, and refuses another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { moveFinaleSlide, setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      const [thanks] = await tx
        .insert(f.schema.finaleSlide)
        .values({
          warWeekId: f.home,
          kind: "custom",
          heading: "Thank you",
          sortOrder: 6,
        })
        .returning({ id: f.schema.finaleSlide.id });
      const [elsewhere] = await tx
        .insert(f.schema.finaleSlide)
        .values({
          warWeekId: f.other,
          kind: "custom",
          heading: "Elsewhere",
          sortOrder: 0,
        })
        .returning({ id: f.schema.finaleSlide.id });

      await moveFinaleSlide({ id: thanks.id }, 0, f.ctx, tx);
      await setFinaleSlideHidden({ id: thanks.id }, true, f.ctx, tx);
      expect(names(await listOf(f.home, tx))).toEqual([
        "(Thank you)",
        "Title",
        "By the numbers",
        "Awards",
        "Champions",
        "Standings countdown",
        "Winner",
      ]);

      const missing = {
        ok: false,
        error: "That Finale slide no longer exists.",
      };
      expect(await moveFinaleSlide({ id: elsewhere.id }, 0, f.ctx, tx)).toEqual(
        missing,
      );
      expect(
        await setFinaleSlideHidden({ id: elsewhere.id }, true, f.ctx, tx),
      ).toEqual(missing);
    });
  });
});

const body = {
  type: "doc" as const,
  content: [
    {
      type: "paragraph" as const,
      content: [{ type: "text" as const, text: "Hi" }],
    },
  ],
};

describe.skipIf(!isLocalDatabase)("Custom Finale slide mutations", () => {
  it("creates a Custom slide just before Standings, saving the default list first", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCustomFinaleSlide } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);

      expect(
        await createCustomFinaleSlide(
          { heading: "Thank you", body, backgroundColor: "#112233" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const slides = await listOf(f.home, tx);
      expect(names(slides)).toEqual([
        "Title",
        "By the numbers",
        "Awards",
        "Champions",
        "Thank you",
        "Standings countdown",
        "Winner",
      ]);
      expect(slides.every((s) => s.id !== null)).toBe(true);
      expect(slides[4]).toMatchObject({
        kind: "custom",
        heading: "Thank you",
        body,
        backgroundColor: "#112233",
      });
    });
  });

  it("puts a new slide before a hidden or moved Standings slide", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCustomFinaleSlide, moveFinaleSlide, setFinaleSlideHidden } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      await moveFinaleSlide({ kind: "standings" }, 1, f.ctx, tx);
      await setFinaleSlideHidden({ kind: "standings" }, true, f.ctx, tx);
      await createCustomFinaleSlide(
        { heading: "A", body, backgroundColor: null },
        f.ctx,
        tx,
      );
      expect(names(await listOf(f.home, tx)).slice(0, 3)).toEqual([
        "Title",
        "A",
        "(Standings countdown)",
      ]);
    });
  });

  it("refuses a heading another Custom slide of the War Week has, not another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCustomFinaleSlide } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      const values = { heading: "Thank you", body, backgroundColor: null };
      await createCustomFinaleSlide(values, f.ctx, tx);

      expect(await createCustomFinaleSlide(values, f.ctx, tx)).toEqual({
        ok: false,
        error: "There's already a Custom slide called Thank you.",
      });
      expect(
        await createCustomFinaleSlide(
          values,
          { ...f.ctx, warWeekId: f.other },
          tx,
        ),
      ).toEqual({ ok: true });
    });
  });

  it("updates a Custom slide in place, refusing another's heading", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCustomFinaleSlide, updateCustomFinaleSlide } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      await createCustomFinaleSlide(
        { heading: "One", body, backgroundColor: null },
        f.ctx,
        tx,
      );
      await createCustomFinaleSlide(
        { heading: "Two", body, backgroundColor: null },
        f.ctx,
        tx,
      );
      const [one, two] = (await listOf(f.home, tx)).filter(
        (s) => s.kind === "custom",
      );

      expect(
        await updateCustomFinaleSlide(
          one.id!,
          { heading: "One!", body, backgroundColor: "#abcdef" },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });
      expect(
        await updateCustomFinaleSlide(
          one.id!,
          { heading: "Two", body, backgroundColor: null },
          f.ctx,
          tx,
        ),
      ).toEqual({
        ok: false,
        error: "There's already a Custom slide called Two.",
      });
      // Saving a slide under its own heading is not a duplicate.
      expect(
        await updateCustomFinaleSlide(
          two.id!,
          { heading: "Two", body, backgroundColor: null },
          f.ctx,
          tx,
        ),
      ).toEqual({ ok: true });

      const customs = (await listOf(f.home, tx)).filter(
        (s) => s.kind === "custom",
      );
      expect(customs.map((s) => [s.heading, s.backgroundColor])).toEqual([
        ["One!", "#abcdef"],
        ["Two", null],
      ]);
    });
  });

  it("deletes a Custom slide, never a built-in or another War Week's", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { createCustomFinaleSlide, deleteCustomFinaleSlide } =
        await import("@/mutations/finale-slides");
      const f = await fixture(tx);
      await createCustomFinaleSlide(
        { heading: "Gone", body, backgroundColor: null },
        f.ctx,
        tx,
      );
      await createCustomFinaleSlide(
        { heading: "Elsewhere", body, backgroundColor: null },
        { ...f.ctx, warWeekId: f.other },
        tx,
      );
      const list = await listOf(f.home, tx);
      const gone = list.find((s) => s.kind === "custom")!;
      const title = list.find((s) => s.kind === "title")!;
      const elsewhere = (await listOf(f.other, tx)).find(
        (s) => s.kind === "custom",
      )!;
      const missing = {
        ok: false,
        error: "That Finale slide no longer exists.",
      };

      expect(await deleteCustomFinaleSlide(title.id!, f.ctx, tx)).toEqual(
        missing,
      );
      expect(await deleteCustomFinaleSlide(elsewhere.id!, f.ctx, tx)).toEqual(
        missing,
      );
      expect(await deleteCustomFinaleSlide(gone.id!, f.ctx, tx)).toEqual({
        ok: true,
      });
      expect(names(await listOf(f.home, tx))).toEqual([
        "Title",
        "By the numbers",
        "Awards",
        "Champions",
        "Standings countdown",
        "Winner",
      ]);
    });
  });
});
