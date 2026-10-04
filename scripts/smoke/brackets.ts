import type { WriteResult } from "@/lib/result";

import {
  BASE_URL,
  MCP_TOKEN,
  type SmokeSession,
  callAction,
  fail,
  leaderboardTeamTotal,
  ok,
  runQuery,
  serverActionIds,
  signedInFetch,
  xiWarWeekId,
} from "./harness";
import { mcpTool } from "./mcp";

/**
 * Saves one setting of a Competition, as its admin page does (ticket 101):
 * every setting, the Entrants and building the Bracket go through this one
 * action, under the lock table.
 */
function saveSetting(
  ids: Record<string, string>,
  id: string,
  field: string,
  value: unknown,
  session: SmokeSession,
): Promise<WriteResult> {
  return callAction(
    ids.saveCompetitionSetting,
    [id, { field, value }],
    session,
  );
}

/** Makes a new Competition a Bracket with `config`: its Format, then its match settings. */
async function runAsBracket(
  ids: Record<string, string>,
  id: string,
  config: {
    kind: "head-to-head" | "group";
    entrantsPerMatch: number;
    advancePerMatch: number;
    thirdPlaceMatch: boolean;
    rounds: Record<string, never>;
  },
  session: SmokeSession,
): Promise<WriteResult> {
  const format = await saveSetting(ids, id, "format", "bracket", session);
  if (!format.ok) return format;
  return saveSetting(ids, id, "bracketConfig", config, session);
}

// The bracket loop check's own Competition and extra Teams (XI has two
// Teams), deleted after the check and before it, so it's rerunnable.
const SMOKE_BRACKET_COMPETITION = "SMOKE TEST bracket";
const SMOKE_BRACKET_TEAMS = ["SMOKE Bracket Gold", "SMOKE Bracket Green"];

export async function deleteSmokeBracket() {
  await runQuery(
    `delete from points_entry where competition_id in
     (select id from competition where name = $1)`,
    [SMOKE_BRACKET_COMPETITION],
  );
  // Deleting the Competition cascades its Entrants and Matches.
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_BRACKET_COMPETITION,
  ]);
  await runQuery(`delete from team where name = any($1)`, [
    SMOKE_BRACKET_TEAMS,
  ]);
}

