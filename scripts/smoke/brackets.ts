import {
  type ActionResult,
  BASE_URL,
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
    "bracket loop: an Organizer sets single elimination on a Competition, enters 4 Teams, generates, records 3 Heat Results, finalizes; GET /xi/competitions/<id> shows the champion and /xi/leaderboard includes the generated points; un-finalize removes them; then cleans up";
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
      `/admin/setup/competitions/${id}/bracket`,
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
      )) as ActionResult & { resetHeatIds?: string[] };
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
