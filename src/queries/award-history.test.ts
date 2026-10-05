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
      storyTheme: "Award history test",
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

describe.skipIf(!isLocalDatabase)("getAwardNameHistory", () => {
  it("lists a name's Awards in every War Week newest first, case-insensitively, with Profile names where linked", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { getAwardNameHistory, getAwardNamesWithHistory } =
        await import("@/queries/award-history");

      const older = await warWeekWith(tx, 1, "complete");
      const newer = await warWeekWith(tx, 2, "upcoming");
      await tx.insert(schema.profile).values({
        email: "ah-linked@jahnelgroup.com",
        name: "Neo Anderson",
      });
      const [linked, roster] = await tx
        .insert(schema.participant)
        .values([
          {
            warWeekId: newer.id,
            displayName: "Tom",
            email: "ah-linked@jahnelgroup.com",
          },
          { warWeekId: older.id, displayName: "Trinity" },
        ])
        .returning({ id: schema.participant.id });
      const [first, second] = await tx
        .insert(schema.award)
        .values([
          { warWeekId: newer.id, name: "History Test Champ" },
          { warWeekId: older.id, name: "history test CHAMP" },
          {
            warWeekId: older.id,
            name: "History Test Champ Team",
            teamId: older.teamId,
          },
          {
            warWeekId: older.id,
            name: "History Test Elsewhere",
            teamId: older.teamId,
          },
        ])
        .returning({ id: schema.award.id });
      await tx.insert(schema.awardParticipant).values([
        { awardId: first.id, participantId: linked.id },
        { awardId: second.id, participantId: roster.id },
      ]);

      const history = await getAwardNameHistory("history-test-champ", tx);
      expect(history?.name).toBe("History Test Champ");
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
        ["h2", [["History Test Champ", null, ["Neo Anderson"]]]],
        ["h1", [["history test CHAMP", null, ["Trinity"]]]],
      ]);

      const listed = await getAwardNamesWithHistory(tx);
      expect(listed).toContainEqual({
        slug: "history-test-champ",
        name: "History Test Champ",
      });
      expect(listed).toContainEqual({
        slug: "history-test-elsewhere",
        name: "History Test Elsewhere",
      });
      expect(
        listed.filter((n) => n.slug === "history-test-champ"),
      ).toHaveLength(1);
    });
  });

  it("is null for an unknown slug and for an old Category id", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getAwardNameHistory } = await import("@/queries/award-history");
      expect(await getAwardNameHistory("no-such-award-name", tx)).toBeNull();
      expect(
        await getAwardNameHistory("00000000-0000-4000-8000-000000000000", tx),
      ).toBeNull();
      expect(await getAwardNameHistory("", tx)).toBeNull();
      expect(await getAwardNameHistory("Not A Slug", tx)).toBeNull();
    });
  });
});

describe.skipIf(!isLocalDatabase)("getAwardPresets", () => {
  it("offers past names once with the most recent description, and the seven former Category names", async () => {
    await inRolledBackTransaction(async (tx) => {
      const schema = await import("@/db/schema");
      const { getAwardPresets } = await import("@/queries/awards");
      const older = await warWeekWith(tx, 1, "complete");
      const newer = await warWeekWith(tx, 2, "upcoming");
      await tx.insert(schema.award).values([
        {
          warWeekId: older.id,
          name: "preset test award",
          description: "Older words",
          teamId: older.teamId,
        },
        {
          warWeekId: newer.id,
          name: "Preset Test Award",
          description: "Newer words",
          teamId: newer.teamId,
        },
      ]);
      const presets = await getAwardPresets(tx);
      expect(
        presets.filter((p) => p.name.toLowerCase() === "preset test award"),
      ).toEqual([{ name: "Preset Test Award", description: "Newer words" }]);
      for (const name of [
        "War Week MVP",
        "Billable Hours Champ",
        "Black Midnight",
        "Grow",
        "Grind",
        "Serve",
        "Inspire",
      ]) {
        expect(presets.map((p) => p.name)).toContain(name);
      }
    });
  });
});
