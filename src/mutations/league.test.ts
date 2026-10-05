import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import type { DBTx } from "@/db";
import { isLocalDatabaseUrl } from "@/db/local-url";
import { insertHosts } from "@/db/test-hosts";
import { inRolledBackTransaction } from "@/db/test-transaction";
import { rematches } from "@/lib/league/pairing";
import {
  HOST,
  MORPHEUS,
  NEO,
  NOBODY,
  ORGANIZER,
  TRINITY,
  loggedFixture,
} from "@/mutations/logged-results.fixture";

// Runs only against a local Postgres (see vitest.config.ts).
const isLocalDatabase = isLocalDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.DATABASE_DRIVER,
);

const load = () => import("@/mutations/league");

const win = { result: "a" as const, scoreA: null, scoreB: null };
const draw = { result: "draw" as const, scoreA: null, scoreB: null };

/**
 * The logged-results War Week plus "Chess": an individual Swiss League
 * (default rounds, so 2 for 4 Entrants) of Neo, Trinity, Morpheus and
 * Cypher, self-report on, hosted by HOST, Placement Points 10, 6, 3.
 */
async function fixture(tx: DBTx) {
  const f = await loggedFixture(tx);
  const { schema, ids } = f;
  const league = async (name: string, entrants: string[]) => {
    const [row] = await tx
      .insert(schema.competition)
      .values({
        warWeekId: f.warWeekId,
        name,
        scoring: "individual",
        format: "league",
        leagueConfig: { pairing: "swiss", rounds: null },
        placementPoints: [10, 6, 3],
        selfReport: true,
      })
      .returning({ id: schema.competition.id });
    await insertHosts(tx, [{ competitionId: row.id, email: HOST }]);
    if (entrants.length) {
      await tx.insert(schema.entrant).values(
        entrants.map((participantId, i) => ({
          competitionId: row.id,
          participantId,
          seedPosition: i + 1,
        })),
      );
    }
    return row.id;
  };
  const chess = await league("Chess", [
    ids.neo,
    ids.trinity,
    ids.morpheus,
    ids.cypher,
  ]);
  const entrantRows = await tx
    .select({
      id: schema.entrant.id,
      participantId: schema.entrant.participantId,
    })
    .from(schema.entrant)
    .where(eq(schema.entrant.competitionId, chess));
  const entrantOf = (participantId: string) =>
    entrantRows.find((e) => e.participantId === participantId)!.id;
  const matches = (competitionId = chess) =>
    tx
      .select({
        id: schema.leagueMatch.id,
        round: schema.leagueMatch.round,
        position: schema.leagueMatch.position,
        a: schema.leagueMatch.entrantAId,
        b: schema.leagueMatch.entrantBId,
        result: schema.leagueMatch.result,
        recordedByEmail: schema.leagueMatch.recordedByEmail,
        recordedByParticipantId: schema.leagueMatch.recordedByParticipantId,
        recordedAt: schema.leagueMatch.recordedAt,
      })
      .from(schema.leagueMatch)
      .where(eq(schema.leagueMatch.competitionId, competitionId))
      .orderBy(asc(schema.leagueMatch.round), asc(schema.leagueMatch.position));
  const roundRobin = () =>
    f.setCompetition(chess, {
      leagueConfig: { pairing: "round-robin", rounds: null },
    });
  return { ...f, chess, league, entrantOf, matches, roundRobin };
}

type Fixture = Awaited<ReturnType<typeof fixture>>;

/** Records every unplayed Match of `round` as a win for A, as the Host. */
async function playRound(f: Fixture, tx: DBTx, round: number) {
  const { recordLeagueResult } = await load();
  for (const m of await f.matches()) {
    if (m.round !== round || m.b === null || m.result !== null) continue;
    expect(
      await recordLeagueResult(f.chess, m.id, win, f.ctx(HOST), tx),
    ).toEqual({ ok: true });
  }
}