export async function assertBracketLoop(sessions: { organizer: SmokeSession }) {
  const check =
    "bracket loop: an Organizer sets a head-to-head Bracket (2 per Match, 1 advances) with a 3rd place Match on a Competition, enters 4 Teams, generates, records 4 Match Results, closes; GET /xi/competitions/<id> shows Red as Winner in Top finishers (no Winner, no Play the finale) and /xi/leaderboard includes the generated points and /xi/finale/<id> answers 200; get_bracket names the Bracket with its match size, advancing and 3rd place Match, a recorded time per played Match, no Match time, place or Forfeit, the final's winner as winner (no winner field), matches (no matches) and closed (no closed) and no @; reopen removes them and /xi/finale/<id> answers 404; a semifinal the final used can't be edited (D1c) until the later Matches are cleared; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "saveCompetitionSetting",
    "recordMatchResult",
    "clearMatchResult",
    "closeBracket",
    "reopenBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("bracket action ids", missing.join(", "));
    return;
  }
  const organizer = sessions.organizer;
  const get = (route: string) =>
    fetch(`${BASE_URL}${route}`, { headers: { cookie: organizer.cookie } });

  const problems: string[] = [];
  try {
    await deleteSmokeBracket();
    for (const [name, color] of [
      [SMOKE_BRACKET_TEAMS[0], "#ca8a04"],
      [SMOKE_BRACKET_TEAMS[1], "#16a34a"],
    ]) {
      await runQuery(
        `insert into team (war_week_id, name, color)
         select id, $1, $2 from war_week where edition = 'xi'`,
        [name, color],
      );
    }
    const expectOk = (
      step: string,
      result: { ok: boolean; error?: string },
    ) => {
      if (!result.ok) problems.push(`${step}: ${result.error}`);
    };
    const expectRefused = (
      step: string,
      result: { ok: boolean; error?: string },
      expected: string,
    ) => {
      if (result.ok || result.error !== expected) {
        problems.push(`${step}: ${JSON.stringify(result)}`);
      }
    };

    expectOk(
      "createCompetition",
      await callAction(
        ids.createCompetition,
        [
          await xiWarWeekId(),
          {
            name: SMOKE_BRACKET_COMPETITION,
            description: "",
            scoring: "team",
            placementPoints: "10, 6, 3",
            countsTowardTeam: false,
            group: "",
          },
        ],
        organizer,
      ),
    );
    const [competition] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = $1`,
      [SMOKE_BRACKET_COMPETITION],
    );
    if (!competition) throw new Error(problems.join("; ") || "not created");
    const id = competition.id;

    expectOk(
      "run as a Bracket",
      await runAsBracket(
        ids,
        id,
        {
          kind: "head-to-head" as const,
          entrantsPerMatch: 2,
          advancePerMatch: 1,
          thirdPlaceMatch: false,
          rounds: {},
        },
        organizer,
      ),
    );
    const teams = await runQuery<{ id: string }>(
      `select t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 4) problems.push(`XI has ${teams.length} Teams`);
    expectOk(
      "entrants",
      await saveSetting(
        ids,
        id,
        "entrants",
        { targetIds: teams.map((t) => t.id) },
        organizer,
      ),
    );
    // A 3rd place Match needs at least 4 Entrants, so it's turned on once
    // they're entered.
    expectOk(
      "bracketConfig with a 3rd place Match",
      await saveSetting(
        ids,
        id,
        "bracketConfig",
        {
          kind: "head-to-head" as const,
          entrantsPerMatch: 2,
          advancePerMatch: 1,
          thirdPlaceMatch: true,
          rounds: {},
        },
        organizer,
      ),
    );
    expectOk(
      "build the Bracket",
      await saveSetting(ids, id, "bracket", null, organizer),
    );

    const before = await leaderboardTeamTotal("Red");
    // Red wins every Match it's in, so it's the Winner; otherwise the
    // first slot wins.
    let recorded = 0;
    for (const round of [1, 2]) {
      const slots = await runQuery<{
        bracket_match_id: string;
        entrant_id: string;
        team_name: string;
      }>(
        `select h.id as bracket_match_id, he.entrant_id, t.name as team_name
         from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
         join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
         where h.competition_id = $1 and h.round = $2
         order by h.position, he.slot`,
        [id, round],
      );
      for (const matchId of [
        ...new Set(slots.map((s) => s.bracket_match_id)),
      ]) {
        const inMatch = slots.filter((s) => s.bracket_match_id === matchId);
        const order = [
          ...inMatch.filter((s) => s.team_name === "Red"),
          ...inMatch.filter((s) => s.team_name !== "Red"),
        ].map((s) => s.entrant_id);
        const result = await callAction(
          ids.recordMatchResult,
          [id, matchId, { order, scores: { [order[0]]: "21" } }],
          organizer,
        );
        expectOk(`recordMatchResult round ${round}`, result);
        if (result.ok) recorded += 1;
      }
    }
    // Two semifinals, then the final and the 3rd place Match.
    if (recorded !== 4) problems.push(`recorded ${recorded} Match Results`);

    for (const route of [`/admin/competitions/${id}`]) {
      const res = await get(route);
      const body = await res.text();
      if (res.status !== 200 || !body.includes(SMOKE_BRACKET_COMPETITION)) {
        problems.push(`${route} status=${res.status}`);
      }
    }

    expectOk(
      "closeBracket",
      await callAction(ids.closeBracket, [id], organizer),
    );
    const page = await (
      await signedInFetch(`${BASE_URL}/xi/competitions/${id}`)
    ).text();
    if (
      !/aria-label="Top finishers"[\s\S]*?data-winner="true"(?:(?!<\/li>)[\s\S])*?>Red</.test(
        page,
      )
    ) {
      problems.push("the Competition page's Top finishers show no Red Winner");
    }
    if (/Champion|Play the finale/i.test(page)) {
      problems.push("the Competition page says Champion or Play the finale");
    }
    if (/\bHeats?\b|Finali[sz]e|Un-finali[sz]e/.test(page)) {
      problems.push("the Competition page says Heat, Finalize or Un-finalize");
    }
    const closed = await leaderboardTeamTotal("Red");
    if (before === null || closed !== before + 10) {
      problems.push(`Red total ${before} → ${closed}, expected +10`);
    }
    const finale = await get(`/xi/finale/${id}`);
    const finaleBody = await finale.text();
    if (
      finale.status !== 200 ||
      !finaleBody.includes('data-finale="ready"') ||
      !finaleBody.includes(SMOKE_BRACKET_COMPETITION)
    ) {
      problems.push(`/xi/finale/<id> after close status=${finale.status}`);
    }

    // get_bracket over /api/mcp, with the bearer token and no session.
    const bearer = { Authorization: `Bearer ${MCP_TOKEN}` };
    const bracket = await mcpTool(
      "get_bracket",
      { competition: SMOKE_BRACKET_COMPETITION },
      undefined,
      "",
      bearer,
    );
    type McpMatch = Record<string, unknown> & {
      status: string;
      recordedAt: string | null;
      thirdPlace: boolean;
      entrants: { name: string; place: number | null }[];
    };
    const bracketPayload = bracket.parsed as
      | {
          found: boolean;
          competition?: Record<string, unknown>;
          winner?: string | null;
          entrants?: unknown[];
          rounds?: { round: number; matches: McpMatch[] }[];
        }
      | undefined;
    const rounds = bracketPayload?.rounds ?? [];
    const matches = rounds.flatMap((round) => round.matches ?? []);
    const lastRound = rounds[rounds.length - 1]?.matches ?? [];
    const finalMatch = lastRound.filter((match) => !match.thirdPlace);
    const thirdPlaceMatches = matches.filter((match) => match.thirdPlace);
    const finalWinner = finalMatch[0]?.entrants.find(
      (entrant) => entrant.place === 1,
    )?.name;
    const matchKeys = [
      "entrants",
      "name",
      "recordedAt",
      "status",
      "thirdPlace",
    ];
    const bracketProblems = [
      bracketPayload?.found !== true && "not found",
      bracketPayload?.competition?.format !== "bracket" && "format",
      bracketPayload?.competition?.matchSize !== 2 && "matchSize",
      bracketPayload?.competition?.advancing !== 1 && "advancing",
      bracketPayload?.competition?.thirdPlaceMatch !== true &&
        "thirdPlaceMatch",
      bracketPayload?.competition?.closed !== true && "closed",
      bracketPayload?.competition !== undefined &&
        ["heatSize", "thirdPlaceGame", "finalized"].some(
          (key) => key in bracketPayload.competition!,
        ) &&
        "an old Match or closed field",
      rounds.some((round) => "heats" in round) && "a heats field",
      bracketPayload?.entrants?.length !== 4 && "entrants",
      matches.length !== 4 && `${matches.length} Matches`,
      matches.some(
        (match) =>
          JSON.stringify(Object.keys(match).sort()) !==
          JSON.stringify(matchKeys),
      ) && "Match keys (no time, place or Forfeit)",
      matches.some(
        (match) =>
          match.status === "played" &&
          (match.recordedAt === null ||
            Number.isNaN(Date.parse(match.recordedAt))),
      ) && "a played Match without recordedAt",
      matches.some(
        (match) => match.status !== "played" && match.recordedAt !== null,
      ) && "an unplayed Match with recordedAt",
      (thirdPlaceMatches.length !== 1 ||
        !lastRound.includes(thirdPlaceMatches[0])) &&
        "one 3rd place Match in the last Round",
      finalMatch.length !== 1 && "one final",
      (finalWinner !== "Red" || bracketPayload?.winner !== finalWinner) &&
        "winner is the final's winner (Red)",
      bracketPayload !== undefined &&
        "champion" in bracketPayload &&
        "still has a champion field",
      /forfeit/i.test(bracket.text) && "mentions Forfeit",
      bracket.text.includes("@") && "has an @",
    ].filter(Boolean);
    if (bracketProblems.length > 0) {
      problems.push(
        `get_bracket (${bracketProblems.join(", ")}) result=${bracket.text}`,
      );
    }
    const missingBracket = await mcpTool(
      "get_bracket",
      { competition: "no such competition" },
      undefined,
      "",
      bearer,
    );
    if (missingBracket.parsed?.found !== false) {
      problems.push(
        `get_bracket(no such competition) result=${JSON.stringify(missingBracket.parsed)}`,
      );
    }

    const competitionPage = await (await get(`/xi/competitions/${id}`)).text();
    if (competitionPage.includes("Points Entries")) {
      problems.push("/xi/competitions/<id> renders a Points Entries section");
    }

    expectOk(
      "reopenBracket",
      await callAction(ids.reopenBracket, [id], organizer),
    );
    const unclosed = await leaderboardTeamTotal("Red");
    if (unclosed !== before) {
      problems.push(`Red total after reopen ${unclosed} != ${before}`);
    }
    const unclosedFinale = await get(`/xi/finale/${id}`);
    if (unclosedFinale.status !== 404) {
      problems.push(
        `/xi/finale/<id> after reopen status=${unclosedFinale.status}`,
      );
    }
    const [{ count }] = await runQuery<{ count: string }>(
      `select count(*) from points_entry where competition_id = $1`,
      [id],
    );
    if (Number(count) !== 0) problems.push(`${count} Points Entries remain`);

    // Every Match is decided, and the final and the 3rd place Match used
    // both semifinals (spec R21, D1c): a score-only edit and a winner change
    // of a semifinal are refused and reset nothing. Clearing those two
    // later Matches lets the winner change through.
    const semis = await runQuery<{
      bracket_match_id: string;
      entrant_id: string;
      team_name: string;
    }>(
      `select h.id as bracket_match_id, he.entrant_id, t.name as team_name
       from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
       join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
       where h.competition_id = $1 and h.round = 1
       order by h.position, he.slot`,
      [id],
    );
    const decidedLater = async () =>
      runQuery<{ id: string }>(
        `select id from bracket_match
         where competition_id = $1 and round > 1 and status = 'played'`,
        [id],
      );
    const laterBefore = await decidedLater();
    const redMatch = semis.find((s) => s.team_name === "Red")?.bracket_match_id;
    const otherMatch = semis.find(
      (s) => s.bracket_match_id !== redMatch,
    )?.bracket_match_id;
    const [{ entrant_id: otherWinner }] = await runQuery<{
      entrant_id: string;
    }>(
      `select entrant_id from bracket_match_entrant where bracket_match_id = $1 and place = 1`,
      [otherMatch],
    );
    const record = (matchId: string, order: string[]) =>
      callAction(
        ids.recordMatchResult,
        [id, matchId, { order, scores: { [order[0]]: "25" } }],
        organizer,
      );
    const redOrder = [
      ...semis.filter(
        (s) => s.bracket_match_id === redMatch && s.team_name === "Red",
      ),
      ...semis.filter(
        (s) => s.bracket_match_id === redMatch && s.team_name !== "Red",
      ),
    ].map((s) => s.entrant_id);
    const flipped = semis
      .filter((s) => s.bracket_match_id === otherMatch)
      .map((s) => s.entrant_id)
      .sort((a, b) => Number(a === otherWinner) - Number(b === otherWinner));
    expectRefused(
      "recordMatchResult same winner on a semifinal the final used",
      await record(redMatch!, redOrder),
      LATER_MATCH_USED,
    );
    expectRefused(
      "recordMatchResult changed winner on a semifinal the final used",
      await record(otherMatch!, flipped),
      LATER_MATCH_USED,
    );
    if ((await decidedLater()).length !== laterBefore.length) {
      problems.push("a refused semifinal edit reset a later Match");
    }
    for (const later of laterBefore) {
      expectOk(
        "clearMatchResult on a later Match",
        await callAction(ids.clearMatchResult, [id, later.id], organizer),
      );
    }
    expectOk(
      "recordMatchResult changed winner once the later Matches are cleared",
      await record(otherMatch!, flipped),
    );
    if ((await decidedLater()).length !== 0) {
      problems.push("a later Match is still played after clearing");
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, [String(error), ...problems].join("; "));
  } finally {
    await deleteSmokeBracket().catch((error) =>
      fail("delete the smoke bracket", String(error)),
    );
  }
}

