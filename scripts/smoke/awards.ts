import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  type SmokeSession,
  callAction,
  escapeHtml,
  fail,
  ok,
  runQuery,
  serverActionIds,
  signedInFetch,
  xiWarWeekId,
} from "./harness";

const SMOKE_AWARD_PREFIX = "smoke-award-";

export const XI_AWARDS = [
  {
    name: "Black Midnight",
    recipients: [
      "Ian Ballard",
      "Joshua Jameson",
      "Bich Dudla",
      "Steven Vickers",
    ],
  },
  { name: "Catan Champion", recipients: ["Anthony Conway"] },
  { name: "Terrordome Champion", recipients: ["Jory Hutchins"] },
];

export const XI_FAQ_QUESTIONS = [
  "I have some great pics and videos. Where do I put them?",
  "How do I record War Week time in Tense?",
  "When are the hours cutoffs this year?",
  "What are the awards at this year's War Week?",
  "Are we allowed to have personal guests at War Week?",
  "What about client or prospect guests?",
];

/** AC1: /xi/awards lists each seeded Award with its recipients. */
export async function assertAwardsPage() {
  const check =
    "GET /xi/awards lists the seeded Awards with descriptions and recipients, and says Awards don't affect Standings";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/awards`);
    const body = await res.text();
    const missing = XI_AWARDS.flatMap((award) =>
      [award.name, ...award.recipients].filter(
        (text) => !body.includes(escapeHtml(text)),
      ),
    );
    const hasDescription = body.includes(
      "Last Beyblade spinning in the Terrordome.",
    );
    const hasNote = body.includes(escapeHtml("Awards don't add points"));
    if (
      res.status === 200 &&
      missing.length === 0 &&
      hasDescription &&
      hasNote
    ) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} missing=${JSON.stringify(missing)} description=${hasDescription} note=${hasNote}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

/** AC3: /xi/faq lists the seeded FAQ Items in sort order with rich answers. */
export async function assertFaqPage() {
  const check =
    "GET /xi/faq lists the six seeded FAQ Items in seed order with their answers";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/faq`);
    const body = await res.text();
    const positions = XI_FAQ_QUESTIONS.map((q) => body.indexOf(escapeHtml(q)));
    const ordered =
      positions.every((p) => p >= 0) &&
      positions.every((p, i) => i === 0 || p > positions[i - 1]);
    const hasAnswer = body.includes(
      escapeHtml("Let Jason know so the proper arrangements can be made."),
    );
    if (res.status === 200 && ordered && hasAnswer) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} positions=${JSON.stringify(positions)} answer=${hasAnswer}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function smokeAwards() {
  return runQuery<{
    id: string;
    name: string;
    description: string | null;
    team_id: string | null;
    participant_ids: string[];
  }>(
    `select a.id, a.name, a.description, a.team_id,
       coalesce(array_agg(ap.participant_id order by ap.participant_id)
         filter (where ap.participant_id is not null), '{}') as participant_ids
     from award a left join award_participant ap on ap.award_id = a.id
     where a.name like $1 group by a.id order by a.name`,
    [`${SMOKE_AWARD_PREFIX}%`],
  );
}

export async function deleteSmokeAwards() {
  await runQuery(`delete from award where name like $1`, [
    `${SMOKE_AWARD_PREFIX}%`,
  ]);
}

