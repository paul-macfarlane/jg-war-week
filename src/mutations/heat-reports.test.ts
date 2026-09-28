import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const actorEmail = "organizer@jahnelgroup.com";

/** A War Week with a team single-elimination Competition and a points one. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `t${n}`,
        editionNumber: 9100 + n,
        year: 9100 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Self-report test",
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
    return row.id;
  };
  const warWeekId = await warWeek(1);
  const otherWarWeekId = await warWeek(2);
  const [bracket, points] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Cypher",
        scoring: "team",
        format: "single-elimination",
      },
      { warWeekId, name: "Trivia", scoring: "team", format: "points" },
    ])
    .returning({ id: schema.competition.id });
  const selfReportOf = async (id: string) =>
    (
      await tx
        .select({ selfReport: schema.competition.selfReport })
        .from(schema.competition)
        .where(eq(schema.competition.id, id))
    )[0].selfReport;
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    otherCtx: { warWeekId: otherWarWeekId, actorEmail },
    competitionId: bracket.id,
    pointsId: points.id,
    selfReportOf,
  };
}

describe.skipIf(!isLocalDatabase)("setSelfReport", () => {
  it("is off by default, and turns on and off", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);
      expect(await f.selfReportOf(f.competitionId)).toBe(false);

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(true);

      expect(
        await setSelfReport(f.competitionId, { on: false }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(false);
    });
  });

  it("is allowed while the Bracket is finalized", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);
      await tx
        .update(f.schema.competition)
        .set({ finalizedAt: new Date() })
        .where(eq(f.schema.competition.id, f.competitionId));

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.ctx, tx),
      ).toEqual({ ok: true });
      expect(await f.selfReportOf(f.competitionId)).toBe(true);
    });
  });

  it("refuses a points Competition and one of another War Week, changing nothing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { setSelfReport } = await import("@/mutations/heat-reports");
      const f = await fixture(tx);

      expect(await setSelfReport(f.pointsId, { on: true }, f.ctx, tx)).toEqual({
        ok: false,
        error: "This Competition isn't run as a Bracket.",
      });
      expect(await f.selfReportOf(f.pointsId)).toBe(false);

      expect(
        await setSelfReport(f.competitionId, { on: true }, f.otherCtx, tx),
      ).toEqual({ ok: false, error: "That Competition no longer exists." });
      expect(await f.selfReportOf(f.competitionId)).toBe(false);
    });
  });
});