const pairsOf = (rows: { a: string; b: string | null }[]) =>
  rows.flatMap((m) => (m.b ? [[m.a, m.b].sort().join(" ")] : []));

describe.skipIf(!isLocalDatabase)("League pairing (spec R23)", () => {
  it("Swiss: pairs round 1, waits for its results, pairs round 2 with no rematch, then every round is paired", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague, pairNextRound } = await load();
      const f = await fixture(tx);
      expect(
        await pairLeague(f.chess, { rng: () => 0 }, f.ctx(HOST), tx),
      ).toEqual({ ok: true });
      const round1 = await f.matches();
      expect(round1.map((m) => m.round)).toEqual([1, 1]);
      expect(
        await pairLeague(f.chess, { rng: () => 0 }, f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "The League is already paired." });
      expect(await pairNextRound(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "Every Match of round 1 needs a result first.",
      });

      await playRound(f, tx, 1);
      expect(await pairNextRound(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      const round2 = (await f.matches()).filter((m) => m.round === 2);
      expect(round2).toHaveLength(2);
      const met = new Set(pairsOf(round1));
      for (const pair of pairsOf(round2)) expect(met.has(pair)).toBe(false);

      await playRound(f, tx, 2);
      expect(await pairNextRound(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "Every round is paired.",
      });
    });
  });

  it("Swiss: an odd count gives one Entrant a bye, which takes no result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague, recordLeagueResult } = await load();
      const f = await fixture(tx);
      const three = await f.league("Blitz", [
        f.ids.neo,
        f.ids.trinity,
        f.ids.morpheus,
      ]);
      expect(await pairLeague(three, {}, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      const rows = await f.matches(three);
      const bye = rows.find((m) => m.b === null)!;
      expect(rows).toHaveLength(2);
      expect(
        await recordLeagueResult(three, bye.id, win, f.ctx(HOST), tx),
      ).toEqual({ ok: false, error: "A bye has no result." });
    });
  });

  it("refuses pairing with fewer than 2 Entrants, and on another Format", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague } = await load();
      const f = await fixture(tx);
      const lonely = await f.league("Solo", [f.ids.neo]);
      expect(await pairLeague(lonely, {}, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "Add at least 2 Entrants before pairing.",
      });
      expect(await pairLeague(f.ids.pong, {}, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "This Competition isn't run as a League.",
      });
    });
  });

  it("round robin: Pair rounds pairs everyone once; Clear pairings deletes them until a Match has a result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague, pairNextRound, clearPairings } = await load();
      const f = await fixture(tx);
      await f.roundRobin();
      expect(await pairLeague(f.chess, {}, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      const rows = await f.matches();
      expect(rows.map((m) => m.round)).toEqual([1, 1, 2, 2, 3, 3]);
      expect(new Set(pairsOf(rows)).size).toBe(6);
      expect(await pairNextRound(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "A round robin pairs every round at once.",
      });

      expect(await clearPairings(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: true,
      });
      expect(await f.matches()).toEqual([]);
      expect(await clearPairings(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "There are no pairings to clear.",
      });

      await pairLeague(f.chess, {}, f.ctx(HOST), tx);
      await playRound(f, tx, 1);
      expect(await clearPairings(f.chess, f.ctx(HOST), tx)).toEqual({
        ok: false,
        error: "A Match has a result: clear its result first.",
      });
      expect(await f.matches()).toHaveLength(6);
    });
  });
});