/** AC2: Organizer-only create, edit and delete with Participant and/or Team recipients. */
export async function assertAwardActions(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const missing = ["createAward", "updateAward", "deleteAward"].filter(
    (name) => !ids[name],
  );
  if (missing.length > 0) {
    fail("Award server action ids in the build manifest", missing.join(", "));
    return;
  }

  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  const recipients = await runQuery<{ kind: string; id: string }>(
    `select 'team' as kind, t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' and t.name = 'Red'
     union all
     select 'participant', p.id from participant p join war_week w on w.id = p.war_week_id
       where w.edition = 'xi' and p.display_name in ('Anthony Conway', 'Jory Hutchins')
     union all
     (select 'elsewhere', p.id from participant p join war_week w on w.id = p.war_week_id
       where w.edition <> 'xi' limit 1)`,
  );
  const redId = recipients.find((r) => r.kind === "team")?.id;
  const participantIds = recipients
    .filter((r) => r.kind === "participant")
    .map((r) => r.id)
    .sort();
  const elsewhereId = recipients.find((r) => r.kind === "elsewhere")?.id;
  if (!redId || participantIds.length !== 2 || !elsewhereId) {
    fail("Award smoke recipients exist", JSON.stringify(recipients));
    return;
  }

  const pointsBefore = await runQuery<{ count: string }>(
    "select count(*) from points_entry",
  );

  try {
    await deleteSmokeAwards();

    await run(
      "createAward rejects a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.createAward,
          [
            await xiWarWeekId(),
            {
              name: `${SMOKE_AWARD_PREFIX}refused`,
              description: null,
              teamId: redId,
              participantIds: [],
            },
          ],
          sessions.notOrganizer,
        );
        const rows = await smokeAwards();
        return !result.ok &&
          result.error === "Only an Organizer can give Awards." &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run("createAward refuses an Award with no recipients", async () => {
      const result = await callAction(
        ids.createAward,
        [
          await xiWarWeekId(),
          {
            name: `${SMOKE_AWARD_PREFIX}empty`,
            description: null,
            teamId: null,
            participantIds: [],
          },
        ],
        sessions.organizer,
      );
      const rows = await smokeAwards();
      return !result.ok &&
        /Choose a Team or at least one Participant/.test(result.error) &&
        rows.length === 0
        ? null
        : `result=${JSON.stringify(result)} rows=${rows.length}`;
    });

    await run(
      "createAward refuses a Participant of another War Week",
      async () => {
        const result = await callAction(
          ids.createAward,
          [
            await xiWarWeekId(),
            {
              name: `${SMOKE_AWARD_PREFIX}elsewhere`,
              description: null,
              teamId: null,
              participantIds: [elsewhereId],
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeAwards();
        return !result.ok &&
          /Participants of this War Week/.test(result.error) &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createAward as an Organizer saves an Award to a Team and two Participants, shown on /xi/awards",
      async () => {
        const result = await callAction(
          ids.createAward,
          [
            await xiWarWeekId(),
            {
              name: `${SMOKE_AWARD_PREFIX}mvp`,
              description: "Smoke MVP",
              teamId: redId,
              participantIds,
            },
          ],
          sessions.organizer,
        );
        const [row] = await smokeAwards();
        const page = await (
          await signedInFetch(`${BASE_URL}/xi/awards`)
        ).text();
        return result.ok &&
          row?.team_id === redId &&
          JSON.stringify(row.participant_ids) ===
            JSON.stringify(participantIds) &&
          page.includes(`${SMOKE_AWARD_PREFIX}mvp`)
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
      },
    );

    const [created] = await smokeAwards();
    if (!created) {
      fail("smoke Award exists for edit and delete", "none created");
      return;
    }

    for (const [name, args] of [
      [
        "updateAward",
        [
          created.id,
          {
            name: `${SMOKE_AWARD_PREFIX}hijack`,
            description: null,
            teamId: redId,
            participantIds: [],
          },
        ],
      ],
      ["deleteAward", [created.id]],
    ] as const) {
      await run(
        `${name} rejects a signed-in JG user off the allowlist`,
        async () => {
          const result = await callAction(
            ids[name],
            [...args],
            sessions.notOrganizer,
          );
          const [row] = await smokeAwards();
          return !result.ok &&
            /^Only an Organizer can (change|delete) Awards\.$/.test(
              result.error,
            ) &&
            row?.name === `${SMOKE_AWARD_PREFIX}mvp`
            ? null
            : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
        },
      );
    }

    await run(
      "updateAward as an Organizer renames it and replaces the recipients with one Participant and no Team",
      async () => {
        const result = await callAction(
          ids.updateAward,
          [
            created.id,
            {
              name: `${SMOKE_AWARD_PREFIX}edited`,
              description: "",
              teamId: null,
              participantIds: [participantIds[0]],
            },
          ],
          sessions.organizer,
        );
        const [row] = await smokeAwards();
        return result.ok &&
          row?.id === created.id &&
          row.name === `${SMOKE_AWARD_PREFIX}edited` &&
          row.description === null &&
          row.team_id === null &&
          JSON.stringify(row.participant_ids) ===
            JSON.stringify([participantIds[0]])
          ? null
          : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
      },
    );

    await run("Giving and editing Awards adds no Points Entries", async () => {
      const [after] = await runQuery<{ count: string }>(
        "select count(*) from points_entry",
      );
      return after.count === pointsBefore[0].count
        ? null
        : `before=${pointsBefore[0].count} after=${after.count}`;
    });

    await run("deleteAward as an Organizer removes it", async () => {
      const result = await callAction(
        ids.deleteAward,
        [created.id],
        sessions.organizer,
      );
      const rows = await smokeAwards();
      return result.ok && rows.length === 0
        ? null
        : `result=${JSON.stringify(result)} rows=${rows.length}`;
    });

    await run(
      "deleteAward of an id that no longer exists says so",
      async () => {
        const result = await callAction(
          ids.deleteAward,
          ["00000000-0000-4000-8000-000000000000"],
          sessions.organizer,
        );
        return !result.ok && /no longer exists/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );
  } finally {
    await deleteSmokeAwards().catch((error) =>
      fail("delete smoke Awards", String(error)),
    );
  }
}

/**
 * /admin/awards: the seeded Awards, each row with Edit and Delete, and Add
 * Award (the form opens in a Sheet, ticket 58).
 */
export async function assertAwardAdminPages(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const listCheck =
    "GET /admin/awards as an Organizer lists the seeded Awards with Edit and Delete and Add Award, and refuses a non-Organizer";
  try {
    const organizerRes = await fetch(`${BASE_URL}/admin/awards`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const organizerBody = await organizerRes.text();
    const hasAll = XI_AWARDS.every(
      (a) =>
        organizerBody.includes(`aria-label="Edit ${a.name}"`) &&
        organizerBody.includes(`aria-label="Delete ${a.name}"`),
    );
    const notOrganizerRes = await fetch(`${BASE_URL}/admin/awards`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const notOrganizerBody = await notOrganizerRes.text();
    if (
      organizerRes.status === 200 &&
      hasAll &&
      organizerBody.includes("Add Award") &&
      notOrganizerRes.status === 200 &&
      notOrganizerBody.includes(ADMIN_REFUSAL_TEXT)
    ) {
      ok(listCheck);
    } else {
      fail(
        listCheck,
        `organizerStatus=${organizerRes.status} hasAll=${hasAll} notOrganizerStatus=${notOrganizerRes.status}`,
      );
    }
  } catch (error) {
    fail(listCheck, String(error));
  }
}
