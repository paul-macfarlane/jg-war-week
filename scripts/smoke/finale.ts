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
 * The Finale (brackets ticket 1): `/xi/finale` opens on Start for any
 * signed-in user, `/admin/standings` is the Organizer's way in, and MCP
 * `get_leaderboard` always returns Standings.
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
          notOrganizer.body.includes(ADMIN_REFUSAL_TEXT) &&
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