describe.skipIf(!isLocalDatabase)("League pairing edits (reading R7)", () => {
  it("Swiss: swaps two Entrants of a round before a result, and refuses once the round has one", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague, swapPairing, recordLeagueResult } = await load();
      const f = await fixture(tx);
      await pairLeague(f.chess, { rng: () => 0 }, f.ctx(HOST), tx);
      const [m0, m1] = await f.matches();
      expect(
        await swapPairing(
          f.chess,
          { round: 1, x: m0.a, y: m1.a },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      const [s0, s1] = await f.matches();
      expect([s0.a, s0.b, s1.a, s1.b]).toEqual([m1.a, m0.b, m0.a, m1.b]);

      expect(
        await swapPairing(
          f.chess,
          { round: 1, x: s0.a, y: s0.b! },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "Those two already play each other." });

      await recordLeagueResult(f.chess, s1.id, win, f.ctx(HOST), tx);
      expect(
        await swapPairing(
          f.chess,
          { round: 1, x: s0.a, y: s1.a },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "A Match in this round has a result." });
      expect((await f.matches()).map((m) => [m.a, m.b])).toEqual([
        [s0.a, s0.b],
        [s1.a, s1.b],
      ]);
    });
  });

  it("round robin: allows a swap that repeats a pairing (Q4), and refuses one touching a Match with a result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { pairLeague, swapPairing, recordLeagueResult } = await load();
      const f = await fixture(tx);
      await f.roundRobin();
      await pairLeague(f.chess, {}, f.ctx(HOST), tx);
      const [m0, m1] = (await f.matches()).filter((m) => m.round === 1);
      expect(
        await swapPairing(
          f.chess,
          { round: 1, x: m0.b!, y: m1.a },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: true });
      // Every pair already met in another round, so two now meet twice.
      expect(rematches(await f.matches())).toHaveLength(2);

      const [r0, r1] = (await f.matches()).filter((m) => m.round === 2);
      await recordLeagueResult(f.chess, r0.id, win, f.ctx(HOST), tx);
      expect(
        await swapPairing(
          f.chess,
          { round: 2, x: r0.a, y: r1.a },
          f.ctx(HOST),
          tx,
        ),
      ).toEqual({ ok: false, error: "A Match being swapped has a result." });
    });
  });
});

