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

/** The roster name a marker email's entry is added under. */
const markerName = (email: string) =>
  `R22 Picker Marker ${email.split("@")[1]}`;

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

const SCHEDULE_MARKER_TITLES = [
  "R25 Picker Marker unlinked item",
  "R25 Picker Marker linked item",
];

/**
 * R25: the Schedule pages show Hosts by name and never an email. One marker
 * roster entry hosts an unlinked Schedule Item and the other hosts a
 * Competition a Schedule Item links; both names must appear on `/xi/schedule`
 * (so the check can fail) and no roster email anywhere on either page.
 */
async function assertNoRosterEmailOnSchedulePages(
  xiId: string,
  sessions: { organizer: SmokeSession; notOrganizer: SmokeSession },
  emails: string[],
  organizerEmail: string,
  participantEmail: string,
) {
  const names = MARKER_EMAILS.map(markerName);
  try {
    const [day] = await runQuery<{ id: string }>(
      `select id from day where war_week_id = $1 order by date limit 1`,
      [xiId],
    );
    const [competition] = await runQuery<{ id: string }>(
      `select id from competition where war_week_id = $1 order by name limit 1`,
      [xiId],
    );
    const [unlinked] = await runQuery<{ id: string }>(
      `insert into schedule_item (day_id, start_time, title, category)
       values ($1, '03:15', $2, 'social') returning id`,
      [day.id, SCHEDULE_MARKER_TITLES[0]],
    );
    await runQuery(
      `insert into schedule_item (day_id, start_time, title, category, competition_id)
       values ($1, '03:20', $2, 'competition', $3)`,
      [day.id, SCHEDULE_MARKER_TITLES[1], competition.id],
    );
    await runQuery(
      `insert into schedule_item_host (schedule_item_id, participant_id)
       select $1, id from participant where email = $2`,
      [unlinked.id, MARKER_EMAILS[0]],
    );
    await runQuery(
      `insert into competition_host (competition_id, participant_id)
       select $1, id from participant where email = $2`,
      [competition.id, MARKER_EMAILS[1]],
    );
    const shown = await bodiesOf("/xi/schedule", sessions.notOrganizer);
    const missing = shown.flatMap(({ kind, body }) =>
      kind === "html"
        ? names
            .filter((name) => !body.includes(name))
            .map((n) => `${kind} lacks ${n}`)
        : [],
    );
    if (missing.length === 0)
      ok("both marker Hosts' names show on /xi/schedule");
    else
      fail("both marker Hosts' names show on /xi/schedule", missing.join("; "));
    await assertNoEmail(
      "no roster email in /xi/schedule with Hosts shown",
      "/xi/schedule",
      sessions.notOrganizer,
      emails,
      participantEmail,
    );
    await assertNoEmail(
      "no roster email in /admin/schedule with Hosts shown",
      "/admin/schedule",
      sessions.organizer,
      emails,
      organizerEmail,
    );
  } catch (error) {
    fail("the Schedule Host email check", String(error));
  } finally {
    await runQuery(
      `delete from competition_host where participant_id in
         (select id from participant where email = any($1))`,
      [MARKER_EMAILS],
    ).catch((error) =>
      fail("remove the marker Competition Host", String(error)),
    );
    await runQuery(`delete from schedule_item where title = any($1)`, [
      SCHEDULE_MARKER_TITLES,
    ]).catch((error) =>
      fail("remove the marker Schedule Items", String(error)),
    );
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
        [xiId, markerName(email), email],
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
    await assertNoRosterEmailOnSchedulePages(
      xiId,
      sessions,
      emails,
      organizerEmail,
      participantEmail,
    );
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

/**
 * R23, red-team W6: no email on a League's pages. The same check as above
 * for XII's seeded Leagues (named in `names`), which are current while the
 * caller has XI ended: each one's Participant page, and its admin page as
 * an Organizer and as a Host, in the HTML and the `RSC: 1` payload. Adds
 * the marker roster entries to XII and makes the smoke Host a roster
 * Participant who hosts the first League; both are removed when it ends.
 */
export async function assertNoRosterEmailInLeagues(
  sessions: {
    organizer: SmokeSession;
    host: SmokeSession;
    notOrganizer: SmokeSession;
  },
  names: string[],
  hostEmail: string,
  organizerEmail: string,
  participantEmail: string,
) {
  const [xii] = await runQuery<{ id: string }>(
    `select id from war_week where edition = 'xii'`,
  );
  const competitions = await runQuery<{ id: string; name: string }>(
    `select id, name from competition where war_week_id = $1 and name = any($2)
     order by name`,
    [xii.id, names],
  );
  if (competitions.length !== names.length) {
    fail(
      "the League picker email check finds XII's Leagues",
      JSON.stringify(competitions),
    );
    return;
  }
  const hosted = competitions[0].id;
  try {
    for (const email of MARKER_EMAILS) {
      await runQuery(
        `insert into participant (war_week_id, display_name, email) values ($1, $2, $3)`,
        [xii.id, `R23 Picker Marker ${email.split("@")[1]}`, email],
      );
    }
    const [host] = await runQuery<{ id: string }>(
      `insert into participant (war_week_id, display_name, email)
       values ($1, 'R23 Smoke League Host', $2) returning id`,
      [xii.id, hostEmail],
    );
    await runQuery(
      `insert into competition_host (competition_id, participant_id) values ($1, $2)`,
      [hosted, host.id],
    );
    const emails = await rosterEmails();
    if (!MARKER_EMAILS.every((email) => emails.includes(email))) {
      fail(
        "the League picker email check has roster emails to look for",
        "none",
      );
      return;
    }
    for (const { id, name } of competitions) {
      await assertNoEmail(
        `no roster email in the Participant page of ${name} (League)`,
        `/xii/competitions/${id}`,
        sessions.notOrganizer,
        emails,
        participantEmail,
      );
      await assertNoEmail(
        `no roster email in the admin page of ${name} (League) as an Organizer`,
        `/admin/competitions/${id}`,
        sessions.organizer,
        emails,
        organizerEmail,
      );
      await assertNoEmail(
        `no roster email in the admin page of ${name} (League) as a Host`,
        `/admin/competitions/${id}`,
        sessions.host,
        emails,
        hostEmail,
      );
    }
  } catch (error) {
    fail("the League picker email check", String(error));
  } finally {
    await runQuery(`delete from participant where email = any($1)`, [
      [...MARKER_EMAILS, hostEmail],
    ]).catch((error) =>
      fail("remove the League picker check's roster entries", String(error)),
    );
  }
}
