import {
  BASE_URL,
  type SmokeSession,
  callAction,
  fail,
  ok,
  runCheck,
  runQuery,
  serverActionIds,
} from "./harness";

// The seeded Head-to-head and Best score Competitions of XI, by name, with the
// Format label their pages show.
const LOGGED_COMPETITIONS = [
  { name: "Bouncy Pong", label: "Head-to-head", empty: "No Matches yet." },
  { name: "Tuesday Stairs", label: "Best score", empty: "No Attempts yet." },
] as const;
const LOG_COMPETITION = "Bouncy Pong";
/**
 * Bouncy Pong's two seeded Entrants; the first is linked to the smoke
 * Participant's email for the length of the check.
 */
const PLAYER = "Albert Hernandez";
const OPPONENT = "Austin Gage";
const SMOKE_PARTICIPANT_EMAIL = "smoke-participant@jahnelgroup.com";
const SMOKE_ORGANIZER_EMAIL = "smoke-organizer@jahnelgroup.com";
const NOT_LINKED = "Your sign-in doesn't match a Participant of this War Week.";
/** The series view's result for the smoke Match. */
const LOGGED = `Winner: ${PLAYER}`;

async function xiCompetitionIdByName(name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select c.id from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.name = $1`,
    [name],
  );
  if (!row) throw new Error(`No XI Competition named "${name}"`);
  return row.id;
}

async function xiParticipantIdByName(name: string): Promise<string> {
  const [row] = await runQuery<{ id: string }>(
    `select p.id from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xi' and p.display_name = $1`,
    [name],
  );
  if (!row) throw new Error(`No XI Participant named "${name}"`);
  return row.id;
}

async function getPage(target: string, session: SmokeSession) {
  const res = await fetch(`${BASE_URL}${target}`, {
    headers: { cookie: session.cookie },
  });
  return { status: res.status, body: await res.text() };
}

/**
 * Email addresses in a page's HTML other than the viewer's own (the
 * header shows the signed-in account's email, and RSC references carry a
 * bare `$@`, so a literal "no @" can't hold for a signed-in page).
 */
function otherEmails(body: string, own: string): string[] {
  return (
    body
      .split(own)
      .join("")
      .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  );
}

/** The "Log a Match" button (Bouncy Pong is Head-to-head), not the dialog title or the home card. */
const LOG_BUTTON = />Log a Match</;

/**
 * The seeded Head-to-head and Best score Competitions (17-5, 17-A): each
 * page renders its Format and its empty results (no Matches, no Attempts)
 * with no email in it; `logResult` over HTTP is refused before the smoke
 * Participant's email links them, then a Match between Bouncy Pong's two
 * Entrants succeeds and shows in its series; closed and with XI ended, the
 * page still renders the series with no Log a Match. Then everything is
 * undone, so a rerun never meets a decided Best of 3: the Match deleted,
 * the Competition reopened, XI `live` with no Winner, the email cleared.
 */
