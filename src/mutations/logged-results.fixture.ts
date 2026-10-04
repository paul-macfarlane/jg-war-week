import { eq } from "drizzle-orm";

import type { DBTx } from "@/db";

export const NEO = "neo@jahnelgroup.com";
export const TRINITY = "trinity@jahnelgroup.com";
export const MORPHEUS = "morpheus@jahnelgroup.com";
export const NOBODY = "nobody@jahnelgroup.com";
export const HOST = "logged-test-host@jahnelgroup.com";
export const ORGANIZER = "logged-test-organizer@jahnelgroup.com";

/**
 * A War Week with Red (Neo, Morpheus) and Blue (Trinity, Cypher with no
 * email), Dozer on no Team, a second War Week with Smith, and five
 * Competitions: Pong (individual Head-to-head, Neo vs Trinity, Best of 3),
 * Relay (team Head-to-head, Red vs Blue, Best of 3, draws on), Bowl
 * (individual Best score, higher is better, "pins"), Stairs (team Best
 * score, Sum of members) and Trivia (Placement). Pong and Bowl give 10, 6,
 * 3 and count toward the Team.
 */
export async function loggedFixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const warWeek = async (n: number) => {
    const [row] = await tx
      .insert(schema.warWeek)
      .values({
        edition: `lr${n}`,
        editionNumber: 9300 + n,
        year: 9300 + n,
        startDate: "2099-01-01",
        endDate: "2099-01-05",
        storyTheme: "Logged results test",
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
  const [red, blue] = await tx
    .insert(schema.team)
    .values([
      { warWeekId, name: "Red", color: "#f00" },
      { warWeekId, name: "Blue", color: "#00f" },
    ])
    .returning({ id: schema.team.id });
  const [neo, trinity, morpheus, cypher, dozer] = await tx
    .insert(schema.participant)
    .values([
      { warWeekId, displayName: "Neo", email: NEO, teamId: red.id },
      { warWeekId, displayName: "Trinity", email: TRINITY, teamId: blue.id },
      { warWeekId, displayName: "Morpheus", email: MORPHEUS, teamId: red.id },
      { warWeekId, displayName: "Cypher", teamId: blue.id },
      { warWeekId, displayName: "Dozer" },
    ])
    .returning({ id: schema.participant.id });
  const [smith] = await tx
    .insert(schema.participant)
    .values({ warWeekId: otherWarWeekId, displayName: "Smith", email: NEO })
    .returning({ id: schema.participant.id });
  const series = { drawsAllowed: false, bestOf: 3 as const };
  const [pong, relay, bowl, stairs, trivia] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Pong",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "head-to-head" as const,
        seriesConfig: series,
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Relay",
        scoring: "team" as const,
        format: "head-to-head" as const,
        seriesConfig: { drawsAllowed: true, bestOf: 3 as const },
        placementPoints: [10, 6],
      },
      {
        warWeekId,
        name: "Bowl",
        scoring: "individual" as const,
        countsTowardTeam: true,
        format: "best-score" as const,
        scoreDirection: "higher" as const,
        scoreUnit: "pins",
        placementPoints: [10, 6, 3],
      },
      {
        warWeekId,
        name: "Stairs",
        scoring: "team" as const,
        format: "best-score" as const,
        scoreDirection: "higher" as const,
        scoreUnit: "trips",
        bestScoreConfig: { teamScore: "sum-of-members" as const },
        placementPoints: [8, 4],
      },
      {
        warWeekId,
        name: "Trivia",
        scoring: "team" as const,
        format: "placement" as const,
      },
    ])
    .returning({ id: schema.competition.id });
  await tx.insert(schema.entrant).values([
    { competitionId: pong.id, participantId: neo.id, seedPosition: 1 },
    { competitionId: pong.id, participantId: trinity.id, seedPosition: 2 },
    { competitionId: relay.id, teamId: red.id, seedPosition: 1 },
    { competitionId: relay.id, teamId: blue.id, seedPosition: 2 },
  ]);
  await tx.insert(schema.competitionHost).values(
    [pong.id, relay.id, bowl.id, stairs.id].map((competitionId) => ({
      competitionId,
      email: HOST,
    })),
  );
  await tx
    .insert(schema.organizer)
    .values({ email: ORGANIZER })
    .onConflictDoNothing();

  const setCompetition = (
    id: string,
    values: Partial<typeof schema.competition.$inferInsert>,
  ) =>
    tx
      .update(schema.competition)
      .set(values)
      .where(eq(schema.competition.id, id));
  const matchRows = (competitionId: string) =>
    tx
      .select({
        id: schema.seriesMatch.id,
        loggedByEmail: schema.seriesMatch.loggedByEmail,
        loggedByParticipantId: schema.seriesMatch.loggedByParticipantId,
        recordedAt: schema.seriesMatch.recordedAt,
        updatedAt: schema.seriesMatch.updatedAt,
      })
      .from(schema.seriesMatch)
      .where(eq(schema.seriesMatch.competitionId, competitionId));
  const attemptRows = (competitionId: string) =>
    tx
      .select({
        id: schema.attempt.id,
        participantId: schema.attempt.participantId,
        teamId: schema.attempt.teamId,
        score: schema.attempt.score,
        loggedByEmail: schema.attempt.loggedByEmail,
        loggedByParticipantId: schema.attempt.loggedByParticipantId,
      })
      .from(schema.attempt)
      .where(eq(schema.attempt.competitionId, competitionId));

  return {
    schema,
    warWeekId,
    ctx: (actorEmail: string) => ({ warWeekId, actorEmail }),
    ids: {
      red: red.id,
      blue: blue.id,
      neo: neo.id,
      trinity: trinity.id,
      morpheus: morpheus.id,
      cypher: cypher.id,
      dozer: dozer.id,
      smith: smith.id,
      pong: pong.id,
      relay: relay.id,
      bowl: bowl.id,
      stairs: stairs.id,
      trivia: trivia.id,
    },
    setCompetition,
    matchRows,
    attemptRows,
  };
}

export type LoggedFixture = Awaited<ReturnType<typeof loggedFixture>>;

/** A Head-to-head Match `winner` won against `loser`. */
export const beat = (winner: string, loser: string) => ({
  players: [
    { id: winner, place: 1, score: null },
    { id: loser, place: 2, score: null },
  ],
});
