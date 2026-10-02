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
  // Deleting the Competition cascades its Entrants and Heats.
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_BRACKET_COMPETITION,
  ]);
  await runQuery(`delete from team where name = any($1)`, [
    SMOKE_BRACKET_TEAMS,
  ]);
}

export async function assertBracketLoop(sessions: { organizer: SmokeSession }) {
  const check =
    "bracket loop: an Organizer sets single elimination on a Competition, enters 4 Teams, generates, records 3 Heat Results, finalizes; GET /xi/competitions/<id> shows the champion and /xi/leaderboard includes the generated points and /xi/finale/<id> answers 200; un-finalize removes them and /xi/finale/<id> answers 404; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "setCompetitionFormat",
    "replaceEntrants",
    "generateBracket",
    "recordHeatResult",
    "finalizeBracket",
    "unfinalizeBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("bracket action ids", missing.join(", "));
    return;
  }
  const organizer = sessions.organizer;
  const get = (route: string) =>
    fetch(`${BASE_URL}${route}`, { headers: { cookie: organizer.cookie } });

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
            name: SMOKE_BRACKET_COMPETITION,
            description: "",
            scoring: "team",
            maxPoints: "",
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
      "setCompetitionFormat",
      await callAction(
        ids.setCompetitionFormat,
        [id, { format: "single-elimination" }],
        organizer,
      ),
    );
    const teams = await runQuery<{ id: string }>(
      `select t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 4) problems.push(`XI has ${teams.length} Teams`);
    expectOk(
      "replaceEntrants",
      await callAction(
        ids.replaceEntrants,
        [id, { targetIds: teams.map((t) => t.id) }],
        organizer,
      ),
    );
    expectOk(
      "generateBracket",
      await callAction(ids.generateBracket, [id, {}], organizer),
    );

    const before = await leaderboardTeamTotal("Red");
    // Red wins every Heat it's in, so it's the champion; otherwise the
    // first slot wins.
    let recorded = 0;
    for (const round of [1, 2]) {
      const slots = await runQuery<{
        heat_id: string;
        entrant_id: string;
        team_name: string;
      }>(
        `select h.id as heat_id, he.entrant_id, t.name as team_name
         from heat h join heat_entrant he on he.heat_id = h.id
         join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
         where h.competition_id = $1 and h.round = $2
         order by h.position, he.slot`,
        [id, round],
      );
      for (const heatId of [...new Set(slots.map((s) => s.heat_id))]) {
        const inHeat = slots.filter((s) => s.heat_id === heatId);
        const order = [
          ...inHeat.filter((s) => s.team_name === "Red"),
          ...inHeat.filter((s) => s.team_name !== "Red"),
        ].map((s) => s.entrant_id);
        const result = await callAction(
          ids.recordHeatResult,
          [id, heatId, { order, scores: { [order[0]]: "21" } }],
          organizer,
        );
        expectOk(`recordHeatResult round ${round}`, result);
        if (result.ok) recorded += 1;
      }
    }
    if (recorded !== 3) problems.push(`recorded ${recorded} Heat Results`);

    for (const route of [
      `/admin/competitions/${id}/bracket`,
      `/admin/brackets/${id}`,
    ]) {
      const res = await get(route);
      const body = await res.text();
      if (res.status !== 200 || !body.includes(SMOKE_BRACKET_COMPETITION)) {
        problems.push(`${route} status=${res.status}`);
      }
    }

    expectOk(
      "finalizeBracket",
      await callAction(ids.finalizeBracket, [id], organizer),
    );
    const page = await (
      await signedInFetch(`${BASE_URL}/xi/competitions/${id}`)
    ).text();
    if (!/aria-label="Champion"(?:(?!aria-label=)[\s\S])*?>Red</.test(page)) {
      problems.push("the Competition page shows no Red champion");
    }
    const finalized = await leaderboardTeamTotal("Red");
    if (before === null || finalized !== before + 10) {
      problems.push(`Red total ${before} → ${finalized}, expected +10`);
    }
    const finale = await get(`/xi/finale/${id}`);
    const finaleBody = await finale.text();
    if (
      finale.status !== 200 ||
      !finaleBody.includes('data-finale="ready"') ||
      !finaleBody.includes(SMOKE_BRACKET_COMPETITION)
    ) {
      problems.push(`/xi/finale/<id> after finalize status=${finale.status}`);
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
    const bracketPayload = bracket.parsed as
      | { found: boolean; champion?: string | null; entrants?: unknown[] }
      | undefined;
    if (
      bracketPayload?.found !== true ||
      bracketPayload.champion !== "Red" ||
      bracketPayload.entrants?.length !== 4 ||
      bracket.text.includes("@")
    ) {
      problems.push(`get_bracket result=${JSON.stringify(bracket.parsed)}`);
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

    const ledger = await (await get("/admin/points")).text();
    if (!ledger.includes("From bracket")) {
      problems.push("/admin/points shows no From bracket row");
    }

    expectOk(
      "unfinalizeBracket",
      await callAction(ids.unfinalizeBracket, [id], organizer),
    );
    const unfinalized = await leaderboardTeamTotal("Red");
    if (unfinalized !== before) {
      problems.push(`Red total after un-finalize ${unfinalized} != ${before}`);
    }
    const unfinalizedFinale = await get(`/xi/finale/${id}`);
    if (unfinalizedFinale.status !== 404) {
      problems.push(
        `/xi/finale/<id> after un-finalize status=${unfinalizedFinale.status}`,
      );
    }
    const [{ count }] = await runQuery<{ count: string }>(
      `select count(*) from points_entry where competition_id = $1`,
      [id],
    );
    if (Number(count) !== 0) problems.push(`${count} Points Entries remain`);

    // Every Heat is decided. A score-only edit of Red's semifinal resets
    // nothing; changing the winner of the other semifinal resets the one
    // decided later Heat its winner reached, the final.
    const semis = await runQuery<{
      heat_id: string;
      entrant_id: string;
      team_name: string;
    }>(
      `select h.id as heat_id, he.entrant_id, t.name as team_name
       from heat h join heat_entrant he on he.heat_id = h.id
       join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
       where h.competition_id = $1 and h.round = 1
       order by h.position, he.slot`,
      [id],
    );
    const [decidedLater] = await runQuery<{ count: string }>(
      `select count(*) from heat
       where competition_id = $1 and round > 1 and status in ('played', 'forfeit')`,
      [id],
    );
    const redHeat = semis.find((s) => s.team_name === "Red")?.heat_id;
    const otherHeat = semis.find((s) => s.heat_id !== redHeat)?.heat_id;
    const [{ entrant_id: otherWinner }] = await runQuery<{
      entrant_id: string;
    }>(`select entrant_id from heat_entrant where heat_id = $1 and place = 1`, [
      otherHeat,
    ]);
    const resetCount = async (
      step: string,
      heatId: string,
      order: string[],
    ) => {
      const result = (await callAction(
        ids.recordHeatResult,
        [id, heatId, { order, scores: { [order[0]]: "25" } }],
        organizer,
      )) as WriteResult & { resetHeatIds?: string[] };
      expectOk(step, result);
      return result.resetHeatIds?.length;
    };
    const redOrder = [
      ...semis.filter((s) => s.heat_id === redHeat && s.team_name === "Red"),
      ...semis.filter((s) => s.heat_id === redHeat && s.team_name !== "Red"),
    ].map((s) => s.entrant_id);
    const sameWinner = await resetCount(
      "recordHeatResult same winner",
      redHeat!,
      redOrder,
    );
    if (sameWinner !== 0) {
      problems.push(`a score-only edit reset ${sameWinner} later Heats`);
    }
    const flipped = semis
      .filter((s) => s.heat_id === otherHeat)
      .map((s) => s.entrant_id)
      .sort((a, b) => Number(a === otherWinner) - Number(b === otherWinner));
    const changedWinner = await resetCount(
      "recordHeatResult changed winner",
      otherHeat!,
      flipped,
    );
    if (changedWinner !== Number(decidedLater.count)) {
      problems.push(
        `a winner change reset ${changedWinner} later Heats, expected the ${decidedLater.count} decided`,
      );
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeBracket().catch((error) =>
      fail("delete the smoke bracket", String(error)),
    );
  }
}

// The heats loop check's own Competition and extra Teams, deleted after the
// check and before it, so it's rerunnable.
const SMOKE_HEATS_COMPETITION = "SMOKE TEST heats";
const SMOKE_HEATS_TEAMS = ["SMOKE Heats Gold", "SMOKE Heats Green"];

export async function deleteSmokeHeats() {
  await runQuery(
    `delete from points_entry where competition_id in
     (select id from competition where name = $1)`,
    [SMOKE_HEATS_COMPETITION],
  );
  // Deleting the Competition cascades its Entrants and Heats.
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_HEATS_COMPETITION,
  ]);
  await runQuery(`delete from team where name = any($1)`, [SMOKE_HEATS_TEAMS]);
}

export async function assertHeatsLoop(sessions: { organizer: SmokeSession }) {
  const check =
    "heats loop: an Organizer sets heats (4 per Heat, 2 advance) on a Competition, enters 4 Teams, generates one Heat of four, records its four-Entrant Heat Result, finalizes; GET /xi/competitions/<id> shows the champion and /xi/leaderboard includes the generated points; un-finalize removes them; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "setCompetitionFormat",
    "replaceEntrants",
    "generateBracket",
    "recordHeatResult",
    "finalizeBracket",
    "unfinalizeBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("heats action ids", missing.join(", "));
    return;
  }
  const organizer = sessions.organizer;

  try {
    await deleteSmokeHeats();
    for (const [name, color] of [
      [SMOKE_HEATS_TEAMS[0], "#ca8a04"],
      [SMOKE_HEATS_TEAMS[1], "#16a34a"],
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
            name: SMOKE_HEATS_COMPETITION,
            description: "",
            scoring: "team",
            maxPoints: "",
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
      [SMOKE_HEATS_COMPETITION],
    );
    if (!competition) throw new Error(problems.join("; ") || "not created");
    const id = competition.id;

    expectOk(
      "setCompetitionFormat",
      await callAction(
        ids.setCompetitionFormat,
        [
          id,
          {
            format: "heats",
            config: { entrantsPerHeat: 4, advancePerHeat: 2 },
          },
        ],
        organizer,
      ),
    );
    const teams = await runQuery<{ id: string }>(
      `select t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 4) problems.push(`XI has ${teams.length} Teams`);
    expectOk(
      "replaceEntrants",
      await callAction(
        ids.replaceEntrants,
        [id, { targetIds: teams.map((t) => t.id) }],
        organizer,
      ),
    );
    expectOk(
      "generateBracket",
      await callAction(ids.generateBracket, [id, {}], organizer),
    );

    const slots = await runQuery<{
      heat_id: string;
      slot_count: number;
      entrant_id: string;
      team_name: string;
    }>(
      `select h.id as heat_id, h.slot_count, he.entrant_id, t.name as team_name
       from heat h join heat_entrant he on he.heat_id = h.id
       join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
       where h.competition_id = $1
       order by h.round, h.position, he.slot`,
      [id],
    );
    const heatIds = [...new Set(slots.map((s) => s.heat_id))];
    if (heatIds.length !== 1 || slots.length !== 4) {
      problems.push(
        `generated ${heatIds.length} Heats holding ${slots.length} Entrants, expected one Heat of four`,
      );
    }

    const before = await leaderboardTeamTotal("Red");
    // Red finishes first; the rest in slot order.
    const order = [
      ...slots.filter((s) => s.team_name === "Red"),
      ...slots.filter((s) => s.team_name !== "Red"),
    ].map((s) => s.entrant_id);
    expectOk(
      "recordHeatResult",
      await callAction(
        ids.recordHeatResult,
        [id, heatIds[0], { order, scores: { [order[0]]: "1:02" } }],
        organizer,
      ),
    );

    expectOk(
      "finalizeBracket",
      await callAction(ids.finalizeBracket, [id], organizer),
    );
    const page = await (
      await signedInFetch(`${BASE_URL}/xi/competitions/${id}`)
    ).text();
    if (!/aria-label="Champion"(?:(?!aria-label=)[\s\S])*?>Red</.test(page)) {
      problems.push("the Competition page shows no Red champion");
    }
    const finalized = await leaderboardTeamTotal("Red");
    if (before === null || finalized !== before + 10) {
      problems.push(`Red total ${before} → ${finalized}, expected +10`);
    }

    expectOk(
      "unfinalizeBracket",
      await callAction(ids.unfinalizeBracket, [id], organizer),
    );
    const unfinalized = await leaderboardTeamTotal("Red");
    if (unfinalized !== before) {
      problems.push(`Red total after un-finalize ${unfinalized} != ${before}`);
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeHeats().catch((error) =>
      fail("delete the smoke heats", String(error)),
    );
  }
}

