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
// Every draw 0 shuffles [a, b, c, d] to [b, c, d, a] (see seeding.test.ts).
const rngZero = () => 0;

/**
 * Red and Blue with emailed Participants; "Cypher", a team Competition
 * whose Entrants are Squads Red Alpha (Sam, Ashley), Blue Alpha (Graham)
 * and Blue Bravo (none yet entered: Alec); "Relay", a team one entering
 * the Teams; "Chess", an individual one entering Ashley and Graham.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const [warWeek] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "t1",
      editionNumber: 9301,
      year: 9301,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Bracket query test",
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
  const warWeekId = warWeek.id;
  const [red, blue] = (
    await tx
      .insert(schema.team)
      .values([
        { warWeekId, name: "Red", color: "#f00" },
        { warWeekId, name: "Blue", color: "#00f" },
      ])
      .returning({ id: schema.team.id })
  ).map((t) => t.id);
  const rows = await tx
    .insert(schema.participant)
    .values(
      (
        [
          ["Sam Schantz", red],
          ["Ashley Schuliger", red],
          ["Graham Macbeth", blue],
          ["Alec Haring", blue],
        ] as const
      ).map(([displayName, teamId]) => ({
        warWeekId,
        displayName,
        teamId,
        email: `${displayName.split(" ")[0].toLowerCase()}@jahnelgroup.com`,
      })),
    )
    .returning({
      id: schema.participant.id,
      displayName: schema.participant.displayName,
    });
  const p = (name: string) => rows.find((r) => r.displayName === name)!.id;
  const [cypher, relay, chess] = await tx
    .insert(schema.competition)
    .values([
      {
        warWeekId,
        name: "Cypher",
        scoring: "team",
        format: "single-elimination",
        selfReport: true,
      },
      {
        warWeekId,
        name: "Relay",
        scoring: "team",
        format: "single-elimination",
      },
      {
        warWeekId,
        name: "Chess",
        scoring: "individual",
        format: "single-elimination",
      },
    ])
    .returning({ id: schema.competition.id });
  const squad = async (name: string, teamId: string, people: string[]) => {
    const [row] = await tx
      .insert(schema.squad)
      .values({ competitionId: cypher.id, teamId, name })
      .returning({ id: schema.squad.id });
    if (people.length) {
      await tx
        .insert(schema.squadParticipant)
        .values(people.map((n) => ({ squadId: row.id, participantId: p(n) })));
    }
    return row.id;
  };
  const redAlpha = await squad("Red Alpha", red, [
    "Sam Schantz",
    "Ashley Schuliger",
  ]);
  const blueAlpha = await squad("Blue Alpha", blue, ["Graham Macbeth"]);
  const blueBravo = await squad("Blue Bravo", blue, ["Alec Haring"]);
  await tx.insert(schema.entrant).values([
    { competitionId: cypher.id, squadId: redAlpha, seedPosition: 1 },
    { competitionId: cypher.id, squadId: blueAlpha, seedPosition: 2 },
    { competitionId: relay.id, teamId: red, seedPosition: 1 },
    { competitionId: relay.id, teamId: blue, seedPosition: 2 },
    {
      competitionId: chess.id,
      participantId: p("Ashley Schuliger"),
      seedPosition: 1,
    },
    {
      competitionId: chess.id,
      participantId: p("Graham Macbeth"),
      seedPosition: 2,
    },
  ]);
  return {
    schema,
    ctx: { warWeekId, actorEmail },
    warWeekId,
    red,
    blue,
    p,
    redAlpha,
    blueAlpha,
    blueBravo,
    cypherId: cypher.id,
    relayId: relay.id,
    chessId: chess.id,
  };
}

describe.skipIf(!isLocalDatabase)("Bracket queries", () => {
  it("labels Squad Entrants with their name, Team and Participants, and their points go to the Team", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getBracketEntrants } = await import("@/queries/brackets");
      const f = await fixture(tx);

      expect(await getBracketEntrants(f.cypherId, tx)).toEqual([
        {
          id: expect.any(String),
          seedPosition: 1,
          label: "Red Alpha",
          teamId: null,
          participantId: null,
          squadId: f.redAlpha,
          participantNames: ["Ashley Schuliger", "Sam Schantz"],
          image: null,
          pointsTeamId: f.red,
          color: "#f00",
          teamName: "Red",
        },
        {
          id: expect.any(String),
          seedPosition: 2,
          label: "Blue Alpha",
          teamId: null,
          participantId: null,
          squadId: f.blueAlpha,
          participantNames: ["Graham Macbeth"],
          image: null,
          pointsTeamId: f.blue,
          color: "#00f",
          teamName: "Blue",
        },
      ]);
    });
  });

  it("gives a Team Entrant its own points Team and a Participant Entrant none", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getBracketEntrants } = await import("@/queries/brackets");
      const f = await fixture(tx);

      expect(await getBracketEntrants(f.relayId, tx)).toMatchObject([
        {
          label: "Red",
          teamId: f.red,
          squadId: null,
          participantNames: [],
          pointsTeamId: f.red,
        },
        {
          label: "Blue",
          teamId: f.blue,
          squadId: null,
          participantNames: [],
          pointsTeamId: f.blue,
        },
      ]);
      expect(await getBracketEntrants(f.chessId, tx)).toMatchObject([
        {
          label: "Ashley Schuliger",
          teamId: null,
          participantId: f.p("Ashley Schuliger"),
          squadId: null,
          participantNames: [],
          pointsTeamId: null,
          color: "#f00",
          teamName: "Red",
        },
        {
          label: "Graham Macbeth",
          pointsTeamId: null,
          teamName: "Blue",
        },
      ]);
    });
  });

  it("carries the Competition's self-report setting", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getBracket } = await import("@/queries/brackets");
      const f = await fixture(tx);

      expect((await getBracket(f.cypherId, tx))!.competition.selfReport).toBe(
        true,
      );
      expect((await getBracket(f.relayId, tx))!.competition.selfReport).toBe(
        false,
      );
    });
  });

  it("lists a Competition's Squads by name, and each Participant's Squad", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getParticipantSquadIds, getSquads } =
        await import("@/queries/brackets");
      const f = await fixture(tx);

      expect(await getSquads(f.cypherId, tx)).toEqual([
        {
          id: f.blueAlpha,
          name: "Blue Alpha",
          teamId: f.blue,
          teamName: "Blue",
          teamColor: "#00f",
          participants: [
            { id: f.p("Graham Macbeth"), displayName: "Graham Macbeth" },
          ],
        },
        {
          id: f.blueBravo,
          name: "Blue Bravo",
          teamId: f.blue,
          teamName: "Blue",
          teamColor: "#00f",
          participants: [
            { id: f.p("Alec Haring"), displayName: "Alec Haring" },
          ],
        },
        {
          id: f.redAlpha,
          name: "Red Alpha",
          teamId: f.red,
          teamName: "Red",
          teamColor: "#f00",
          participants: [
            { id: f.p("Ashley Schuliger"), displayName: "Ashley Schuliger" },
            { id: f.p("Sam Schantz"), displayName: "Sam Schantz" },
          ],
        },
      ]);
      expect(await getSquads(f.relayId, tx)).toEqual([]);

      expect(await getParticipantSquadIds(f.cypherId, tx)).toEqual({
        [f.p("Sam Schantz")]: f.redAlpha,
        [f.p("Ashley Schuliger")]: f.redAlpha,
        [f.p("Graham Macbeth")]: f.blueAlpha,
        [f.p("Alec Haring")]: f.blueBravo,
      });
      expect(await getParticipantSquadIds(f.relayId, tx)).toEqual({});
    });
  });

  it("names each self-reported Heat's reporter, never their email", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { generateBracket } = await import("@/mutations/brackets");
      const { getHeatReporters, loadBracket } =
        await import("@/queries/brackets");
      const f = await fixture(tx);
      await generateBracket(f.chessId, { rng: rngZero }, f.ctx, tx);
      await generateBracket(f.relayId, { rng: rngZero }, f.ctx, tx);
      const [chessHeat] = (await loadBracket(f.chessId, tx)).heats;
      const [relayHeat] = (await loadBracket(f.relayId, tx)).heats;

      expect(await getHeatReporters(f.chessId, tx)).toEqual({});
      await tx
        .update(f.schema.heat)
        .set({
          reportedByEmail: "ashley@jahnelgroup.com",
          reportedByParticipantId: f.p("Ashley Schuliger"),
        })
        .where(eq(f.schema.heat.id, chessHeat.id));
      expect(await getHeatReporters(f.chessId, tx)).toEqual({
        [chessHeat.id]: "Ashley Schuliger",
      });

      // A deleted reporter's Participant: the email stays for audit only.
      await tx
        .update(f.schema.heat)
        .set({
          reportedByEmail: "graham@jahnelgroup.com",
          reportedByParticipantId: f.p("Graham Macbeth"),
        })
        .where(eq(f.schema.heat.id, relayHeat.id));
      await tx
        .delete(f.schema.participant)
        .where(eq(f.schema.participant.id, f.p("Graham Macbeth")));
      const reporters = await getHeatReporters(f.relayId, tx);
      expect(reporters).toEqual({ [relayHeat.id]: "a Participant" });
      expect(JSON.stringify(reporters)).not.toContain("@");
    });
  });

  it("never returns an email from any Bracket query, even from a self-reported Heat", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { generateBracket } = await import("@/mutations/brackets");
      const queries = await import("@/queries/brackets");
      const f = await fixture(tx);
      for (const id of [f.cypherId, f.relayId, f.chessId]) {
        await generateBracket(id, { rng: rngZero }, f.ctx, tx);
      }
      await tx
        .update(f.schema.heat)
        .set({
          reportedByEmail: "ashley@jahnelgroup.com",
          reportedByParticipantId: f.p("Ashley Schuliger"),
        })
        .where(eq(f.schema.heat.competitionId, f.cypherId));

      const shapes: unknown[] = [];
      for (const id of [f.cypherId, f.relayId, f.chessId]) {
        shapes.push(
          await queries.getBracketEntrants(id, tx),
          await queries.loadBracket(id, tx),
          await queries.getBracket(id, tx),
          await queries.getSquads(id, tx),
          await queries.getParticipantSquadIds(id, tx),
          await queries.getHeatReporters(id, tx),
        );
      }
      shapes.push(
        await queries.getBracketCompetitions({ id: f.warWeekId }, tx),
        await queries.getParticipantTeamIds({ id: f.warWeekId }, tx),
      );
      expect(JSON.stringify(shapes)).toContain("Ashley Schuliger");
      for (const rows of shapes) {
        expect(JSON.stringify(rows)).not.toContain("@");
      }
      // A loaded Bracket's Heats carry no reporter at all.
      const bracket = await queries.loadBracket(f.cypherId, tx);
      expect(JSON.stringify(bracket).toLowerCase()).not.toContain("report");
    });
  });
});
