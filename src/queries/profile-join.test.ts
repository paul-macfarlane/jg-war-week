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

const GOOGLE = "https://lh3.googleusercontent.com/a/profile-join-test";
const SET_URL = "https://images.example.test/me.png";

/**
 * A War Week with four Participants: one with a Profile (name and picture)
 * and a Google photo, one with only a Google photo (its roster email in
 * mixed case), one whose `user.image` isn't a Google photo, and one with no
 * email at all.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "pj1",
      editionNumber: 9301,
      year: 9301,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Profile join test",
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
  await tx.insert(schema.participant).values([
    {
      warWeekId: warWeek.id,
      displayName: "Set R",
      email: "pj-set@jahnelgroup.com",
    },
    {
      warWeekId: warWeek.id,
      displayName: "Google R",
      email: "PJ-Google@JahnelGroup.com",
    },
    {
      warWeekId: warWeek.id,
      displayName: "Other R",
      email: "pj-other@jahnelgroup.com",
    },
    { warWeekId: warWeek.id, displayName: "Nobody R" },
  ]);
  await tx.insert(schema.user).values([
    { id: "pj-set", name: "x", email: "pj-set@jahnelgroup.com", image: GOOGLE },
    {
      id: "pj-google",
      name: "x",
      email: "pj-google@jahnelgroup.com",
      image: GOOGLE,
    },
    {
      id: "pj-other",
      name: "x",
      email: "pj-other@jahnelgroup.com",
      image: "https://evil.example.com/x.png",
    },
  ]);
  await tx.insert(schema.profile).values({
    email: "pj-set@jahnelgroup.com",
    name: "Set Profile",
    imageUrl: SET_URL,
  });
  return warWeek.id;
}

describe.skipIf(!isLocalDatabase)("profile join", () => {
  it("resolves each Participant's shown name and picture in SQL", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { participant } = await import("@/db/schema");
      const { eq } = await import("drizzle-orm");
      const { participantImageSql, participantNameSql, withProfile } =
        await import("@/queries/profile-join");
      const warWeekId = await fixture(tx);

      const rows = await withProfile(
        tx
          .select({
            roster: participant.displayName,
            name: participantNameSql(),
            image: participantImageSql(),
          })
          .from(participant)
          .where(eq(participant.warWeekId, warWeekId))
          .orderBy(participant.displayName)
          .$dynamic(),
      );

      expect(rows).toEqual([
        { roster: "Google R", name: "Google R", image: GOOGLE },
        { roster: "Nobody R", name: "Nobody R", image: null },
        { roster: "Other R", name: "Other R", image: null },
        { roster: "Set R", name: "Set Profile", image: SET_URL },
      ]);
    });
  });

  it("loads Profiles and Google photos by email, ignoring case", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getProfilesByEmail } = await import("@/queries/profile-join");
      await fixture(tx);

      const profiles = await getProfilesByEmail(
        ["PJ-SET@jahnelgroup.com", "pj-google@jahnelgroup.com", "x@y.z"],
        tx,
      );

      expect(Object.fromEntries(profiles)).toEqual({
        "pj-set@jahnelgroup.com": {
          profileName: "Set Profile",
          profileImage: SET_URL,
          googleImage: GOOGLE,
        },
        "pj-google@jahnelgroup.com": {
          profileName: null,
          profileImage: null,
          googleImage: GOOGLE,
        },
      });
    });
  });

  it("refuses a Profile email that isn't lowercase", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { profile } = await import("@/db/schema");
      await expect(
        tx.insert(profile).values({ email: "Mixed@jahnelgroup.com" }),
      ).rejects.toThrow();
    });
  });
});