// The matches loop check's own Competition and extra Teams, deleted after the
// check and before it, so it's rerunnable.
const SMOKE_MATCHES_COMPETITION = "SMOKE TEST matches";
const SMOKE_MATCHES_TEAMS = ["SMOKE Matches Gold", "SMOKE Matches Green"];

export async function deleteSmokeMatches() {
  await runQuery(
    `delete from points_entry where competition_id in
     (select id from competition where name = $1)`,
    [SMOKE_MATCHES_COMPETITION],
  );
  // Deleting the Competition cascades its Entrants and Matches.
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_MATCHES_COMPETITION,
  ]);
  await runQuery(`delete from team where name = any($1)`, [
    SMOKE_MATCHES_TEAMS,
  ]);
}

export async function assertMatchesLoop(sessions: { organizer: SmokeSession }) {
  const check =
    "matches loop: an Organizer sets a Bracket of 4 per Match, 2 advance, on a Competition, enters 4 Teams, generates one Match of four, records its four-Entrant Match Result, closes; GET /xi/competitions/<id> shows Red as Winner in Top finishers (no Winner, no Play the finale) and /xi/leaderboard includes the generated points; reopen removes them; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "saveCompetitionSetting",
    "recordMatchResult",
    "closeBracket",
    "reopenBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("matches action ids", missing.join(", "));
    return;
  }
  const organizer = sessions.organizer;

  try {
    await deleteSmokeMatches();
    for (const [name, color] of [
      [SMOKE_MATCHES_TEAMS[0], "#ca8a04"],
      [SMOKE_MATCHES_TEAMS[1], "#16a34a"],
    ]) {
      await runQuery(
        `insert into team (war_week_id, name, color)
         select id, $1, $2 from war_week where edition = 'xi'`,
        [name, color],
      );
    }
    const problems: string[] = [];
    const expectOk = (
      step: string,
      result: { ok: boolean; error?: string },
    ) => {
      if (!result.ok) problems.push(`${step}: ${result.error}`);
    };

    expectOk(
      "createCompetition",
      await callAction(
        ids.createCompetition,
        [
          await xiWarWeekId(),
          {
            name: SMOKE_MATCHES_COMPETITION,
            description: "",
            scoring: "team",
            placementPoints: "10, 6, 3",
            countsTowardTeam: false,
            group: "",
          },
        ],
        organizer,
      ),
    );
    const [competition] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = $1`,
      [SMOKE_MATCHES_COMPETITION],
    );
    if (!competition) throw new Error(problems.join("; ") || "not created");
    const id = competition.id;

    expectOk(
      "run as a Bracket",
      await runAsBracket(
        ids,
        id,
        {
          kind: "group" as const,
          entrantsPerMatch: 4,
          advancePerMatch: 2,
          thirdPlaceMatch: false,
          rounds: {},
        },
        organizer,
      ),
    );
    const teams = await runQuery<{ id: string }>(
      `select t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 4) problems.push(`XI has ${teams.length} Teams`);
    expectOk(
      "entrants",
      await saveSetting(
        ids,
        id,
        "entrants",
        { targetIds: teams.map((t) => t.id) },
        organizer,
      ),
    );
    expectOk(
      "build the Bracket",
      await saveSetting(ids, id, "bracket", null, organizer),
    );

    const slots = await runQuery<{
      bracket_match_id: string;
      slot_count: number;
      entrant_id: string;
      team_name: string;
    }>(
      `select h.id as bracket_match_id, h.slot_count, he.entrant_id, t.name as team_name
       from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
       join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
       where h.competition_id = $1
       order by h.round, h.position, he.slot`,
      [id],
    );
    const matchIds = [...new Set(slots.map((s) => s.bracket_match_id))];
    if (matchIds.length !== 1 || slots.length !== 4) {
      problems.push(
        `generated ${matchIds.length} Matches holding ${slots.length} Entrants, expected one Match of four`,
      );
    }

    const before = await leaderboardTeamTotal("Red");
    // Red finishes first; the rest in slot order.
    const order = [
      ...slots.filter((s) => s.team_name === "Red"),
      ...slots.filter((s) => s.team_name !== "Red"),
    ].map((s) => s.entrant_id);
    expectOk(
      "recordMatchResult",
      await callAction(
        ids.recordMatchResult,
        [id, matchIds[0], { order, scores: { [order[0]]: "62" } }],
        organizer,
      ),
    );

    expectOk(
      "closeBracket",
      await callAction(ids.closeBracket, [id], organizer),
    );
    const page = await (
      await signedInFetch(`${BASE_URL}/xi/competitions/${id}`)
    ).text();
    if (
      !/aria-label="Top finishers"[\s\S]*?data-winner="true"(?:(?!<\/li>)[\s\S])*?>Red</.test(
        page,
      )
    ) {
      problems.push("the Competition page's Top finishers show no Red Winner");
    }
    if (/Champion|Play the finale/i.test(page)) {
      problems.push("the Competition page says Champion or Play the finale");
    }
    if (/\bHeats?\b|Finali[sz]e|Un-finali[sz]e/.test(page)) {
      problems.push("the Competition page says Heat, Finalize or Un-finalize");
    }
    const closed = await leaderboardTeamTotal("Red");
    if (before === null || closed !== before + 10) {
      problems.push(`Red total ${before} → ${closed}, expected +10`);
    }

    expectOk(
      "reopenBracket",
      await callAction(ids.reopenBracket, [id], organizer),
    );
    const unclosed = await leaderboardTeamTotal("Red");
    if (unclosed !== before) {
      problems.push(`Red total after reopen ${unclosed} != ${before}`);
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeMatches().catch((error) =>
      fail("delete the smoke matches", String(error)),
    );
  }
}

