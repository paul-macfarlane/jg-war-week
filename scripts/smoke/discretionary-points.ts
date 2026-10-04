import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  SMOKE_ORGANIZER_EMAIL,
  type SmokeSession,
  callAction,
  fail,
  leaderboardTeamTotal,
  ok,
  runQuery,
  serverActionIds,
  xiWarWeekId,
} from "./harness";

// Discretionary points the smoke gives carry this reason prefix so cleanup
// can find them (and never touch an Organizer's own entries).
export const SMOKE_REASON_PREFIX = "smoke-discretionary-";

export async function smokeDiscretionary() {
  return runQuery<{
    id: string;
    points: string;
    team_id: string | null;
    competition_id: string | null;
    entered_by_email: string;
    updated_after_create: boolean;
  }>(
    `select id, points, team_id, competition_id, entered_by_email,
            (updated_at - created_at) > interval '1 second' as updated_after_create
     from points_entry where note like $1`,
    [`${SMOKE_REASON_PREFIX}%`],
  );
}

export async function deleteSmokeDiscretionary() {
  await runQuery(`delete from points_entry where note like $1`, [
    `${SMOKE_REASON_PREFIX}%`,
  ]);
}

async function run(check: string, body: () => Promise<string | null>) {
  try {
    const problem = await body();
    if (problem === null) ok(check);
    else fail(check, problem);
  } catch (error) {
    fail(check, String(error));
  }
}

/**
 * Discretionary points over HTTP: the page opens for an Organizer and
 * refuses everyone else (the old `/admin/points` redirects are in
 * `assertAdminRedirects`), and each action writes as an Organizer and is
 * refused for a non-Organizer.
 */