// The Squad + self-report loop's own Competition. It reuses XI's two native
// Teams (Red, Blue) and email-less Participants of the seeded roster, so
// unlike the two loops above it inserts no extra Teams; deleting the
// Competition cascades its Squads, Entrants and Heats.
const SMOKE_SQUAD_COMPETITION = "SMOKE TEST squads";
const SMOKE_SQUAD_PARTICIPANT_EMAIL = "smoke-participant@jahnelgroup.com";
const SELF_REPORT_OFF = "Self-report is off for this Competition.";
const NOT_IN_HEAT = "You're not in this Heat.";
const HEAT_DECIDED = "This Heat already has a result.";
const NOT_HOST_REFUSAL_SQUAD = "You're not a Host of that Competition.";
const SQUADS_SEEDED_AT_RANDOM = "Squads are seeded at random.";

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
    "squad loop: an Organizer builds a single-elimination Bracket of four Squads from XI's two Teams, turns on self-report; a linked Participant reports their Heat and their Squad advances, a second report and an outsider's POST are refused, the Organizer overwrites and re-records, the Participant reports the Final, finalize splits Points Entries two per Team; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "setCompetitionFormat",
    "createSquad",
    "replaceEntrants",
    "generateBracket",
    "setSelfReport",
    "reportHeatResult",
    "recordHeatResult",
    "finalizeBracket",
    "unfinalizeBracket",
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
            maxPoints: "",
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
      "setCompetitionFormat",
      await callAction(
        ids.setCompetitionFormat,
        [id, { format: "single-elimination" }],
        organizer,
      ),
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
      "replaceEntrants kind squad",
      await callAction(
        ids.replaceEntrants,
        [id, { kind: "squad", targetIds: squads.map((s) => s.id) }],
        organizer,
      ),
    );
    expectRefused(
      "generateBracket seeding standings",
      await callAction(
        ids.generateBracket,
        [id, { seeding: "standings" }],
        organizer,
      ),
      SQUADS_SEEDED_AT_RANDOM,
    );
    expectOk(
      "generateBracket",
      await callAction(ids.generateBracket, [id, {}], organizer),
    );

    const round1 = await runQuery<{
      heat_id: string;
      entrant_id: string;
      squad_id: string;
    }>(
      `select h.id as heat_id, he.entrant_id, e.squad_id
       from heat h join heat_entrant he on he.heat_id = h.id
       join entrant e on e.id = he.entrant_id
       where h.competition_id = $1 and h.round = 1
       order by h.position, he.slot`,
      [id],
    );
    const heatIds = [...new Set(round1.map((r) => r.heat_id))];
    if (heatIds.length !== 2 || round1.length !== 4) {
      problems.push(
        `generated ${heatIds.length} Round-1 Heats holding ${round1.length} Entrants, expected 2 Heats of two`,
      );
    }
    const [heat1Id, heat2Id] = heatIds;
    const [entrantA, entrantB] = round1.filter((r) => r.heat_id === heat1Id);
    const [entrantC, entrantD] = round1.filter((r) => r.heat_id === heat2Id);

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
      "reportHeatResult while self-report is off",
      await callAction(ids.reportHeatResult, [id, heat1Id, {}], notOrganizer),
      SELF_REPORT_OFF,
    );
    expectRefused(
      "setSelfReport as the linked Participant",
      await callAction(ids.setSelfReport, [id, { on: true }], notOrganizer),
      NOT_HOST_REFUSAL_SQUAD,
    );
    expectOk(
      "setSelfReport on",
      await callAction(ids.setSelfReport, [id, { on: true }], organizer),
    );
    expectRefused(
      "recordHeatResult as the linked Participant",
      await callAction(
        ids.recordHeatResult,
        [id, heat1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
      NOT_HOST_REFUSAL_SQUAD,
    );
    expectRefused(
      "reportHeatResult on a Heat their Squad isn't in",
      await callAction(ids.reportHeatResult, [id, heat2Id, {}], notOrganizer),
      NOT_IN_HEAT,
    );

    // The outsider's session has a non-JG email, so `src/proxy.ts` answers
    // with a 307 to /sign-in before any action runs; `callAction` can't be
    // used (it expects a 200 RSC reply), so this POSTs directly.
    const outsiderRes = await fetch(`${BASE_URL}/admin/points`, {
      method: "POST",
      headers: {
        "next-action": ids.reportHeatResult,
        "content-type": "text/plain;charset=UTF-8",
        accept: "text/x-component",
        origin: BASE_URL,
        cookie: outsider.cookie,
      },
      body: JSON.stringify([id, heat1Id, {}]),
      redirect: "manual",
    });
    const outsiderLocation = outsiderRes.headers.get("location") ?? "";
    if (outsiderRes.status !== 307 || !outsiderLocation.includes("/sign-in")) {
      problems.push(
        `outsider POST reportHeatResult status=${outsiderRes.status} location=${outsiderLocation}`,
      );
    }
    const [heat1BeforeReport] = await runQuery<{
      status: string;
      reported_by_email: string | null;
    }>(`select status, reported_by_email from heat where id = $1`, [heat1Id]);
    if (
      heat1BeforeReport.status === "played" ||
      heat1BeforeReport.reported_by_email !== null
    ) {
      problems.push(
        `the outsider's refused POST changed the Heat: ${JSON.stringify(heat1BeforeReport)}`,
      );
    }

    expectOk(
      "reportHeatResult",
      await callAction(
        ids.reportHeatResult,
        [id, heat1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
    );
    const [heat1AfterReport] = await runQuery<{
      status: string;
      reported_by_email: string | null;
    }>(`select status, reported_by_email from heat where id = $1`, [heat1Id]);
    if (
      heat1AfterReport.status !== "played" ||
      heat1AfterReport.reported_by_email !== SMOKE_SQUAD_PARTICIPANT_EMAIL
    ) {
      problems.push(`heat1 after report: ${JSON.stringify(heat1AfterReport)}`);
    }
    const finalSlotAfterReport = await runQuery<{ entrant_id: string }>(
      `select he.entrant_id from heat h join heat_entrant he on he.heat_id = h.id
       where h.competition_id = $1 and h.round = 2 and he.entrant_id = $2`,
      [id, entrantA.entrant_id],
    );
    if (finalSlotAfterReport.length !== 1) {
      problems.push("the reported Squad didn't reach the Final's slot");
    }

    expectRefused(
      "reportHeatResult on an already-decided Heat",
      await callAction(
        ids.reportHeatResult,
        [id, heat1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        notOrganizer,
      ),
      HEAT_DECIDED,
    );

    const resultsPage = await (await get(`/admin/brackets/${id}`)).text();
    if (!resultsPage.includes("Reported by")) {
      problems.push("/admin/brackets/<id> shows no 'Reported by' line");
    }

    expectOk(
      "recordHeatResult overwrites with the other Squad winning",
      await callAction(
        ids.recordHeatResult,
        [id, heat1Id, { order: [entrantB.entrant_id, entrantA.entrant_id] }],
        organizer,
      ),
    );
    const [heat1AfterOverwrite] = await runQuery<{
      reported_by_email: string | null;
      reported_by_participant_id: string | null;
    }>(
      `select reported_by_email, reported_by_participant_id from heat where id = $1`,
      [heat1Id],
    );
    if (
      heat1AfterOverwrite.reported_by_email !== null ||
      heat1AfterOverwrite.reported_by_participant_id !== null
    ) {
      problems.push(
        `the Host overwrite left a reporter: ${JSON.stringify(heat1AfterOverwrite)}`,
      );
    }
    const finalSlotAfterOverwrite = await runQuery<{ entrant_id: string }>(
      `select he.entrant_id from heat h join heat_entrant he on he.heat_id = h.id
       where h.competition_id = $1 and h.round = 2 and he.entrant_id = $2`,
      [id, entrantB.entrant_id],
    );
    if (finalSlotAfterOverwrite.length !== 1) {
      problems.push("the overwrite didn't move the Final's slot");
    }

    expectOk(
      "recordHeatResult records the linked Squad back in",
      await callAction(
        ids.recordHeatResult,
        [id, heat1Id, { order: [entrantA.entrant_id, entrantB.entrant_id] }],
        organizer,
      ),
    );
    expectOk(
      "recordHeatResult records the other Semifinal",
      await callAction(
        ids.recordHeatResult,
        [id, heat2Id, { order: [entrantC.entrant_id, entrantD.entrant_id] }],
        organizer,
      ),
    );

    const [finalHeat] = await runQuery<{ id: string }>(
      `select id from heat where competition_id = $1 and round = 2 limit 1`,
      [id],
    );
    expectOk(
      "reportHeatResult on the Final",
      await callAction(
        ids.reportHeatResult,
        [
          id,
          finalHeat.id,
          { order: [entrantA.entrant_id, entrantC.entrant_id] },
        ],
        notOrganizer,
      ),
    );

    const beforeTotals: Record<string, number> = {};
    for (const team of teams) {
      beforeTotals[team.name] = (await leaderboardTeamTotal(team.name)) ?? 0;
    }

    expectOk(
      "finalizeBracket",
      await callAction(ids.finalizeBracket, [id], organizer),
    );
    const entries = await runQuery<{
      team_id: string | null;
      points: string;
      generated_by_bracket: boolean;
    }>(
      `select team_id, points, generated_by_bracket from points_entry where competition_id = $1`,
      [id],
    );
    const perTeamCount = new Map<string, number>();
    let sum = 0;
    for (const entry of entries) {
      if (!entry.team_id || !entry.generated_by_bracket) {
        problems.push(
          `a Points Entry with no Team or not generated: ${JSON.stringify(entry)}`,
        );
      }
      sum += Number(entry.points);
      const key = entry.team_id ?? "";
      perTeamCount.set(key, (perTeamCount.get(key) ?? 0) + 1);
    }
    if (entries.length !== 4) {
      problems.push(`${entries.length} Points Entries, expected 4`);
    }
    if (sum !== 22) problems.push(`Points Entries total ${sum}, expected 22`);
    if ([...perTeamCount.values()].some((count) => count !== 2)) {
      problems.push(
        `Points Entries per Team: ${JSON.stringify([...perTeamCount])}`,
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
      "unfinalizeBracket",
      await callAction(ids.unfinalizeBracket, [id], organizer),
    );
    for (const team of teams) {
      const after = await leaderboardTeamTotal(team.name);
      if (after !== beforeTotals[team.name]) {
        problems.push(
          `${team.name} leaderboard total after un-finalize ${after}, expected ${beforeTotals[team.name]}`,
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