describe.skipIf(!isLocalDatabase)(
  "League results (spec R23, decision 8)",
  () => {
    /** Neo's round 1 Match, his opponent's email, and someone not in it. */
    async function neosMatch(f: Fixture) {
      const emailOf = new Map([
        [f.entrantOf(f.ids.neo), NEO],
        [f.entrantOf(f.ids.trinity), TRINITY],
        [f.entrantOf(f.ids.morpheus), MORPHEUS],
        [f.entrantOf(f.ids.cypher), null],
      ]);
      const neo = f.entrantOf(f.ids.neo);
      const match = (await f.matches()).find(
        (m) => m.round === 1 && (m.a === neo || m.b === neo),
      )!;
      const opponent = match.a === neo ? match.b! : match.a;
      const outsider = [TRINITY, MORPHEUS].find(
        (email) => email !== emailOf.get(opponent),
      )!;
      return { match, opponentEmail: emailOf.get(opponent) ?? null, outsider };
    }

    it("with self-report on, a player records their own Match and their opponent changes it; a non-player is refused", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { pairLeague, recordLeagueResult } = await load();
        const f = await fixture(tx);
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        const { match, opponentEmail, outsider } = await neosMatch(f);

        expect(
          await recordLeagueResult(f.chess, match.id, win, f.ctx(NEO), tx),
        ).toEqual({ ok: true });
        const [saved] = (await f.matches()).filter((m) => m.id === match.id);
        expect(saved).toMatchObject({
          result: "a",
          recordedByEmail: NEO,
          recordedByParticipantId: f.ids.neo,
        });
        expect(saved.recordedAt).not.toBeNull();

        if (opponentEmail) {
          expect(
            await recordLeagueResult(
              f.chess,
              match.id,
              draw,
              f.ctx(opponentEmail),
              tx,
            ),
          ).toEqual({ ok: true });
        }
        expect(
          await recordLeagueResult(f.chess, match.id, win, f.ctx(outsider), tx),
        ).toEqual({ ok: false, error: "You're not a player in this Match." });
        expect(
          await recordLeagueResult(f.chess, match.id, win, f.ctx(NOBODY), tx),
        ).toMatchObject({ ok: false });
      });
    });

    it("with self-report off, refuses the players, and a Host or Organizer still records (recorded by no Participant)", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { pairLeague, recordLeagueResult, clearLeagueResult } =
          await load();
        const f = await fixture(tx);
        await f.setCompetition(f.chess, { selfReport: false });
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        const { match } = await neosMatch(f);
        expect(
          await recordLeagueResult(f.chess, match.id, win, f.ctx(NEO), tx),
        ).toEqual({
          ok: false,
          error: "Self-report is off for this Competition.",
        });
        expect(
          await recordLeagueResult(
            f.chess,
            match.id,
            draw,
            f.ctx(ORGANIZER),
            tx,
          ),
        ).toEqual({ ok: true });
        const [saved] = (await f.matches()).filter((m) => m.id === match.id);
        expect(saved).toMatchObject({
          result: "draw",
          recordedByParticipantId: null,
        });
        expect(
          await clearLeagueResult(f.chess, match.id, f.ctx(NEO), tx),
        ).toMatchObject({ ok: false });
      });
    });

    it("clears a result, by whoever could record it, and refuses a Match with none", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { pairLeague, recordLeagueResult, clearLeagueResult } =
          await load();
        const f = await fixture(tx);
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        const { match } = await neosMatch(f);
        await recordLeagueResult(
          f.chess,
          match.id,
          { result: "b", scoreA: 1, scoreB: 3 },
          f.ctx(HOST),
          tx,
        );
        expect(
          await clearLeagueResult(f.chess, match.id, f.ctx(NEO), tx),
        ).toEqual({ ok: true });
        const [cleared] = (await f.matches()).filter((m) => m.id === match.id);
        expect(cleared).toMatchObject({
          result: null,
          recordedAt: null,
          recordedByEmail: null,
          recordedByParticipantId: null,
        });
        expect(
          await clearLeagueResult(f.chess, match.id, f.ctx(NEO), tx),
        ).toEqual({ ok: false, error: "That Match has no result." });
      });
    });

    it("refuses another Competition's Match id, another War Week, and a Closed League (P3a)", async () => {
      await inRolledBackTransaction(async (tx) => {
        const {
          pairLeague,
          recordLeagueResult,
          clearLeagueResult,
          swapPairing,
        } = await load();
        const f = await fixture(tx);
        const go = await f.league("Go", [f.ids.neo, f.ids.trinity]);
        await pairLeague(go, {}, f.ctx(HOST), tx);
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        const [goMatch] = await f.matches(go);

        const gone = { ok: false, error: "That Match no longer exists." };
        expect(
          await recordLeagueResult(f.chess, goMatch.id, win, f.ctx(HOST), tx),
        ).toEqual(gone);
        expect(
          await clearLeagueResult(f.chess, goMatch.id, f.ctx(HOST), tx),
        ).toEqual(gone);
        expect((await f.matches(go))[0].result).toBeNull();
        expect(
          await swapPairing(
            f.chess,
            { round: 1, x: goMatch.a, y: goMatch.b! },
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({ ok: false, error: "Choose two Entrants of this round." });

        const [chessMatch] = await f.matches();
        const elsewhere = { warWeekId: crypto.randomUUID(), actorEmail: HOST };
        expect(
          await recordLeagueResult(f.chess, chessMatch.id, win, elsewhere, tx),
        ).toEqual({ ok: false, error: "That Competition no longer exists." });

        await f.setCompetition(f.chess, { closedAt: new Date() });
        expect(
          await recordLeagueResult(
            f.chess,
            chessMatch.id,
            win,
            f.ctx(HOST),
            tx,
          ),
        ).toEqual({
          ok: false,
          error: "This Competition is closed.",
        });
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)(
  "League settings, Entrants and enrollment (reading R1)",
  () => {
    it("saving Round robin writes rounds null (M3), and the Pairing, Score direction and Entrants lock once paired until Clear pairings", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { saveCompetitionSetting } =
          await import("@/mutations/competition-settings");
        const { pairLeague, clearPairings } = await load();
        const f = await fixture(tx);
        const save = (change: Parameters<typeof saveCompetitionSetting>[1]) =>
          saveCompetitionSetting(f.chess, change, f.ctx(HOST), tx);
        const config = async () =>
          (
            await tx
              .select({ leagueConfig: f.schema.competition.leagueConfig })
              .from(f.schema.competition)
              .where(eq(f.schema.competition.id, f.chess))
          )[0].leagueConfig;

        expect(
          await save({
            field: "leagueConfig",
            value: { pairing: "swiss", rounds: 3 },
          }),
        ).toEqual({ ok: true });
        expect(await config()).toEqual({ pairing: "swiss", rounds: 3 });
        expect(
          await save({
            field: "leagueConfig",
            value: { pairing: "round-robin", rounds: 3 },
          }),
        ).toEqual({ ok: true });
        expect(await config()).toEqual({
          pairing: "round-robin",
          rounds: null,
        });
        expect(
          await saveCompetitionSetting(
            f.ids.pong,
            {
              field: "leagueConfig",
              value: { pairing: "swiss", rounds: null },
            },
            f.ctx(HOST),
            tx,
          ),
        ).toMatchObject({
          ok: false,
          error: "This Competition isn't run as a League.",
        });

        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        const locked = "Locked once round 1 is paired.";
        const changes: Parameters<typeof save>[0][] = [
          { field: "leagueConfig", value: { pairing: "swiss", rounds: null } },
          { field: "scoreDirection", value: "higher" },
          { field: "entrants", value: { targetIds: [f.ids.neo, f.ids.dozer] } },
        ];
        for (const change of changes) {
          expect(await save(change), change.field).toMatchObject({
            ok: false,
            error: locked,
          });
        }
        // The unit never locks; self-report locks only while Closed (Q1).
        expect(await save({ field: "scoreUnit", value: "pts" })).toEqual({
          ok: true,
        });
        expect(await save({ field: "selfReport", value: false })).toEqual({
          ok: true,
        });

        await clearPairings(f.chess, f.ctx(HOST), tx);
        expect(
          await save({
            field: "entrants",
            value: { targetIds: [f.ids.neo, f.ids.dozer, f.ids.trinity] },
          }),
        ).toEqual({ ok: true });
        expect(
          await save({
            field: "entrants",
            value: { targetIds: [f.ids.red], kind: "squad" },
          }),
        ).toMatchObject({ ok: false });
      });
    });

    it("enrollment closes when round 1 is paired", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { enroll, withdraw } = await import("@/mutations/enrollment");
        const { pairLeague } = await load();
        const f = await fixture(tx);
        await f.setCompetition(f.chess, { selfEnroll: true });
        // Dozer (HOST's email) isn't entered yet.
        expect(await enroll(f.chess, f.ctx(HOST), tx)).toEqual({ ok: true });
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        expect(await withdraw(f.chess, f.ctx(NEO), tx)).toEqual({
          ok: false,
          error: "Enrollment is closed: round 1 is paired.",
        });
      });
    });

    it("refuses deleting a paired League, and counts its results for Unstart and End War Week", async () => {
      await inRolledBackTransaction(async (tx) => {
        const { deleteCompetition } = await import("@/mutations/setup");
        const { getScoredCounts } = await import("@/queries/scored-counts");
        const { getOpenUnscoredCompetitions } =
          await import("@/queries/open-unscored-competitions");
        const { pairLeague } = await load();
        const f = await fixture(tx);
        await pairLeague(f.chess, {}, f.ctx(HOST), tx);
        expect(await deleteCompetition(f.chess, f.ctx(ORGANIZER), tx)).toEqual({
          ok: false,
          error:
            "This Competition has 2 League Matches. Clear the pairings first.",
        });
        const before = await getScoredCounts(f.warWeekId, tx);
        const unscored = () =>
          getOpenUnscoredCompetitions({ id: f.warWeekId }, tx).then((rows) =>
            rows.filter((r) => r.format === "league"),
          );
        expect(await unscored()).toEqual([]);

        await playRound(f, tx, 1);
        expect((await getScoredCounts(f.warWeekId, tx)).matchResults).toBe(
          before.matchResults + 2,
        );
        expect(await unscored()).toEqual([
          { id: f.chess, name: "Chess", format: "league" },
        ]);
      });
    });
  },
);

