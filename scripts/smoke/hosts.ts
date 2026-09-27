import {
  SMOKE_ANNOUNCEMENT_PREFIX,
  deleteSmokeAnnouncements,
} from "./announcements";
import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  SMOKE_HOST_EMAIL,
  SMOKE_ORGANIZER_EMAIL,
  type SmokeSession,
  callAction,
  fail,
  hasNameProp,
  ok,
  runCheck,
  runQuery,
  serverActionIds,
  xiWarWeekId,
} from "./harness";
import {
  SMOKE_NOTE_PREFIX,
  deleteSmokeEntries,
  smokeEntries,
} from "./points-entries";

// The smoke Host (ADR 0002): a JG user with no Organizer row who hosts one
// seeded XI Competition. Both Competitions are picked by name from
// seeds/xi.json; the smoke Organizer, the Participant and everyone else
// never host anything.
const HOST_COMPETITION = "Tuesday Stairs";
const OTHER_COMPETITION = "Cypher";
const NOT_HOST_REFUSAL = "You're not a Host of that Competition.";

/** Removes every `competition_host` row the smoke Host has. */
export async function deleteSmokeHosts() {
  await runQuery(`delete from competition_host where email = $1`, [
    SMOKE_HOST_EMAIL,
  ]);
}

type HostFixture = {
  session: SmokeSession;
  xiId: string;
  hostCompetitionId: string;
  otherCompetitionId: string;
  /** A Team of XI: the Target of a Points Entry in a team Competition. */
  teamId: string;
};

/** The ids of the two Competitions the Host checks use. */
async function hostFixture(session: SmokeSession): Promise<HostFixture> {
  const competitions = await runQuery<{ id: string; name: string }>(
    `select c.id, c.name from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.name = any($1) and c.scoring = 'team'`,
    [[HOST_COMPETITION, OTHER_COMPETITION]],
  );
  const idOf = (name: string) => {
    const row = competitions.find((c) => c.name === name);
    if (!row) throw new Error(`no XI team Competition named ${name}`);
    return row.id;
  };
  const [team] = await runQuery<{ id: string }>(
    `select t.id from team t join war_week w on w.id = t.war_week_id
     where w.edition = 'xi' order by t.name limit 1`,
  );
  return {
    session,
    xiId: await xiWarWeekId(),
    hostCompetitionId: idOf(HOST_COMPETITION),
    otherCompetitionId: idOf(OTHER_COMPETITION),
    teamId: team.id,
  };
}

/**
 * Every check that needs the smoke Host: assigns it to the Host
 * Competition, runs them, and removes its `competition_host` rows however
 * they end. The former-Host check removes the assignment, so it runs last.
 */
