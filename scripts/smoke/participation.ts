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

// The seeded `participation` Competition of the XI demo (R12 red-team B1):
// team scoring, ranked by headcount, 5 / 3 / 1, Self check-in on.
const COMPETITION = "Daily Workout Check-in";
/** Linked to the smoke Participant's email for the length of the check. */
const PARTICIPANT = "Albert Hernandez";
const SMOKE_PARTICIPANT_EMAIL = "smoke-participant@jahnelgroup.com";
const NOT_LINKED = "Your sign-in doesn't match a Participant of this War Week.";

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

/** Email addresses in a page's HTML other than the viewer's own. */
function otherEmails(body: string, own: string): string[] {
  return (
    body
      .split(own)
      .join("")
      .match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) ?? []
  );
}

/** How many took part, as the page's "Took part (N)" heading shows it. */
function tookPartCount(body: string): number | null {
  const match =
    /Took part(?:<!-- -->)?\s*(?:<[^>]+>)*\s*\((?:<!-- -->)?(\d+)/.exec(body);
  return match ? Number(match[1]) : null;
}

/**
 * The seeded `participation` Competition (69-AC3): its page renders "Took
 * part" with no email but the viewer's; `checkIn` over HTTP is refused for
 * a signed-in JG user linked to no Participant, then accepted once the
 * smoke Participant's email links them, and the page lists them. Then
 * everything is undone: their check-in removed, the email cleared.
 */
export async function assertParticipationLoop(sessions: {
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const missing = ["checkIn", "checkOut"].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("participation: action ids", `missing ${missing.join(", ")}`);
    return;
  }
  let competitionId: string | null = null;
  let participantId: string | null = null;
  try {
    competitionId = await xiCompetitionIdByName(COMPETITION);
    participantId = await xiParticipantIdByName(PARTICIPANT);
    const id = competitionId;
    const linkedId = participantId;

    await runCheck(
      `participation: /xi/competitions/<${COMPETITION}> answers 200 with "Took part", "Participation" and no email but the viewer's`,
      async () => {
        const { status, body } = await getPage(
          `/xi/competitions/${id}`,
          sessions.notOrganizer,
        );
        const checks = {
          status: status === 200,
          tookPart: body.includes("Took part"),
          format: body.includes("Participation"),
          noneYet: tookPartCount(body) === 0,
          noEmail: otherEmails(body, SMOKE_PARTICIPANT_EMAIL).length === 0,
        };
        return Object.values(checks).every(Boolean)
          ? null
          : JSON.stringify(checks);
      },
    );

    await runCheck(
      "participation: checkIn by a signed-in JG user linked to no Participant is refused",
      async () => {
        const result = await callAction(
          ids.checkIn,
          [id],
          sessions.notOrganizer,
        );
        return !result.ok && result.error === NOT_LINKED
          ? null
          : JSON.stringify(result);
      },
    );

    await runCheck(
      "participation: checkIn as the linked smoke Participant succeeds and the page lists them",
      async () => {
        await runQuery(`update participant set email = $1 where id = $2`, [
          SMOKE_PARTICIPANT_EMAIL,
          linkedId,
        ]);
        const result = await callAction(
          ids.checkIn,
          [id],
          sessions.notOrganizer,
        );
        if (!result.ok) return JSON.stringify(result);
        const { status, body } = await getPage(
          `/xi/competitions/${id}`,
          sessions.notOrganizer,
        );
        const checks = {
          status: status === 200,
          listed: body.includes(PARTICIPANT),
          count: tookPartCount(body) === 1,
          checkOut: />Check out</.test(body),
          noEmail: otherEmails(body, SMOKE_PARTICIPANT_EMAIL).length === 0,
        };
        return Object.values(checks).every(Boolean)
          ? null
          : JSON.stringify(checks);
      },
    );
  } catch (error) {
    fail("participation: loop", String(error));
  } finally {
    if (competitionId) {
      await runQuery(`delete from participation where competition_id = $1`, [
        competitionId,
      ])
        .then(() => ok(`participation: clear ${COMPETITION}'s check-ins`))
        .catch((error) =>
          fail(
            `participation: clear ${COMPETITION}'s check-ins`,
            String(error),
          ),
        );
    }
    if (participantId) {
      await runQuery(`update participant set email = null where id = $1`, [
        participantId,
      ]).catch((error) =>
        fail(
          "participation: clear the smoke Participant's email",
          String(error),
        ),
      );
    }
  }
}
