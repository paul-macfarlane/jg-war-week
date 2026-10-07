import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { isJahnelGroupEmail } from "@/lib/access";

const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

/** One War Week with a Competition (Chess) and a Participant who hosts it. */
async function fixture(tx: DBTx, hostEmail: string | null) {
  const schema = await import("@/db/schema");
  const [ww] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "ho1",
      editionNumber: 9500,
      year: 9500,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Hosted competitions test",
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
  const [chess] = await tx
    .insert(schema.competition)
    .values({ warWeekId: ww.id, name: "Chess", scoring: "individual" })
    .returning({ id: schema.competition.id });
  const [tony] = await tx
    .insert(schema.participant)
    .values({ warWeekId: ww.id, displayName: "Tony", email: hostEmail })
    .returning({ id: schema.participant.id });
  await tx
    .insert(schema.competitionHost)
    .values({ competitionId: chess.id, participantId: tony.id });
  return { schema, warWeekId: ww.id, chessId: chess.id, tonyId: tony.id };
}

describe.skipIf(!isLocalDatabase)("getHostedCompetitions", () => {
  it("gives a Host no access until their roster entry has the email, then follows it, whatever its case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getHostedCompetitions } = await import("@/queries/organizers");
      const { schema, warWeekId, chessId, tonyId } = await fixture(tx, null);

      // Chosen with no email: nobody signs in as this Host yet.
      expect(await getHostedCompetitions("tony@jahnelgroup.com", tx)).toEqual(
        [],
      );

      await tx
        .update(schema.participant)
        .set({ email: "Tony@JahnelGroup.com" })
        .where(eq(schema.participant.id, tonyId));
      expect(await getHostedCompetitions("tony@jahnelgroup.com", tx)).toEqual([
        { competitionId: chessId, warWeekId },
      ]);
      expect(await getHostedCompetitions(" TONY@jahnelgroup.com ", tx)).toEqual(
        [{ competitionId: chessId, warWeekId }],
      );

      // Changing the roster email moves the Host access with it.
      await tx
        .update(schema.participant)
        .set({ email: "anna@jahnelgroup.com" })
        .where(eq(schema.participant.id, tonyId));
      expect(await getHostedCompetitions("tony@jahnelgroup.com", tx)).toEqual(
        [],
      );
      expect(await getHostedCompetitions("anna@jahnelgroup.com", tx)).toEqual([
        { competitionId: chessId, warWeekId },
      ]);
    });
  });

  it("gives a Host whose roster email isn't @jahnelgroup.com no access: sign-in rejects that email", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getHostedCompetitions } = await import("@/queries/organizers");
      await fixture(tx, "tony@gmail.com");

      expect(isJahnelGroupEmail("tony@gmail.com")).toBe(false);
      expect(await getHostedCompetitions("tony@gmail.com", tx)).toEqual([]);
    });
  });

  it("gives a Participant who hosts only a Schedule Item no Host role", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getHostedCompetitions } = await import("@/queries/organizers");
      const { schema, warWeekId, chessId } = await fixture(tx, null);
      const [sam] = await tx
        .insert(schema.participant)
        .values({
          warWeekId,
          displayName: "Sam",
          email: "sam@jahnelgroup.com",
        })
        .returning({ id: schema.participant.id });
      const [day] = await tx
        .insert(schema.day)
        .values({ warWeekId, date: "2099-01-02", dayTheme: "Day" })
        .returning({ id: schema.day.id });
      const [item] = await tx
        .insert(schema.scheduleItem)
        .values({ dayId: day.id, title: "Board games", category: "social" })
        .returning({ id: schema.scheduleItem.id });
      await tx
        .insert(schema.scheduleItemHost)
        .values({ scheduleItemId: item.id, participantId: sam.id });

      expect(await getHostedCompetitions("sam@jahnelgroup.com", tx)).toEqual(
        [],
      );

      // Hosting the Competition itself is what grants the role.
      await tx
        .insert(schema.competitionHost)
        .values({ competitionId: chessId, participantId: sam.id });
      expect(await getHostedCompetitions("sam@jahnelgroup.com", tx)).toEqual([
        { competitionId: chessId, warWeekId },
      ]);
    });
  });
});
