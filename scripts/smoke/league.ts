import { Client } from "pg";

import {
  SMOKE_HOST_EMAIL,
  type SmokeSession,
  callAction,
  createSmokeSession,
  fail,
  ok,
  runCheck,
  runQuery,
  runStep,
  serverActionIds,
} from "./harness";
import { deleteSmokeHosts } from "./hosts";
import { mcpTool } from "./mcp";
import { assertNoRosterEmailInLeagues } from "./pickers";

// Literals from src/lib/league/rules.ts and src/lib/bracket/match-report-rule.ts,
// not imported: they are the words a player is told.
const SELF_REPORT_OFF = "Self-report is off for this Competition.";
const NOT_A_PLAYER = "You're not a player in this Match.";
const MATCH_HAS_RESULT = "A Match being swapped has a result.";

const SMOKE_LEAGUE = "smoke-League";
/** XI roster Participants: two players and a third Entrant, and a bystander. */
const PLAYER = "Albert Hernandez";
const OPPONENT = "Austin Gage";
const THIRD = "Sam Schantz";
const BYSTANDER = "Ryan Shendler";
const SMOKE_PARTICIPANT_EMAIL = "smoke-participant@jahnelgroup.com";
const SMOKE_BYSTANDER_EMAIL = "smoke-league-bystander@jahnelgroup.com";

// ---------------------------------------------------------------------------
// The new CHECKs (migration 0034)
// ---------------------------------------------------------------------------

/** Runs `sql` in a transaction that is always rolled back. */
async function inRollback<T>(
  sql: string,
): Promise<{ ok: true; rows: T[] } | { ok: false; error: string }> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("begin");
    try {
      const { rows } = await client.query(sql);
      return { ok: true, rows: rows as T[] };
    } catch (error) {
      return { ok: false, error: String(error) };
    } finally {
      await client.query("rollback");
    }
  } finally {
    await client.end().catch(() => {});
  }
}

async function assertRefused(check: string, constraint: string, sql: string) {
  await runCheck(check, async () => {
    const result = await inRollback(sql);
    if (result.ok) return "insert succeeded";
    return result.error.includes(constraint) ? null : result.error;
  });
}

const XI = "from war_week w where w.edition = 'xi'";

/**
 * A statement that inserts a League of XI with two Entrants, then the
 * Match `select` (over `a` and `b`, the Entrants at Seed Positions 1 and
 * 2): the CHECK under test is the last insert's.
 */
function leagueMatchInsert(matchColumns: string, matchSelect: string) {
  return `with c as (
      insert into competition (war_week_id, name, format, scoring, league_config)
      select w.id, 'Smoke bad league match', 'league', 'individual',
        '{"pairing":"round-robin","rounds":null}' ${XI} returning id),
    p as (
      select p.id, row_number() over (order by p.display_name) as n
      from participant p join war_week w on w.id = p.war_week_id
      where w.edition = 'xi' limit 2),
    e as (
      insert into entrant (competition_id, participant_id, seed_position)
      select c.id, p.id, p.n from c, p returning id, competition_id, seed_position)
    insert into league_match (competition_id, round, position, entrant_a_id, ${matchColumns})
    select a.competition_id, 1, 0, a.id, ${matchSelect}
    from e a join e b on b.seed_position = 2 where a.seed_position = 1`;
}

/**
 * The five R23 CHECKs each refuse what the model forbids, and the
 * widened `competition_self_enroll_bracket_only` admits a League with
 * enrollment and still refuses a Head-to-head. Each is proven by an insert
 * the database refuses (or admits), rolled back.
 */
