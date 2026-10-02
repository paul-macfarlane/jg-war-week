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

async function warWeekWith(
  tx: DBTx,
  n: number,
  status: "complete" | "upcoming",
) {
  const schema = await import("@/db/schema");
  const [row] = await tx
    .insert(schema.warWeek)
    .values({
      edition: `h${n}`,
      editionNumber: 9600 + n,
      year: 9600 + n,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Category history test",
      status,
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
  const [red] = await tx
    .insert(schema.team)
    .values({ warWeekId: row.id, name: "Red", color: "#f00" })
    .returning({ id: schema.team.id });
  return { id: row.id, teamId: red.id };
}

describe.skipIf(!isLocalDatabase)("getCategoryHistory", () => {
  it("lists every War Week's Awards newest first, with Profile names where linked", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const { getCategoryHistory, getCategoriesWithAwards } =
        await import("@/queries/award-category-history");
      const [mvp] = await tx
        .select({ id: schema.awardCategory.id })
        .from(schema.awardCategory)
        .where(eq(schema.awardCategory.key, "war-week-mvp"));
      const [grow] = await tx
        .select({ id: schema.awardCategory.id })
        .from(schema.awardCategory)
        .where(eq(schema.awardCategory.key, "grow"));

      const older = await warWeekWith(tx, 1, "complete");
      const newer = await warWeekWith(tx, 2, "upcoming");
      await tx.insert(schema.profile).values({
        email: "ch-linked@jahnelgroup.com",
        name: "Neo Anderson",
      });
      const [linked, roster] = await tx
        .insert(schema.participant)
        .values([
          {
            warWeekId: newer.id,
            displayName: "Tom",
            email: "ch-linked@jahnelgroup.com",
          },
          { warWeekId: older.id, displayName: "Trinity" },
        ])
        .returning({ id: schema.participant.id });
      const [first, second] = await tx
        .insert(schema.award)
        .values([
          { warWeekId: newer.id, name: "War Week MVP", categoryId: mvp.id },
          { warWeekId: older.id, name: "MVP 1st Place", categoryId: mvp.id },
          {
            warWeekId: older.id,
            name: "MVP Team",
            categoryId: mvp.id,
            teamId: older.teamId,
          },
        ])
        .returning({ id: schema.award.id });
      await tx.insert(schema.awardParticipant).values([
        { awardId: first.id, participantId: linked.id },
        { awardId: second.id, participantId: roster.id },
      ]);
      await tx.insert(schema.award).values({
        warWeekId: older.id,
        name: "Elsewhere",
        categoryId: grow.id,
        teamId: older.teamId,
      });

      const history = await getCategoryHistory(mvp.id, tx);
      expect(history?.category).toEqual({
        id: mvp.id,
        name: "War Week MVP",
        archived: false,
      });
      expect(
        history?.warWeeks.map((w) => [
          w.edition,
          w.awards.map((a) => [
            a.name,
            a.team?.name ?? null,
            a.participants.map((p) => p.displayName),
          ]),
        ]),
      ).toEqual([
        ["h2", [["War Week MVP", null, ["Neo Anderson"]]]],
        [
          "h1",
          [
            ["MVP 1st Place", null, ["Trinity"]],
            ["MVP Team", "Red", []],
          ],
        ],
      ]);

      const listed = await getCategoriesWithAwards(tx);
      expect(listed.map((c) => c.id)).toEqual(
        expect.arrayContaining([mvp.id, grow.id]),
      );
      expect(listed.map((c) => c.name)).not.toContain("Serve");
    });
  });

  it("is null for an unknown Category", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getCategoryHistory } =
        await import("@/queries/award-category-history");
      expect(
        await getCategoryHistory("00000000-0000-4000-8000-000000000000", tx),
      ).toBeNull();
    });
  });
});