// The Squad + self-report loop's own Competition. It reuses XI's two native
// Teams (Red, Blue) and email-less Participants of the seeded roster, so
// unlike the two loops above it inserts no extra Teams; deleting the
// Competition cascades its Squads, Entrants and Matches.
const SMOKE_SQUAD_COMPETITION = "SMOKE TEST squads";
const SMOKE_SQUAD_PARTICIPANT_EMAIL = "smoke-participant@jahnelgroup.com";
const SELF_REPORT_OFF = "Self-report is off for this Competition.";
const NOT_IN_MATCH = "You're not in this Match.";
const LATER_MATCH_USED =
  "A later Match already used this result. Change that Match first.";
const NOT_HOST_REFUSAL_SQUAD = "You're not a Host of that Competition.";

async function deleteSmokeSquadCompetition() {
  await runQuery(
    `delete from points_entry where competition_id in
     (select id from competition where name = $1)`,
    [SMOKE_SQUAD_COMPETITION],
  );
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_SQUAD_COMPETITION,
  ]);
}

export async function assertSquadSelfReportLoop(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
  outsider: SmokeSession;
}) {
  const check =
    "squad loop: an Organizer builds a head-to-head Bracket of four Squads from XI's two Teams; with self-report off a linked Participant's report is refused, then on it is recorded and their Squad advances, they change it again (D1d), an outsider's POST is refused, the Organizer overwrites and re-records, the Participant reports the Final, and then nobody (Organizer or Participant) can change a semifinal the Final used (D1c); close gives the two finalist Squads' Teams 10 and 6 (no 3rd place match: the semifinal losers get nothing); then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "saveCompetitionSetting",
    "createSquad",
    "reportMatchResult",
    "recordMatchResult",
    "closeBracket",
    "reopenBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("squad loop action ids", missing.join(", "));
    return;
  }
  const { organizer, notOrganizer, outsider } = sessions;
  const get = (route: string, session: SmokeSession = organizer) =>
    fetch(`${BASE_URL}${route}`, { headers: { cookie: session.cookie } });

  const problems: string[] = [];
  const expectOk = (step: string, result: { ok: boolean; error?: string }) => {
    if (!result.ok) problems.push(`${step}: ${result.error}`);
  };
  const expectRefused = (
    step: string,
    result: { ok: boolean; error?: string },
    expected: string,
  ) => {
    if (result.ok || result.error !== expected) {
      problems.push(`${step}: ${JSON.stringify(result)}`);
    }
  };

  let borrowedParticipantId: string | undefined;

  try {
    await deleteSmokeSquadCompetition();

    expectOk(
      "createCompetition",
      await callAction(
        ids.createCompetition,
        [
          await xiWarWeekId(),
          {
            name: SMOKE_SQUAD_COMPETITION,
            description: "",
            scoring: "team",
            placementPoints: "10, 6, 3",
            countsTowardTeam: false,
            group: "",
          },
        ],
        organizer,
      ),
    );
    const [competition] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = $1`,
      [SMOKE_SQUAD_COMPETITION],
    );
    if (!competition) throw new Error(problems.join("; ") || "not created");
    const id = competition.id;

    expectOk(
      "format bracket",
      await saveSetting(ids, id, "format", "bracket", organizer),
    );

    // XI's two native Teams, and 5 email-less Participants of each (4 for
    // two Squads of two, the 5th a spare for the cross-Team refusal case).
    const teams = await runQuery<{ id: string; name: string }>(
      `select t.id, t.name from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 2) problems.push(`XI has ${teams.length} Teams`);
    const rosters = await Promise.all(
      teams.map((t) =>
        runQuery<{ id: string; display_name: string }>(
          `select id, display_name from participant
           where team_id = $1 and email is null
           order by display_name limit 5`,
          [t.id],
        ),
      ),
    );
    if (rosters.some((r) => r.length < 5)) {
      problems.push(
        `a Team's email-less roster is short: ${JSON.stringify(rosters.map((r) => r.length))}`,
      );
    }

    const squadDefs = teams.flatMap((team, ti) => [
      {
        name: `SMOKE Squad ${team.name} Alpha`,
        teamId: team.id,
        participantIds: [rosters[ti][0].id, rosters[ti][1].id],
      },
      {
        name: `SMOKE Squad ${team.name} Bravo`,
        teamId: team.id,
        participantIds: [rosters[ti][2].id, rosters[ti][3].id],
      },
    ]);
    for (const def of squadDefs) {
      expectOk(
        `createSquad ${def.name}`,
        await callAction(ids.createSquad, [id, def], organizer),
      );
    }

    // A Participant already in a Squad of this Competition is refused.
    expectRefused(
      "createSquad with a Participant already in another Squad",
      await callAction(
        ids.createSquad,
        [
          id,
          {
            name: "SMOKE Squad Invalid Taken",
            teamId: teams[0].id,
            participantIds: [rosters[0][0].id],
          },
        ],
        organizer,
      ),
      `${rosters[0][0].display_name} is already in SMOKE Squad ${teams[0].name} Alpha.`,
    );
    // A Participant of the other Team is refused.
    expectRefused(
      "createSquad with a Participant of another Team",
      await callAction(
        ids.createSquad,
        [
          id,
          {
            name: "SMOKE Squad Invalid Team",
            teamId: teams[0].id,
            participantIds: [rosters[1][4].id],
          },
        ],
        organizer,
      ),
      "Every Participant in a Squad must be on the same Team.",
    );

    const squads = await runQuery<{ id: string; name: string }>(
      `select id, name from squad where competition_id = $1 order by name`,
      [id],
    );
    if (squads.length !== 4) {
      problems.push(`created ${squads.length} Squads, expected 4`);
    }

    expectOk(
      "entrants of kind squad",
      await saveSetting(
        ids,
        id,
        "entrants",
        { kind: "squad", targetIds: squads.map((s) => s.id) },
        organizer,
      ),
    );
    expectOk(
      "build the Bracket",
      await saveSetting(ids, id, "bracket", null, organizer),
    );

    const round1 = await runQuery<{
      bracket_match_id: string;
      entrant_id: string;
      squad_id: string;
    }>(
      `select h.id as bracket_match_id, he.entrant_id, e.squad_id
       from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
       join entrant e on e.id = he.entrant_id
       where h.competition_id = $1 and h.round = 1
       order by h.position, he.slot`,
      [id],
    );
    const matchIds = [...new Set(round1.map((r) => r.bracket_match_id))];
    if (matchIds.length !== 2 || round1.length !== 4) {
      problems.push(
        `generated ${matchIds.length} Round-1 Matches holding ${round1.length} Entrants, expected 2 Matches of two`,
      );
    }
    const [match1Id, match2Id] = matchIds;
    const [entrantA, entrantB] = round1.filter(
      (r) => r.bracket_match_id === match1Id,
    );
    const [entrantC, entrantD] = round1.filter(
      (r) => r.bracket_match_id === match2Id,
    );

    const [borrowed] = await runQuery<{ participant_id: string }>(
      `select participant_id from squad_participant where squad_id = $1
       order by participant_id limit 1`,
      [entrantA.squad_id],
    );
    borrowedParticipantId = borrowed.participant_id;
    await runQuery(`update participant set email = $1 where id = $2`, [
      SMOKE_SQUAD_PARTICIPANT_EMAIL,
      borrowedParticipantId,
    ]);

    expectRefused(
      "reportMatchResult while self-report is off",
      await callAction(ids.reportMatchResult, [id, match1Id, {}], notOrganizer),
      SELF_REPORT_OFF,
    );
    expectRefused(
      "selfReport as the linked Participant",
      await saveSetting(ids, id, "selfReport", true, notOrganizer),
      NOT_HOST_REFUSAL_SQUAD,
    );
    expectOk(
      "selfReport on",
      await saveSetting(ids, id, "selfReport", true, organizer),
    );
    expectRefused(
      "recordMatchResult as the linked Participant",
      await callAction(
        ids.recordMatchResult,
        [id, match1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
      NOT_HOST_REFUSAL_SQUAD,
    );
    expectRefused(
      "reportMatchResult on a Match their Squad isn't in",
      await callAction(ids.reportMatchResult, [id, match2Id, {}], notOrganizer),
      NOT_IN_MATCH,
    );

    // The outsider's session has a non-JG email, so `src/proxy.ts` answers
    // with a 307 to /sign-in before any action runs; `callAction` can't be
    // used (it expects a 200 RSC reply), so this POSTs directly.
    const outsiderRes = await fetch(`${BASE_URL}/admin/competitions`, {
      method: "POST",
      headers: {
        "next-action": ids.reportMatchResult,
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        origin: BASE_URL,
        cookie: outsider.cookie,
      },
      body: JSON.stringify([id, match1Id, {}]),
      redirect: "manual",
    });
    const outsiderLocation = outsiderRes.headers.get("location") ?? "";
    if (outsiderRes.status !== 307 || !outsiderLocation.includes("/sign-in")) {
      problems.push(
        `outsider POST reportMatchResult status=${outsiderRes.status} location=${outsiderLocation}`,
      );
    }
    const [match1BeforeReport] = await runQuery<{
      status: string;
      reported_by_email: string | null;
    }>(`select status, reported_by_email from bracket_match where id = $1`, [
      match1Id,
    ]);
    if (
      match1BeforeReport.status === "played" ||
      match1BeforeReport.reported_by_email !== null
    ) {
      problems.push(
        `the outsider's refused POST changed the Match: ${JSON.stringify(match1BeforeReport)}`,
      );
    }

    expectOk(
      "reportMatchResult",
      await callAction(
        ids.reportMatchResult,
        [id, match1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
    );
    const [match1AfterReport] = await runQuery<{
      status: string;
      reported_by_email: string | null;
    }>(`select status, reported_by_email from bracket_match where id = $1`, [
      match1Id,
    ]);
    if (
      match1AfterReport.status !== "played" ||
      match1AfterReport.reported_by_email !== SMOKE_SQUAD_PARTICIPANT_EMAIL
    ) {
      problems.push(
        `match1 after report: ${JSON.stringify(match1AfterReport)}`,
      );
    }
    const finalSlotAfterReport = await runQuery<{ entrant_id: string }>(
      `select he.entrant_id from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
       where h.competition_id = $1 and h.round = 2 and he.entrant_id = $2`,
      [id, entrantA.entrant_id],
    );
    if (finalSlotAfterReport.length !== 1) {
      problems.push("the reported Squad didn't reach the Final's slot");
    }

    expectOk(
      "reportMatchResult again on their decided Match (a player changes it, D1d)",
      await callAction(
        ids.reportMatchResult,
        [id, match1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
    );

    const resultsPage = await (await get(`/admin/competitions/${id}`)).text();
    if (!resultsPage.includes("Reported by")) {
      problems.push("/admin/competitions/<id> shows no 'Reported by' line");
    }

    expectOk(
      "recordMatchResult overwrites with the other Squad winning",
      await callAction(
        ids.recordMatchResult,
        [id, match1Id, { order: [entrantB.entrant_id, entrantA.entrant_id] }],
        organizer,
      ),
    );
    const [match1AfterOverwrite] = await runQuery<{
      reported_by_email: string | null;
      reported_by_participant_id: string | null;
    }>(
      `select reported_by_email, reported_by_participant_id from bracket_match where id = $1`,
      [match1Id],
    );
    if (
      match1AfterOverwrite.reported_by_email !== null ||
      match1AfterOverwrite.reported_by_participant_id !== null
    ) {
      problems.push(
        `the Host overwrite left a reporter: ${JSON.stringify(match1AfterOverwrite)}`,
      );
    }
    const finalSlotAfterOverwrite = await runQuery<{ entrant_id: string }>(
      `select he.entrant_id from bracket_match h join bracket_match_entrant he on he.bracket_match_id = h.id
       where h.competition_id = $1 and h.round = 2 and he.entrant_id = $2`,
      [id, entrantB.entrant_id],
    );
    if (finalSlotAfterOverwrite.length !== 1) {
      problems.push("the overwrite didn't move the Final's slot");
    }

    expectOk(
      "recordMatchResult records the linked Squad back in",
      await callAction(
        ids.recordMatchResult,
        [id, match1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        organizer,
      ),
    );
    expectOk(
      "recordMatchResult records the other Semifinal",
      await callAction(
        ids.recordMatchResult,
        [id, match2Id, { order: [entrantC.entrant_id, entrantD.entrant_id] }],
        organizer,
      ),
    );

    const [finalMatch] = await runQuery<{ id: string }>(
      `select id from bracket_match where competition_id = $1 and round = 2 and not third_place limit 1`,
      [id],
    );
    expectOk(
      "reportMatchResult on the Final",
      await callAction(
        ids.reportMatchResult,
        [
          id,
          finalMatch.id,
          { order: [entrantA.entrant_id, entrantC.entrant_id] },
        ],
        notOrganizer,
      ),
    );

    // The Final used both semifinals: nobody changes them now (D1c).
    expectRefused(
      "recordMatchResult on a semifinal the Final used",
      await callAction(
        ids.recordMatchResult,
        [id, match1Id, { order: [entrantB.entrant_id, entrantA.entrant_id] }],
        organizer,
      ),
      LATER_MATCH_USED,
    );
    expectRefused(
      "reportMatchResult on a semifinal the Final used",
      await callAction(
        ids.reportMatchResult,
        [id, match1Id, { order: [entrantB.entrant_id, entrantA.entrant_id] }],
        notOrganizer,
      ),
      LATER_MATCH_USED,
    );

    const beforeTotals: Record<string, number> = {};
    for (const team of teams) {
      beforeTotals[team.name] = (await leaderboardTeamTotal(team.name)) ?? 0;
    }

    expectOk(
      "closeBracket",
      await callAction(ids.closeBracket, [id], organizer),
    );
    const entries = await runQuery<{
      team_id: string | null;
      points: string;
      generated: boolean;
    }>(
      `select team_id, points, generated from points_entry where competition_id = $1`,
      [id],
    );
    for (const entry of entries) {
      if (!entry.team_id || !entry.generated) {
        problems.push(
          `a Points Entry with no Team or not generated: ${JSON.stringify(entry)}`,
        );
      }
    }
    // A won the Final over C; with no 3rd place match B and D aren't placed.
    const teamOfSquad = async (squadId: string) =>
      (
        await runQuery<{ team_id: string }>(
          `select team_id from squad where id = $1`,
          [squadId],
        )
      )[0]?.team_id;
    const expectedEntries = [
      { team: await teamOfSquad(entrantA.squad_id), points: 10 },
      { team: await teamOfSquad(entrantC.squad_id), points: 6 },
    ];
    const gotEntries = entries
      .map((entry) => ({ team: entry.team_id, points: Number(entry.points) }))
      .sort((a, b) => b.points - a.points);
    if (JSON.stringify(gotEntries) !== JSON.stringify(expectedEntries)) {
      problems.push(
        `Points Entries ${JSON.stringify(gotEntries)}, expected ${JSON.stringify(expectedEntries)}`,
      );
    }

    for (const team of teams) {
      const delta = entries
        .filter((entry) => entry.team_id === team.id)
        .reduce((s, entry) => s + Number(entry.points), 0);
      const after = await leaderboardTeamTotal(team.name);
      const expected = beforeTotals[team.name] + delta;
      if (after !== expected) {
        problems.push(
          `${team.name} leaderboard total ${after}, expected ${expected}`,
        );
      }
    }

    const bearer = { Authorization: `Bearer ${MCP_TOKEN}` };
    const bracket = await mcpTool(
      "get_bracket",
      { competition: SMOKE_SQUAD_COMPETITION },
      undefined,
      "",
      bearer,
    );
    const bracketPayload = bracket.parsed as
      | { found: boolean; entrants?: { participants: string[] | null }[] }
      | undefined;
    const withParticipants = bracketPayload?.entrants?.filter((entrant) =>
      Array.isArray(entrant.participants),
    );
    if (
      bracketPayload?.found !== true ||
      bracketPayload.entrants?.length !== 4 ||
      withParticipants?.length !== 4 ||
      withParticipants.some((entrant) => entrant.participants!.length !== 2) ||
      bracket.text.includes("@") ||
      bracket.text.toLowerCase().includes("report")
    ) {
      problems.push(`get_bracket squads: ${bracket.text}`);
    }

    expectOk(
      "reopenBracket",
      await callAction(ids.reopenBracket, [id], organizer),
    );
    for (const team of teams) {
      const after = await leaderboardTeamTotal(team.name);
      if (after !== beforeTotals[team.name]) {
        problems.push(
          `${team.name} leaderboard total after reopen ${after}, expected ${beforeTotals[team.name]}`,
        );
      }
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    if (borrowedParticipantId) {
      await runQuery(`update participant set email = null where id = $1`, [
        borrowedParticipantId,
      ]).catch((error) =>
        fail("restore the borrowed Participant's email", String(error)),
      );
    }
    await deleteSmokeSquadCompetition().catch((error) =>
      fail("delete the smoke squad competition", String(error)),
    );
  }
}
