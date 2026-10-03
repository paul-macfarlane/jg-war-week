import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  SMOKE_ORGANIZER_EMAIL,
  type SmokeSession,
  callAction,
  escapeHtml,
  fail,
  hasNameProp,
  leaderboardTeamTotal,
  ok,
  runQuery,
  serverActionIds,
} from "./harness";

// Points Entries the smoke creates carry this note prefix so cleanup can
// find them (and never touch an Organizer's own entries).
export const SMOKE_NOTE_PREFIX = "smoke-points-";

export async function smokeEntries() {
  return runQuery<{
    id: string;
    points: string;
    team_id: string | null;
    entered_by_email: string;
  }>(
    `select id, points, team_id, entered_by_email from points_entry where note like $1`,
    [`${SMOKE_NOTE_PREFIX}%`],
  );
}

export async function deleteSmokeEntries() {
  await runQuery(`delete from points_entry where note like $1`, [
    `${SMOKE_NOTE_PREFIX}%`,
  ]);
}

export async function assertAdminPointsPage(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const check =
    "GET /admin/points as an Organizer shows the form with every Competition, the ledger with entered-by, and the current standings";
  try {
    const competitions = await runQuery<{ name: string }>(
      `select c.name from competition c join war_week w on w.id = c.war_week_id where w.edition = 'xi'`,
    );
    const [unscheduled] = await runQuery<{ count: string }>(
      `select count(*) from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and not exists (select 1 from schedule_item s where s.competition_id = c.id)`,
    );
    const [enteredBy] = await runQuery<{ email: string }>(
      `select pe.entered_by_email as email from points_entry pe
       join competition c on c.id = pe.competition_id
       join war_week w on w.id = c.war_week_id where w.edition = 'xi' limit 1`,
    );
    const res = await fetch(`${BASE_URL}/admin/points`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    const missing = competitions
      .map((c) => c.name)
      .filter((name) => !hasNameProp(body, name));
    const result = {
      status: res.status,
      form:
        body.includes("Add a Points Entry") &&
        body.includes('aria-label="Points Entry"'),
      missing: missing.join("|"),
      unscheduled: Number(unscheduled.count),
      ledger: Boolean(enteredBy) && body.includes(escapeHtml(enteredBy.email)),
      standings:
        body.includes("Current standings") &&
        body.includes("Individual leaderboard") &&
        /tabular-nums">[\d.,]+<\/span>/.test(body),
    };
    if (
      result.status === 200 &&
      result.form &&
      !result.missing &&
      result.ledger &&
      result.standings
    ) {
      ok(`${check} (${result.unscheduled} unscheduled Competitions offered)`);
    } else {
      fail(check, JSON.stringify(result));
    }
  } catch (error) {
    fail(check, String(error));
  }

  const refusedCheck = "GET /admin/points as a non-Organizer shows the refusal";
  try {
    const res = await fetch(`${BASE_URL}/admin/points`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes(ADMIN_REFUSAL_TEXT) &&
      !body.includes("Add a Points Entry")
    ) {
      ok(refusedCheck);
    } else {
      fail(refusedCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(refusedCheck, String(error));
  }
}

export async function assertPointsEntryActions(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const actions = [
    "createPointsEntry",
    "updatePointsEntry",
    "deletePointsEntry",
  ];
  const missing = actions.filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("server action ids in the build manifest", missing.join(", "));
    return;
  }
  const [teamCompetition] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.scoring = 'team' and c.format = 'placement'
     order by c.name limit 1`,
  );
  const [individualCompetition] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.scoring = 'individual' order by c.name limit 1`,
  );
  const [target] = await runQuery<{
    team_id: string;
    team_name: string;
    participant_id: string;
  }>(
    `select t.id as team_id, t.name as team_name, p.id as participant_id
     from team t join war_week w on w.id = t.war_week_id
     join participant p on p.team_id = t.id where w.edition = 'xi' order by t.name limit 1`,
  );
  const amount = 12;
  const teamInput = {
    competitionId: teamCompetition.id,
    targetId: target.team_id,
    points: String(amount),
    note: `${SMOKE_NOTE_PREFIX}create`,
  };

  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  try {
    await deleteSmokeEntries();
    const before = await leaderboardTeamTotal(target.team_name);

    await run(
      "createPointsEntry rejects a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.createPointsEntry,
          [teamInput],
          sessions.notOrganizer,
        );
        const rows = await smokeEntries();
        return !result.ok &&
          result.error === "You're not a Host of that Competition." &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createPointsEntry rejects a Participant in a team Competition and a Team in an individual one",
      async () => {
        const wrongTeam = await callAction(
          ids.createPointsEntry,
          [{ ...teamInput, targetId: target.participant_id }],
          sessions.organizer,
        );
        const wrongIndividual = await callAction(
          ids.createPointsEntry,
          [
            {
              ...teamInput,
              competitionId: individualCompetition.id,
              targetId: target.team_id,
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeEntries();
        return !wrongTeam.ok && !wrongIndividual.ok && rows.length === 0
          ? null
          : `team=${JSON.stringify(wrongTeam)} individual=${JSON.stringify(wrongIndividual)} rows=${rows.length}`;
      },
    );

    await run(
      "createPointsEntry as an Organizer saves a decimal entry with entered-by",
      async () => {
        const result = await callAction(
          ids.createPointsEntry,
          [{ ...teamInput, points: `${amount}.25` }],
          sessions.organizer,
        );
        const rows = await smokeEntries();
        return result.ok &&
          rows.length === 1 &&
          Number(rows[0].points) === amount + 0.25 &&
          rows[0].team_id === target.team_id &&
          rows[0].entered_by_email === SMOKE_ORGANIZER_EMAIL
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );

    await run(
      "an entry saved in admin shows up on /xi/leaderboard on the next refresh",
      async () => {
        const after = await leaderboardTeamTotal(target.team_name);
        return before !== null &&
          after !== null &&
          Math.abs(after - before - (amount + 0.25)) < 0.001
          ? null
          : `before=${before} after=${after}`;
      },
    );

    const [created] = await smokeEntries();
    await run(
      "updatePointsEntry and deletePointsEntry reject a non-Organizer",
      async () => {
        const update = await callAction(
          ids.updatePointsEntry,
          [created.id, { ...teamInput, points: "1" }],
          sessions.notOrganizer,
        );
        const remove = await callAction(
          ids.deletePointsEntry,
          [created.id],
          sessions.notOrganizer,
        );
        const [row] = await smokeEntries();
        return !update.ok &&
          !remove.ok &&
          row &&
          Number(row.points) === amount + 0.25
          ? null
          : `update=${JSON.stringify(update)} delete=${JSON.stringify(remove)} row=${JSON.stringify(row)}`;
      },
    );

    await run(
      "updatePointsEntry as an Organizer edits points and keeps entered-by",
      async () => {
        const result = await callAction(
          ids.updatePointsEntry,
          [created.id, { ...teamInput, points: "1.5" }],
          sessions.organizer,
        );
        const [row] = await smokeEntries();
        return result.ok &&
          Number(row?.points) === 1.5 &&
          row?.entered_by_email === SMOKE_ORGANIZER_EMAIL
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
      },
    );

    await run("deletePointsEntry as an Organizer removes it", async () => {
      const result = await callAction(
        ids.deletePointsEntry,
        [created.id],
        sessions.organizer,
      );
      const rows = await smokeEntries();
      return result.ok && rows.length === 0
        ? null
        : `result=${JSON.stringify(result)} rows=${rows.length}`;
    });
  } finally {
    await deleteSmokeEntries().catch((error) =>
      fail("delete smoke Points Entries", String(error)),
    );
  }
}
