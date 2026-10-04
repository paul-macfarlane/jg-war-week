import { afterEach, describe, expect, it, vi } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { NOT_IN_MATCH, SELF_REPORT_OFF } from "@/lib/bracket/match-report-rule";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

// The report action runs for real (authorizeMatchReport, `can`, the
// mutation) against a rolled-back transaction: `@/db` hands out the test's
// transaction, and the session email is the one boundary stubbed. The tree
// only hides Record result; this is the server refusing it.
const { session, current } = vi.hoisted(() => ({
  session: { email: null as string | null },
  current: { tx: null as unknown },
}));
vi.mock("@/auth/server", () => ({
  getSessionEmail: async () => session.email,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/db", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/db")>();
  const db = new Proxy(real.db, {
    get(target, property) {
      const source = (current.tx ?? target) as object;
      const value = Reflect.get(source, property);
      return typeof value === "function" ? value.bind(source) : value;
    },
  });
  return { ...real, db };
});

afterEach(() => {
  session.email = null;
  current.tx = null;
});

const ORGANIZER = "match-refusal-organizer@jahnelgroup.com";
const NEO = "match-refusal-neo@jahnelgroup.com";
const MORPHEUS = "match-refusal-morpheus@jahnelgroup.com";

/**
 * A War Week with Red (Neo), Blue (Trinity) and Green (Morpheus), every
 * Participant linked by email, and Cypher: a team Bracket drawn Red v Blue
 * (one Match, the Final). Self-report is `selfReport`.
 */
async function fixture(tx: DBTx, selfReport: boolean) {
  current.tx = tx;
  const schema = await import("@/db/schema");
  const brackets = await import("@/mutations/brackets");
  const { setSelfReport } = await import("@/mutations/match-reports");
  const { getBracket } = await import("@/queries/brackets");
  const [w] = await tx
    .insert(schema.warWeek)
    .values({
      edition: "hrref",
      editionNumber: 9731,
      year: 9731,
      startDate: "2099-01-01",
      endDate: "2099-01-05",
      storyTheme: "Match report refusal test",
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
  const teams = await tx
    .insert(schema.team)
    .values(
      [
        ["Red", "#f00"],
        ["Blue", "#00f"],
        ["Green", "#0f0"],
      ].map(([name, color]) => ({ warWeekId: w.id, name, color })),
    )
    .returning({ id: schema.team.id, name: schema.team.name });
  const teamId = (name: string) => teams.find((t) => t.name === name)!.id;
  await tx.insert(schema.participant).values([
    { warWeekId: w.id, displayName: "Neo", email: NEO, teamId: teamId("Red") },
    {
      warWeekId: w.id,
      displayName: "Trinity",
      email: "match-refusal-trinity@jahnelgroup.com",
      teamId: teamId("Blue"),
    },
    {
      warWeekId: w.id,
      displayName: "Morpheus",
      email: MORPHEUS,
      teamId: teamId("Green"),
    },
  ]);
  const [cypher] = await tx
    .insert(schema.competition)
    .values({
      warWeekId: w.id,
      name: "Cypher",
      scoring: "team",
      format: "bracket",
    })
    .returning({ id: schema.competition.id });
  const ctx = { warWeekId: w.id, actorEmail: ORGANIZER };
  expect(
    await brackets.replaceEntrants(
      cypher.id,
      { targetIds: [teamId("Red"), teamId("Blue")] },
      ctx,
      tx,
    ),
  ).toEqual({ ok: true });
  expect(await brackets.generateBracket(cypher.id, {}, ctx, tx)).toEqual({
    ok: true,
  });
  expect(await setSelfReport(cypher.id, { on: selfReport }, ctx, tx)).toEqual({
    ok: true,
  });
  const view = async () => (await getBracket(cypher.id, tx))!;
  const drawn = await view();
  const final = drawn.bracket.matches[0];
  const entrantOf = (label: string) =>
    drawn.entrants.find((e) => e.label === label)!.id;
  return {
    competitionId: cypher.id,
    matchId: final.id,
    result: { order: [entrantOf("Red"), entrantOf("Blue")] },
    matchNow: async () =>
      (await view()).bracket.matches.find((h) => h.id === final.id)!,
  };
}

describe.skipIf(!isLocalDatabase)(
  "reportMatchResult refuses a Participant who may not record the Match",
  () => {
    it("refuses a Participant not in the Match, recording nothing", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx, true);
        const before = await f.matchNow();
        session.email = MORPHEUS;
        const { reportMatchResult } = await import("@/actions/match-reports");

        expect(
          await reportMatchResult(f.competitionId, f.matchId, f.result),
        ).toEqual({ ok: false, error: NOT_IN_MATCH });
        expect(await f.matchNow()).toEqual(before);
      });
    });

    it("refuses a Participant in the Match while self-report is off, recording nothing", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx, false);
        const before = await f.matchNow();
        session.email = NEO;
        const { reportMatchResult } = await import("@/actions/match-reports");

        expect(
          await reportMatchResult(f.competitionId, f.matchId, f.result),
        ).toEqual({ ok: false, error: SELF_REPORT_OFF });
        expect(await f.matchNow()).toEqual(before);
      });
    });

    it("lets that Participant record it once self-report is on", async () => {
      await inRolledBackTransaction(async (tx) => {
        const f = await fixture(tx, true);
        session.email = NEO;
        const { reportMatchResult } = await import("@/actions/match-reports");

        expect(
          await reportMatchResult(f.competitionId, f.matchId, f.result),
        ).toEqual({ ok: true, resetMatchIds: [] });
        const match = await f.matchNow();
        expect(match.status).toBe("played");
        expect(match.slots.find((s) => s.place === 1)?.entrantId).toBe(
          f.result.order[0],
        );
      });
    });
  },
);