export async function assertHostChecks(sessions: {
  host: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const setup = "the smoke Host hosts one XI Competition";
  let fixture: HostFixture;
  try {
    fixture = await hostFixture(sessions.host);
    await deleteSmokeHosts();
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)`,
      [fixture.hostCompetitionId, SMOKE_HOST_EMAIL],
    );
    ok(setup);
  } catch (error) {
    fail(setup, String(error));
    await deleteSmokeHosts().catch(() => {});
    return;
  }
  try {
    await assertHostAllowedAndRefused(fixture);
    await assertHostKeepsOwnPin(fixture);
    await assertAdminTrimmedForHost(sessions);
    await assertAdminLinkForHost(sessions);
    await assertAccessBeforeValidation(sessions, fixture);
    await assertFormerHostRefused(fixture);
  } finally {
    await deleteSmokeHosts().catch((error) =>
      fail("delete the smoke Host's competition_host rows", String(error)),
    );
  }
}

/** Ticket 03 AC5: a Host runs their own Competition and nothing else. */
async function assertHostAllowedAndRefused(fixture: HostFixture) {
  const ids = serverActionIds();
  const { session, xiId } = fixture;
  const entry = (competitionId: string, note: string) => ({
    competitionId,
    targetId: fixture.teamId,
    points: "3",
    note: `${SMOKE_NOTE_PREFIX}${note}`,
  });

  try {
    await deleteSmokeEntries();
    await runCheck(
      "createPointsEntry as a Host saves an entry on their Competition, entered by the Host",
      async () => {
        const result = await callAction(
          ids.createPointsEntry,
          [entry(fixture.hostCompetitionId, "host")],
          session,
        );
        const rows = await smokeEntries();
        return result.ok &&
          rows.length === 1 &&
          rows[0].entered_by_email === SMOKE_HOST_EMAIL
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );
  } finally {
    await deleteSmokeEntries().catch((error) =>
      fail("delete smoke Points Entries", String(error)),
    );
  }

  await runCheck(
    "createPointsEntry as a Host refuses another Competition with 'You're not a Host of that Competition.'",
    async () => {
      const result = await callAction(
        ids.createPointsEntry,
        [entry(fixture.otherCompetitionId, "host-other")],
        session,
      );
      const rows = await smokeEntries();
      return !result.ok &&
        result.error === NOT_HOST_REFUSAL &&
        rows.length === 0
        ? null
        : `result=${JSON.stringify(result)} rows=${rows.length}`;
    },
  );

  const [settingsBefore] = await runQuery<{ story_theme: string }>(
    `select story_theme from war_week where id = $1`,
    [xiId],
  );
  const [daysBefore] = await runQuery<{ count: string }>(
    `select count(*) from day where war_week_id = $1`,
    [xiId],
  );
  const [announcement] = await runQuery<{ id: string; pinned: boolean }>(
    `select id, pinned from announcement where war_week_id = $1 and not pinned
     order by published_at limit 1`,
    [xiId],
  );

  for (const [label, action, args, expected, unchanged] of [
    [
      "updateWarWeekSettings for XI",
      "updateWarWeekSettings",
      [xiId, { storyTheme: "smoke-host-theme" }],
      "Only an Organizer can change War Week settings.",
      async () => {
        const [row] = await runQuery<{ story_theme: string }>(
          `select story_theme from war_week where id = $1`,
          [xiId],
        );
        return row.story_theme === settingsBefore.story_theme;
      },
    ],
    [
      "createDay for XI",
      "createDay",
      [xiId, { date: "2026-02-28", dayTheme: "smoke-host-day" }],
      "Only an Organizer can add Days.",
      async () => {
        const [row] = await runQuery<{ count: string }>(
          `select count(*) from day where war_week_id = $1`,
          [xiId],
        );
        return row.count === daysBefore.count;
      },
    ],
    [
      "pinAnnouncement on a seeded Announcement",
      "pinAnnouncement",
      [announcement.id],
      "Only an Organizer can pin Announcements.",
      async () => {
        const [row] = await runQuery<{ pinned: boolean }>(
          `select pinned from announcement where id = $1`,
          [announcement.id],
        );
        return row.pinned === false;
      },
    ],
  ] as const) {
    await runCheck(
      `${action} as a Host is refused on ${label} with '${expected}'`,
      async () => {
        const result = await callAction(ids[action], [...args], session);
        const same = await unchanged();
        return !result.ok && result.error === expected && same
          ? null
          : `result=${JSON.stringify(result)} unchanged=${same}`;
      },
    );
  }
}

/** Spec: a Host's edit of their own Announcement never changes its pin. */
async function assertHostKeepsOwnPin(fixture: HostFixture) {
  const ids = serverActionIds();
  const title = `${SMOKE_ANNOUNCEMENT_PREFIX}host-pinned`;
  const body = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "smoke" }] },
    ],
  };
  const pinned = async (id: string) => {
    const [row] = await runQuery<{ pinned: boolean; title: string }>(
      `select pinned, title from announcement where id = $1`,
      [id],
    );
    return row;
  };
  try {
    await deleteSmokeAnnouncements();
    // An Organizer pinned the Host's own Announcement.
    const [row] = await runQuery<{ id: string }>(
      `insert into announcement (war_week_id, title, body, pinned, author_email)
       values ($1, $2, $3, true, $4) returning id`,
      [fixture.xiId, title, JSON.stringify(body), SMOKE_HOST_EMAIL],
    );

    await runCheck(
      "updateAnnouncement as a Host without pinned keeps their Organizer-pinned Announcement pinned",
      async () => {
        const result = await callAction(
          ids.updateAnnouncement,
          [row.id, { title: `${title}-edited`, body, videoUrls: [] }],
          fixture.session,
        );
        const after = await pinned(row.id);
        return result.ok &&
          after.pinned === true &&
          after.title === `${title}-edited`
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(after)}`;
      },
    );

    await runCheck(
      "updateAnnouncement as a Host with pinned: false on their pinned Announcement is refused with 'Only an Organizer can unpin Announcements.'",
      async () => {
        const result = await callAction(
          ids.updateAnnouncement,
          [
            row.id,
            { title: `${title}-unpinned`, body, videoUrls: [], pinned: false },
          ],
          fixture.session,
        );
        const after = await pinned(row.id);
        return !result.ok &&
          result.error === "Only an Organizer can unpin Announcements." &&
          after.pinned === true &&
          after.title === `${title}-edited`
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(after)}`;
      },
    );
  } catch (error) {
    fail("the Host's own pinned Announcement", String(error));
  } finally {
    await deleteSmokeAnnouncements().catch((error) =>
      fail("delete smoke Announcements", String(error)),
    );
  }
}

/** Spec: `/admin` shows a Host their Competitions only. */
async function assertAdminTrimmedForHost(sessions: {
  host: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const get = async (route: string, session: SmokeSession) => {
    const res = await fetch(`${BASE_URL}${route}`, {
      headers: { cookie: session.cookie },
    });
    return { status: res.status, body: await res.text() };
  };

  await runCheck(
    `GET /admin/points as a Host offers ${HOST_COMPETITION} and not ${OTHER_COMPETITION}`,
    async () => {
      const { status, body } = await get("/admin/points", sessions.host);
      const result = {
        status,
        form: body.includes("Add a Points Entry"),
        hosted: hasNameProp(body, HOST_COMPETITION),
        other: hasNameProp(body, OTHER_COMPETITION),
      };
      return status === 200 && result.form && result.hosted && !result.other
        ? null
        : JSON.stringify(result);
    },
  );

  await runCheck(
    `GET /admin/setup/war-week as a Host shows '${ADMIN_REFUSAL_TEXT}'`,
    async () => {
      const { status, body } = await get(
        "/admin/setup/war-week",
        sessions.host,
      );
      return status === 200 &&
        body.includes(ADMIN_REFUSAL_TEXT) &&
        !body.includes(">War Week settings</h1>")
        ? null
        : `status=${status}`;
    },
  );

  await runCheck(
    `GET /admin as a Participant shows '${ADMIN_REFUSAL_TEXT}'`,
    async () => {
      const { status, body } = await get("/admin", sessions.notOrganizer);
      return status === 200 &&
        body.includes(ADMIN_REFUSAL_TEXT) &&
        !body.includes("Admin sections")
        ? null
        : `status=${status}`;
    },
  );
}

/** The Admin link in the edition navigation (`canOpenAdmin`). */
async function assertAdminLinkForHost(sessions: {
  host: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  for (const [label, session, expected] of [
    ["a Host", sessions.host, true],
    ["a Participant", sessions.notOrganizer, false],
  ] as const) {
    await runCheck(
      `GET /xi as ${label} ${expected ? "shows" : "hides"} the Admin link`,
      async () => {
        const res = await fetch(`${BASE_URL}/xi`, {
          headers: { cookie: session.cookie },
        });
        const body = await res.text();
        const shown = body.includes('href="/admin"');
        return res.status === 200 && shown === expected
          ? null
          : `status=${res.status} shown=${shown}`;
      },
    );
  }
}

/** A real, existing row id of each kind in XI, for the order-of-checks calls. */
async function xiRowIds(fixture: HostFixture) {
  const first = async (sql: string, params: unknown[] = []) => {
    const [row] = await runQuery<{ id: string }>(sql, params);
    if (!row) throw new Error(`no row for: ${sql}`);
    return row.id;
  };
  const xi = fixture.xiId;
  return {
    day: await first(`select id from day where war_week_id = $1 limit 1`, [xi]),
    team: fixture.teamId,
    participant: await first(
      `select p.id from participant p where p.war_week_id = $1 limit 1`,
      [xi],
    ),
    scheduleItem: await first(
      `select s.id from schedule_item s join day d on d.id = s.day_id
       where d.war_week_id = $1 and s.competition_id is distinct from $2 limit 1`,
      [xi, fixture.hostCompetitionId],
    ),
    faqItem: await first(
      `select id from faq_item where war_week_id = $1 limit 1`,
      [xi],
    ),
    award: await first(`select id from award where war_week_id = $1 limit 1`, [
      xi,
    ]),
    announcement: await first(
      `select id from announcement where war_week_id = $1 and author_email <> $2 limit 1`,
      [xi, SMOKE_HOST_EMAIL],
    ),
  };
}

/**
 * Spec S-ORDER: access comes before validation. With a real existing id,
 * a Participant and a Host outside their Competition post malformed input
 * (wrong types, missing fields) and get the access refusal, never a
 * validation message. A malformed id gets "no longer exists" first, which
 * this doesn't test.
 */
async function assertAccessBeforeValidation(
  sessions: { host: SmokeSession; notOrganizer: SmokeSession },
  fixture: HostFixture,
) {
  const ids = serverActionIds();
  const row = await xiRowIds(fixture);
  const other = fixture.otherCompetitionId;
  const organizerOnly = (what: string) => `Only an Organizer can ${what}.`;
  const cases: {
    family: string;
    action: string;
    args: unknown[];
    participant: string;
    host: string;
  }[] = [
    {
      family: "settings",
      action: "updateWarWeekSettings",
      args: [fixture.xiId, "not settings"],
      participant: organizerOnly("change War Week settings"),
      host: organizerOnly("change War Week settings"),
    },
    {
      family: "Day",
      action: "updateDay",
      args: [row.day, { date: 5 }],
      participant: organizerOnly("change Days"),
      host: organizerOnly("change Days"),
    },
    {
      family: "Team",
      action: "updateTeam",
      args: [row.team, { name: [] }],
      participant: organizerOnly("change Teams"),
      host: organizerOnly("change Teams"),
    },
    {
      family: "Participant",
      action: "updateParticipant",
      args: [row.participant, { teamId: 9 }],
      participant: organizerOnly("change Participants"),
      host: organizerOnly("change Participants"),
    },
    {
      family: "Competition",
      action: "updateCompetition",
      args: [other, { scoring: 7 }],
      participant: NOT_HOST_REFUSAL,
      host: NOT_HOST_REFUSAL,
    },
    {
      family: "Schedule Item",
      action: "updateScheduleItem",
      args: [row.scheduleItem, { competitionId: other, startTime: 9 }],
      participant: NOT_HOST_REFUSAL,
      host: NOT_HOST_REFUSAL,
    },
    {
      family: "FAQ",
      action: "updateFaqItem",
      args: [row.faqItem, { question: 1 }],
      participant: organizerOnly("change FAQ Items"),
      host: organizerOnly("change FAQ Items"),
    },
    {
      family: "Award",
      action: "updateAward",
      args: [row.award, { name: null }],
      participant: organizerOnly("change Awards"),
      host: organizerOnly("change Awards"),
    },
    {
      family: "Announcement",
      action: "updateAnnouncement",
      args: [row.announcement, { title: 3, pinned: "yes" }],
      participant: "Only an Organizer can change someone else's Announcement.",
      host: "Only an Organizer can change someone else's Announcement.",
    },
    {
      family: "Points Entry",
      action: "createPointsEntry",
      args: [{ competitionId: other, points: {}, targetId: 7 }],
      participant: NOT_HOST_REFUSAL,
      host: NOT_HOST_REFUSAL,
    },
    {
      family: "Bracket",
      action: "replaceEntrants",
      args: [other, { targetIds: "everyone" }],
      participant: NOT_HOST_REFUSAL,
      host: NOT_HOST_REFUSAL,
    },
    {
      family: "lifecycle",
      action: "endWarWeek",
      args: [fixture.xiId, "no Winner"],
      participant: organizerOnly("end a War Week"),
      host: organizerOnly("end a War Week"),
    },
    {
      family: "Organizer list",
      action: "addOrganizer",
      args: [42],
      participant: organizerOnly("add an Organizer"),
      host: organizerOnly("add an Organizer"),
    },
  ];

  for (const [label, session, key] of [
    ["a Participant", sessions.notOrganizer, "participant"],
    ["a Host outside their Competition", sessions.host, "host"],
  ] as const) {
    await runCheck(
      `malformed input from ${label} gets the access refusal, not a validation message, in every family`,
      async () => {
        const wrong: string[] = [];
        for (const c of cases) {
          const result = await callAction(ids[c.action], c.args, session);
          if (result.ok || result.error !== c[key]) {
            wrong.push(`${c.family} (${c.action}): ${JSON.stringify(result)}`);
          }
        }
        return wrong.length === 0 ? null : wrong.join("; ");
      },
    );
  }
}

/** Spec S-FORMER: removing the assignment takes effect on the next request. */
async function assertFormerHostRefused(fixture: HostFixture) {
  const ids = serverActionIds();
  await runCheck(
    "createPointsEntry as a former Host is refused on the Competition they no longer host",
    async () => {
      await deleteSmokeHosts();
      try {
        const result = await callAction(
          ids.createPointsEntry,
          [
            {
              competitionId: fixture.hostCompetitionId,
              targetId: fixture.teamId,
              points: "3",
              note: `${SMOKE_NOTE_PREFIX}former-host`,
            },
          ],
          fixture.session,
        );
        const rows = await smokeEntries();
        return !result.ok &&
          result.error === NOT_HOST_REFUSAL &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      } finally {
        await deleteSmokeEntries();
      }
    },
  );
}

/**
 * A signed-in Participant (no Organizer row, hosts nothing) is refused on
 * one representative action per family, and nothing is written.
 */
export async function assertParticipantRefused(sessions: {
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const xi = await xiWarWeekId();
  const [competition] = await runQuery<{ id: string }>(
    `select id from competition where war_week_id = $1 and scoring = 'team' order by name limit 1`,
    [xi],
  );
  const [team] = await runQuery<{ id: string }>(
    `select id from team where war_week_id = $1 order by name limit 1`,
    [xi],
  );
  const [day] = await runQuery<{ id: string }>(
    `select id from day where war_week_id = $1 order by date limit 1`,
    [xi],
  );
  const doc = (text: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const organizerOnly = (what: string) => `Only an Organizer can ${what}.`;
  const cases: [string, string, unknown[], string][] = [
    [
      "settings",
      "updateWarWeekSettings",
      [xi, { storyTheme: "smoke-participant" }],
      organizerOnly("change War Week settings"),
    ],
    [
      "Day",
      "createDay",
      [xi, { date: "2026-02-28", dayTheme: "smoke-participant" }],
      organizerOnly("add Days"),
    ],
    [
      "Team",
      "createTeam",
      [xi, { name: "Smoke Participant Team", color: "#123456", logoUrl: "" }],
      organizerOnly("add Teams"),
    ],
    [
      "Participant",
      "createParticipant",
      [
        xi,
        {
          displayName: "Smoke Refused Participant",
          companyTag: "",
          email: "",
          teamId: team.id,
          isLeader: false,
        },
      ],
      organizerOnly("add Participants"),
    ],
    [
      "Competition",
      "createCompetition",
      [
        xi,
        { name: "Smoke Refused Competition", description: "", scoring: "team" },
      ],
      organizerOnly("add Competitions"),
    ],
    [
      "Schedule Item",
      "createScheduleItem",
      [
        xi,
        {
          dayId: day.id,
          startTime: "23:10",
          endTime: "23:50",
          title: "smoke-participant-schedule-item",
          host: "",
          location: "",
          virtualLink: "",
          category: "social",
          competitionId: competition.id,
          description: doc("smoke"),
        },
      ],
      NOT_HOST_REFUSAL,
    ],
    [
      "FAQ",
      "createFaqItem",
      [xi, { question: "smoke-participant?", answer: doc("smoke") }],
      organizerOnly("add FAQ Items"),
    ],
    [
      "Award",
      "createAward",
      [
        xi,
        {
          name: "smoke-award-participant",
          description: null,
          teamId: team.id,
          participantIds: [],
        },
      ],
      organizerOnly("give Awards"),
    ],
    [
      "Announcement",
      "createAnnouncement",
      [
        xi,
        {
          title: `${SMOKE_ANNOUNCEMENT_PREFIX}participant`,
          body: doc("smoke"),
          pinned: false,
        },
      ],
      "Only an Organizer or a Host of this War Week can post Announcements.",
    ],
    [
      "Points Entry",
      "createPointsEntry",
      [
        {
          competitionId: competition.id,
          targetId: team.id,
          points: "1",
          note: `${SMOKE_NOTE_PREFIX}participant`,
        },
      ],
      NOT_HOST_REFUSAL,
    ],
    ["Bracket", "generateBracket", [competition.id, {}], NOT_HOST_REFUSAL],
    ["lifecycle", "startWarWeek", [xi], organizerOnly("start a War Week")],
    [
      "Organizer list",
      "removeOrganizer",
      [SMOKE_ORGANIZER_EMAIL],
      organizerOnly("remove an Organizer"),
    ],
  ];

  for (const [family, action, args, expected] of cases) {
    await runCheck(
      `${action} as a Participant is refused (${family}) with '${expected}'`,
      async () => {
        if (!ids[action]) return `no server action id for ${action}`;
        const result = await callAction(
          ids[action],
          args,
          sessions.notOrganizer,
        );
        return !result.ok && result.error === expected
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );
  }

  await runCheck("the Participant's refused calls wrote nothing", async () => {
    const [counts] = await runQuery<Record<string, string>>(
      `select
         (select count(*) from points_entry where note = $1) as points_entries,
         (select count(*) from announcement where title = $2) as announcements,
         (select count(*) from faq_item where question = 'smoke-participant?') as faq_items,
         (select count(*) from team where name = 'Smoke Participant Team') as teams,
         (select count(*) from participant where display_name = 'Smoke Refused Participant') as participants,
         (select count(*) from competition where name = 'Smoke Refused Competition') as competitions,
         (select count(*) from award where name = 'smoke-award-participant') as awards,
         (select count(*) from schedule_item where title = 'smoke-participant-schedule-item') as schedule_items,
         (select count(*) from day where day_theme = 'smoke-participant') as days,
         (select count(*) from war_week where story_theme = 'smoke-participant') as settings,
         (select count(*) from war_week where edition = 'xi' and status = 'live') as xi_live,
         (select count(*) from organizer where email = $3) as smoke_organizer`,
      [
        `${SMOKE_NOTE_PREFIX}participant`,
        `${SMOKE_ANNOUNCEMENT_PREFIX}participant`,
        SMOKE_ORGANIZER_EMAIL,
      ],
    );
    const expected = { xi_live: "1", smoke_organizer: "1" };
    const wrong = Object.entries(counts).filter(
      ([key, count]) =>
        count !== (expected[key as keyof typeof expected] ?? "0"),
    );
    return wrong.length === 0 ? null : JSON.stringify(counts);
  });
}
