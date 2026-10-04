import {
  BASE_URL,
  type SmokeSession,
  fail,
  ok,
  runQuery,
  xiWarWeekId,
} from "./harness";

// Marker roster entries the check adds, so it never passes by finding no
// email to look for. One is a JG address, one is not (a "Can't sign in" Host
// candidate); both are removed when the check ends.
const MARKER_EMAILS = [
  "r22-picker-marker@jahnelgroup.com",
  "r22-picker-marker@example.org",
];

/** Every email on any War Week's roster, lowercase. */
async function rosterEmails(): Promise<string[]> {
  const rows = await runQuery<{ email: string }>(
    `select distinct lower(email) as email from participant where email is not null`,
  );
  return rows.map((row) => row.email);
}

/**
 * Fetches `path` as `session`, once as HTML and once as the RSC payload
 * Next sends on a client navigation (`RSC: 1`), and returns each body.
 */
async function bodiesOf(path: string, session: SmokeSession) {
  const out: { kind: string; status: number; body: string }[] = [];
  for (const [kind, headers] of [
    ["html", {}],
    ["rsc", { RSC: "1" }],
  ] as const) {
    const response = await fetch(`${BASE_URL}${path}`, {
      headers: { cookie: session.cookie, ...headers },
    });
    out.push({ kind, status: response.status, body: await response.text() });
  }
  return out;
}

async function assertNoEmail(
  check: string,
  path: string,
  session: SmokeSession,
  forbidden: string[],
  ownEmail: string | null,
) {
  try {
    const problems: string[] = [];
    for (const { kind, status, body } of await bodiesOf(path, session)) {
      if (status !== 200) {
        problems.push(`${kind} answered ${status}`);
        continue;
      }
      const lower = body.toLowerCase();
      // The viewer's own address may show (the account menu); no one else's.
      const leaked = forbidden.filter(
        (email) => email !== ownEmail && lower.includes(email),
      );
      if (leaked.length > 0) {
        problems.push(`${kind} holds roster email ${leaked[0]}`);
      }
    }
    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  }
}

/**
 * No picker leaks a Participant's email (People and admin, Decision 3): the
 * rendered HTML and the RSC payload of the Participant Competition page, the
 * Competition admin page as a Host and as an Organizer, Discretionary points
 * and Awards hold no roster email. Every Competition of XI is checked, so
 * every Format's pickers (the Placement sheet, Entrants, Squads, Attempts,
 * Hosts) are covered.
 */
export async function assertNoRosterEmailInPickers(
  sessions: {
    organizer: SmokeSession;
    host: SmokeSession;
    notOrganizer: SmokeSession;
  },
  hostEmail: string,
  organizerEmail: string,
  participantEmail: string,
) {
  const xiId = await xiWarWeekId();
  try {
    for (const email of MARKER_EMAILS) {
      await runQuery(
        `insert into participant (war_week_id, display_name, email) values ($1, $2, $3)`,
        [xiId, `R22 Picker Marker ${email.split("@")[1]}`, email],
      );
    }
  } catch (error) {
    fail("the picker email check's marker roster entries", String(error));
    return;
  }
  try {
    const emails = await rosterEmails();
    if (!MARKER_EMAILS.every((email) => emails.includes(email))) {
      fail("the picker email check has roster emails to look for", "none");
      return;
    }
    const competitions = await runQuery<{ id: string; name: string }>(
      `select id, name from competition where war_week_id = $1 order by name`,
      [xiId],
    );
    for (const { id, name } of competitions) {
      await assertNoEmail(
        `no roster email in the Participant page of ${name}`,
        `/xi/competitions/${id}`,
        sessions.notOrganizer,
        emails,
        participantEmail,
      );
      await assertNoEmail(
        `no roster email in the admin page of ${name} as an Organizer`,
        `/admin/competitions/${id}`,
        sessions.organizer,
        emails,
        organizerEmail,
      );
    }
    // The Host's one Competition: its page loads for them. The others
    // answer the refusal, which holds no roster email either.
    for (const { id, name } of competitions) {
      await assertNoEmail(
        `no roster email in the admin page of ${name} as a Host`,
        `/admin/competitions/${id}`,
        sessions.host,
        emails,
        hostEmail,
      );
    }
    for (const path of ["/admin/discretionary-points", "/admin/awards"]) {
      await assertNoEmail(
        `no roster email in ${path}`,
        path,
        sessions.organizer,
        emails,
        organizerEmail,
      );
    }
  } finally {
    await runQuery(`delete from participant where email = any($1)`, [
      MARKER_EMAILS,
    ]).catch((error) =>
      fail("remove the picker email check's marker entries", String(error)),
    );
  }
}
