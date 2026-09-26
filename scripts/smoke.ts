import { TZDate } from "@date-fns/tz";
import { loadEnvConfig } from "@next/env";
import { makeSignature } from "better-auth/crypto";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { ABOUT_FEATURES } from "@/lib/about";
import { WAR_WEEK_TIME_ZONE } from "@/lib/schedule";
import { YOU_ROW_CLASS } from "@/lib/you";
import { MCP_TOOLS } from "@/mcp/tools";

loadEnvConfig(process.cwd());

// SMOKE_PORT lets parallel worktrees run smoke side by side.
const PORT = Number(process.env.SMOKE_PORT ?? 3100);
const BASE_URL = `http://localhost:${PORT}`;
const READY_TIMEOUT_MS = 30_000;

// The smoke never uses real OAuth credentials: it proves the app runs
// without them and signs its own session cookies with this secret.
const AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || `smoke-only-secret-${randomUUID()}`;
const SESSION_COOKIE = "better-auth.session_token";
// A smoke-only MCP bearer token; MCP_PUBLIC stays off so anonymous gets 401.
const MCP_TOKEN = `smoke-mcp-token-${randomUUID()}`;

const childEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DRIVER: process.env.DATABASE_DRIVER,
  BETTER_AUTH_SECRET: AUTH_SECRET,
  BETTER_AUTH_URL: BASE_URL,
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  MCP_TOKEN,
  MCP_PUBLIC: "",
};

let failures = 0;

// Every page needs a sign-in, so page checks run as a signed-in JG user
// (a smoke session, set in main before the server starts).
let viewerCookie = "";

function signedInFetch(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { cookie: viewerCookie, ...init.headers },
  });
}

function ok(check: string) {
  console.log(`ok - ${check}`);
}

function fail(check: string, detail: string) {
  failures += 1;
  console.log(`FAIL - ${check}: ${detail}`);
}

function runStep(command: string, args: string[], label: string) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: childEnv,
  });
  if (result.status !== 0) {
    fail(label, `exited with status ${result.status}`);
    return false;
  }
  ok(label);
  return true;
}

