import { TZDate } from "@date-fns/tz";

import { WAR_WEEK_TIME_ZONE } from "@/lib/schedule";

import { XI_FAQ_QUESTIONS } from "./awards";
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

export async function assertSetup(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  await run(
    "GET /admin/setup, /admin/setup/war-week and /admin/setup/days show the setup pages to an Organizer and the refusal to a non-Organizer",
    async () => {
      const problems: string[] = [];
      for (const [page, marker] of [
        ["/admin/setup", 'href="/admin/setup/days"'],
        ["/admin/setup/war-week", 'aria-label="War Week settings"'],
        ["/admin/setup/days", 'aria-label="Days"'],
      ] as const) {
        const organizer = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.organizer.cookie },
        });
        const body = await organizer.text();
        if (
          organizer.status !== 200 ||
          !body.includes(marker) ||
          !body.includes("overwrites the setup")
        ) {
          problems.push(`${page} organizer status=${organizer.status}`);
        }
        const refused = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.notOrganizer.cookie },
        });
        if (!(await refused.text()).includes(ADMIN_REFUSAL_TEXT)) {
          problems.push(`${page} not refused`);
        }
      }
      return problems.length === 0 ? null : problems.join("; ");
    },
  );

  const ids = serverActionIds();
  const missing = [
    "updateWarWeekSettings",
    "createDay",
    "updateDay",
    "deleteDay",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("setup server action ids in the build manifest", missing.join(", "));
    return;
  }

  const [xi] = await runQuery<Record<string, string | string[] | null>>(
    `select story_theme, start_date::text, end_date::text, mode,
       team_label, leader_title, slack_channel_url, wiki_url,
       primary_color, primary_foreground_color, accent_color, background_color,
       foreground_color, override_primary_color,
       override_primary_foreground_color, override_accent_color,
       override_background_color, override_foreground_color,
       logo_url, banner_url, font_preset, winner, highlights
     from war_week where edition = 'xi'`,
  );
  const input = {
    storyTheme: xi.story_theme,
    startDate: xi.start_date,
    endDate: xi.end_date,
    mode: xi.mode,
    teamLabel: xi.team_label,
    leaderTitle: xi.leader_title,
    slackChannelUrl: xi.slack_channel_url,
    wikiUrl: xi.wiki_url ?? "",
    primaryColor: xi.primary_color,
    primaryForegroundColor: xi.primary_foreground_color,
    accentColor: xi.accent_color,
    backgroundColor: xi.background_color,
    foregroundColor: xi.foreground_color,
    // Sent as read, so no settings save here clears one.
    overridePrimaryColor: xi.override_primary_color ?? "",
    overridePrimaryForegroundColor: xi.override_primary_foreground_color ?? "",
    overrideAccentColor: xi.override_accent_color ?? "",
    overrideBackgroundColor: xi.override_background_color ?? "",
    overrideForegroundColor: xi.override_foreground_color ?? "",
    logoUrl: xi.logo_url ?? "",
    bannerUrl: xi.banner_url ?? "",
    fontPreset: xi.font_preset,
    winner: xi.winner ?? "",
    highlights: (xi.highlights as string[]).join("\n"),
  };
  const [busyDay] = await runQuery<{ id: string; day_theme: string }>(
    `select d.id, d.day_theme from day d join war_week w on w.id = d.war_week_id
     join schedule_item s on s.day_id = d.id
     where w.edition = 'xi' order by d.date limit 1`,
  );
  const smokePrimary = "#ab12cd";
  const smokeDayTheme = "smoke-day-theme";

  try {
    await run(
      "updateWarWeekSettings rejects a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.updateWarWeekSettings,
          [await xiWarWeekId(), { ...input, primaryColor: smokePrimary }],
          sessions.notOrganizer,
        );
        const [row] = await runQuery<{ primary_color: string }>(
          "select primary_color from war_week where edition = 'xi'",
        );
        return !result.ok &&
          result.error === "Only an Organizer can change War Week settings." &&
          row.primary_color === xi.primary_color
          ? null
          : `result=${JSON.stringify(result)} color=${row.primary_color}`;
      },
    );

    await run(
      "updateWarWeekSettings refuses free-for-all while XI has Teams",
      async () => {
        const result = await callAction(
          ids.updateWarWeekSettings,
          [await xiWarWeekId(), { ...input, mode: "free-for-all" }],
          sessions.organizer,
        );
        return !result.ok && /Delete them before switching/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );

    await run(
      "an Organizer saves a new primary color and GET /xi is themed with it",
      async () => {
        const result = await callAction(
          ids.updateWarWeekSettings,
          [await xiWarWeekId(), { ...input, primaryColor: smokePrimary }],
          sessions.organizer,
        );
        const body = await (await signedInFetch(`${BASE_URL}/xi`)).text();
        return result.ok && body.includes(`--primary:${smokePrimary}`)
          ? null
          : `result=${JSON.stringify(result)} themed=${body.includes(smokePrimary)}`;
      },
    );

    await run(
      "an Organizer edits a Day Theme and GET /xi/schedule shows it; deleting a Day with Schedule Items is refused",
      async () => {
        const [dayRow] = await runQuery<{ date: string }>(
          "select date::text from day where id = $1",
          [busyDay.id],
        );
        const updated = await callAction(
          ids.updateDay,
          [busyDay.id, { date: dayRow.date, dayTheme: smokeDayTheme }],
          sessions.organizer,
        );
        const body = await (
          await signedInFetch(`${BASE_URL}/xi/schedule`)
        ).text();
        const deleted = await callAction(
          ids.deleteDay,
          [busyDay.id],
          sessions.organizer,
        );
        return updated.ok &&
          body.includes(smokeDayTheme) &&
          !deleted.ok &&
          /Schedule Item/.test(deleted.error)
          ? null
          : `updated=${JSON.stringify(updated)} shown=${body.includes(smokeDayTheme)} deleted=${JSON.stringify(deleted)}`;
      },
    );
  } finally {
    await runQuery(
      "update war_week set primary_color = $1, mode = $2 where edition = 'xi'",
      [xi.primary_color, xi.mode],
    );
    await runQuery("update day set day_theme = $1 where id = $2", [
      busyDay.day_theme,
      busyDay.id,
    ]);
  }
}

