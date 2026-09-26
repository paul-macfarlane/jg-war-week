import { makeSignature } from "better-auth/crypto";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

// SMOKE_PORT lets parallel worktrees run smoke side by side.
export const PORT = Number(process.env.SMOKE_PORT ?? 3100);
export const BASE_URL = `http://localhost:${PORT}`;
export const READY_TIMEOUT_MS = 30_000;

// The smoke never uses real OAuth credentials: it proves the app runs
// without them and signs its own session cookies with this secret.
export const AUTH_SECRET =
  process.env.BETTER_AUTH_SECRET || `smoke-only-secret-${randomUUID()}`;
export const SESSION_COOKIE = "better-auth.session_token";

/** What `/admin` shows a signed-in user with no role on the page. */
export const ADMIN_REFUSAL_TEXT = "Organizers and Hosts only.";
// A smoke-only MCP bearer token; anonymous requests still get 401.
export const MCP_TOKEN = `smoke-mcp-token-${randomUUID()}`;

export const childEnv = {
  ...process.env,
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_DRIVER: process.env.DATABASE_DRIVER,
  BETTER_AUTH_SECRET: AUTH_SECRET,
  BETTER_AUTH_URL: BASE_URL,
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  MCP_TOKEN,
};

/**
 * Mutable smoke state shared across check modules: the failure count, the
 * signed-in viewer cookie every page check uses, and the cached XI id.
 */
export const state = {
  failures: 0,
  // Every page needs a sign-in, so page checks run as a signed-in JG user
  // (a smoke session, set in main before the server starts).
  viewerCookie: "",
  xiWarWeekIdCache: undefined as string | undefined,
};

export type SmokeSession = { cookie: string };
export type ActionResult = { ok: true } | { ok: false; error: string };

export function signedInFetch(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { cookie: state.viewerCookie, ...init.headers },
  });
}

export function ok(check: string) {
  console.log(`ok - ${check}`);
}

export function fail(check: string, detail: string) {
  state.failures += 1;
  console.log(`FAIL - ${check}: ${detail}`);
}

/** Runs one named check: `body` returns null when it passes, else why not. */
export async function runCheck(
  check: string,
  body: () => Promise<string | null>,
) {
  try {
    const problem = await body();
    if (problem === null) ok(check);
    else fail(check, problem);
  } catch (error) {
    fail(check, String(error));
  }
}

export function runStep(command: string, args: string[], label: string) {
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

export async function waitForReady(): Promise<boolean> {
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

export async function portInUse(baseUrl: string): Promise<boolean> {
  try {
    await fetch(`${baseUrl}/`, { redirect: "manual" });
    return true;
  } catch {
    return false;
  }
}

export async function runQuery<T extends Record<string, unknown>>(
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

// Smoke users never share an email with a real person, so cleanup can't
// touch a real account.
export const SMOKE_EMAIL_PATTERN = "smoke-%@jahnelgroup.com";
export const SMOKE_EMAIL_PATTERN_OUTSIDER = "smoke-%@example.com";
export const SMOKE_ORGANIZER_EMAIL = "smoke-organizer@jahnelgroup.com";

/**
 * Inserts a user and a session straight into the database and returns the
 * session cookie better-auth would have set after a Google sign-in.
 */
export async function createSmokeSession(email: string): Promise<SmokeSession> {
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
export async function deleteSmokeUsers() {
  await runQuery(`delete from "user" where email like $1 or email like $2`, [
    SMOKE_EMAIL_PATTERN,
    SMOKE_EMAIL_PATTERN_OUTSIDER,
  ]);
}

/** Adds or removes the smoke Organizer on the global Organizer list. */
export async function setSmokeOrganizer(on: boolean) {
  await runQuery(
    on
      ? `insert into organizer (email) values ($1) on conflict do nothing`
      : `delete from organizer where email = $1`,
    [SMOKE_ORGANIZER_EMAIL],
  );
}

/**
 * War Week XI's id: creates and the settings save post the War Week they
 * write to (ADR 0003).
 */
export async function xiWarWeekId(): Promise<string> {
  if (!state.xiWarWeekIdCache) {
    const [row] = await runQuery<{ id: string }>(
      "select id from war_week where edition = 'xi'",
    );
    state.xiWarWeekIdCache = row.id;
  }
  return state.xiWarWeekIdCache;
}

/** The build's server action ids, by exported name. */
export function serverActionIds(): Record<string, string> {
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
export async function callAction(
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
export function hasNameProp(body: string, name: string) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\\\?"(?:name|label)\\\\?":\\\\?"${escaped}\\\\?"`).test(
    body,
  );
}

export function escapeHtml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/** A Team's total on the public leaderboard page, or null when not shown. */
export async function leaderboardTeamTotal(
  teamName: string,
): Promise<number | null> {
  const res = await signedInFetch(`${BASE_URL}/xi/leaderboard`);
  return teamTotalIn(await res.text(), teamName);
}

/** A Team's total in a page's Team Standings list, or null when not shown. */
export function teamTotalIn(body: string, teamName: string): number | null {
  const match = body.match(
    new RegExp(
      `font-semibold">${escapeHtml(teamName)}</span><span class="[^"]*">([-\\d.,]+)</span>`,
    ),
  );
  return match ? Number(match[1].replace(/,/g, "")) : null;
}

export function startServer(
  port: number,
  env: NodeJS.ProcessEnv,
): ChildProcess {
  return spawn("pnpm", ["start", "-p", String(port)], {
    env,
    stdio: "inherit",
    // pnpm forks a `next start` child; detach into its own process group
    // so killing the group (not just the pnpm wrapper) stops the server.
    detached: true,
  });
}

export function killProcessGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    // group already gone
  }
}

export function killServer(child: ChildProcess): Promise<void> {
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
