import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { ABOUT_FEATURES } from "@/lib/about";
import { DISPLAY_SCRIPT } from "@/lib/display";
import { YOU_ROW_CLASS } from "@/lib/you";
import { MCP_TOOLS } from "@/mcp/tools";
import { DEMO_SEED } from "@/seed/local-files";

import {
  BASE_URL,
  type SmokeSession,
  createSmokeSession,
  fail,
  ok,
  runCheck,
  runQuery,
  signedInFetch,
  teamTotalIn,
} from "./harness";

/** Rows each table should hold for War Week XI after loading the demo seed. */
function expectedXiCounts(): Record<string, number> {
  const seed = JSON.parse(
    readFileSync(path.resolve(process.cwd(), DEMO_SEED), "utf-8"),
  );
  const count = (list: unknown[] | undefined) => list?.length ?? 0;
  return {
    war_week: 1,
    day: count(seed.days),
    schedule_item: seed.days.reduce(
      (sum: number, d: { scheduleItems?: unknown[] }) =>
        sum + count(d.scheduleItems),
      0,
    ),
    team: count(seed.teams),
    participant: count(seed.participants),
    competition: count(seed.competitions),
    points_entry: count(seed.pointsEntries),
    award: count(seed.awards),
    announcement: count(seed.announcements),
    faq_item: count(seed.faqItems),
  };
}

const XI_COUNT_QUERIES: Record<string, string> = {
  war_week: "select count(*) from war_week where edition = 'xi'",
  day: "select count(*) from day join war_week w on w.id = day.war_week_id where w.edition = 'xi'",
  schedule_item:
    "select count(*) from schedule_item s join day d on d.id = s.day_id join war_week w on w.id = d.war_week_id where w.edition = 'xi'",
  team: "select count(*) from team t join war_week w on w.id = t.war_week_id where w.edition = 'xi'",
  participant:
    "select count(*) from participant p join war_week w on w.id = p.war_week_id where w.edition = 'xi'",
  competition:
    "select count(*) from competition c join war_week w on w.id = c.war_week_id where w.edition = 'xi'",
  points_entry:
    "select count(*) from points_entry e join competition c on c.id = e.competition_id join war_week w on w.id = c.war_week_id where w.edition = 'xi'",
  award:
    "select count(*) from award a join war_week w on w.id = a.war_week_id where w.edition = 'xi'",
  announcement:
    "select count(*) from announcement a join war_week w on w.id = a.war_week_id where w.edition = 'xi'",
  faq_item:
    "select count(*) from faq_item f join war_week w on w.id = f.war_week_id where w.edition = 'xi'",
};

export async function assertSeedLoadedOnce() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const expected = expectedXiCounts();
    for (const [table, query] of Object.entries(XI_COUNT_QUERIES)) {
      const check = `after loading the seed twice, War Week XI has ${expected[table]} ${table} rows`;
      const { rows } = await client.query<{ count: string }>(query);
      if (Number(rows[0]?.count) === expected[table]) {
        ok(check);
      } else {
        fail(check, `count=${rows[0]?.count}`);
      }
    }
  } catch (error) {
    fail("seed row counts", String(error));
  } finally {
    await client.end().catch(() => {});
  }
}

export async function assertPointsEntryTargetConstraint() {
  const check =
    "the database rejects a Points Entry with both a Team and a Participant";
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query("begin");
    try {
      await client.query(
        `insert into points_entry (competition_id, team_id, participant_id, points, entered_by_email)
         select c.id, p.team_id, p.id, 1, 'smoke@jahnelgroup.com'
         from competition c
         join war_week w on w.id = c.war_week_id
         join participant p on p.war_week_id = w.id and p.team_id is not null
         where w.edition = 'xi'
         limit 1`,
      );
      fail(check, "insert succeeded");
    } catch (error) {
      const message = String(error);
      if (message.includes("points_entry_exactly_one_target")) {
        ok(check);
      } else {
        fail(check, message);
      }
    } finally {
      await client.query("rollback");
    }
  } catch (error) {
    fail(check, String(error));
  } finally {
    await client.end().catch(() => {});
  }
}