/**
 * /admin/setup/teams and /admin/setup/competitions: the pages, one
 * Participant added through the roster that GET /xi/teams shows (and a
 * duplicate email refused), and one Competition with Placement Points that
 * points entry offers as presets. Deletes what it adds.
 */
export async function assertSetupTeamsAndCompetitions(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  await run(
    "GET /admin/setup/teams and /admin/setup/competitions show the editors to an Organizer and the refusal to a non-Organizer; the landing links them",
    async () => {
      const problems: string[] = [];
      for (const [page, marker] of [
        ["/admin/setup", 'href="/admin/setup/competitions"'],
        ["/admin/setup/teams", 'aria-label="Roster"'],
        ["/admin/setup/competitions", 'aria-label="Competitions"'],
      ] as const) {
        const organizer = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.organizer.cookie },
        });
        const body = await organizer.text();
        if (organizer.status !== 200 || !body.includes(marker)) {
          problems.push(`${page} organizer status=${organizer.status}`);
        }
        const refused = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.notOrganizer.cookie },
        });
        if (!(await refused.text()).includes(ADMIN_REFUSAL_TEXT)) {
          problems.push(`${page} not refused`);
        }
      }
      return problems.length === 0 ? null : problems.join("; ");
    },
  );

  const ids = serverActionIds();
  const missing = [
    "createTeam",
    "updateTeam",
    "deleteTeam",
    "createParticipant",
    "updateParticipant",
    "deleteParticipant",
    "createCompetition",
    "updateCompetition",
    "deleteCompetition",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail(
      "setup Team, Participant and Competition action ids",
      missing.join(", "),
    );
    return;
  }

  const [red] = await runQuery<{ id: string }>(
    `select t.id from team t join war_week w on w.id = t.war_week_id
     where w.edition = 'xi' and t.name = 'Red'`,
  );
  const smokeName = "Smoke Roster Participant";
  const smokeEmail = "smoke-roster@example.com";
  const smokeCompetition = "Smoke Placement Presets";
  const participant = {
    displayName: smokeName,
    companyTag: "LTI",
    email: smokeEmail,
    teamId: red.id,
    isLeader: false,
  };

  try {
    await run(
      "createParticipant refuses a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.createParticipant,
          [await xiWarWeekId(), participant],
          sessions.notOrganizer,
        );
        return !result.ok &&
          result.error === "Only an Organizer can add Participants."
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );

    await run(
      "an Organizer adds a Participant and GET /xi/teams shows them; a second with the same email is refused",
      async () => {
        const created = await callAction(
          ids.createParticipant,
          [await xiWarWeekId(), participant],
          sessions.organizer,
        );
        const body = await (await signedInFetch(`${BASE_URL}/xi/teams`)).text();
        const duplicate = await callAction(
          ids.createParticipant,
          [
            await xiWarWeekId(),
            { ...participant, displayName: `${smokeName} 2` },
          ],
          sessions.organizer,
        );
        return created.ok &&
          body.includes(smokeName) &&
          !duplicate.ok &&
          duplicate.error === `${smokeEmail} is already ${smokeName}'s email.`
          ? null
          : `created=${JSON.stringify(created)} shown=${body.includes(smokeName)} duplicate=${JSON.stringify(duplicate)}`;
      },
    );

    await run(
      "deleteTeam refuses a Team that has Participants, naming the count",
      async () => {
        const result = await callAction(
          ids.deleteTeam,
          [red.id],
          sessions.organizer,
        );
        return !result.ok &&
          /^This Team has \d+ Participants/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );

    await run(
      "an Organizer adds a Competition with Placement Points and GET /admin/points offers them as presets",
      async () => {
        const created = await callAction(
          ids.createCompetition,
          [
            await xiWarWeekId(),
            {
              name: smokeCompetition,
              description: "",
              scoring: "team",
              maxPoints: "10",
              placementPoints: "9, 4",
              countsTowardTeam: false,
              group: "",
            },
          ],
          sessions.organizer,
        );
        const body = await (
          await fetch(`${BASE_URL}/admin/points`, {
            headers: { cookie: sessions.organizer.cookie },
          })
        ).text();
        const offered =
          body.includes(smokeCompetition) &&
          /placementPoints\\?":\[9,4\]/.test(body);
        return created.ok && offered
          ? null
          : `created=${JSON.stringify(created)} offered=${offered}`;
      },
    );
  } finally {
    await runQuery(
      `delete from participant where email = $1 or display_name like $2`,
      [smokeEmail, `${smokeName}%`],
    );
    await runQuery("delete from competition where name = $1", [
      smokeCompetition,
    ]);
  }
}