async function waitForReady(): Promise<boolean> {
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/sign-in`);
      if (res.status === 200) return true;
    } catch {
      // server not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

async function portInUse(baseUrl: string): Promise<boolean> {
  try {
    await fetch(`${baseUrl}/`, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

/** Rows each table should hold for War Week XI after loading its seed. */
function expectedXiCounts(): Record<string, number> {
  const seed = JSON.parse(
    readFileSync(path.resolve(process.cwd(), "seeds/xi.json"), "utf-8"),
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

async function assertSeedLoadedOnce() {
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

async function assertPointsEntryTargetConstraint() {
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

async function assertUnknownEdition404() {
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

async function assertRootRedirect() {
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

async function assertXiHome() {
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

/** Whether a page shows both XI Teams in a Standings list, with totals. */
function xiTeamsShown(body: string): boolean {
  return (
    teamTotalIn(body, "Red") !== null && teamTotalIn(body, "Blue") !== null
  );
}

async function assertLeaderboard() {
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

async function assertSchedule() {
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

async function assertHomeNowNext() {
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

async function runQuery<T extends Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    const { rows } = await client.query<T>(sql, params);
    return rows;
  } finally {
    await client.end().catch(() => {});
  }
}

async function assertPlacementPointsSeeded() {
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

async function assertMoreLinks() {
  const check =
    "GET /xi/more links to Competitions, Teams, Awards, FAQ, history, Install app and About";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/more`);
    const body = await res.text();
    const checks = {
      competitions: body.includes('href="/xi/competitions"'),
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

async function assertInstallable() {
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

async function assertLlmsTxt() {
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

async function assertHistory() {
  const check =
    "GET /history lists every complete War Week, newest first, each in its own theme";
  try {
    const res = await signedInFetch(`${BASE_URL}/history`);
    const body = await res.text();
    const complete = await runQuery<{ edition: string; primary: string }>(
      `select edition, primary_color as primary from war_week
         where status = 'complete' order by year desc`,
    );
    const positions = complete.map((w) => body.indexOf(`href="/${w.edition}"`));
    const checks = {
      allListed: positions.every((p) => p >= 0),
      newestFirst: positions.every((p, i) => i === 0 || p > positions[i - 1]),
      ownThemes: complete.every((w) => body.includes(`--primary:${w.primary}`)),
      excludesLive: !body.includes("The Matrix"),
    };
    if (
      res.status === 200 &&
      complete.length === 10 &&
      Object.values(checks).every(Boolean)
    ) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} complete=${complete.length} ${JSON.stringify(checks)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

async function assertArchiveDetail() {
  const check =
    "GET /viii renders 2023 in its Harry Potter theme with stored winner, Houses, Awards, highlights and wiki link";
  try {
    const res = await signedInFetch(`${BASE_URL}/viii`);
    const body = await res.text();
    const checks = {
      theme: body.includes("--primary:#740001"),
      storyTheme: body.includes("Harry Potter: The Houses of Hogwarts"),
      winner: body.includes("Winner") && body.includes("Slytherin"),
      houses: ["Gryffindor", "Hufflepuff", "Ravenclaw"].every((h) =>
        body.includes(h),
      ),
      awards: body.includes("House Cup"),
      highlights: body.includes("Highlights"),
      wiki: body.includes(
        'href="https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/war-week-2023"',
      ),
      noSlack: !body.includes("Join the Slack channel"),
    };
    if (res.status === 200 && Object.values(checks).every(Boolean)) {
      ok(check);
    } else {
      fail(check, `status=${res.status} ${JSON.stringify(checks)}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  const linkOnlyCheck =
    "GET /i, /ii, /iii render as link-only cards with the wiki link";
  try {
    const results = await Promise.all(
      [
        ["i", 2016],
        ["ii", 2017],
        ["iii", 2018],
      ].map(async ([edition, year]) => {
        const res = await signedInFetch(`${BASE_URL}/${edition}`);
        const body = await res.text();
        return {
          edition,
          status: res.status,
          linkOnly: body.includes("lives on") && !body.includes("Awards</h2>"),
          wiki: body.includes(
            `href="https://sites.google.com/jahnelgroup.com/jahnel-group-wiki/war-week-${year}"`,
          ),
        };
      }),
    );
    if (results.every((r) => r.status === 200 && r.linkOnly && r.wiki)) {
      ok(linkOnlyCheck);
    } else {
      fail(linkOnlyCheck, JSON.stringify(results));
    }
  } catch (error) {
    fail(linkOnlyCheck, String(error));
  }
}

async function assertCompetitions() {
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

async function assertCompetitionDetail() {
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

async function assertTeams() {
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

async function assertFreeForAllRoster() {
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

type SmokeSession = { cookie: string };

const SMOKE_YOU_EMAIL = "smoke-you@jahnelgroup.com";
const YOU_PARTICIPANT = "Anthony Conway";
const YOU_TAG = 'data-you="true"';

const countOf = (body: string, needle: string) => body.split(needle).length - 1;

/**
 * Account linking and the "You" highlight (ticket 20). Gives XI's
 * Anthony Conway (on the roster, the individual leaderboard and an Award)
 * the smoke user's email for the length of the check, then restores it.
 */
async function assertYouHighlight(sessions: { notOrganizer: SmokeSession }) {
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
      "a signed-in user with no email match gets the 'Which one is you?' picker and no 'You'",
      unlinked.status,
      {
        picker: unlinked.body.includes("Which one is you?"),
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

// Smoke users never share an email with a real person, so cleanup can't
// touch a real account.
const SMOKE_EMAIL_PATTERN = "smoke-%@jahnelgroup.com";
const SMOKE_EMAIL_PATTERN_OUTSIDER = "smoke-%@example.com";
const SMOKE_ORGANIZER_EMAIL = "smoke-organizer@jahnelgroup.com";

/**
 * Inserts a user and a session straight into the database and returns the
 * session cookie better-auth would have set after a Google sign-in.
 */
async function createSmokeSession(email: string): Promise<SmokeSession> {
  const userId = `smoke-${randomUUID()}`;
  const token = `smoke-${randomUUID()}`;
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  try {
    await client.connect();
    await client.query(
      `insert into "user" (id, name, email, email_verified) values ($1, 'Smoke', $2, true)`,
      [userId, email],
    );
    await client.query(
      `insert into session (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 day')`,
      [`smoke-${randomUUID()}`, token, userId],
    );
  } finally {
    await client.end().catch(() => {});
  }
  const signed = `${token}.${await makeSignature(token, AUTH_SECRET)}`;
  return { cookie: `${SESSION_COOKIE}=${encodeURIComponent(signed)}` };
}

/** Deletes every smoke user (and, by cascade, their sessions). */
async function deleteSmokeUsers() {
  await runQuery(`delete from "user" where email like $1 or email like $2`, [
    SMOKE_EMAIL_PATTERN,
    SMOKE_EMAIL_PATTERN_OUTSIDER,
  ]);
}

/** Adds or removes the smoke Organizer on War Week XI's allowlist. */
async function setSmokeOrganizer(on: boolean) {
  await runQuery(
    on
      ? `update war_week set organizer_emails = array_append(organizer_emails, $1) where edition = 'xi' and not ($1 = any(organizer_emails))`
      : `update war_week set organizer_emails = array_remove(organizer_emails, $1) where edition = 'xi'`,
    [SMOKE_ORGANIZER_EMAIL],
  );
}

async function assertAboutPage() {
  const check =
    "anonymous GET /about is 200 with the Finale video, every feature card, the XI link and no sign-in redirect";
  try {
    const res = await fetch(`${BASE_URL}/about`, { redirect: "manual" });
    const body = await res.text();
    const checks = {
      video: body.includes('src="/about/finale.mp4"'),
      poster: body.includes('poster="/about/finale-poster.png"'),
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

async function assertPrivacyAndTermsPages() {
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

async function assertSignInPage() {
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

async function assertAdminGate(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
  outsider: SmokeSession;
}) {
  const anonymousCheck = "anonymous GET /admin redirects to sign-in";
  try {
    const res = await fetch(`${BASE_URL}/admin`, { redirect: "manual" });
    const location = res.headers.get("location") ?? "";
    if (
      res.status === 307 &&
      location.includes("/sign-in?callbackURL=%2Fadmin")
    ) {
      ok(anonymousCheck);
    } else {
      fail(anonymousCheck, `status=${res.status} location=${location}`);
    }
  } catch (error) {
    fail(anonymousCheck, String(error));
  }

  type AdminResult = { status: number; body: string; location: string };
  const shows = {
    "the admin shell": ({ status, body }: AdminResult) =>
      status === 200 &&
      body.includes("Organizer overview") &&
      body.includes("Admin sections"),
    "the refusal": ({ status, body }: AdminResult) =>
      status === 200 &&
      body.includes("Organizers only") &&
      !body.includes("Admin sections"),
    "sign-in": ({ status, location }: AdminResult) =>
      status === 307 && location.includes("/sign-in"),
  };

  for (const [label, session, expected] of [
    ["an allowlisted Organizer", sessions.organizer, "the admin shell"],
    [
      "a signed-in JG user off the allowlist",
      sessions.notOrganizer,
      "the refusal",
    ],
    ["a session with a non-JG email", sessions.outsider, "sign-in"],
  ] as const) {
    const check = `GET /admin as ${label} shows ${expected}`;
    try {
      const res = await fetch(`${BASE_URL}/admin`, {
        headers: { cookie: session.cookie },
        redirect: "manual",
      });
      const result = {
        status: res.status,
        body: await res.text(),
        location: res.headers.get("location") ?? "",
      };
      if (shows[expected](result)) {
        ok(check);
      } else {
        fail(check, `status=${result.status} location=${result.location}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }
}

async function assertAdminWording(sessions: { organizer: SmokeSession }) {
  for (const route of ["/admin", "/admin/standings", "/admin/points"]) {
    const check = `GET ${route} as an Organizer says 'Back to War Week XI' and never 'public site'`;
    try {
      const res = await fetch(`${BASE_URL}${route}`, {
        headers: { cookie: sessions.organizer.cookie },
      });
      const body = await res.text();
      const checks = {
        // React SSR can split "Back to War Week " and "XI" with a hydration
        // comment marker, so tolerate one between them.
        backLink: /Back to War Week\s*(?:<!--\s*-->)?\s*XI/.test(body),
        noPublicSite: !body.includes("public site"),
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
}

// Points Entries the smoke creates carry this note prefix so cleanup can
// find them (and never touch an Organizer's own entries).
const SMOKE_NOTE_PREFIX = "smoke-points-";

// Announcements the smoke creates carry this title prefix so cleanup can
// find them (and never touch a seeded Announcement).
const SMOKE_ANNOUNCEMENT_PREFIX = "smoke-announcement-";

type ActionResult = { ok: true } | { ok: false; error: string };

/** The build's server action ids, by exported name. */
function serverActionIds(): Record<string, string> {
  const manifest = JSON.parse(
    readFileSync(
      path.resolve(
        process.cwd(),
        ".next/server/server-reference-manifest.json",
      ),
      "utf-8",
    ),
  ) as { node: Record<string, { exportedName?: string }> };
  return Object.fromEntries(
    Object.entries(manifest.node).flatMap(([id, action]) =>
      action.exportedName ? [[action.exportedName, id]] : [],
    ),
  );
}

/**
 * Calls a server action the way the browser does: a POST with the action id
 * and the arguments as React's JSON reply, answered with an RSC payload that
 * carries the action's return value.
 */
async function callAction(
  actionId: string,
  args: unknown[],
  session: SmokeSession,
): Promise<ActionResult> {
  const res = await fetch(`${BASE_URL}/admin/points`, {
    method: "POST",
    headers: {
      "next-action": actionId,
      "content-type": "text/plain;charset=UTF-8",
      accept: "text/x-component",
      origin: BASE_URL,
      cookie: session.cookie,
    },
    body: JSON.stringify(args),
  });
  const body = await res.text();
  const line = body.split("\n").find((l) => /^\d+:\{"ok":/.test(l));
  if (res.status !== 200 || !line) {
    throw new Error(`status=${res.status} body=${body.slice(0, 300)}`);
  }
  return JSON.parse(line.slice(line.indexOf(":") + 1)) as ActionResult;
}

/**
 * Whether a client component on the page was given `name` as a prop: the
 * shadcn comboboxes and selects render their options only when opened, so
 * the options reach the HTML as the page's serialized props instead.
 */
function hasNameProp(body: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\\\?"(?:name|label)\\\\?":\\\\?"${escaped}\\\\?"`).test(
    body,
  );
}

function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** A Team's total on the public leaderboard page, or null when not shown. */
async function leaderboardTeamTotal(teamName: string): Promise<number | null> {
  const res = await signedInFetch(`${BASE_URL}/xi/leaderboard`);
  return teamTotalIn(await res.text(), teamName);
}

/** A Team's total in a page's Team Standings list, or null when not shown. */
function teamTotalIn(body: string, teamName: string): number | null {
  const match = body.match(
    new RegExp(
      `font-semibold">${escapeHtml(teamName)}</span><span class="[^"]*">([-\\d.,]+)</span>`,
    ),
  );
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

async function smokeEntries() {
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

async function deleteSmokeEntries() {
  await runQuery(`delete from points_entry where note like $1`, [
    `${SMOKE_NOTE_PREFIX}%`,
  ]);
}

async function smokeAnnouncements() {
  return runQuery<{
    id: string;
    title: string;
    author_email: string;
    published_at: string;
    pinned: boolean;
    body: string;
  }>(
    `select id, title, author_email, published_at, pinned, body::text as body
     from announcement where title like $1 order by published_at desc`,
    [`${SMOKE_ANNOUNCEMENT_PREFIX}%`],
  );
}

async function deleteSmokeAnnouncements() {
  await runQuery(`delete from announcement where title like $1`, [
    `${SMOKE_ANNOUNCEMENT_PREFIX}%`,
  ]);
}

async function assertAdminPointsPage(sessions: {
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
      body.includes("Organizers only") &&
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

async function assertPointsEntryActions(sessions: {
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
  const [teamCompetition] = await runQuery<{ id: string; max: string }>(
    `select c.id, c.max_points as max from competition c join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.scoring = 'team' and c.max_points is not null order by c.name limit 1`,
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
  const overMax = Number(teamCompetition.max) + 7;
  const teamInput = {
    competitionId: teamCompetition.id,
    targetId: target.team_id,
    points: String(overMax),
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
          /not an Organizer/.test(result.error) &&
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
      "createPointsEntry as an Organizer saves an over-max decimal entry with entered-by",
      async () => {
        const result = await callAction(
          ids.createPointsEntry,
          [{ ...teamInput, points: `${overMax}.25` }],
          sessions.organizer,
        );
        const rows = await smokeEntries();
        return result.ok &&
          rows.length === 1 &&
          Number(rows[0].points) === overMax + 0.25 &&
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
          Math.abs(after - before - (overMax + 0.25)) < 0.001
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
          Number(row.points) === overMax + 0.25
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

/** Calls MCP `get_leaderboard` and returns its raw text and parsed payload. */
async function mcpLeaderboard(kind: "team" | "individual") {
  const init = await mcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.1.0" },
    },
  });
  const call = await mcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_leaderboard", arguments: { kind } },
    },
    init.sessionId,
  );
  const text =
    (
      call.json?.result as
        { content?: { type: string; text: string }[] } | undefined
    )?.content?.[0]?.text ?? "";
  return { text, parsed: text ? JSON.parse(text) : undefined };
}

/**
 * The Finale (brackets ticket 1): `/xi/finale` opens on Start for any
 * signed-in user, `/admin/standings` is the Organizer's way in, and MCP
 * `get_leaderboard` always returns Standings.
 */
async function assertFinale(sessions: {
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
  const page = async (target: string, session: SmokeSession) => {
    const res = await fetch(`${BASE_URL}${target}`, {
      headers: { cookie: session.cookie },
    });
    return { status: res.status, body: await res.text() };
  };

  await run(
    "GET /xi/finale as a signed-in user shows the Start button",
    async () => {
      const { status, body } = await page("/xi/finale", sessions.notOrganizer);
      const checks = {
        status: status === 200,
        start: /<button[^>]*>Start<\/button>/.test(body),
        ready: body.includes('data-finale="ready"'),
        heading: body.includes("Finale"),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  await run(
    "GET /admin/standings shows the Finale page with Open Finale to an Organizer and the refusal to a non-Organizer",
    async () => {
      const organizer = await page("/admin/standings", sessions.organizer);
      const notOrganizer = await page(
        "/admin/standings",
        sessions.notOrganizer,
      );
      const checks = {
        heading: /<h1[^>]*>Finale<\/h1>/.test(organizer.body),
        open:
          organizer.body.includes("Open Finale") &&
          organizer.body.includes('href="/xi/finale"'),
        refused:
          notOrganizer.body.includes("Organizers only") &&
          !notOrganizer.body.includes("Open Finale"),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  await run(
    "MCP get_leaderboard(team) returns the same Team totals as /xi/leaderboard",
    async () => {
      const mcp = await mcpLeaderboard("team");
      const rows: { name: string; total: number }[] =
        mcp.parsed?.standings ?? [];
      const shown = await Promise.all(
        rows.map((row) => leaderboardTeamTotal(row.name)),
      );
      const checks = {
        rows: rows.length > 0,
        noHiddenKey: mcp.parsed !== undefined && !("hidden" in mcp.parsed),
        same: rows.every((row, i) => shown[i] === row.total),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : `${JSON.stringify(checks)} text=${mcp.text}`;
    },
  );
}

/** AC1: pinned first, then newest first; AC2: an allow-listed embed. */
async function assertAnnouncementFeed() {
  const check =
    "GET /xi/news orders the pinned welcome first, then Wellness Wednesday, then Tournament Night recap";
  let body = "";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi/news`);
    body = await res.text();
    const positions = {
      welcome: body.indexOf("Welcome to War Week XI"),
      wellness: body.indexOf("Wellness Wednesday is here"),
      recap: body.indexOf("Tournament Night recap"),
    };
    const ordered =
      positions.welcome >= 0 &&
      positions.wellness > positions.welcome &&
      positions.recap > positions.wellness;
    if (res.status === 200 && ordered) {
      ok(check);
    } else {
      fail(
        check,
        `status=${res.status} positions=${JSON.stringify(positions)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
    return;
  }

  const embedCheck =
    "GET /xi/news embeds the welcome Announcement's video as a YouTube iframe";
  if (
    /<iframe[^>]*src="https:\/\/www\.youtube-nocookie\.com\/embed\/vKQi3bBA1y8"/.test(
      body,
    )
  ) {
    ok(embedCheck);
  } else {
    fail(embedCheck, "no matching iframe src found");
  }
}

/** AC3: the pinned Announcement shows on the edition home. */
async function assertAnnouncementHomePinned() {
  const check = "GET /xi shows a Pinned section with the welcome Announcement";
  try {
    const res = await signedInFetch(`${BASE_URL}/xi`);
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes(">Pinned<") &&
      body.includes("Welcome to War Week XI")
    ) {
      ok(check);
    } else {
      fail(check, `status=${res.status}`);
    }
  } catch (error) {
    fail(check, String(error));
  }

  const badgeCheck = "GET /xi/news and /xi both show the Pinned badge";
  const pinnedBadge = /<span[^>]*>Pinned<\/span>/;
  try {
    const news = await (await signedInFetch(`${BASE_URL}/xi/news`)).text();
    const home = await (await signedInFetch(`${BASE_URL}/xi`)).text();
    if (pinnedBadge.test(news) && pinnedBadge.test(home)) {
      ok(badgeCheck);
    } else {
      fail(badgeCheck, "Pinned badge markup missing on one of the pages");
    }
  } catch (error) {
    fail(badgeCheck, String(error));
  }
}

/** AC4: Organizer-only create/edit/pin/unpin/delete, recording author/published-at. */
async function assertAnnouncementActions(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const ids = serverActionIds();
  const actions = [
    "createAnnouncement",
    "updateAnnouncement",
    "deleteAnnouncement",
    "pinAnnouncement",
    "unpinAnnouncement",
  ];
  const missing = actions.filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("server action ids in the build manifest", missing.join(", "));
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

  const validBody = {
    type: "doc",
    content: [
      { type: "paragraph", content: [{ type: "text", text: "smoke body" }] },
    ],
  };
  const editedTitle = `${SMOKE_ANNOUNCEMENT_PREFIX}edited`;

  try {
    await deleteSmokeAnnouncements();

    await run(
      "createAnnouncement rejects a signed-in JG user off the allowlist",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}refused`,
              body: validBody,
              videoUrls: [],
              pinned: false,
            },
          ],
          sessions.notOrganizer,
        );
        const rows = await smokeAnnouncements();
        return !result.ok &&
          /not an Organizer/.test(result.error) &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createAnnouncement rejects a disallowed video URL (AC2)",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}bad-video`,
              body: validBody,
              videoUrls: ["https://evil.example.com/watch?v=1"],
              pinned: false,
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        return !result.ok &&
          /YouTube, Loom, Vimeo or Google Drive/.test(result.error) &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run(
      "createAnnouncement as an Organizer saves a valid Announcement with author-email and a recent published-at",
      async () => {
        const result = await callAction(
          ids.createAnnouncement,
          [
            {
              title: `${SMOKE_ANNOUNCEMENT_PREFIX}created`,
              body: validBody,
              videoUrls: ["https://youtu.be/dQw4w9WgXcQ"],
              pinned: false,
            },
          ],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        const row = rows[0];
        const publishedRecent =
          row != null &&
          Date.now() - new Date(row.published_at).getTime() < 60_000;
        return result.ok &&
          rows.length === 1 &&
          row.author_email === SMOKE_ORGANIZER_EMAIL &&
          publishedRecent
          ? null
          : `result=${JSON.stringify(result)} rows=${JSON.stringify(rows)}`;
      },
    );

    const [created] = await smokeAnnouncements();

    if (!created) {
      fail(
        "look up the just-created smoke Announcement",
        "smokeAnnouncements() returned no rows",
      );
    } else {
      await run(
        "updateAnnouncement, pinAnnouncement, unpinAnnouncement and deleteAnnouncement each reject a non-Organizer and leave the row unchanged",
        async () => {
          const update = await callAction(
            ids.updateAnnouncement,
            [
              created.id,
              {
                title: "should-not-apply",
                body: validBody,
                videoUrls: [],
                pinned: true,
              },
            ],
            sessions.notOrganizer,
          );
          const pin = await callAction(
            ids.pinAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const unpin = await callAction(
            ids.unpinAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const remove = await callAction(
            ids.deleteAnnouncement,
            [created.id],
            sessions.notOrganizer,
          );
          const [row] = await smokeAnnouncements();
          const refused = [update, pin, unpin, remove].every(
            (result) => !result.ok && /not an Organizer/.test(result.error),
          );
          const unchanged =
            row != null &&
            row.title === created.title &&
            row.pinned === created.pinned;
          return refused && unchanged
            ? null
            : `update=${JSON.stringify(update)} pin=${JSON.stringify(pin)} unpin=${JSON.stringify(unpin)} delete=${JSON.stringify(remove)} row=${JSON.stringify(row)}`;
        },
      );

      await run(
        "updateAnnouncement changes the title and keeps author-email and published-at",
        async () => {
          const result = await callAction(
            ids.updateAnnouncement,
            [
              created.id,
              {
                title: editedTitle,
                body: validBody,
                videoUrls: ["https://youtu.be/dQw4w9WgXcQ"],
                pinned: false,
              },
            ],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          return result.ok &&
            row?.title === editedTitle &&
            row.author_email === created.author_email &&
            new Date(row.published_at).getTime() ===
              new Date(created.published_at).getTime()
            ? null
            : `result=${JSON.stringify(result)} row=${JSON.stringify(row)}`;
        },
      );

      await run(
        "pinAnnouncement pins it, and it now sorts first on /xi/news",
        async () => {
          const result = await callAction(
            ids.pinAnnouncement,
            [created.id],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          const body = await (
            await signedInFetch(`${BASE_URL}/xi/news`)
          ).text();
          const welcomePos = body.indexOf("Welcome to War Week XI");
          const editedPos = body.indexOf(editedTitle);
          return result.ok &&
            row?.pinned === true &&
            editedPos >= 0 &&
            editedPos < welcomePos
            ? null
            : `result=${JSON.stringify(result)} pinned=${row?.pinned} welcomePos=${welcomePos} editedPos=${editedPos}`;
        },
      );

      await run(
        "unpinAnnouncement unpins it, and the welcome Announcement sorts first again",
        async () => {
          const result = await callAction(
            ids.unpinAnnouncement,
            [created.id],
            sessions.organizer,
          );
          const [row] = await smokeAnnouncements();
          const body = await (
            await signedInFetch(`${BASE_URL}/xi/news`)
          ).text();
          const welcomePos = body.indexOf("Welcome to War Week XI");
          const editedPos = body.indexOf(editedTitle);
          return result.ok &&
            row?.pinned === false &&
            welcomePos >= 0 &&
            welcomePos < editedPos
            ? null
            : `result=${JSON.stringify(result)} pinned=${row?.pinned} welcomePos=${welcomePos} editedPos=${editedPos}`;
        },
      );

      await run("deleteAnnouncement as an Organizer removes it", async () => {
        const result = await callAction(
          ids.deleteAnnouncement,
          [created.id],
          sessions.organizer,
        );
        const rows = await smokeAnnouncements();
        return result.ok && rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      });
    }

    await run(
      "deleteAnnouncement of an id that no longer exists says so",
      async () => {
        const result = await callAction(
          ids.deleteAnnouncement,
          ["00000000-0000-4000-8000-000000000000"],
          sessions.organizer,
        );
        return !result.ok && /no longer exists/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );
  } finally {
    await deleteSmokeAnnouncements().catch((error) =>
      fail("delete smoke Announcements", String(error)),
    );
  }
}

/** AC5: unsafe content is stripped on write, not just rejected outright. */
async function assertAnnouncementUnsafeContentStripped(sessions: {
  organizer: SmokeSession;
}) {
  const ids = serverActionIds();
  if (!ids.createAnnouncement) {
    fail(
      "server action id createAnnouncement in the build manifest",
      "missing",
    );
    return;
  }

  const check =
    "createAnnouncement strips a javascript: link, a data: image and an unrecognized iframe block on write";
  const unsafeBody = {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [
          {
            type: "text",
            text: "click",
            marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }],
          },
        ],
      },
      { type: "image", attrs: { src: "data:image/png;base64,AAAA", alt: "" } },
      { type: "iframe", attrs: { src: "https://evil.example.com" } },
    ],
  };

  try {
    await deleteSmokeAnnouncements();
    const result = await callAction(
      ids.createAnnouncement,
      [
        {
          title: `${SMOKE_ANNOUNCEMENT_PREFIX}unsafe`,
          body: unsafeBody,
          videoUrls: [],
          pinned: false,
        },
      ],
      sessions.organizer,
    );
    const rows = await smokeAnnouncements();
    const storedBody = rows[0]?.body ?? "";
    const clean =
      !storedBody.includes("javascript:") &&
      !storedBody.includes("data:image") &&
      !storedBody.includes('"iframe"');
    if (!result.ok || rows.length !== 1 || !clean) {
      fail(check, `result=${JSON.stringify(result)} body=${storedBody}`);
      return;
    }

    const feed = await (await signedInFetch(`${BASE_URL}/xi/news`)).text();
    if (feed.includes("javascript:")) {
      fail(check, "rendered /xi/news still contains javascript:");
      return;
    }
    ok(check);
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeAnnouncements().catch((error) =>
      fail("delete smoke Announcements", String(error)),
    );
  }
}

/** /admin/announcements, its New form and the edit form for a seeded row. */
async function assertAnnouncementAdminPages(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const listCheck =
    "GET /admin/announcements as an Organizer lists the seeded titles and New Announcement, and refuses a non-Organizer";
  try {
    const organizerRes = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const organizerBody = await organizerRes.text();
    const titles = [
      "Welcome to War Week XI",
      "Tournament Night recap",
      "Wellness Wednesday is here",
    ];
    const hasAllTitles = titles.every((title) => organizerBody.includes(title));
    const notOrganizerRes = await fetch(`${BASE_URL}/admin/announcements`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const notOrganizerBody = await notOrganizerRes.text();
    if (
      organizerRes.status === 200 &&
      hasAllTitles &&
      organizerBody.includes("New Announcement") &&
      notOrganizerRes.status === 200 &&
      notOrganizerBody.includes("Organizers only")
    ) {
      ok(listCheck);
    } else {
      fail(
        listCheck,
        `organizerStatus=${organizerRes.status} hasAllTitles=${hasAllTitles} notOrganizerStatus=${notOrganizerRes.status}`,
      );
    }
  } catch (error) {
    fail(listCheck, String(error));
  }

  const newCheck =
    "GET /admin/announcements/new as an Organizer shows the Announcement form";
  try {
    const res = await fetch(`${BASE_URL}/admin/announcements/new`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes('aria-label="Announcement"')) {
      ok(newCheck);
    } else {
      fail(newCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(newCheck, String(error));
  }

  const editCheck =
    "GET /admin/announcements/[id] as an Organizer shows Edit Announcement for the seeded welcome Announcement";
  try {
    const [welcome] = await runQuery<{ id: string }>(
      `select a.id from announcement a join war_week w on w.id = a.war_week_id
       where w.edition = 'xi' and a.title = 'Welcome to War Week XI'`,
    );
    const res = await fetch(`${BASE_URL}/admin/announcements/${welcome.id}`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes("Edit Announcement")) {
      ok(editCheck);
    } else {
      fail(editCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(editCheck, String(error));
  }
}

// Awards the smoke creates carry this name prefix so cleanup can find them
// (and never touch a seeded Award).
const SMOKE_AWARD_PREFIX = "smoke-award-";

const XI_AWARDS = [
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

const XI_FAQ_QUESTIONS = [
  "I have some great pics and videos. Where do I put them?",
  "How do I record War Week time in Tense?",
  "When are the hours cutoffs this year?",
  "What are the awards at this year's War Week?",
  "Are we allowed to have personal guests at War Week?",
  "What about client or prospect guests?",
];

/** AC1: /xi/awards lists each seeded Award with its recipients. */
async function assertAwardsPage() {
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
async function assertFaqPage() {
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

async function smokeAwards() {
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

async function deleteSmokeAwards() {
  await runQuery(`delete from award where name like $1`, [
    `${SMOKE_AWARD_PREFIX}%`,
  ]);
}

/** AC2: Organizer-only create, edit and delete with Participant and/or Team recipients. */
async function assertAwardActions(sessions: {
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
          /not an Organizer/.test(result.error) &&
          rows.length === 0
          ? null
          : `result=${JSON.stringify(result)} rows=${rows.length}`;
      },
    );

    await run("createAward refuses an Award with no recipients", async () => {
      const result = await callAction(
        ids.createAward,
        [
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
            /not an Organizer/.test(result.error) &&
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

/** /admin/awards, its New form and the edit form for a seeded Award. */
async function assertAwardAdminPages(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const listCheck =
    "GET /admin/awards as an Organizer lists the seeded Awards and New Award, and refuses a non-Organizer";
  try {
    const organizerRes = await fetch(`${BASE_URL}/admin/awards`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const organizerBody = await organizerRes.text();
    const hasAll = XI_AWARDS.every((a) => organizerBody.includes(a.name));
    const notOrganizerRes = await fetch(`${BASE_URL}/admin/awards`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const notOrganizerBody = await notOrganizerRes.text();
    if (
      organizerRes.status === 200 &&
      hasAll &&
      organizerBody.includes("New Award") &&
      notOrganizerRes.status === 200 &&
      notOrganizerBody.includes("Organizers only")
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

  const newCheck =
    "GET /admin/awards/new as an Organizer shows the Award form with XI's Teams and Participants";
  try {
    const res = await fetch(`${BASE_URL}/admin/awards/new`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes('aria-label="Award"') &&
      hasNameProp(body, "Red") &&
      hasNameProp(body, "Anthony Conway")
    ) {
      ok(newCheck);
    } else {
      fail(newCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(newCheck, String(error));
  }

  const editCheck =
    "GET /admin/awards/[id] as an Organizer shows Edit Award for the seeded Catan Champion";
  try {
    const [catan] = await runQuery<{ id: string }>(
      `select a.id from award a join war_week w on w.id = a.war_week_id
       where w.edition = 'xi' and a.name = 'Catan Champion'`,
    );
    const res = await fetch(`${BASE_URL}/admin/awards/${catan.id}`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes("Edit Award") &&
      body.includes('value="Catan Champion"')
    ) {
      ok(editCheck);
    } else {
      fail(editCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(editCheck, String(error));
  }
}

/**
 * Creates XII from XI, ends XI with a Winner and starts XII through the
 * lifecycle actions, checks the site follows, and that an Organizer of
 * only XI can still pick and edit XI but can't reopen it or create the
 * next War Week. Then puts XI back (`live`, no Winner, its own Organizers)
 * and deletes XII by SQL so the smoke can run again.
 */
async function assertWarWeekLifecycle(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const check =
    "lifecycle: create XII, end XI with a Winner, start XII; an XI-only Organizer edits XI but can't reopen it; then restore";
  const xiOnlyEmail = "smoke-xi-only@jahnelgroup.com";
  const restore = async () => {
    await runQuery("delete from war_week where edition in ('xii', 'xiii')");
    await runQuery(
      "update war_week set status = 'live', winner = null, highlights = '{}', organizer_emails = array_remove(organizer_emails, $1) where edition = 'xi'",
      [xiOnlyEmail],
    );
  };
  try {
    const ids = serverActionIds();
    const missing = [
      "createNextWarWeek",
      "endWarWeek",
      "startWarWeek",
      "reopenWarWeek",
      "selectAdminEdition",
      "updateWarWeekSettings",
    ].filter((name) => !ids[name]);
    if (missing.length > 0) {
      fail(check, `missing action ids: ${missing.join(", ")}`);
      return;
    }
    await restore();
    const editionId = async (edition: string) =>
      (
        await runQuery<{ id: string }>(
          "select id from war_week where edition = $1",
          [edition],
        )
      )[0]?.id;
    const xiId = await editionId("xi");
    const xId = await editionId("x");
    const problems: string[] = [];
    const expectRefused = async (
      label: string,
      name: string,
      args: unknown[],
    ) => {
      const result = await callAction(ids[name], args, sessions.notOrganizer);
      if (result.ok || !/not an Organizer/.test(result.error)) {
        problems.push(`${label}: ${JSON.stringify(result)}`);
      }
    };
    const expectOk = async (label: string, name: string, args: unknown[]) => {
      const result = await callAction(ids[name], args, sessions.organizer);
      if (!result.ok) problems.push(`${label}: ${JSON.stringify(result)}`);
    };

    await expectRefused("non-Organizer ends XI", "endWarWeek", [
      xiId,
      { winner: "Nope", highlights: "" },
    ]);
    await expectRefused(
      "non-Organizer reopens X (forged id)",
      "reopenWarWeek",
      [xId],
    );
    await expectOk("create XII", "createNextWarWeek", [
      xiId,
      {
        edition: "XII",
        editionNumber: "12",
        year: "2027",
        startDate: "2027-02-21",
        endDate: "2027-02-26",
        storyTheme: "Smoke XII",
        copyOrganizers: true,
        copySettings: true,
      },
    ]);
    const xiiId = await editionId("xii");
    if (!xiiId) problems.push("XII was not created");
    const early = await callAction(
      ids.startWarWeek,
      [xiiId],
      sessions.organizer,
    );
    if (early.ok || early.error !== "End XI first.") {
      problems.push(`start XII while XI is live: ${JSON.stringify(early)}`);
    }
    await expectOk("end XI", "endWarWeek", [
      xiId,
      { winner: "Smoke Winner", highlights: "" },
    ]);
    await expectRefused("non-Organizer starts XII", "startWarWeek", [xiiId]);
    await expectOk("start XII", "startWarWeek", [xiiId]);
    await expectRefused("non-Organizer ends XII", "endWarWeek", [
      xiiId,
      { winner: "Nope", highlights: "" },
    ]);

    const root = await signedInFetch(`${BASE_URL}/`, { redirect: "manual" });
    if (!root.headers.get("location")?.endsWith("/xii")) {
      problems.push(`/ goes to ${root.headers.get("location")}`);
    }
    const history = await (await signedInFetch(`${BASE_URL}/history`)).text();
    if (!history.includes('href="/xi"') || !history.includes("Smoke Winner")) {
      problems.push("/history lacks XI with Smoke Winner");
    }
    const archiveAdmin = await (
      await fetch(`${BASE_URL}/admin/setup`, {
        headers: { cookie: `${sessions.organizer.cookie}; admin_edition=xi` },
      })
    ).text();
    if (!archiveAdmin.includes("Editing the Archive: War Week XI")) {
      problems.push("the switcher can't edit XI");
    }

    // A current (XII) Organizer may reopen XI, the latest ended edition,
    // but the one-live rule still waits for XII to end.
    const reopenWhileLive = await callAction(
      ids.reopenWarWeek,
      [xiId],
      sessions.organizer,
    );
    if (reopenWhileLive.ok || reopenWhileLive.error !== "End XII first.") {
      problems.push(
        `XII Organizer reopens XI while XII is live: ${JSON.stringify(reopenWhileLive)}`,
      );
    }

    // An Organizer of only XI, added after XII was created from it.
    await runQuery(
      "update war_week set organizer_emails = array_append(organizer_emails, $1) where edition = 'xi'",
      [xiOnlyEmail],
    );
    const xiOnly = await createSmokeSession(xiOnlyEmail);
    const xiOnlyDefault = await (
      await fetch(`${BASE_URL}/admin/setup`, {
        headers: { cookie: xiOnly.cookie },
      })
    ).text();
    if (!xiOnlyDefault.includes("Editing the Archive: War Week XI")) {
      problems.push("/admin doesn't open on XI for an XI-only Organizer");
    }
    const selected = await callAction(ids.selectAdminEdition, ["xi"], xiOnly);
    if (!selected.ok) {
      problems.push(
        `XI-only Organizer selects XI: ${JSON.stringify(selected)}`,
      );
    }
    const [xi] = await runQuery<Record<string, string | string[] | null>>(
      `select story_theme, start_date::text, end_date::text, mode,
         team_label, leader_title, slack_channel_url, wiki_url,
         organizer_emails, primary_color, primary_foreground_color,
         accent_color, background_color, foreground_color, logo_url,
         banner_url, font_preset, winner
       from war_week where edition = 'xi'`,
    );
    const saved = await callAction(
      ids.updateWarWeekSettings,
      [
        {
          storyTheme: xi.story_theme,
          startDate: xi.start_date,
          endDate: xi.end_date,
          mode: xi.mode,
          teamLabel: xi.team_label,
          leaderTitle: xi.leader_title,
          slackChannelUrl: xi.slack_channel_url,
          wikiUrl: xi.wiki_url ?? "",
          organizerEmails: (xi.organizer_emails as string[]).join("\n"),
          primaryColor: xi.primary_color,
          primaryForegroundColor: xi.primary_foreground_color,
          accentColor: xi.accent_color,
          backgroundColor: xi.background_color,
          foregroundColor: xi.foreground_color,
          logoUrl: xi.logo_url ?? "",
          bannerUrl: xi.banner_url ?? "",
          fontPreset: xi.font_preset,
          winner: xi.winner ?? "",
          highlights: "Smoke XI highlight",
        },
      ],
      { cookie: `${xiOnly.cookie}; admin_edition=xi` },
    );
    const [xiAfter] = await runQuery<{ highlights: string[] }>(
      "select highlights from war_week where edition = 'xi'",
    );
    if (!saved.ok || xiAfter.highlights.join() !== "Smoke XI highlight") {
      problems.push(
        `XI-only Organizer saves XI highlights: ${JSON.stringify(saved)} ${JSON.stringify(xiAfter.highlights)}`,
      );
    }
    const takeover = await callAction(ids.reopenWarWeek, [xiId], xiOnly);
    if (takeover.ok || !/the current War Week/.test(takeover.error)) {
      problems.push(
        `XI-only Organizer reopens XI while XII is live: ${JSON.stringify(takeover)}`,
      );
    }
    const createFromXi = await callAction(
      ids.createNextWarWeek,
      [
        xiId,
        {
          edition: "XIII",
          editionNumber: "13",
          year: "2028",
          startDate: "2028-02-21",
          endDate: "2028-02-26",
          storyTheme: "Smoke XIII",
        },
      ],
      xiOnly,
    );
    if (createFromXi.ok || !/the current War Week/.test(createFromXi.error)) {
      problems.push(
        `XI-only Organizer creates XIII: ${JSON.stringify(createFromXi)}`,
      );
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await restore().catch((error) =>
      fail("restore XI after the lifecycle check", String(error)),
    );
  }
}

/**
 * /admin/setup: the landing, settings and Days pages, and one settings save
 * and one Day Theme edit that the War Week's own pages reflect. Restores XI
 * after.
 */
async function assertSetup(sessions: {
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
        if (!(await refused.text()).includes("Organizers only")) {
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
       team_label, leader_title, slack_channel_url, wiki_url, organizer_emails,
       primary_color, primary_foreground_color, accent_color, background_color,
       foreground_color, logo_url, banner_url, font_preset, winner, highlights
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
    organizerEmails: (xi.organizer_emails as string[]).join("\n"),
    primaryColor: xi.primary_color,
    primaryForegroundColor: xi.primary_foreground_color,
    accentColor: xi.accent_color,
    backgroundColor: xi.background_color,
    foregroundColor: xi.foreground_color,
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
          [{ ...input, primaryColor: smokePrimary }],
          sessions.notOrganizer,
        );
        const [row] = await runQuery<{ primary_color: string }>(
          "select primary_color from war_week where edition = 'xi'",
        );
        return !result.ok &&
          /not an Organizer/.test(result.error) &&
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
          [{ ...input, mode: "free-for-all" }],
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
          [{ ...input, primaryColor: smokePrimary }],
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
async function assertSetupTeamsAndCompetitions(sessions: {
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
        if (!(await refused.text()).includes("Organizers only")) {
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
          [participant],
          sessions.notOrganizer,
        );
        return !result.ok && /not an Organizer/.test(result.error)
          ? null
          : `result=${JSON.stringify(result)}`;
      },
    );

    await run(
      "an Organizer adds a Participant and GET /xi/teams shows them; a second with the same email is refused",
      async () => {
        const created = await callAction(
          ids.createParticipant,
          [participant],
          sessions.organizer,
        );
        const body = await (await signedInFetch(`${BASE_URL}/xi/teams`)).text();
        const duplicate = await callAction(
          ids.createParticipant,
          [{ ...participant, displayName: `${smokeName} 2` }],
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
async function assertSetupScheduleFaq(sessions: {
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
        if (!(await refused.text()).includes("Organizers only")) {
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
          [{ ...item, endTime: "23:00" }],
          sessions.organizer,
        );
        const outsider = await callAction(
          ids.createScheduleItem,
          [item],
          sessions.notOrganizer,
        );
        return !backwards.ok &&
          backwards.error === "End time must be after the start time." &&
          !outsider.ok &&
          /not an Organizer/.test(outsider.error)
          ? null
          : `backwards=${JSON.stringify(backwards)} outsider=${JSON.stringify(outsider)}`;
      },
    );

    await run(
      "an Organizer adds a Schedule Item; GET /xi/schedule lists it, GET /xi shows it in Now/Next while it's on, and a duplicate is refused",
      async () => {
        const created = await callAction(
          ids.createScheduleItem,
          [item],
          sessions.organizer,
        );
        const duplicate = await callAction(
          ids.createScheduleItem,
          [item],
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
          [{ question, answer: paragraph("smoke answer") }],
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

// The bracket loop check's own Competition and extra Teams (XI has two
// Teams), deleted after the check and before it, so it's rerunnable.
const SMOKE_BRACKET_COMPETITION = "SMOKE TEST bracket";
const SMOKE_BRACKET_TEAMS = ["SMOKE Bracket Gold", "SMOKE Bracket Green"];

async function deleteSmokeBracket() {
  await runQuery(
    `delete from points_entry where competition_id in
     (select id from competition where name = $1)`,
    [SMOKE_BRACKET_COMPETITION],
  );
  // Deleting the Competition cascades its Entrants and Heats.
  await runQuery(`delete from competition where name = $1`, [
    SMOKE_BRACKET_COMPETITION,
  ]);
  await runQuery(`delete from team where name = any($1)`, [
    SMOKE_BRACKET_TEAMS,
  ]);
}

async function assertBracketLoop(sessions: { organizer: SmokeSession }) {
  const check =
    "bracket loop: an Organizer sets single elimination on a Competition, enters 4 Teams, generates, records 3 Heat Results, finalizes; GET /xi/competitions/<id> shows the champion and /xi/leaderboard includes the generated points; un-finalize removes them; then cleans up";
  const ids = serverActionIds();
  const missing = [
    "createCompetition",
    "setCompetitionFormat",
    "replaceEntrants",
    "generateBracket",
    "recordHeatResult",
    "finalizeBracket",
    "unfinalizeBracket",
  ].filter((name) => !ids[name]);
  if (missing.length > 0) {
    fail("bracket action ids", missing.join(", "));
    return;
  }
  const organizer = sessions.organizer;
  const get = (route: string) =>
    fetch(`${BASE_URL}${route}`, { headers: { cookie: organizer.cookie } });

  try {
    await deleteSmokeBracket();
    for (const [name, color] of [
      [SMOKE_BRACKET_TEAMS[0], "#ca8a04"],
      [SMOKE_BRACKET_TEAMS[1], "#16a34a"],
    ]) {
      await runQuery(
        `insert into team (war_week_id, name, color)
         select id, $1, $2 from war_week where edition = 'xi'`,
        [name, color],
      );
    }
    const problems: string[] = [];
    const expectOk = (
      step: string,
      result: { ok: boolean; error?: string },
    ) => {
      if (!result.ok) problems.push(`${step}: ${result.error}`);
    };

    expectOk(
      "createCompetition",
      await callAction(
        ids.createCompetition,
        [
          {
            name: SMOKE_BRACKET_COMPETITION,
            description: "",
            scoring: "team",
            maxPoints: "",
            placementPoints: "10, 6, 3",
            countsTowardTeam: false,
            group: "",
          },
        ],
        organizer,
      ),
    );
    const [competition] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = $1`,
      [SMOKE_BRACKET_COMPETITION],
    );
    if (!competition) throw new Error(problems.join("; ") || "not created");
    const id = competition.id;

    expectOk(
      "setCompetitionFormat",
      await callAction(
        ids.setCompetitionFormat,
        [id, { format: "single-elimination" }],
        organizer,
      ),
    );
    const teams = await runQuery<{ id: string }>(
      `select t.id from team t join war_week w on w.id = t.war_week_id
       where w.edition = 'xi' order by t.name`,
    );
    if (teams.length !== 4) problems.push(`XI has ${teams.length} Teams`);
    expectOk(
      "replaceEntrants",
      await callAction(
        ids.replaceEntrants,
        [id, { targetIds: teams.map((t) => t.id) }],
        organizer,
      ),
    );
    expectOk(
      "generateBracket",
      await callAction(ids.generateBracket, [id, {}], organizer),
    );

    const before = await leaderboardTeamTotal("Red");
    // Red wins every Heat it's in, so it's the champion; otherwise the
    // first slot wins.
    let recorded = 0;
    for (const round of [1, 2]) {
      const slots = await runQuery<{
        heat_id: string;
        entrant_id: string;
        team_name: string;
      }>(
        `select h.id as heat_id, he.entrant_id, t.name as team_name
         from heat h join heat_entrant he on he.heat_id = h.id
         join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
         where h.competition_id = $1 and h.round = $2
         order by h.position, he.slot`,
        [id, round],
      );
      for (const heatId of [...new Set(slots.map((s) => s.heat_id))]) {
        const inHeat = slots.filter((s) => s.heat_id === heatId);
        const order = [
          ...inHeat.filter((s) => s.team_name === "Red"),
          ...inHeat.filter((s) => s.team_name !== "Red"),
        ].map((s) => s.entrant_id);
        const result = await callAction(
          ids.recordHeatResult,
          [id, heatId, { order, scores: { [order[0]]: "21" } }],
          organizer,
        );
        expectOk(`recordHeatResult round ${round}`, result);
        if (result.ok) recorded += 1;
      }
    }
    if (recorded !== 3) problems.push(`recorded ${recorded} Heat Results`);

    for (const route of [
      `/admin/setup/competitions/${id}/bracket`,
      `/admin/brackets/${id}`,
    ]) {
      const res = await get(route);
      const body = await res.text();
      if (res.status !== 200 || !body.includes(SMOKE_BRACKET_COMPETITION)) {
        problems.push(`${route} status=${res.status}`);
      }
    }

    expectOk(
      "finalizeBracket",
      await callAction(ids.finalizeBracket, [id], organizer),
    );
    const page = await (
      await signedInFetch(`${BASE_URL}/xi/competitions/${id}`)
    ).text();
    if (!/aria-label="Champion"(?:(?!aria-label=)[\s\S])*?>Red</.test(page)) {
      problems.push("the Competition page shows no Red champion");
    }
    const finalized = await leaderboardTeamTotal("Red");
    if (before === null || finalized !== before + 10) {
      problems.push(`Red total ${before} → ${finalized}, expected +10`);
    }
    const ledger = await (await get("/admin/points")).text();
    if (!ledger.includes("From bracket")) {
      problems.push("/admin/points shows no From bracket row");
    }

    expectOk(
      "unfinalizeBracket",
      await callAction(ids.unfinalizeBracket, [id], organizer),
    );
    const unfinalized = await leaderboardTeamTotal("Red");
    if (unfinalized !== before) {
      problems.push(`Red total after un-finalize ${unfinalized} != ${before}`);
    }
    const [{ count }] = await runQuery<{ count: string }>(
      `select count(*) from points_entry where competition_id = $1`,
      [id],
    );
    if (Number(count) !== 0) problems.push(`${count} Points Entries remain`);

    // Every Heat is decided. A score-only edit of Red's semifinal resets
    // nothing; changing the winner of the other semifinal resets the one
    // decided later Heat its winner reached, the final.
    const semis = await runQuery<{
      heat_id: string;
      entrant_id: string;
      team_name: string;
    }>(
      `select h.id as heat_id, he.entrant_id, t.name as team_name
       from heat h join heat_entrant he on he.heat_id = h.id
       join entrant e on e.id = he.entrant_id join team t on t.id = e.team_id
       where h.competition_id = $1 and h.round = 1
       order by h.position, he.slot`,
      [id],
    );
    const [decidedLater] = await runQuery<{ count: string }>(
      `select count(*) from heat
       where competition_id = $1 and round > 1 and status in ('played', 'forfeit')`,
      [id],
    );
    const redHeat = semis.find((s) => s.team_name === "Red")?.heat_id;
    const otherHeat = semis.find((s) => s.heat_id !== redHeat)?.heat_id;
    const [{ entrant_id: otherWinner }] = await runQuery<{
      entrant_id: string;
    }>(`select entrant_id from heat_entrant where heat_id = $1 and place = 1`, [
      otherHeat,
    ]);
    const resetCount = async (
      step: string,
      heatId: string,
      order: string[],
    ) => {
      const result = (await callAction(
        ids.recordHeatResult,
        [id, heatId, { order, scores: { [order[0]]: "25" } }],
        organizer,
      )) as ActionResult & { resetHeatIds?: string[] };
      expectOk(step, result);
      return result.resetHeatIds?.length;
    };
    const redOrder = [
      ...semis.filter((s) => s.heat_id === redHeat && s.team_name === "Red"),
      ...semis.filter((s) => s.heat_id === redHeat && s.team_name !== "Red"),
    ].map((s) => s.entrant_id);
    const sameWinner = await resetCount(
      "recordHeatResult same winner",
      redHeat!,
      redOrder,
    );
    if (sameWinner !== 0) {
      problems.push(`a score-only edit reset ${sameWinner} later Heats`);
    }
    const flipped = semis
      .filter((s) => s.heat_id === otherHeat)
      .map((s) => s.entrant_id)
      .sort((a, b) => Number(a === otherWinner) - Number(b === otherWinner));
    const changedWinner = await resetCount(
      "recordHeatResult changed winner",
      otherHeat!,
      flipped,
    );
    if (changedWinner !== Number(decidedLater.count)) {
      problems.push(
        `a winner change reset ${changedWinner} later Heats, expected the ${decidedLater.count} decided`,
      );
    }

    if (problems.length === 0) ok(check);
    else fail(check, problems.join("; "));
  } catch (error) {
    fail(check, String(error));
  } finally {
    await deleteSmokeBracket().catch((error) =>
      fail("delete the smoke bracket", String(error)),
    );
  }
}

async function assertSignInRequired() {
  for (const target of ["/", "/xi", "/xi/leaderboard"]) {
    const check = `anonymous GET ${target} redirects to sign-in`;
    try {
      const res = await fetch(`${BASE_URL}${target}`, { redirect: "manual" });
      const location = res.headers.get("location") ?? "";
      const callback = `callbackURL=${encodeURIComponent(target)}`;
      if (
        res.status === 307 &&
        location.includes("/sign-in?") &&
        location.includes(callback)
      ) {
        ok(check);
      } else {
        fail(check, `status=${res.status} location=${location}`);
      }
    } catch (error) {
      fail(check, String(error));
    }
  }

  const mcpCheck = "anonymous POST /api/mcp answers 401";
  try {
    const { status } = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-06-18",
          capabilities: {},
          clientInfo: { name: "smoke-test", version: "0.1.0" },
        },
      },
      undefined,
      "",
    ).catch(() => ({ status: -1 }));
    if (status === 401) {
      ok(mcpCheck);
    } else {
      fail(mcpCheck, `status=${status}`);
    }
  } catch (error) {
    fail(mcpCheck, String(error));
  }

  await assertMcpBearerToken();
}

/** Without a session, `/api/mcp` takes `Authorization: Bearer <MCP_TOKEN>`. */
async function assertMcpBearerToken() {
  const initialize = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.1.0" },
    },
  };

  const wrongCheck = "POST /api/mcp with a wrong bearer token answers 401";
  try {
    const { status } = await mcpRequest(initialize, undefined, "", {
      Authorization: "Bearer not-the-token",
    });
    if (status === 401) ok(wrongCheck);
    else fail(wrongCheck, `status=${status}`);
  } catch (error) {
    fail(wrongCheck, String(error));
  }

  const check =
    "POST /api/mcp with the bearer token and no session completes initialize and get_current_war_week";
  try {
    const bearer = { Authorization: `Bearer ${MCP_TOKEN}` };
    const init = await mcpRequest(initialize, undefined, "", bearer);
    const call = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: { name: "get_current_war_week", arguments: {} },
      },
      init.sessionId,
      "",
      bearer,
    );
    const text = (
      call.json?.result as { content?: { text: string }[] } | undefined
    )?.content?.[0]?.text;
    const parsed = text ? JSON.parse(text) : undefined;
    if (
      init.status === 200 &&
      init.json?.result !== undefined &&
      parsed?.edition === "xi"
    ) {
      ok(check);
    } else {
      fail(
        check,
        `init=${init.status} ${JSON.stringify(init.json)} call=${call.status} ${JSON.stringify(call.json)}`,
      );
    }
  } catch (error) {
    fail(check, String(error));
  }
}

async function assertAdminGuidePage(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  const organizerCheck =
    "GET /admin/guide as an Organizer shows the guide, linked in the admin nav";
  try {
    const res = await fetch(`${BASE_URL}/admin/guide`, {
      headers: { cookie: sessions.organizer.cookie },
    });
    const body = await res.text();
    if (
      res.status === 200 &&
      body.includes("Organizer guide") &&
      body.includes("Placement Points") &&
      body.includes('href="/admin/guide"')
    ) {
      ok(organizerCheck);
    } else {
      fail(organizerCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(organizerCheck, String(error));
  }

  const refusalCheck =
    "GET /admin/guide as a signed-in non-Organizer shows the refusal";
  try {
    const res = await fetch(`${BASE_URL}/admin/guide`, {
      headers: { cookie: sessions.notOrganizer.cookie },
    });
    const body = await res.text();
    if (res.status === 200 && body.includes("Organizers only")) {
      ok(refusalCheck);
    } else {
      fail(refusalCheck, `status=${res.status}`);
    }
  } catch (error) {
    fail(refusalCheck, String(error));
  }
}

async function assertAdminLink(sessions: {
  organizer: SmokeSession;
  notOrganizer: SmokeSession;
}) {
  for (const [label, session, expected] of [
    ["an Organizer", sessions.organizer, true],
    ["a non-Organizer", sessions.notOrganizer, false],
  ] as const) {
    const check = `GET /xi/more as ${label} ${expected ? "shows" : "hides"} the Admin link and shows the account`;
    try {
      const res = await fetch(`${BASE_URL}/xi/more`, {
        headers: { cookie: session.cookie },
      });
      const body = await res.text();
      const checks = {
        admin: body.includes('href="/admin"') === expected,
        account: body.includes("Signed in as") && body.includes("Sign out"),
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
}

async function mcpRequest(
  body: Record<string, unknown>,
  sessionId?: string,
  cookie = viewerCookie,
  extraHeaders: Record<string, string> = {},
): Promise<{
  status: number;
  json: Record<string, unknown> | undefined;
  sessionId: string | undefined;
}> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (cookie) headers.cookie = cookie;
  if (sessionId) headers["mcp-session-id"] = sessionId;
  Object.assign(headers, extraHeaders);

  const res = await fetch(`${BASE_URL}/api/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const contentType = res.headers.get("content-type") ?? "";
  const text = await res.text();

  let json: Record<string, unknown> | undefined;
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter(Boolean);
    const lastData = dataLines[dataLines.length - 1];
    if (lastData) json = JSON.parse(lastData);
  } else if (text) {
    json = JSON.parse(text);
  }

  return {
    status: res.status,
    json,
    sessionId: res.headers.get("mcp-session-id") ?? undefined,
  };
}

async function assertMcp() {
  try {
    const init = await mcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "smoke-test", version: "0.1.0" },
      },
    });
    const sessionId = init.sessionId;

    const toolsList = await mcpRequest(
      { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
      sessionId,
    );
    const tools =
      (toolsList.json?.result as { tools?: { name: string }[] } | undefined)
        ?.tools ?? [];
    for (const name of [
      "get_current_war_week",
      "get_leaderboard",
      "get_schedule",
      "get_announcements",
      "get_awards",
      "get_faq",
      "list_history",
      "get_history",
    ]) {
      if (tools.some((tool) => tool.name === name)) {
        ok(`MCP tools/list includes ${name}`);
      } else {
        fail(
          `MCP tools/list includes ${name}`,
          `tools=${JSON.stringify(tools)}`,
        );
      }
    }

    const call = await mcpRequest(
      {
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "get_current_war_week", arguments: {} },
      },
      sessionId,
    );
    const result = call.json?.result as
      { content?: { type: string; text: string }[] } | undefined;
    const text = result?.content?.[0]?.text;
    const parsed = text ? JSON.parse(text) : undefined;

    if (parsed?.edition === "xi") {
      ok("MCP tools/call get_current_war_week returns edition xi");
    } else {
      fail(
        "MCP tools/call get_current_war_week returns edition xi",
        `result=${JSON.stringify(call.json)}`,
      );
    }

    for (const [id, kind] of [
      [4, "team"],
      [5, "individual"],
    ] as const) {
      const check = `MCP get_leaderboard(${kind}) returns Standings with numeric totals`;
      const leaderboard = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "get_leaderboard", arguments: { kind } },
        },
        sessionId,
      );
      const text = (
        leaderboard.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      const parsed = text ? JSON.parse(text) : undefined;
      if (
        parsed?.kind === kind &&
        !("hidden" in parsed) &&
        Array.isArray(parsed.standings) &&
        parsed.standings.length > 0 &&
        parsed.standings.every(
          (row: { total: unknown }) => typeof row.total === "number",
        )
      ) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(leaderboard.json)}`);
      }
    }

    for (const [id, args, check, expectDays] of [
      [
        6,
        { date: "2026-02-24" },
        "MCP get_schedule(2026-02-24) returns only that Day",
        ["2026-02-24"],
      ],
      [7, {}, "MCP get_schedule() returns all six XI Days", 6],
    ] as const) {
      const schedule = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name: "get_schedule", arguments: args },
        },
        sessionId,
      );
      const text = (
        schedule.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      const parsed = text ? JSON.parse(text) : undefined;
      const days = parsed?.days as
        { date: string; dayTheme: string; items: unknown[] }[] | undefined;
      const passed =
        parsed?.timeZone === "America/New_York" &&
        Array.isArray(days) &&
        (typeof expectDays === "number"
          ? days.length === expectDays
          : days.length === 1 &&
            days[0].date === expectDays[0] &&
            days[0].dayTheme === "Red vs. Blue" &&
            days[0].items.length > 0);
      if (passed) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(schedule.json)}`);
      }
    }

    const callTool = async (
      id: number,
      name: string,
      args: Record<string, unknown>,
    ) => {
      const res = await mcpRequest(
        {
          jsonrpc: "2.0",
          id,
          method: "tools/call",
          params: { name, arguments: args },
        },
        sessionId,
      );
      const text = (
        res.json?.result as
          { content?: { type: string; text: string }[] } | undefined
      )?.content?.[0]?.text;
      return { raw: res.json, parsed: text ? JSON.parse(text) : undefined };
    };

    const announcementsLimited = await callTool(12, "get_announcements", {
      limit: 2,
    });
    const limited = announcementsLimited.parsed as
      | {
          edition: string;
          announcements: {
            title: string;
            pinned: boolean;
            videoUrls: string[];
            body: string | null;
          }[];
        }
      | undefined;
    const firstAnnouncement = limited?.announcements?.[0];
    const limitedCheck =
      "MCP get_announcements(limit: 2) returns edition xi, 2 Announcements, welcome pinned first with its video and body";
    if (
      limited?.edition === "xi" &&
      limited.announcements.length === 2 &&
      firstAnnouncement?.pinned === true &&
      firstAnnouncement.title === "Welcome to War Week XI" &&
      firstAnnouncement.videoUrls.includes(
        "https://www.youtube.com/watch?v=vKQi3bBA1y8",
      ) &&
      typeof firstAnnouncement.body === "string" &&
      firstAnnouncement.body.length > 0 &&
      firstAnnouncement.body.includes("Choose your pill")
    ) {
      ok(limitedCheck);
    } else {
      fail(limitedCheck, `result=${JSON.stringify(announcementsLimited.raw)}`);
    }

    const announcementsAll = await callTool(13, "get_announcements", {});
    const allCount = (
      announcementsAll.parsed as { announcements?: unknown[] } | undefined
    )?.announcements?.length;
    const allCheck = "MCP get_announcements() returns all 3 Announcements";
    if (allCount === 3) {
      ok(allCheck);
    } else {
      fail(allCheck, `result=${JSON.stringify(announcementsAll.raw)}`);
    }

    const awards = await callTool(14, "get_awards", {});
    const awardsCheck =
      "MCP get_awards returns XI's three seeded Awards with the same recipients as /xi/awards";
    const mcpAwards = awards.parsed?.awards as
      { name: string; participants: string[] }[] | undefined;
    const sameAwards =
      awards.parsed?.edition === "xi" &&
      mcpAwards?.length === XI_AWARDS.length &&
      XI_AWARDS.every((expected) => {
        const found = mcpAwards.find((a) => a.name === expected.name);
        return (
          found &&
          JSON.stringify([...found.participants].sort()) ===
            JSON.stringify([...expected.recipients].sort())
        );
      });
    if (sameAwards) ok(awardsCheck);
    else fail(awardsCheck, `result=${JSON.stringify(awards.raw)}`);

    const faq = await callTool(15, "get_faq", {});
    const faqCheck =
      "MCP get_faq returns XI's six FAQ Items in seed order with plain-text answers";
    const mcpFaq = faq.parsed?.faq as
      { question: string; answer: string | null }[] | undefined;
    if (
      faq.parsed?.edition === "xi" &&
      JSON.stringify(mcpFaq?.map((f) => f.question)) ===
        JSON.stringify(XI_FAQ_QUESTIONS) &&
      mcpFaq?.[5].answer ===
        "They're very welcome. Let Jason know so the proper arrangements can be made."
    ) {
      ok(faqCheck);
    } else {
      fail(faqCheck, `result=${JSON.stringify(faq.raw)}`);
    }

    const list = await callTool(8, "list_history", {});
    const years = (
      list.parsed?.warWeeks as { year: number }[] | undefined
    )?.map((w) => w.year);
    const expectedYears = Array.from({ length: 10 }, (_, i) => 2025 - i);
    if (JSON.stringify(years) === JSON.stringify(expectedYears)) {
      ok("MCP list_history returns 2025 down to 2016");
    } else {
      fail(
        "MCP list_history returns 2025 down to 2016",
        `result=${JSON.stringify(list.raw)}`,
      );
    }

    const y2023 = await callTool(9, "get_history", { year: 2023 });
    const p = y2023.parsed;
    if (
      p?.found === true &&
      p.edition === "viii" &&
      p.winner === "Slytherin" &&
      p.teams?.length === 4 &&
      p.awards?.some((a: { name: string }) => a.name === "House Cup") &&
      p.highlights?.length > 0 &&
      String(p.wikiUrl).endsWith("war-week-2023")
    ) {
      ok(
        "MCP get_history(2023) returns the stored winner, Houses, Awards and wiki link",
      );
    } else {
      fail(
        "MCP get_history(2023) returns the stored winner, Houses, Awards and wiki link",
        `result=${JSON.stringify(y2023.raw)}`,
      );
    }

    for (const [id, year] of [
      [10, 2030],
      [11, 2026],
    ] as const) {
      const check = `MCP get_history(${year}) returns a clear not-found result`;
      const missing = await callTool(id, "get_history", { year });
      if (
        missing.parsed?.found === false &&
        String(missing.parsed.message).includes(
          `No past War Week found for ${year}`,
        )
      ) {
        ok(check);
      } else {
        fail(check, `result=${JSON.stringify(missing.raw)}`);
      }
    }
  } catch (error) {
    fail("MCP requests succeed", String(error));
  }
}

function startServer(port: number, env: NodeJS.ProcessEnv): ChildProcess {
  return spawn("pnpm", ["start", "-p", String(port)], {
    env,
    stdio: "inherit",
    // pnpm forks a `next start` child; detach into its own process group
    // so killing the group (not just the pnpm wrapper) stops the server.
    detached: true,
  });
}

function killProcessGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    // group already gone
  }
}

function killServer(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null || child.killed || !child.pid) {
      resolve();
      return;
    }
    const pid = child.pid;
    const forceKill = setTimeout(() => {
      killProcessGroup(pid, "SIGKILL");
    }, 3000);
    child.once("exit", () => {
      clearTimeout(forceKill);
      resolve();
    });
    killProcessGroup(pid, "SIGTERM");
  });
}

async function main() {
  if (
    !isLocalDatabaseUrl(process.env.DATABASE_URL, process.env.DATABASE_DRIVER)
  ) {
    console.error(
      'FAIL - DATABASE_URL must point at a local database (localhost, 127.0.0.1 or [::1]) with DATABASE_DRIVER not "neon"; smoke resets every seeded War Week and never runs against a hosted database',
    );
    process.exit(1);
  }

  if (!existsSync(path.resolve(process.cwd(), ".next"))) {
    console.error(
      "FAIL - .next build output missing: run `pnpm build` before `pnpm smoke`",
    );
    process.exit(1);
  }

  if (await portInUse(BASE_URL)) {
    console.error(
      `FAIL - something is already listening on ${BASE_URL}; stop it before running the smoke`,
    );
    process.exit(1);
  }

  if (!runStep("pnpm", ["db:migrate"], "pnpm db:migrate")) {
    process.exit(1);
  }
  // Load every seed twice: the first load resets each War Week so the counts
  // below match the seeds exactly; the second proves loading is idempotent.
  const seedFiles = readdirSync(path.resolve(process.cwd(), "seeds"))
    .filter((f) => f.endsWith(".json"))
    .map((f) => `seeds/${f}`);
  for (const [attempt, flags] of [
    [1, ["--reset"]],
    [2, []],
  ] as const) {
    if (
      !runStep(
        "pnpm",
        ["seed:load", ...flags, ...seedFiles],
        `pnpm ${["seed:load", ...flags].join(" ")} (${seedFiles.length} seeds, load ${attempt})`,
      )
    ) {
      process.exit(1);
    }
  }
  await assertSeedLoadedOnce();
  await assertPointsEntryTargetConstraint();
  await assertPlacementPointsSeeded();

  // Clear leftovers from an interrupted run, then add the smoke Organizer
  // to XI's allowlist until the run ends.
  await deleteSmokeUsers();
  await setSmokeOrganizer(true);
  const sessions = {
    organizer: await createSmokeSession(SMOKE_ORGANIZER_EMAIL),
    notOrganizer: await createSmokeSession("smoke-participant@jahnelgroup.com"),
    // Can't happen through sign-in (the user-create hook refuses it); the
    // session check still treats it as anonymous.
    outsider: await createSmokeSession("smoke-outsider@example.com"),
  };
  viewerCookie = sessions.notOrganizer.cookie;

  const server = startServer(PORT, childEnv);

  try {
    const ready = await waitForReady();
    if (!ready) {
      fail(
        "server ready",
        `did not respond on ${BASE_URL}/xi within ${READY_TIMEOUT_MS}ms`,
      );
    } else {
      ok("server ready");
      await assertRootRedirect();
      await assertXiHome();
      await assertUnknownEdition404();
      await assertLeaderboard();
      await assertSchedule();
      await assertHomeNowNext();
      await assertMoreLinks();
      await assertInstallable();
      await assertLlmsTxt();
      await assertHistory();
      await assertArchiveDetail();
      await assertCompetitions();
      await assertCompetitionDetail();
      await assertTeams();
      await assertFreeForAllRoster();
      await assertYouHighlight(sessions);
      await assertMcp();
      await assertAboutPage();
      await assertPrivacyAndTermsPages();
      await assertSignInPage();
      await assertAdminGate(sessions);
      await assertAdminWording(sessions);
      await assertSignInRequired();
      await assertAdminLink(sessions);
      await assertAdminGuidePage(sessions);
      await assertAdminPointsPage(sessions);
      await assertPointsEntryActions(sessions);
      await assertFinale(sessions);
      await assertAnnouncementFeed();
      await assertAnnouncementHomePinned();
      await assertAnnouncementActions(sessions);
      await assertAnnouncementUnsafeContentStripped(sessions);
      await assertAnnouncementAdminPages(sessions);
      await assertAwardsPage();
      await assertFaqPage();
      await assertAwardActions(sessions);
      await assertAwardAdminPages(sessions);
      await assertSetup(sessions);
      await assertSetupTeamsAndCompetitions(sessions);
      await assertSetupScheduleFaq(sessions);
      await assertBracketLoop(sessions);
      // Last: it changes which War Week is current, then restores XI.
      await assertWarWeekLifecycle(sessions);
    }
  } finally {
    await killServer(server);
    await deleteSmokeUsers().catch((error) =>
      fail("delete smoke users", String(error)),
    );
    await setSmokeOrganizer(false).catch((error) =>
      fail("remove the smoke Organizer from XI", String(error)),
    );
  }

  process.exit(failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