export async function assertLeagueConstraints() {
  await assertRefused(
    "the database rejects a League with no league config",
    "competition_league_config_league",
    `insert into competition (war_week_id, name, format, scoring)
     select w.id, 'Smoke bad league', 'league', 'individual' ${XI}`,
  );
  await assertRefused(
    "the database rejects a league config on a Placement Competition",
    "competition_league_config_league",
    `insert into competition (war_week_id, name, format, scoring, league_config)
     select w.id, 'Smoke bad league', 'placement', 'individual',
       '{"pairing":"swiss","rounds":3}' ${XI}`,
  );
  for (const [what, config] of [
    ["Swiss rounds below 1", '{"pairing":"swiss","rounds":0}'],
    ["rounds on a round robin", '{"pairing":"round-robin","rounds":3}'],
    ["an unknown pairing", '{"pairing":"knockout","rounds":null}'],
  ] as const) {
    await assertRefused(
      `the database rejects a League with ${what}`,
      "competition_league_config_shape",
      `insert into competition (war_week_id, name, format, scoring, league_config)
       select w.id, 'Smoke bad league', 'league', 'individual', '${config}' ${XI}`,
    );
  }
  await assertRefused(
    "the database rejects a League bye with a result",
    "league_match_bye_no_result",
    leagueMatchInsert("entrant_b_id, result, recorded_at", "null, 'a', now()"),
  );
  await assertRefused(
    "the database rejects a League Match with a result and no recorded time",
    "league_match_recorded",
    leagueMatchInsert("entrant_b_id, result", "b.id, 'a'"),
  );
  await assertRefused(
    "the database rejects a League Match of an Entrant against itself",
    "league_match_two_entrants",
    leagueMatchInsert("entrant_b_id", "a.id"),
  );
  await runCheck(
    "competition_self_enroll_bracket_only admits a League with enrollment",
    async () => {
      const result = await inRollback(
        `insert into competition (war_week_id, name, format, scoring, league_config, self_enroll)
         select w.id, 'Smoke league enroll', 'league', 'individual',
           '{"pairing":"swiss","rounds":null}', true ${XI} returning id`,
      );
      return result.ok ? null : result.error;
    },
  );
  await assertRefused(
    "competition_self_enroll_bracket_only still refuses a Head-to-head with enrollment",
    "competition_self_enroll_bracket_only",
    `insert into competition (war_week_id, name, format, scoring, series_config, self_enroll)
     select w.id, 'Smoke bad enroll', 'head-to-head', 'individual',
       '{"drawsAllowed":false,"bestOf":3}', true ${XI}`,
  );
}

// ---------------------------------------------------------------------------
// Over HTTP: self-report and pairing edits, on the step's own League in XI
// ---------------------------------------------------------------------------

async function xiParticipantId(name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select p.id from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xi' and p.display_name = $1`,
    [name],
  );
  if (!row) throw new Error(`No XI Participant named "${name}"`);
  return row.id;
}

type Round = {
  id: string;
  round: number;
  a: string;
  b: string | null;
  result: string | null;
};

async function roundsOf(competitionId: string): Promise<Round[]> {
  return runQuery<Round>(
    `select id, round, entrant_a_id as a, entrant_b_id as b, result
     from league_match where competition_id = $1 order by round, position`,
    [competitionId],
  );
}

/**
 * AC 4 and AC 6, over HTTP, on a League the step makes in XI and deletes
 * (`smoke-League`, a round robin of 3): with self-report off both a player
 * and a non-player are refused `SELF_REPORT_OFF`; on, the player records
 * their own Match and a non-player is refused `NOT_A_PLAYER`; a swap
 * before a result succeeds and after one is refused. Everything is undone:
 * the League deleted, the emails cleared.
 */
