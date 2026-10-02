import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const GOOGLE = "https://lh3.googleusercontent.com/a/surfaces-test";
const SET_URL = "https://images.example.test/me.png";

/** A free-for-all War Week: one Participant with a Profile, one without, one Award and Points Entry for each. */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "ps1",
      editionNumber: 9302,
      year: 9302,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Profile surfaces test",
      status: "upcoming",
      mode: "free-for-all",
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
    .returning({ id: schema.warWeek.id, mode: schema.warWeek.mode });
  const people = await tx
    .insert(schema.participant)
    .values([
      {
        warWeekId: warWeek.id,
        displayName: "Typed Name",
        email: "ps-set@jahnelgroup.com",
      },
      {
        warWeekId: warWeek.id,
        displayName: "Plain Name",
        email: "ps-plain@jahnelgroup.com",
      },
    ])
    .returning({ id: schema.participant.id });
  await tx.insert(schema.user).values({
    id: "ps-set",
    name: "x",
    email: "ps-set@jahnelgroup.com",
    image: GOOGLE,
  });
  await tx.insert(schema.profile).values({
    email: "ps-set@jahnelgroup.com",
    name: "Profile Name",
    imageUrl: SET_URL,
  });
  const [comp] = await tx
    .insert(schema.competition)
    .values({
      warWeekId: warWeek.id,
      name: "Darts",
      scoring: "individual",
      format: "points",
    })
    .returning({ id: schema.competition.id });
  await tx.insert(schema.pointsEntry).values(
    people.map((p) => ({
      competitionId: comp.id,
      participantId: p.id,
      points: 3,
      enteredByEmail: "org@jahnelgroup.com",
    })),
  );
  const [aw] = await tx
    .insert(schema.award)
    .values({ warWeekId: warWeek.id, name: "MVP" })
    .returning({ id: schema.award.id });
  await tx
    .insert(schema.awardParticipant)
    .values({ awardId: aw.id, participantId: people[0].id });
  return { warWeek, setId: people[0].id };
}

describe.skipIf(!isLocalDatabase)(
  "Profile name and picture on surfaces",
  () => {
    it("shows the Profile name and picture on the roster, Standings and Awards", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { getRoster } = await import("@/queries/roster");
        const { getStandings } = await import("@/queries/standings");
        const { getAwards } = await import("@/queries/awards");
        const { warWeek } = await fixture(tx);

        const roster = await getRoster(warWeek, tx);
        expect(roster.kind === "free-for-all" && roster.participants).toEqual([
          expect.objectContaining({ displayName: "Plain Name", image: null }),
          expect.objectContaining({
            displayName: "Profile Name",
            image: SET_URL,
          }),
        ]);

        const standings = await getStandings(warWeek, tx);
        expect(standings.individual.map((r) => [r.name, r.image])).toEqual([
          ["Plain Name", null],
          ["Profile Name", SET_URL],
        ]);

        const awards = await getAwards(warWeek, tx);
        expect(awards[0].participants).toEqual([
          expect.objectContaining({
            displayName: "Profile Name",
            image: SET_URL,
          }),
        ]);
      });
    });

    it("keeps the raw roster name on `getYouCandidates`", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { getYouCandidates } = await import("@/queries/roster");
        const { warWeek, setId } = await fixture(tx);

        const candidates = await getYouCandidates(warWeek, tx);
        expect(candidates.find((c) => c.id === setId)).toMatchObject({
          displayName: "Typed Name",
        });
      });
    });

    it("gives the roster form the Profile name and keeps the typed one", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { getSetupParticipants } = await import("@/queries/setup");
        const { warWeek } = await fixture(tx);

        const rows = await getSetupParticipants(warWeek, tx);
        expect(rows.map((r) => [r.displayName, r.profileName])).toEqual([
          ["Plain Name", null],
          ["Typed Name", "Profile Name"],
        ]);
      });
    });
  },
);
