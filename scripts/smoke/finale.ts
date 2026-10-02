import {
  ADMIN_REFUSAL_TEXT,
  BASE_URL,
  type SmokeSession,
  fail,
  leaderboardTeamTotal,
  ok,
} from "./harness";
import { mcpLeaderboard } from "./mcp";

/**
 * The Finale (brackets ticket 1, ticket 72): `/xi/finale` opens on the
 * slideshow's first slide for any signed-in user, `/admin/finale` is the
 * Organizer's way in and lists the slides, and MCP `get_leaderboard` always
 * returns Standings.
 */
export async function assertFinale(sessions: {
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
    "GET /xi/finale as a signed-in user opens the slideshow on its Title slide, with nothing waiting on Start",
    async () => {
      const { status, body } = await page("/xi/finale", sessions.notOrganizer);
      const checks = {
        status: status === 200,
        title: body.includes('data-finale-slide="title"'),
        first: body.includes('data-finale-slide-index="0"'),
        noReady: !body.includes('data-finale="ready"'),
        noStart: !/<button[^>]*>Start<\/button>/.test(body),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  await run(
    "GET /admin/finale shows the Finale page with Open Finale and the slide list to an Organizer and the refusal to a non-Organizer",
    async () => {
      const organizer = await page("/admin/finale", sessions.organizer);
      const notOrganizer = await page("/admin/finale", sessions.notOrganizer);
      const checks = {
        heading: /<h1[^>]*>Finale<\/h1>/.test(organizer.body),
        open:
          organizer.body.includes("Open Finale") &&
          organizer.body.includes('href="/xi/finale"'),
        slides:
          organizer.body.includes('aria-label="Finale slides"') &&
          organizer.body.includes("Standings countdown"),
        refused:
          notOrganizer.body.includes(ADMIN_REFUSAL_TEXT) &&
          !notOrganizer.body.includes("Open Finale"),
      };
      return Object.values(checks).every(Boolean)
        ? null
        : JSON.stringify(checks);
    },
  );

  await run(
    'GET /admin/finale lists the seeded Custom "Thank you" slide on XI with its Edit and Delete, and offers Add custom slide, to an Organizer',
    async () => {
      const { body } = await page("/admin/finale", sessions.organizer);
      const checks = {
        heading: body.includes("Thank you"),
        edit: body.includes('aria-label="Edit Thank you"'),
        delete: body.includes('aria-label="Delete Thank you"'),
        add: body.includes("Add custom slide"),
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