export async function assertUnknownEdition404() {
  const check = "GET /zz returns 404";
  try {
    const res = await signedInFetch(`${BASE_URL}/zz`);
    if (res.status === 404) {
      ok(check);
    } else {
      fail(check, `status=${res.status}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertRootRedirect() {
  const check = "signed-in GET / redirects to /xi";
  try {
    const res = await signedInFetch(`${BASE_URL}/`, { redirect: "manual" });
    const location = res.headers.get("location");
    if (res.status === 307 && location && location.endsWith("/xi")) {
      ok(check);
    } else {
      fail(check, `status=${res.status} location=${location}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertXiHome() {
  const check = "GET /xi renders War Week XI with the Team Standings";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi`);
    const body = await res.text();
    const standings = xiTeamsShown(body);
    if (res.status === 200 && body.includes("War Week XI") && standings) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} bodyIncludes=${body.includes("War Week XI")} standings=${standings}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

/**
 * The Display's pre-paint script is inline in `<head>`, before `<body>`, so
 * a stored Light or Dark applies before anything paints (no flash).
 */
export async function assertDisplayScriptInHead() {
  const check =
    "GET /xi carries the Display's inline script inside <head>, before <body>";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi`);
    const html = await res.text();
    const headOpen = html.indexOf("<head");
    const headClose = html.indexOf("</head>");
    const bodyOpen = html.indexOf("<body");
    const script = html.indexOf(`<script>${DISPLAY_SCRIPT}</script>`);
    if (
      res.status === 200 &&
      headOpen >= 0 &&
      script > headOpen &&
      script < headClose &&
      headClose < bodyOpen
    ) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} head=${headOpen} script=${script} headClose=${headClose} body=${bodyOpen}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

/** Whether a page shows both XI Teams in a Standings list, with totals. */
function xiTeamsShown(body: string): boolean {
  return (
    teamTotalIn(body, "Red") !== null && teamTotalIn(body, "Blue") !== null
  );
}

export async function assertLeaderboard() {
  const check =
    "GET /xi/leaderboard responds and shows the Team Standings for the demo seed";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/leaderboard`);
    const body = await res.text();
    const standings = xiTeamsShown(body);
    if (res.status === 200 && standings) {
      ok(check);
    } else {
      fail(check, `status=${res.status} standings=${standings}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertSchedule() {
  const check =
    "GET /xi/schedule groups by Day with Day Themes, ET times and Competition links";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/schedule`);
    const body = await res.text();
    const checks = {
      dayTheme: body.includes("Red vs. Blue"),
      anchor: body.includes('id="day-2026-02-23"'),
      etTime: body.includes("7:00 AM ET"),
      competitionLink: body.includes('href="/xi/competitions/'),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertHomeNowNext() {
  const check =
    "GET /xi?at=<Tue Feb 24 12:30 ET> shows today's Day Theme and now/next";
  try {
    const at = encodeURIComponent("2026-02-24T12:30:00-05:00");
    const res = await signedInFetch(`${BASE_URL}/xi?at=${at}`);
    const body = await res.text();
    const checks = {
      dayTheme: body.includes("Red vs. Blue"),
      onNow:
        body.includes("On now") &&
        body.includes("Electric City Matrix - Day 2"),
      upNext: body.includes("Up next"),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertPlacementPointsSeeded() {
  const check =
    "the XI seed loads 5/3/1 Placement Points for Catan and none for Beast Mode";
  try {
    const rows = await runQuery<{ name: string; placement_points: string }>(
      `select c.name, c.placement_points::text
       from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name in ('Settlers of Catan', 'Beast Mode Workout')`,
    );
    const byName = Object.fromEntries(
      rows.map((r) => [r.name, r.placement_points]),
    );
    if (
      byName["Settlers of Catan"] === "{5.00,3.00,1.00}" &&
      byName["Beast Mode Workout"] === null
    ) {
      ok(check);
    } else {
      fail(check, JSON.stringify(byName));
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertMoreLinks() {
  const check =
    "GET /xi/more links to Teams, Awards, FAQ, history, Install app and About";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/more`);
    const body = await res.text();
    const checks = {
      teams: body.includes('href="/xi/teams"'),
      awards: body.includes('href="/xi/awards"'),
      faq: body.includes('href="/xi/faq"'),
      history: body.includes('href="/history"'),
      install: body.includes('href="/install"'),
      about: body.includes('href="/about"'),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertInstallable() {
  const check =
    "PWA: manifest, icons and service worker load without a session, pages link them, and /install renders";
  try {
    const manifestRes = await fetch(`${BASE_URL}/manifest.webmanifest`);
    const manifest = manifestRes.ok
      ? ((await manifestRes.json()) as {
          display?: string;
          start_url?: string;
          icons?: { src: string; sizes: string; purpose?: string }[];
        })
      : {};
    const icons = manifest.icons ?? [];
    const iconPaths = [
      ...icons.map((icon) => icon.src),
      "/icons/apple-touch-icon.png",
      "/favicon.ico",
    ];
    const iconStatuses = await Promise.all(
      iconPaths.map(async (src) => (await fetch(`${BASE_URL}${src}`)).status),
    );
    const sw = await fetch(`${BASE_URL}/sw.js`);
    const home = await (await signedInFetch(`${BASE_URL}/xi`)).text();
    const install = await signedInFetch(`${BASE_URL}/install`);
    const installBody = await install.text();
    const checks = {
      manifest: manifestRes.status === 200,
      standalone: manifest.display === "standalone",
      startUrl: manifest.start_url === "/",
      sizes: ["192x192", "512x512"].every((size) =>
        icons.some((icon) => icon.sizes === size),
      ),
      maskable: icons.some((icon) => icon.purpose === "maskable"),
      icons: iconStatuses.every((status) => status === 200),
      serviceWorker: sw.status === 200,
      manifestLink: home.includes('rel="manifest"'),
      appleTouchIcon: home.includes('href="/icons/apple-touch-icon.png"'),
      favicon: home.includes('rel="icon" href="/favicon.ico'),
      install:
        install.status === 200 && installBody.includes("Install JG War Week"),
      installFooter: installBody.includes("Jahnel Group"),
    };
    if (Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, JSON.stringify(checks));
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertLlmsTxt() {
  const check =
    "GET /llms.txt returns 200 text/plain without a session and names every MCP tool";
  try {
    const res = await fetch(`${BASE_URL}/llms.txt`, { redirect: "manual" });
    const body = await res.text();
    const checks = {
      status: res.status === 200,
      contentType: (res.headers.get("content-type") ?? "").startsWith(
        "text/plain",
      ),
      title: body.startsWith("# JG War Week\n"),
      tools: Object.keys(MCP_TOOLS).every((name) =>
        body.includes(`\`${name}\``),
      ),
      endpoint: body.includes(`${BASE_URL}/api/mcp`),
    };
    if (Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertCompetitions() {
  const check =
    "GET /xi/competitions groups Competitions with max points and scoring";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/competitions`);
    const body = await res.text();
    const checks = {
      group: body.includes("Team Night Events"),
      ungrouped: body.includes("Other Competitions"),
      maxPoints: body.includes("Max 1.5 pts"),
      scoring: body.includes("Individual · counts toward Team"),
      link: body.includes('href="/xi/competitions/'),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertCompetitionDetail() {
  let id: string | undefined;
  try {
    const rows = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = 'Winning the Day Challenge'`,
    );
    id = rows[0]?.id;
  } catch (error) {
    fail("look up the Winning the Day Challenge id", String(error));
    return;
  }
  if (!id) {
    fail("look up the Winning the Day Challenge id", "not found");
    return;
  }

  const url = `${BASE_URL}/xi/competitions/${id}`;
  const note = "First to finish all 10 wellness tasks";

  const shownCheck =
    "GET /xi/competitions/[id] shows the Competition and lists its Points Entries (target, points, note)";
  try {
    const res = await signedInFetch(url);
    const body = await res.text();
    const checks = {
      name: body.includes("Winning the Day Challenge"),
      target: body.includes("Dani Milliken"),
      note: body.includes(note),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(shownCheck);
    } else {
      fail(shownCheck, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(shownCheck, String(error));
  }

  for (const bad of ["00000000-0000-4000-8000-000000000000", "not-a-uuid"]) {
    const check = `GET /xi/competitions/${bad} returns 404`;
    try {
      const res = await signedInFetch(`${BASE_URL}/xi/competitions/${bad}`);
      if (res.status === 404) {
        ok(check);
      } else {
        fail(check, `status=${res.status}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }
}

export async function assertTeams() {
  const check =
    "GET /xi/teams shows each Team with Leaders marked by Leader Title and Company Tags";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/teams`);
    const body = await res.text();
    const checks = {
      red: body.includes("Red"),
      blue: body.includes("Blue"),
      leaderTitle: body.includes(">Captain<"),
      leader: body.includes("Ashley Schuliger"),
      companyTag: body.includes(">LTI<"),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

export async function assertFreeForAllRoster() {
  const check =
    "GET /iv/teams shows one roster of all Participants for a free-for-all War Week";
  try {
    const res = await signedInFetch(`${BASE_URL}/iv/teams`);
    const body = await res.text();
    const checks = {
      heading: body.includes("Participants"),
      participant: body.includes("Ian Ballard"),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }
}

const SMOKE_YOU_EMAIL = "smoke-you@jahnelgroup.com";
const YOU_PARTICIPANT = "Anthony Conway";
const YOU_TAG = 'data-you="true"';

const countOf = (body: string, needle: string) => body.split(needle).length - 1;

/**
 * Account linking and the "You" highlight (ticket 20). Gives XI's
 * Anthony Conway (on the roster, the individual leaderboard and an Award)
 * the smoke user's email for the length of the check, then restores it.
 */
export async function assertYouHighlight(sessions: {
  notOrganizer: SmokeSession;
}) {
  const [{ email: originalEmail }] = await runQuery<{ email: string | null }>(
    `select p.email from participant p join war_week w on w.id = p.war_week_id
     where w.edition = 'xi' and p.display_name = $1`,
    [YOU_PARTICIPANT],
  );
  const setEmail = (email: string | null) =>
    runQuery(
      `update participant p set email = $1 from war_week w
       where w.id = p.war_week_id and w.edition = 'xi' and p.display_name = $2`,
      [email, YOU_PARTICIPANT],
    );

  const get = async (target: string, session: SmokeSession) => {
    const res = await fetch(`${BASE_URL}${target}`, {
      headers: { cookie: session.cookie },
    });
    return { status: res.status, body: await res.text() };
  };
  const report = (
    check: string,
    status: number,
    checks: Record<string, boolean>,
  ) => {
    if (status === 200 && Object.values(checks).every(Boolean)) ok(check);
    else fail(check, `status=${status} ${JSON.stringify(checks)}`);
  };

  try {
    await setEmail(SMOKE_YOU_EMAIL);
    const you = await createSmokeSession(SMOKE_YOU_EMAIL);

    const teams = await get("/xi/teams", you);
    report(
      "a signed-in user linked by email sees one 'You' on /xi/teams and no picker",
      teams.status,
      {
        oneTag: countOf(teams.body, YOU_TAG) === 1,
        rowStyled: teams.body.includes(YOU_ROW_CLASS),
        noPicker: !teams.body.includes("Which one is you?"),
      },
    );
    const leaderboard = await get("/xi/leaderboard", you);
    report(
      "a signed-in user linked by email sees one 'You' on the individual leaderboard",
      leaderboard.status,
      {
        oneTag: countOf(leaderboard.body, YOU_TAG) === 1,
        rowStyled: leaderboard.body.includes(YOU_ROW_CLASS),
        participant: leaderboard.body.includes(YOU_PARTICIPANT),
      },
    );
    const awards = await get("/xi/awards", you);
    report(
      "a signed-in user linked by email sees 'You' on their Award on /xi/awards",
      awards.status,
      {
        tag: countOf(awards.body, YOU_TAG) >= 1,
        rowStyled: awards.body.includes(YOU_ROW_CLASS),
      },
    );

    const unlinked = await get("/xi/teams", sessions.notOrganizer);
    report(
      "a signed-in user with no email match gets no 'You' and no picker",
      unlinked.status,
      {
        noPicker: !unlinked.body.includes("Which one is you?"),
        noTag: !unlinked.body.includes(YOU_TAG),
        noEmails: !unlinked.body.includes(SMOKE_YOU_EMAIL),
      },
    );
  } catch (error) {
    fail("'You' highlight", String(error));
  } finally {
    await setEmail(originalEmail).catch((error) =>
      fail(`restore ${YOU_PARTICIPANT}'s email`, String(error)),
    );
  }
}

export async function assertAboutPage() {
  const check =
    "anonymous GET /about is 200 with the Standings-hero stills, the Finale still, every feature card, the XI link and no sign-in redirect";
  try {
    const res = await fetch(`${BASE_URL}/about`, { redirect: "manual" });
    const body = await res.text();
    const checks = {
      noVideo: !/<video/i.test(body),
      standingsHero:
        body.includes('src="/about/standings-before.png"') &&
        body.includes('src="/about/standings-entry.png"') &&
        body.includes('src="/about/standings-after.png"'),
      finalePoster: body.includes('src="/about/finale-poster.png"'),
      cards:
        (body.match(/data-feature="/g) ?? []).length === ABOUT_FEATURES.length,
      xi: body.includes('href="/xi"'),
      noTooling: !/claude code|atlas/i.test(body),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  // /about is an exact match: the [edition] route would otherwise make
  // /about/leaderboard a public edition page.
  for (const pathname of ["/about/leaderboard", "/aboutx"]) {
    const privateCheck = `anonymous GET ${pathname} redirects to sign-in`;
    try {
      const res = await fetch(`${BASE_URL}${pathname}`, { redirect: "manual" });
      const location = res.headers.get("location") ?? "";
      if (res.status === 307 && location.includes("/sign-in")) {
        ok(privateCheck);
      } else {
        fail(privateCheck, `status=${res.status} location=${location}`);
      }
    } catch (error) {
      fail(privateCheck, String(error));
    }
  }
}

export async function assertPrivacyAndTermsPages() {
  for (const [pathname, title] of [
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
  ] as const) {
    const check = `anonymous GET ${pathname} is 200 with its "${title}" heading, "Last updated" and no sign-in redirect`;
    try {
      const res = await fetch(`${BASE_URL}${pathname}`, { redirect: "manual" });
      const body = await res.text();
      if (
        res.status === 200 &&
        body.includes(`>${title}</h1>`) &&
        body.includes("Last updated")
      ) {
        ok(check);
      } else {
        fail(check, `status=${res.status}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }

  // /privacy and /terms are exact matches: the [edition] route would
  // otherwise make /privacy/x or /terms/leaderboard public edition pages.
  for (const pathname of ["/privacy/x", "/termsx"]) {
    const privateCheck = `anonymous GET ${pathname} redirects to sign-in`;
    try {
      const res = await fetch(`${BASE_URL}${pathname}`, { redirect: "manual" });
      const location = res.headers.get("location") ?? "";
      if (res.status === 307 && location.includes("/sign-in")) {
        ok(privateCheck);
      } else {
        fail(privateCheck, `status=${res.status} location=${location}`);
      }
    } catch (error) {
      fail(privateCheck, String(error));
    }
  }
}

export async function assertSignInPage() {
  const check =
    "GET /sign-in renders without OAuth credentials and says Google isn't configured";
  try {
    const res = await fetch(`${BASE_URL}/sign-in?callbackURL=%2Fadmin`);
    const body = await res.text();
    const checks = {
      heading: body.includes("Sign in to JG War Week"),
      domain: body.includes("Use your @jahnelgroup.com Google account."),
      notConfigured: body.includes("configured on this server"),
      about: body.includes('href="/about"'),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  const sessionCheck = "GET /api/auth/get-session answers null with no session";
  try {
    const res = await fetch(`${BASE_URL}/api/auth/get-session`);
    const body = await res.text();
    if (res.status === 200 && body.trim() === "null") {
      ok(sessionCheck);
    } else {
      fail(sessionCheck, `status=${res.status} body=${body.slice(0, 200)}`);
    }
  } catch (error) {
    fail(sessionCheck, String(error));
  }
}

/**
 * The smoke server runs with no TEST_SIGN_IN_SECRET (and VERCEL_ENV
 * blank), as Production would: Test sign-in is off, so its page is not
 * found. better-auth's self-service `/update-user` is disabled everywhere.
 */
export async function assertTestSignInOffAndUpdateUserDisabled() {
  await runCheck(
    "GET /sign-in/test is 404 with no TEST_SIGN_IN_SECRET",
    async () => {
      const res = await fetch(`${BASE_URL}/sign-in/test`, {
        redirect: "manual",
      });
      return res.status === 404 ? null : `status=${res.status}`;
    },
  );
  await runCheck(
    "POST /api/auth/update-user is 404 for a signed-in user",
    async () => {
      const res = await signedInFetch(`${BASE_URL}/api/auth/update-user`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE_URL,
        },
        body: JSON.stringify({ image: "https://example.com/x.png" }),
      });
      return res.status === 404
        ? null
        : `status=${res.status} body=${(await res.text()).slice(0, 200)}`;
    },
  );
}

const FAQ_TABLE_OFF = "faq_item_smoke_off";

/** Puts `faq_item` back if an interrupted run left it renamed. */
export async function restoreFaqTable() {
  const [row] = await runQuery<{ off: string | null; on: string | null }>(
    `select to_regclass($1)::text as off, to_regclass('faq_item')::text as on`,
    [FAQ_TABLE_OFF],
  );
  if (row.off && !row.on) {
    await runQuery(`alter table ${FAQ_TABLE_OFF} rename to faq_item`);
  }
}

/**
 * Ticket 04 AC3: a real server error on an edition page shows the edition
 * error boundary, not Next's default error page. The only failing query on
 * /xi/faq is the FAQ Items one, so hiding that table forces the error with
 * no test-only code in the app. Runs last; the table is always put back.
 *
 * The page streams, so the response is already 200 when the error happens:
 * the server marks the page's Suspense boundary as errored (a
 * `<template data-dgst>`) and the browser renders the nearest error
 * boundary from the flight payload. So the check reads what the browser
 * would: the payload's error row, and the edition layout's error boundary
 * script, which must carry the ErrorScreen copy.
 */
export async function assertEditionErrorBoundary() {
  await runQuery(`alter table faq_item rename to ${FAQ_TABLE_OFF}`);
  const check =
    "GET /xi/faq with its table missing streams the edition error boundary (ErrorScreen copy), not Next's default error page";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/faq`);
    const body = await res.text();
    console.log(`  /xi/faq with faq_item missing answered ${res.status}`);
    // The edition layout's children router names its error boundary's
    // script; the root layout's global-error is sent separately ("G").
    const scripts = [
      ...body.matchAll(
        /\\"errorScripts\\":\[\[\\"\$\\",\\"script\\",\\"script-0\\",\{\\"src\\":\\"(\/_next\/static\/[^\\"]+)\\"/g,
      ),
    ].map((m) => m[1]);
    let boundaryCopy = false;
    for (const src of scripts) {
      const script = await (await fetch(`${BASE_URL}${src}`)).text();
      if (
        script.includes("Something went wrong") &&
        script.includes("This page ran into a problem.") &&
        script.includes("Go to the current War Week")
      ) {
        boundaryCopy = true;
      }
    }
    const result = {
      status: res.status,
      erroredBoundary: /<template data-dgst="[^"]+"><\/template>/.test(body),
      errorRow: /\d+:E\{\\"digest\\":/.test(body),
      nav: body.includes("War Week XI"),
      scripts,
      boundaryCopy,
      nextDefault:
        body.includes("Application error") ||
        body.includes("Internal Server Error"),
    };
    if (
      result.erroredBoundary &&
      result.errorRow &&
      result.nav &&
      result.boundaryCopy &&
      !result.nextDefault
    ) {
      ok(check);
    } else {
      fail(check, JSON.stringify(result));
    }
  } catch (error) {
    fail(check, String(error));
  } finally {
    await restoreFaqTable();
  }
}