/**
 * /admin/setup/schedule and /admin/setup/faq: the pages, the Schedule Item
 * validation refusals, and one new Schedule Item and one new FAQ Item that
 * the War Week's own pages show. Deletes both after.
 */
export async function assertSetupScheduleFaq(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const run = async (check: string, body: () => Promise<string | null>) => {
    try {
      const problem = await body();
      if (problem === null) ok(check);
      else fail(check, problem);
    } catch (error) {
      fail(check, String(error));
    }
  };

  await run(
    "GET /admin/setup/schedule and /admin/setup/faq show the setup pages to an Organizer and the refusal to a non-Organizer",
    async () => {
      const problems: string[] = [];
      for (const [page, marker] of [
        ["/admin/setup", 'href="/admin/setup/faq"'],
        ["/admin/setup/schedule", 'aria-label="Schedule Items"'],
        ["/admin/setup/schedule/new", 'aria-label="Schedule Item"'],
        ["/admin/setup/faq", 'aria-label="FAQ Items"'],
        ["/admin/setup/faq/new", 'aria-label="FAQ Item"'],
      ] as const) {
        const organizer = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.organizer.cookie },
        });
        const body = await organizer.text();
        if (organizer.status !== 200 || !body.includes(marker)) {
          problems.push(`${page} organizer status=${organizer.status}`);
        }
        const refused = await fetch(`${BASE_URL}${page}`, {
          headers: { cookie: sessions.notOrganizer.cookie },
        });
        if (!(await refused.text()).includes(ADMIN_REFUSAL_TEXT)) {
          problems.push(`${page} not refused`);
        }
      }
      return problems.length === 0 ? null : problems.join("; ");
    },
  );

  const ids = serverActionIds();
  const missing = [
    "createScheduleItem",
    "updateScheduleItem",
    "deleteScheduleItem",
    "createFaqItem",
    "updateFaqItem",
    "deleteFaqItem",
    "moveFaqItem",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail(
      "setup Schedule and FAQ server action ids in the build manifest",
      missing.join(", "),
    );
    return;
  }

  const [xiDay] = await runQuery<{ id: string; date: string }>(
    `select d.id, d.date::text from day d join war_week w on w.id = d.war_week_id
     where w.edition = 'xi' order by d.date limit 1`,
  );
  const title = "smoke-schedule-item";
  const question = "smoke-faq-question?";
  const paragraph = (text: string) => ({
    type: "doc",
    content: [{ type: "paragraph", content: [{ type: "text", text }] }],
  });
  const item = {
    dayId: xiDay.id,
    startTime: "23:10",
    endTime: "23:50",
    title,
    host: "",
    location: "",
    virtualLink: "",
    category: "social",
    competitionId: "",
    description: paragraph("smoke description"),
  };

  try {
    await run(
      "createScheduleItem refuses an end before the start and a non-Organizer",
      async () => {
        const backwards = await callAction(
          ids.createScheduleItem,
          [await xiWarWeekId(), { ...item, endTime: "23:00" }],
          sessions.organizer,
        );
        const outsider = await callAction(
          ids.createScheduleItem,
          [await xiWarWeekId(), item],
          sessions.notOrganizer,
        );
        return !backwards.ok &&
          backwards.error === "End time must be after the start time." &&
          !outsider.ok &&
          outsider.error === "Link the Schedule Item to a Competition you host."
          ? null
          : `backwards=${JSON.stringify(backwards)} outsider=${JSON.stringify(outsider)}`;
      },
    );

    await run(
      "an Organizer adds a Schedule Item; GET /xi/schedule lists it, GET /xi shows it in Now/Next while it's on, and a duplicate is refused",
      async () => {
        const created = await callAction(
          ids.createScheduleItem,
          [await xiWarWeekId(), item],
          sessions.organizer,
        );
        const duplicate = await callAction(
          ids.createScheduleItem,
          [await xiWarWeekId(), item],
          sessions.organizer,
        );
        const schedule = await (
          await signedInFetch(`${BASE_URL}/xi/schedule`)
        ).text();
        const [year, month, date] = xiDay.date.split("-").map(Number);
        const at = new TZDate(
          year,
          month - 1,
          date,
          23,
          20,
          0,
          0,
          WAR_WEEK_TIME_ZONE,
        ).toISOString();
        const home = await (
          await signedInFetch(`${BASE_URL}/xi?at=${encodeURIComponent(at)}`)
        ).text();
        return created.ok &&
          !duplicate.ok &&
          /already a Schedule Item/.test(duplicate.error) &&
          schedule.includes(title) &&
          home.includes(title)
          ? null
          : `created=${JSON.stringify(created)} duplicate=${JSON.stringify(duplicate)} schedule=${schedule.includes(title)} home=${home.includes(title)}`;
      },
    );

    await run(
      "an Organizer adds an FAQ Item and GET /xi/faq lists it last",
      async () => {
        const created = await callAction(
          ids.createFaqItem,
          [
            await xiWarWeekId(),
            { question, answer: paragraph("smoke answer") },
          ],
          sessions.organizer,
        );
        const body = await (await signedInFetch(`${BASE_URL}/xi/faq`)).text();
        const last = XI_FAQ_QUESTIONS.at(-1) ?? "";
        return created.ok &&
          body.includes(question) &&
          body.indexOf(question) > body.indexOf(escapeHtml(last))
          ? null
          : `created=${JSON.stringify(created)} shown=${body.includes(question)}`;
      },
    );

    await run(
      "an Organizer deletes the new Schedule Item and FAQ Item",
      async () => {
        const [row] = await runQuery<{ id: string }>(
          "select id from schedule_item where title = $1",
          [title],
        );
        const [faq] = await runQuery<{ id: string }>(
          "select id from faq_item where question = $1",
          [question],
        );
        const items = await callAction(
          ids.deleteScheduleItem,
          [row?.id],
          sessions.organizer,
        );
        const faqs = await callAction(
          ids.deleteFaqItem,
          [faq?.id],
          sessions.organizer,
        );
        return items.ok && faqs.ok
          ? null
          : `schedule=${JSON.stringify(items)} faq=${JSON.stringify(faqs)}`;
      },
    );
  } finally {
    await runQuery("delete from schedule_item where title = $1", [title]);
    await runQuery("delete from faq_item where question = $1", [question]);
  }
}