export async function assertLeagueLoop(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const missing = [
    "pairLeague",
    "recordLeagueResult",
    "swapPairing",
    "saveCompetitionSetting",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("league: action ids", `missing ${missing.join(", ")}`);
    return;
  }
  let competitionId: string | null = null;
  const linked: string[] = [];
  try {
    const [created] = await runQuery<{ id: string }>(
      `insert into competition (war_week_id, name, format, scoring, league_config)
       select w.id, $1, 'league', 'individual', '{"pairing":"round-robin","rounds":null}'
       ${XI} returning id`,
      [SMOKE_LEAGUE],
    );
    const id = created.id;
    competitionId = id;
    const playerId = await xiParticipantId(PLAYER);
    const bystanderId = await xiParticipantId(BYSTANDER);
    for (const [i, name] of [PLAYER, OPPONENT, THIRD].entries()) {
      await runQuery(
        `insert into entrant (competition_id, participant_id, seed_position) values ($1, $2, $3)`,
        [id, await xiParticipantId(name), i + 1],
      );
    }
    await runQuery(`update participant set email = $1 where id = $2`, [
      SMOKE_PARTICIPANT_EMAIL,
      playerId,
    ]);
    linked.push(playerId);
    await runQuery(`update participant set email = $1 where id = $2`, [
      SMOKE_BYSTANDER_EMAIL,
      bystanderId,
    ]);
    linked.push(bystanderId);
    const bystander = await createSmokeSession(SMOKE_BYSTANDER_EMAIL);
    const selfReport = (value: boolean) =>
      callAction(
        ids.saveCompetitionSetting,
        [id, { field: "selfReport", value }],
        sessions.organizer,
      );

    await runCheck(
      "league: pairLeague by an Organizer pairs a round robin of 3 (3 rounds, a Match and a sit-out each)",
      async () => {
        const paired = await callAction(
          ids.pairLeague,
          [id],
          sessions.organizer,
        );
        if (!paired.ok) return JSON.stringify(paired);
        const rows = await roundsOf(id);
        const byRound = [1, 2, 3].map((n) => rows.filter((r) => r.round === n));
        return byRound.every(
          (r) => r.length === 2 && r.filter((m) => m.b === null).length === 1,
        )
          ? null
          : JSON.stringify(rows);
      },
    );

    const rows = await roundsOf(id);
    const [playerEntrant] = await runQuery<{ id: string }>(
      `select id from entrant where competition_id = $1 and participant_id = $2`,
      [id, playerId],
    );
    // The player's first played Match, and the Round it is in.
    const match = rows.find(
      (r) =>
        r.b !== null && (r.a === playerEntrant.id || r.b === playerEntrant.id),
    )!;
    const record = (session: SmokeSession, matchId = match.id) =>
      callAction(
        ids.recordLeagueResult,
        [id, matchId, { result: "a" }],
        session,
      );

    await runCheck(
      "league: with self-report off, a player and a non-player recording a Match are both refused SELF_REPORT_OFF (AC 4)",
      async () => {
        const player = await record(sessions.notOrganizer);
        const other = await record(bystander);
        return !player.ok &&
          player.error === SELF_REPORT_OFF &&
          !other.ok &&
          other.error === SELF_REPORT_OFF
          ? null
          : JSON.stringify({ player, other });
      },
    );

    await runCheck(
      "league: with self-report on, a player records their own Match and a non-player is refused NOT_A_PLAYER (AC 4)",
      async () => {
        const on = await selfReport(true);
        if (!on.ok) return `selfReport on: ${JSON.stringify(on)}`;
        const other = await record(bystander);
        if (other.ok || other.error !== NOT_A_PLAYER) {
          return `non-player: ${JSON.stringify(other)}`;
        }
        const [before] = await runQuery<{ result: string | null }>(
          `select result from league_match where id = $1`,
          [match.id],
        );
        if (before.result !== null) return "the refusal wrote a result";
        const player = await record(sessions.notOrganizer);
        if (!player.ok) return `player: ${JSON.stringify(player)}`;
        const [after] = await runQuery<{
          result: string | null;
          by: string | null;
          recorded: boolean;
        }>(
          `select result, recorded_by_participant_id as by,
             recorded_at is not null as recorded
           from league_match where id = $1`,
          [match.id],
        );
        return after.result === "a" && after.by === playerId && after.recorded
          ? null
          : JSON.stringify(after);
      },
    );

    // A round with no result yet: one Match and one sit-out.
    const open = (await roundsOf(id)).filter((r) => r.round !== match.round);
    const roundNo = open[0].round;
    const inRound = open.filter((r) => r.round === roundNo);
    const played = inRound.find((r) => r.b !== null)!;
    const sitOut = inRound.find((r) => r.b === null)!;

    await runCheck(
      "league: swapPairing before a result succeeds, and after a result in the round it is refused (AC 6)",
      async () => {
        const swap = (x: string, y: string) =>
          callAction(
            ids.swapPairing,
            [id, { round: roundNo, x, y }],
            sessions.organizer,
          );
        const first = await swap(played.a, sitOut.a);
        if (!first.ok) return `swap before a result: ${JSON.stringify(first)}`;
        const after = await roundsOf(id);
        const swapped = after.find((r) => r.id === played.id)!;
        const sat = after.find((r) => r.id === sitOut.id)!;
        if (swapped.a !== sitOut.a || sat.a !== played.a) {
          return `swap not saved: ${JSON.stringify(after)}`;
        }
        const recorded = await callAction(
          ids.recordLeagueResult,
          [id, played.id, { result: "draw" }],
          sessions.organizer,
        );
        if (!recorded.ok) return `record: ${JSON.stringify(recorded)}`;
        const again = await swap(sat.a, swapped.b!);
        return !again.ok && again.error === MATCH_HAS_RESULT
          ? null
          : `swap after a result: ${JSON.stringify(again)}`;
      },
    );

    await runCheck(
      "league: swapPairing in the round with the player's result is refused too",
      async () => {
        const inFirst = (await roundsOf(id)).filter(
          (r) => r.round === match.round,
        );
        const sit = inFirst.find((r) => r.b === null)!;
        const result = await callAction(
          ids.swapPairing,
          [id, { round: match.round, x: sit.a, y: match.a }],
          sessions.organizer,
        );
        return !result.ok && result.error === MATCH_HAS_RESULT
          ? null
          : JSON.stringify(result);
      },
    );
  } catch (error) {
    fail("league: loop", String(error));
  } finally {
    if (competitionId) {
      await runQuery(`delete from competition where id = $1`, [competitionId])
        .then(() => ok("league: the smoke-League is deleted"))
        .catch((error) =>
          fail("league: the smoke-League is deleted", String(error)),
        );
    }
    if (linked.length > 0) {
      await runQuery(`update participant set email = null where id = any($1)`, [
        linked,
      ]).catch((error) =>
        fail("league: clear the smoke Participants' emails", String(error)),
      );
    }
  }
}