export async function assertDiscretionaryPoints(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const route = "/admin/discretionary-points";
  await run(
    `GET ${route} as an Organizer shows Discretionary points and the Give button`,
    async () => {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { cookie: sessions.organizer.cookie },
      });
      const body = await res.text();
      const result = {
        status: res.status,
        heading: body.includes("Discretionary points"),
        give: body.includes("Give Discretionary points"),
        ledger: body.includes("Ledger"),
      };
      return result.status === 200 &&
        result.heading &&
        result.give &&
        result.ledger
        ? null
        : JSON.stringify(result);
    },
  );

  await run(`GET ${route} as a non-Organizer shows the refusal`, async () => {
    const res = await fetch(`${BASE_URL}${route}`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const body = await res.text();
    return res.status === 200 &&
      body.includes(ADMIN_REFUSAL_TEXT) &&
      !body.includes("Give Discretionary points")
      ? null
      : `status=${res.status}`;
  });

  const ids = serverActionIds();
  const actions = [
    "createDiscretionaryPoints",
    "updateDiscretionaryPoints",
    "deleteDiscretionaryPoints",
  ];
  const missing = actions.filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("server action ids in the build manifest", missing.join(", "));
    return;
  }
  const xiId = await xiWarWeekId();
  const [target] = await runQuery<{ team_id: string; team_name: string }>(
    `select t.id as team_id, t.name as team_name
     from team t join war_week w on w.id = t.war_week_id
     where w.edition = 'xi' order by t.name limit 1`,
  );
  const amount = 7;
  const input = (points: string, reason = "create") => ({
    targetId: target.team_id,
    points,
    reason: `${SMOKE_REASON_PREFIX}${reason}`,
  });

  try {
    await deleteSmokeDiscretionary();
    const before = await leaderboardTeamTotal(target.team_name);

    await run(
      "createDiscretionaryPoints is refused for a non-Organizer and writes nothing",
      async () => {
        const result = await callAction(
          ids.createDiscretionaryPoints,
          [xiId, input(String(amount))],
          sessions.notOrganizer,
        );
        const rows = await smokeDiscretionary();
        return !result.ok &&
          result.error === "Only an Organizer can give Discretionary points." &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createDiscretionaryPoints without a reason is refused",
      async () => {
        const result = await callAction(
          ids.createDiscretionaryPoints,
          [xiId, { ...input(String(amount)), reason: "  " }],
          sessions.organizer,
        );
        return !result.ok && (await smokeDiscretionary()).length === 0
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );

    await run(
      "createDiscretionaryPoints as an Organizer saves an entry with no Competition, entered by them",
      async () => {
        const result = await callAction(
          ids.createDiscretionaryPoints,
          [xiId, input(`${amount}.25`)],
          sessions.organizer,
        );
        const rows = await smokeDiscretionary();
        return result.ok &&
          rows.length === 1 &&
          rows[0].competition_id === null &&
          Number(rows[0].points) === amount + 0.25 &&
          rows[0].team_id === target.team_id &&
          rows[0].entered_by_email === SMOKE_ORGANIZER_EMAIL
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );

    await run(
      "Discretionary points show up on /xi/leaderboard on the next refresh",
      async () => {
        const after = await leaderboardTeamTotal(target.team_name);
        return before !== null &&
          after !== null &&
          Math.abs(after - before - (amount + 0.25)) < 0.001
          ? null
          : `before=${before} after=${after}`;
      },
    );

    const [created] = await smokeDiscretionary();
    await run(
      "updateDiscretionaryPoints and deleteDiscretionaryPoints are refused for a non-Organizer",
      async () => {
        const update = await callAction(
          ids.updateDiscretionaryPoints,
          [created.id, input("1")],
          sessions.notOrganizer,
        );
        const remove = await callAction(
          ids.deleteDiscretionaryPoints,
          [created.id],
          sessions.notOrganizer,
        );
        const [row] = await smokeDiscretionary();
        return !update.ok &&
          !remove.ok &&
          row &&
          Number(row.points) === amount + 0.25
          ? null
          : `update=${JSON.stringify(update)} delete=${JSON.stringify(remove)}`;
      },
    );

    await run(
      "updateDiscretionaryPoints as an Organizer edits points and keeps entered-by",
      async () => {
        const result = await callAction(
          ids.updateDiscretionaryPoints,
          [created.id, input("1.5")],
          sessions.organizer,
        );
        const [row] = await smokeDiscretionary();
        return result.ok &&
          Number(row?.points) === 1.5 &&
          row?.entered_by_email === SMOKE_ORGANIZER_EMAIL
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
      },
    );

    await run(
      "updateDiscretionaryPoints and deleteDiscretionaryPoints refuse a Competition's Points Entry",
      async () => {
        const [competitionEntry] = await runQuery<{ id: string }>(
          `select pe.id from points_entry pe
           join competition c on c.id = pe.competition_id
           join war_week w on w.id = c.war_week_id
           where w.edition = 'xi' limit 1`,
        );
        if (!competitionEntry) return "no Competition Points Entry in XI";
        const update = await callAction(
          ids.updateDiscretionaryPoints,
          [competitionEntry.id, input("1")],
          sessions.organizer,
        );
        const remove = await callAction(
          ids.deleteDiscretionaryPoints,
          [competitionEntry.id],
          sessions.organizer,
        );
        const [still] = await runQuery<{ n: string }>(
          `select count(*) as n from points_entry where id = $1`,
          [competitionEntry.id],
        );
        return !update.ok && !remove.ok && still.n === "1"
          ? null
          : `update=${JSON.stringify(update)} delete=${JSON.stringify(remove)}`;
      },
    );

    await run(
      "deleteDiscretionaryPoints as an Organizer removes it",
      async () => {
        const result = await callAction(
          ids.deleteDiscretionaryPoints,
          [created.id],
          sessions.organizer,
        );
        const rows = await smokeDiscretionary();
        return result.ok && rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );
  } finally {
    await deleteSmokeDiscretionary().catch((error) =>
      fail("delete smoke Discretionary points", String(error)),
    );
  }
}