describe.skipIf(!isLocalDatabase)("getLeagueView (P4)", () => {
  it("gives a player their next Match and Record result on it, the Host the offers with their reasons, and Provisional points once a Match has a result", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getLeagueView } = await import("@/queries/league");
      const { pairLeague, recordLeagueResult } = await load();
      const f = await fixture(tx);

      const before = (await getLeagueView(f.chess, HOST, tx))!;
      expect(before.offers.pair).toEqual({
        label: "Pair round 1",
        disabledReason: null,
      });
      expect(before.offers.close).toEqual({
        label: "Close",
        disabledReason:
          "Finish every Match before closing. Not yet paired: rounds 1, 2.",
      });

      await pairLeague(f.chess, {}, f.ctx(HOST), tx);
      const neo = f.entrantOf(f.ids.neo);
      const view = (await getLeagueView(f.chess, NEO, tx))!;
      expect(view.runs).toBe(false);
      expect(view.yourEntrantId).toBe(neo);
      expect(view.roundsTotal).toBe(2);
      expect(view.roundsPaired).toBe(1);
      const mine = view.rounds[0].matches.find((m) => m.yours)!;
      const opponent = mine.a === neo ? mine.b! : mine.a;
      expect(view.yourNextMatch).toEqual({
        round: 1,
        matchId: mine.id,
        opponent: view.entrants.find((e) => e.id === opponent)!.name,
      });
      expect(
        view.rounds[0].matches.map((m) => [m.yours, m.canRecord, m.canClear]),
      ).toEqual(view.rounds[0].matches.map((m) => [m.yours, m.yours, false]));
      expect(Object.values(view.offers)).toEqual([
        null,
        null,
        null,
        null,
        null,
      ]);
      expect(view.standings.every((row) => row.points === null)).toBe(true);
      expect(JSON.stringify(view)).not.toContain("@");

      await recordLeagueResult(f.chess, mine.id, win, f.ctx(HOST), tx);
      const host = (await getLeagueView(f.chess, HOST, tx))!;
      expect(host.offers.pair).toBeNull();
      expect(host.offers.pairNext).toEqual({
        label: "Pair next round",
        disabledReason: "Every Match of round 1 needs a result first.",
      });
      expect(host.offers.clearPairings?.disabledReason).toBe(
        "A Match has a result: clear its result first.",
      );
      expect(host.offers.close?.disabledReason).toMatch(
        /^Finish every Match before closing\. Unplayed: Round 1: .+ v .+\. Not yet paired: round 2\.$/,
      );
      expect(host.rounds[0].editDisabledReason).toBe(
        "A Match in this round has a result.",
      );
      const winner = host.standings[0];
      expect(winner).toMatchObject({ entrantId: mine.a, rank: 1, wins: 1 });
      expect(winner.points).toBe(10);
      expect(host.provisional).toBe(true);
    });
  });

  it("is null for another Format", async () => {
    await inRolledBackTransaction(async (tx) => {
      const { getLeagueView } = await import("@/queries/league");
      const f = await fixture(tx);
      expect(await getLeagueView(f.ids.pong, HOST, tx)).toBeNull();
      // The Match rows of the League are scoped to it.
      expect(
        await tx
          .select()
          .from(f.schema.leagueMatch)
          .where(and(eq(f.schema.leagueMatch.competitionId, f.ids.pong))),
      ).toEqual([]);
    });
  });
});