// ---------------------------------------------------------------------------
// XII's seeded Leagues: seeds twice, a reload over a re-paired League, MCP
// ---------------------------------------------------------------------------

const XII_ROUND_ROBIN = "Chess Round Robin";
const XII_SWISS = "Chess Swiss";

const XII_COUNTS = `
  select
    (select count(*)::int from league_match m join competition c on c.id = m.competition_id
       join war_week w on w.id = c.war_week_id where w.edition = 'xii') as league_match,
    (select count(*)::int from entrant e join competition c on c.id = e.competition_id
       join war_week w on w.id = c.war_week_id where w.edition = 'xii') as entrant,
    (select count(*)::int from points_entry p join war_week w on w.id = p.war_week_id
       where w.edition = 'xii') as points_entry,
    (select count(*)::int from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xii') as competition`;

type Counts = {
  league_match: number;
  entrant: number;
  points_entry: number;
  competition: number;
};

const counts = async () => (await runQuery<Counts>(XII_COUNTS))[0];

type McpLeague = {
  found?: boolean;
  competition?: Record<string, unknown>;
  standings?: {
    rank: number;
    name: string;
    matchPoints: number;
    tiebreaks: Record<string, number | null>;
    points: number | null;
    provisional: boolean;
  }[];
  rounds?: {
    round: number;
    matches: { a: string; b: string | null; result: string | null }[];
  }[];
};

/**
 * XII's demo Leagues (Chess Round Robin, Closed; Chess Swiss, in play),
 * which only XII's demo seed holds: ends XI by SQL so XII (the demo is
 * live; the lifecycle step has deleted the committed XII) is the current
 * War Week, loads `seeds/demo/xii.json` twice (no row count changes), re-pairs an unplayed Swiss Match by SQL and reloads (the
 * pairing stays and nothing throws), reads both over MCP (`get_league`:
 * pairing, rounds, Matches with results, standings with tiebreaks, no
 * `@`; `get_bracket`, `get_games`, `get_placements` and `get_participation`
 * point to it) and checks their Participant and admin pages hold no roster
 * email. Then XI is live again and XII is back to its committed seed.
 */