export async function assertLoggedResultsLoop(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const missing = [
    "logResult",
    "deleteResult",
    "closeLoggedResults",
    "reopenLoggedResults",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("logged results: action ids", `missing ${missing.join(", ")}`);
    return;
  }
  let competitionId: string | null = null;
  let playerId: string | null = null;
  try {
    for (const { name, label, empty } of LOGGED_COMPETITIONS) {
      await runCheck(
        `logged results: /xi/competitions/<${name}> answers 200 with "${label}", "${empty}" and no email but the viewer's`,
        async () => {
          const id = await xiCompetitionIdByName(name);
          const { status, body } = await getPage(
            `/xi/competitions/${id}`,
            sessions.notOrganizer,
          );
          const checks = {
            status: status === 200,
            label: body.includes(label),
            empty: body.includes(empty),
            noEmail: otherEmails(body, SMOKE_PARTICIPANT_EMAIL).length === 0,
          };
          return Object.values(checks).every(Boolean)
            ? null
            : JSON.stringify(checks);
        },
      );
    }

    competitionId = await xiCompetitionIdByName(LOG_COMPETITION);
    playerId = await xiParticipantIdByName(PLAYER);
    const opponentId = await xiParticipantIdByName(OPPONENT);
    const input = { playerA: playerId, playerB: opponentId, outcome: "a" };
    const id = competitionId;
    const linkedId = playerId;

    await runCheck(
      "logged results: logResult by a signed-in JG user linked to no Participant is refused",
      async () => {
        const result = await callAction(
          ids.logResult,
          [id, input],
          sessions.notOrganizer,
        );
        return !result.ok && result.error === NOT_LINKED
          ? null
          : JSON.stringify(result);
      },
    );

    await runCheck(
      "logged results: logResult as the linked smoke Participant (an Entrant) succeeds and the series shows the Match",
      async () => {
        await runQuery(`update participant set email = $1 where id = $2`, [
          SMOKE_PARTICIPANT_EMAIL,
          linkedId,
        ]);
        const result = await callAction(
          ids.logResult,
          [id, input],
          sessions.notOrganizer,
        );
        if (!result.ok) return JSON.stringify(result);
        const { status, body } = await getPage(
          `/xi/competitions/${id}`,
          sessions.notOrganizer,
        );
        const checks = {
          status: status === 200,
          series: body.includes('aria-label="Series"'),
          logged: body.includes(LOGGED),
          logButton: LOG_BUTTON.test(body),
          // The Match's logger is the viewer here: an Organizer's view
          // shows no email but the Organizer's own.
          noEmail:
            otherEmails(
              (await getPage(`/xi/competitions/${id}`, sessions.organizer))
                .body,
              SMOKE_ORGANIZER_EMAIL,
            ).length === 0,
        };
        return Object.values(checks).every(Boolean)
          ? null
          : JSON.stringify(checks);
      },
    );

    // Its own sequential step: never alongside the lifecycle check, which
    // also changes XI's status.
    await runCheck(
      "logged results: closed and with XI ended, the page still renders the series and its Match, with no Log a Match",
      async () => {
        const closed = await callAction(
          ids.closeLoggedResults,
          [id],
          sessions.organizer,
        );
        if (!closed.ok) return `closeLoggedResults: ${JSON.stringify(closed)}`;
        await runQuery(
          "update war_week set status = 'complete' where edition = 'xi'",
        );
        const { status, body } = await getPage(
          `/xi/competitions/${id}`,
          sessions.notOrganizer,
        );
        const checks = {
          status: status === 200,
          series: body.includes('aria-label="Series"'),
          player: body.includes(PLAYER),
          log: body.includes(LOGGED),
          noLogButton: !LOG_BUTTON.test(body),
          // The Match's logger is the viewer here: an Organizer's view
          // shows no email but the Organizer's own.
          noEmail:
            otherEmails(
              (await getPage(`/xi/competitions/${id}`, sessions.organizer))
                .body,
              SMOKE_ORGANIZER_EMAIL,
            ).length === 0,
        };
        return Object.values(checks).every(Boolean)
          ? null
          : JSON.stringify(checks);
      },
    );
  } catch (error) {
    fail("logged results: loop", String(error));
  } finally {
    await runQuery(
      "update war_week set status = 'live', winner = null where edition = 'xi'",
    ).catch((error) => fail("logged results: restore XI live", String(error)));
    if (competitionId) {
      const id = competitionId;
      const restore = async () => {
        const [row] = await runQuery<{ closed: boolean }>(
          `select closed_at is not null as closed from competition where id = $1`,
          [id],
        );
        if (row?.closed) {
          const reopened = await callAction(
            ids.reopenLoggedResults,
            [id],
            sessions.organizer,
          );
          if (!reopened.ok) throw new Error(JSON.stringify(reopened));
        }
        const matches = await runQuery<{ id: string }>(
          `select id from series_match where competition_id = $1`,
          [id],
        );
        for (const match of matches) {
          const deleted = await callAction(
            ids.deleteResult,
            [id, match.id],
            sessions.organizer,
          );
          if (!deleted.ok) throw new Error(JSON.stringify(deleted));
        }
        const [left] = await runQuery<{ matches: number; entries: number }>(
          `select (select count(*)::int from series_match where competition_id = $1) as matches,
             (select count(*)::int from points_entry where competition_id = $1 and generated) as entries`,
          [id],
        );
        if (left.matches !== 0 || left.entries !== 0) {
          throw new Error(JSON.stringify(left));
        }
      };
      await restore()
        .then(() =>
          ok("logged results: reopen Bouncy Pong and delete the smoke Match"),
        )
        .catch((error) =>
          fail(
            "logged results: reopen Bouncy Pong and delete the smoke Match",
            String(error),
          ),
        );
    }
    if (playerId) {
      await runQuery(`update participant set email = null where id = $1`, [
        playerId,
      ]).catch((error) =>
        fail(
          "logged results: clear the smoke Participant's email",
          String(error),
        ),
      );
    }
  }
}
