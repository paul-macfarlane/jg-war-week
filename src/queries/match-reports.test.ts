import { eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { matchReportError } from "@/lib/bracket/match-report-rule";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const ctxEmail = "organizer@jahnelgroup.com";
// Every draw 0 shuffles [a, b, c, d] to [b, c, d, a] (see seeding.test.ts).
const rngZero = () => 0;

async function warWeekRow(tx: DBTx, n: number) {
  const schema = await import("@/db/schema");
  const [row] = await tx
    .insert(schema.warWeek)
    .values({
      edition: `t${n}`,
      editionNumber: 9200 + n,
      year: 9200 + n,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Match report test",
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
}

/**
 * Red and Blue, their Participants (with emails), and "Cypher": a team
 * single-elimination Competition, self-report on, whose Entrants are four
 * Squads drawn by `rngZero` into Semifinal 1 Red Bravo vs Red Alpha and
 * Semifinal 2 Blue Alpha vs Blue Bravo. Neo is on Red in no Squad.
 */
async function fixture(tx: DBTx) {
  const schema = await import("@/db/schema");
  const { generateBracket } = await import("@/mutations/brackets");
  const { loadBracket } = await import("@/queries/brackets");
  const warWeekId = await warWeekRow(tx, 1);
  const otherWarWeekId = await warWeekRow(tx, 2);
  const ctx = { warWeekId, actorEmail: ctxEmail };
  const [red, blue] = (
    await tx
      .insert(schema.team)
      .values([
        { warWeekId, name: "Red", color: "#f00" },
        { warWeekId, name: "Blue", color: "#00f" },
      ])
      .returning({ id: schema.team.id })
  ).map((t) => t.id);
  const people = [
    ["Ashley Schuliger", "ashley@jahnelgroup.com", red],
    ["Sam Schantz", "sam@jahnelgroup.com", red],
    ["Ryan Shendler", "ryan@jahnelgroup.com", red],
    ["Alex Kelly", null, red],
    ["Graham Macbeth", "graham@jahnelgroup.com", blue],
    ["Brandon Badgett", null, blue],
    ["Alec Haring", null, blue],
    ["Victoria Campbell", null, blue],
    ["Neo", "neo@jahnelgroup.com", red],
  ] as const;
  const rows = await tx
    .insert(schema.participant)
    .values(
      people.map(([displayName, email, teamId]) => ({
        warWeekId,
        displayName,
        email,
        teamId,
      })),
    )
    .returning({
      id: schema.participant.id,
      displayName: schema.participant.displayName,
    });
  const p = (name: string) => rows.find((r) => r.displayName === name)!.id;
  // The same email on a Participant of another War Week links nothing here.
  await tx.insert(schema.participant).values({
    warWeekId: otherWarWeekId,
    displayName: "Elsewhere",
    email: "elsewhere@jahnelgroup.com",
  });

  const [cypher] = await tx
    .insert(schema.competition)
    .values({
      warWeekId,
      name: "Cypher",
      scoring: "team",
      format: "bracket",
      selfReport: true,
    })
    .returning({ id: schema.competition.id });
  const squadIds: Record<string, string> = {};
  for (const [name, teamId, participantNames] of [
    ["Red Alpha", red, ["Ashley Schuliger", "Sam Schantz"]],
    ["Red Bravo", red, ["Ryan Shendler", "Alex Kelly"]],
    ["Blue Alpha", blue, ["Graham Macbeth", "Brandon Badgett"]],
    ["Blue Bravo", blue, ["Alec Haring", "Victoria Campbell"]],
  ] as const) {
    const [row] = await tx
      .insert(schema.squad)
      .values({ competitionId: cypher.id, teamId, name })
      .returning({ id: schema.squad.id });
    squadIds[name] = row.id;
    await tx.insert(schema.squadParticipant).values(
      participantNames.map((name) => ({
        squadId: row.id,
        participantId: p(name),
      })),
    );
  }
  await tx.insert(schema.entrant).values(
    ["Red Alpha", "Red Bravo", "Blue Alpha", "Blue Bravo"].map((name, i) => ({
      competitionId: cypher.id,
      squadId: squadIds[name],
      seedPosition: i + 1,
    })),
  );
  expect(await generateBracket(cypher.id, { rng: rngZero }, ctx, tx)).toEqual({
    ok: true,
  });
  const bracket = await loadBracket(cypher.id, tx);
  const matchAt = (round: number, position: number) =>
    bracket.matches.find((h) => h.round === round && h.position === position)!;

  return {
    schema,
    ctx,
    red,
    blue,
    p,
    squadIds,
    cypherId: cypher.id,
    semi1: matchAt(1, 1),
    semi2: matchAt(1, 2),
    final: matchAt(2, 1),
  };
}

const bySquad = <T extends { squadId: string | null }>(list: T[]) =>
  [...list].sort((a, b) => (a.squadId ?? "").localeCompare(b.squadId ?? ""));

describe.skipIf(!isLocalDatabase)("getMatchReportFacts", () => {
  it("links through a Squad, ignoring case, in Red Bravo vs Red Alpha", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const f = await fixture(tx);

      const facts = await getMatchReportFacts(
        f.cypherId,
        f.semi1.id,
        "  Ashley@JahnelGroup.com ",
        tx,
      );
      expect(facts.linked).toEqual({
        participantId: f.p("Ashley Schuliger"),
        teamId: f.red,
        squadId: f.squadIds["Red Alpha"],
      });
      expect(facts.matchReport.selfReport).toBe(true);
      expect(facts.matchReport.match).toBe("open");
      // Squad Entrants carry no Team of their own.
      expect(bySquad(facts.matchReport.entrants)).toEqual(
        bySquad([
          {
            teamId: null,
            participantId: null,
            squadId: f.squadIds["Red Alpha"],
          },
          {
            teamId: null,
            participantId: null,
            squadId: f.squadIds["Red Bravo"],
          },
        ]),
      );
      expect(matchReportError(facts.matchReport)).toBeNull();
      expect(JSON.stringify(facts)).not.toContain("@");
    });
  });

  it("the same-Team Squad Match: a Red Participant in neither Squad isn't in it; one in the opposing Squad is", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const f = await fixture(tx);

      const neo = await getMatchReportFacts(
        f.cypherId,
        f.semi1.id,
        "neo@jahnelgroup.com",
        tx,
      );
      expect(neo.linked).toEqual({
        participantId: f.p("Neo"),
        teamId: f.red,
        squadId: null,
      });
      expect(matchReportError(neo.matchReport)).toBe(
        "You're not in this Match.",
      );

      const ryan = await getMatchReportFacts(
        f.cypherId,
        f.semi1.id,
        "ryan@jahnelgroup.com",
        tx,
      );
      expect(ryan.linked?.squadId).toBe(f.squadIds["Red Bravo"]);
      expect(matchReportError(ryan.matchReport)).toBeNull();

      // Graham (Blue Alpha) isn't in the Red Semifinal.
      const graham = await getMatchReportFacts(
        f.cypherId,
        f.semi1.id,
        "graham@jahnelgroup.com",
        tx,
      );
      expect(matchReportError(graham.matchReport)).toBe(
        "You're not in this Match.",
      );
      for (const facts of [neo, ryan, graham]) {
        expect(JSON.stringify(facts)).not.toContain("@");
      }
    });
  });

  it("reads each Match state: open, unfilled, decided, missing", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const { recordMatchResult } = await import("@/mutations/brackets");
      const f = await fixture(tx);
      const facts = (matchId: string) =>
        getMatchReportFacts(f.cypherId, matchId, "ashley@jahnelgroup.com", tx);

      expect((await facts(f.final.id)).matchReport).toMatchObject({
        match: "unfilled",
        entrants: [],
      });
      const order = f.semi1.slots.map((s) => s.entrantId!);
      expect(
        await recordMatchResult(f.cypherId, f.semi1.id, { order }, f.ctx, tx),
      ).toMatchObject({ ok: true });
      expect((await facts(f.semi1.id)).matchReport.match).toBe("decided");
      const final = await facts(f.final.id);
      expect(final.matchReport.match).toBe("unfilled");
      expect(final.matchReport.entrants).toHaveLength(1);

      const missing = await facts(randomUUID());
      expect(missing.matchReport).toMatchObject({
        match: "missing",
        entrants: [],
      });
      expect(matchReportError(missing.matchReport)).toBe(
        "That Match no longer exists.",
      );
      // A Match of another Competition is missing from this one.
      const [other] = await tx
        .insert(f.schema.competition)
        .values({
          warWeekId: f.ctx.warWeekId,
          name: "Other",
          scoring: "team",
          format: "bracket",
          selfReport: true,
        })
        .returning({ id: f.schema.competition.id });
      expect(
        (
          await getMatchReportFacts(
            other.id,
            f.semi2.id,
            "ashley@jahnelgroup.com",
            tx,
          )
        ).matchReport.match,
      ).toBe("missing");
    });
  });

  it("links through a Team and as the Participant, and reads a bye", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const { generateBracket } = await import("@/mutations/brackets");
      const { loadBracket } = await import("@/queries/brackets");
      const { isBye } = await import("@/lib/bracket/formats");
      const f = await fixture(tx);

      // Three Teams: one has Round 1's bye, two play.
      const [green] = await tx
        .insert(f.schema.team)
        .values({ warWeekId: f.ctx.warWeekId, name: "Green", color: "#0f0" })
        .returning({ id: f.schema.team.id });
      const [relay, chess] = await tx
        .insert(f.schema.competition)
        .values([
          {
            warWeekId: f.ctx.warWeekId,
            name: "Relay",
            scoring: "team",
            format: "bracket",
            selfReport: true,
          },
          {
            warWeekId: f.ctx.warWeekId,
            name: "Chess",
            scoring: "individual",
            format: "bracket",
            selfReport: true,
          },
        ])
        .returning({ id: f.schema.competition.id });
      await tx.insert(f.schema.entrant).values([
        ...[f.red, f.blue, green.id].map((teamId, i) => ({
          competitionId: relay.id,
          teamId,
          seedPosition: i + 1,
        })),
        ...["Ashley Schuliger", "Graham Macbeth"].map((name, i) => ({
          competitionId: chess.id,
          participantId: f.p(name),
          seedPosition: i + 1,
        })),
      ]);
      await generateBracket(relay.id, { rng: rngZero }, f.ctx, tx);
      await generateBracket(chess.id, { rng: rngZero }, f.ctx, tx);

      const relayBracket = await loadBracket(relay.id, tx);
      const bye = relayBracket.matches.find(
        (h) => h.round === 1 && isBye(relayBracket, h),
      )!;
      const played = relayBracket.matches.find(
        (h) => h.round === 1 && !isBye(relayBracket, h),
      )!;
      const byeFacts = await getMatchReportFacts(
        relay.id,
        bye.id,
        "ashley@jahnelgroup.com",
        tx,
      );
      expect(byeFacts.matchReport.match).toBe("bye");
      expect(byeFacts.linked).toEqual({
        participantId: f.p("Ashley Schuliger"),
        teamId: f.red,
        squadId: null,
      });

      // Of three Teams, one has the bye, so Red or Blue plays this Match:
      // report as a Participant of whichever does, through their Team.
      const teamsInMatch = (
        await tx
          .select({ teamId: f.schema.entrant.teamId })
          .from(f.schema.bracketMatchEntrant)
          .innerJoin(
            f.schema.entrant,
            eq(f.schema.entrant.id, f.schema.bracketMatchEntrant.entrantId),
          )
          .where(eq(f.schema.bracketMatchEntrant.matchId, played.id))
      ).map((row) => row.teamId);
      const [email, teamId] = teamsInMatch.includes(f.red)
        ? ["ashley@jahnelgroup.com", f.red]
        : ["graham@jahnelgroup.com", f.blue];
      const playedFacts = await getMatchReportFacts(
        relay.id,
        played.id,
        email,
        tx,
      );
      expect(playedFacts.matchReport.match).toBe("open");
      expect(playedFacts.linked).toMatchObject({ teamId, squadId: null });
      expect(playedFacts.matchReport.entrants).toContainEqual({
        teamId,
        participantId: null,
        squadId: null,
      });
      expect(matchReportError(playedFacts.matchReport)).toBeNull();

      const chessBracket = await loadBracket(chess.id, tx);
      const chessFacts = await getMatchReportFacts(
        chess.id,
        chessBracket.matches[0].id,
        "ashley@jahnelgroup.com",
        tx,
      );
      expect(chessFacts.matchReport.match).toBe("open");
      expect(chessFacts.matchReport.entrants).toContainEqual({
        teamId: null,
        participantId: f.p("Ashley Schuliger"),
        squadId: null,
      });
      expect(matchReportError(chessFacts.matchReport)).toBeNull();
      for (const facts of [byeFacts, playedFacts, chessFacts]) {
        expect(JSON.stringify(facts)).not.toContain("@");
      }
    });
  });

  it("links no one for an unknown email, another War Week's, a blank one, or two case-variant matches", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const f = await fixture(tx);
      const facts = (email: string | null) =>
        getMatchReportFacts(f.cypherId, f.semi1.id, email, tx);

      for (const email of [
        "nobody@jahnelgroup.com",
        "elsewhere@jahnelgroup.com",
        "",
        null,
      ]) {
        const result = await facts(email);
        expect(result.linked).toBeNull();
        expect(matchReportError(result.matchReport)).toBe(
          "Your sign-in doesn't match a Participant of this War Week.",
        );
        expect(JSON.stringify(result)).not.toContain("@");
      }

      // Raw rows can skip the write-time lowercasing: two matches, no link.
      await tx.insert(f.schema.participant).values([
        {
          warWeekId: f.ctx.warWeekId,
          displayName: "Dup 1",
          email: "dup@jahnelgroup.com",
        },
        {
          warWeekId: f.ctx.warWeekId,
          displayName: "Dup 2",
          email: "DUP@jahnelgroup.com",
        },
      ]);
      expect((await facts("dup@jahnelgroup.com")).linked).toBeNull();
    });
  });

  it("carries the Competition's self-report setting", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getMatchReportFacts } = await import("@/queries/match-reports");
      const { setSelfReport } = await import("@/mutations/match-reports");
      const f = await fixture(tx);
      await setSelfReport(f.cypherId, { on: false }, f.ctx, tx);

      const facts = await getMatchReportFacts(
        f.cypherId,
        f.semi1.id,
        "ashley@jahnelgroup.com",
        tx,
      );
      expect(facts.matchReport.selfReport).toBe(false);
      expect(matchReportError(facts.matchReport)).toBe(
        "Self-report is off for this Competition.",
      );
    });
  });
});