export async function assertLeagueSeeds(sessions: {
  organizer: SmokeSession;
  host: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  // The lifecycle step deletes XII before this one; put back what was there.
  const [{ existed }] = await runQuery<{ existed: boolean }>(
    "select exists (select 1 from war_week where edition = 'xii') as existed",
  );
  try {
    await runQuery(
      "update war_week set status = 'complete' where edition = 'xi'",
    );
    const load = (n: number) =>
      runStep(
        "pnpm",
        ["seed:load", "seeds/demo/xii.json"],
        `league: pnpm seed:load seeds/demo/xii.json (XII demo, load ${n})`,
      );
    if (!load(1)) return;
    const first = await counts();
    if (!load(2)) return;
    const second = await counts();
    await runCheck(
      "league: the XII demo's Leagues load twice with no league_match, entrant, points_entry or competition count changing",
      async () =>
        JSON.stringify(first) === JSON.stringify(second) &&
        first.league_match === 27
          ? null
          : `first=${JSON.stringify(first)} second=${JSON.stringify(second)}`,
    );

    await runCheck(
      "league: a reload over a re-paired Chess Swiss changes nothing and doesn't throw",
      async () => {
        const open = await runQuery<{ id: string; a: string }>(
          `select m.id, m.entrant_a_id as a from league_match m
           join competition c on c.id = m.competition_id
           join war_week w on w.id = c.war_week_id
           where w.edition = 'xii' and c.name = $1 and m.round = 3
             and m.result is null order by m.position`,
          [XII_SWISS],
        );
        if (open.length < 2) return `unplayed round 3 Matches: ${open.length}`;
        const [x, y] = open;
        await runQuery(
          `update league_match set entrant_a_id = case id when $1 then $4::uuid else $3::uuid end
           where id in ($1, $2)`,
          [x.id, y.id, x.a, y.a],
        );
        const snapshot = () =>
          runQuery(
            `select m.id, m.round, m.position, m.entrant_a_id, m.entrant_b_id, m.result
             from league_match m join competition c on c.id = m.competition_id
             join war_week w on w.id = c.war_week_id
             where w.edition = 'xii' order by m.id`,
          );
        const before = JSON.stringify(await snapshot());
        const countsBefore = await counts();
        if (
          !runStep(
            "pnpm",
            ["seed:load", "seeds/demo/xii.json"],
            "league: pnpm seed:load seeds/demo/xii.json over the re-paired Chess Swiss",
          )
        ) {
          return "the reload failed";
        }
        const after = JSON.stringify(await snapshot());
        const moved = (await snapshot()).some(
          (m) => m.id === x.id && m.entrant_a_id === y.a,
        );
        return before === after &&
          moved &&
          JSON.stringify(await counts()) === JSON.stringify(countsBefore)
          ? null
          : "the reload changed the pairings or a count";
      },
    );

    await assertLeagueMcp();
    await assertNoRosterEmailInLeagues(
      sessions,
      [XII_ROUND_ROBIN, XII_SWISS],
      SMOKE_HOST_EMAIL,
      "smoke-organizer@jahnelgroup.com",
      SMOKE_PARTICIPANT_EMAIL,
    );
  } catch (error) {
    fail("league: XII seeds phase", String(error));
  } finally {
    await deleteSmokeHosts().catch((error) =>
      fail("league: remove the smoke Host from XII", String(error)),
    );
    // The demo XII is live, so it goes before XI is live again.
    const restoreXii = existed
      ? runStep(
          "pnpm",
          ["seed:load", "--reset", "seeds/xii.json"],
          "league: pnpm seed:load --reset seeds/xii.json puts XII's committed seed back",
        )
      : await runQuery("delete from war_week where edition = 'xii'").then(
          () => true,
          (error) => {
            fail("league: delete the demo XII", String(error));
            return false;
          },
        );
    if (restoreXii) ok("league: XII is back as it was before this step");
    await runQuery(
      "update war_week set status = 'live', winner = null where edition = 'xi'",
    )
      .then(() => ok("league: XI is live again"))
      .catch((error) => fail("league: restore XI live", String(error)));
  }
}

/** `get_league` on both XII Leagues and the redirects to it (AC 8); the tool list is `assertMcp`'s. */
async function assertLeagueMcp() {
  const call = async (name: string, competition: string) => {
    const { text, parsed } = await mcpTool(name, { competition });
    return { text, parsed } as {
      text: string;
      parsed: McpLeague & Record<string, unknown>;
    };
  };

  await runCheck(
    "league: MCP get_league(Chess Swiss) returns the pairing, 3 rounds of 4 Matches with results, and standings with Buchholz, with no @",
    async () => {
      const { text, parsed } = await call("get_league", XII_SWISS);
      const rounds = parsed.rounds ?? [];
      const standings = parsed.standings ?? [];
      const played = (n: number) =>
        rounds[n - 1]?.matches.filter((m) => m.result !== null).length;
      const checks = {
        found: parsed.found === true,
        format: parsed.competition?.format === "league",
        pairing: parsed.competition?.pairing === "swiss",
        rounds: parsed.competition?.rounds === 3,
        roundsPaired: parsed.competition?.roundsPaired === 3,
        closed: parsed.competition?.closed === false,
        threeRounds: rounds.length === 3,
        round1: rounds[0]?.matches.length === 4 && played(1) === 4,
        round2: rounds[1]?.matches.length === 4 && played(2) === 4,
        round3: rounds[2]?.matches.length === 4 && played(3) === 1,
        standings: standings.length === 8,
        first: standings[0]?.rank === 1 && standings[0]?.name === "Ada Anvil",
        buchholz: standings.every(
          (s) => typeof s.tiebreaks.buchholz === "number",
        ),
        // Only the places that earn Placement Points have any, and they are
        // Provisional until Closed.
        provisional:
          standings.filter((s) => s.points !== null).length === 3 &&
          standings.every((s) => s.provisional === (s.points !== null)),
        noAt: !text.includes("@"),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  await runCheck(
    "league: MCP get_league(Chess Round Robin) returns 5 rounds of Matches with results and the standings with head-to-head and Sonneborn-Berger, Closed with its points, with no @",
    async () => {
      const { text, parsed } = await call("get_league", XII_ROUND_ROBIN);
      const rounds = parsed.rounds ?? [];
      const standings = parsed.standings ?? [];
      const byName = Object.fromEntries(standings.map((s) => [s.name, s]));
      const checks = {
        found: parsed.found === true,
        pairing: parsed.competition?.pairing === "round robin",
        rounds: parsed.competition?.rounds === 5 && rounds.length === 5,
        closed: parsed.competition?.closed === true,
        results:
          rounds
            .flatMap((r) => r.matches)
            .filter((m) => m.b !== null && m.result !== null).length === 10,
        sitOuts:
          rounds.flatMap((r) => r.matches).filter((m) => m.b === null)
            .length === 5,
        order:
          JSON.stringify(standings.map((s) => [s.rank, s.name])) ===
          JSON.stringify([
            [1, "Ada Anvil"],
            [2, "Bo Banner"],
            [3, "Eli Ember"],
            [4, "Cass Comet"],
            [5, "Dot Dynamo"],
          ]),
        matchPoints:
          JSON.stringify(standings.map((s) => s.matchPoints)) ===
          JSON.stringify([2.5, 2.5, 2, 2, 1]),
        headToHead:
          byName["Ada Anvil"]?.tiebreaks.headToHead === 1 &&
          byName["Bo Banner"]?.tiebreaks.headToHead === 0 &&
          byName["Dot Dynamo"]?.tiebreaks.headToHead === null,
        sonnebornBerger:
          byName["Cass Comet"]?.tiebreaks.sonnebornBerger === 3.25 &&
          byName["Eli Ember"]?.tiebreaks.sonnebornBerger === 4,
        points:
          JSON.stringify(standings.map((s) => s.points)) ===
          JSON.stringify([5, 3, 1, null, null]),
        final: standings.every((s) => s.provisional === false),
        noAt: !text.includes("@"),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  for (const [tool, field] of [
    ["get_bracket", "bracket"],
    ["get_games", "matches"],
    ["get_placements", "placements"],
    ["get_participation", "participation"],
  ] as const) {
    await runCheck(
      `league: MCP ${tool}(Chess Swiss) answers ${field}: null and points to get_league`,
      async () => {
        const { text, parsed } = await call(tool, XII_SWISS);
        return parsed.found === true &&
          parsed[field] === null &&
          String((parsed as { message?: string }).message).includes(
            "get_league",
          ) &&
          !text.includes("@")
          ? null
          : text.slice(0, 300);
      },
    );
  }

  await runCheck(
    "league: MCP get_league(Mile Run) answers league: null and points to get_placements",
    async () => {
      const { parsed } = await call("get_league", "Mile Run");
      return parsed.found === true &&
        parsed.league === null &&
        String((parsed as { message?: string }).message).includes(
          "get_placements",
        )
        ? null
        : JSON.stringify(parsed);
    },
  );
}
