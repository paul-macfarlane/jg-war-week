/**
 * Helpers the media scripts share (`scripts/about-media.ts`,
 * `scripts/finale-stills.ts`): their own production server, plain SQL on
 * `DATABASE_URL` (importing the app's database would keep a pool open), a
 * signed session cookie for a made-up user, the Display a page opens in,
 * and a finished Heats Bracket on a demo War Week.
 */
import { makeSignature } from "better-auth/crypto";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";

/** The cookie a signed-in session rides in. */
export const SESSION_COOKIE = "better-auth.session_token";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** A media script's own server: where it listens, when it's up, and its stop. */
export type DemoServer = {
  baseUrl: string;
  /** Resolves once `/sign-in` answers (about 30 s at most). */
  ready: () => Promise<void>;
  stop: () => void;
};

/**
 * Starts the production build (`pnpm start`) on `port`, signing sessions
 * with `authSecret` and with Google sign-in and MCP off. Exits when there
 * is no build; throws when something already listens on the port.
 */
export async function startDemoServer(
  port: number,
  authSecret: string,
): Promise<DemoServer> {
  if (!existsSync(path.resolve(process.cwd(), ".next/BUILD_ID"))) {
    console.error("No production build in .next: run `pnpm build` first.");
    process.exit(1);
  }
  const baseUrl = `http://localhost:${port}`;
  if (
    await fetch(baseUrl).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(`something is already listening on ${baseUrl}`);
  }
  const server = spawn("pnpm", ["start", "-p", String(port)], {
    env: {
      ...process.env,
      BETTER_AUTH_SECRET: authSecret,
      BETTER_AUTH_URL: baseUrl,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      MCP_TOKEN: "",
    },
    stdio: "ignore",
    detached: true,
  });
  return {
    baseUrl,
    ready: async () => {
      for (let i = 0; i < 60; i++) {
        await sleep(500);
        const up = await fetch(`${baseUrl}/sign-in`).then(
          (r) => r.ok,
          () => false,
        );
        if (up) return;
      }
    },
    stop: () => {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    },
  };
}

/**
 * A script that stores `display` as the viewer's Display before the page's
 * own scripts run, so a page shows that scheme, never this machine's.
 */
export function displayInitScript(display: string): string {
  return `try{localStorage.setItem(${JSON.stringify(DISPLAY_STORAGE_KEY)},${JSON.stringify(display)})}catch(e){}`;
}

/** The War Week a fixture goes on. */
export type DemoWarWeek = { id: string; edition: string };

/** Runs one query on its own connection. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    return (await client.query(sql, params)).rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Adds a user `email` named `name` with a one-hour session, replacing any
 * user of that email, and returns its session cookie's value, signed with
 * `secret` (the server's `BETTER_AUTH_SECRET`).
 */
export async function createDemoSession(
  email: string,
  secret: string,
  name: string,
): Promise<string> {
  const userId = `smoke-${randomUUID()}`;
  const token = `smoke-${randomUUID()}`;
  await query(`delete from "user" where email = $1`, [email]);
  await query(
    `insert into "user" (id, name, email, email_verified) values ($1, $2, $3, true)`,
    [userId, name, email],
  );
  await query(
    `insert into session (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 hour')`,
    [`smoke-${randomUUID()}`, token, userId],
  );
  return encodeURIComponent(`${token}.${await makeSignature(token, secret)}`);
}

const BRACKET_COMP_NAME = "Capture the Flag";

/**
 * Fills a small, already-finished Heats Bracket on `warWeek` (8
 * Participant Entrants, 4 per Heat with the top 2 advancing, two Round 1
 * Heats and a decided Final) directly in SQL: its Entrants at Seed
 * Positions 1–8, and each Heat with its slots and places. It uses the
 * demo's own seeded heats Competition when it has one with no Entrants yet
 * (seeds can't seed Entrants), else adds a Competition of its own. Returns
 * the Competition and the undo: delete the added Competition (which cascades
 * its Entrants and Heats), or the seeded one's Heats and Entrants.
 */
export async function setupBracketDemo(
  warWeek: DemoWarWeek,
  note: (line: string) => void,
): Promise<{
  competitionId: string;
  teardown: () => Promise<void>;
}> {
  const [seeded] = await query<{ id: string }>(
    `select c.id from competition c
     where c.war_week_id = $1 and c.format = 'bracket' and c.scoring = 'individual'
       and not exists (select 1 from entrant e where e.competition_id = c.id)
     order by c.name limit 1`,
    [warWeek.id],
  );
  const competitionId =
    seeded?.id ??
    (
      await query<{ id: string }>(
        `insert into competition (war_week_id, name, scoring, format, bracket_config)
         values ($1, $2, 'individual', 'bracket', $3) returning id`,
        [
          warWeek.id,
          BRACKET_COMP_NAME,
          { entrantsPerHeat: 4, advancePerHeat: 2, thirdPlaceGame: false },
        ],
      )
    )[0].id;
  const teardown = seeded
    ? async () => {
        await query(`delete from heat where competition_id = $1`, [
          competitionId,
        ]);
        await query(`delete from entrant where competition_id = $1`, [
          competitionId,
        ]);
      }
    : async () => {
        await query(`delete from competition where id = $1`, [competitionId]);
      };
  try {
    const participants = await query<{ id: string }>(
      `select id from participant where war_week_id = $1 order by display_name limit 8`,
      [warWeek.id],
    );
    if (participants.length < 8) {
      throw new Error(
        `${warWeek.edition} needs at least 8 Participants for the Bracket demo`,
      );
    }
    const entrantIds: string[] = [];
    for (const [i, p] of participants.entries()) {
      const [entrant] = await query<{ id: string }>(
        `insert into entrant (competition_id, participant_id, seed_position)
         values ($1, $2, $3) returning id`,
        [competitionId, p.id, i + 1],
      );
      entrantIds.push(entrant.id);
    }
    const [e1, e2, e3, e4, e5, e6, e7, e8] = entrantIds;
    const [finalHeat] = await query<{ id: string }>(
      `insert into heat (competition_id, round, position, status, slot_count)
       values ($1, 2, 1, 'played', 4) returning id`,
      [competitionId],
    );
    const [heatA] = await query<{ id: string }>(
      `insert into heat (competition_id, round, position, status, slot_count)
       values ($1, 1, 1, 'played', 4) returning id`,
      [competitionId],
    );
    const [heatB] = await query<{ id: string }>(
      `insert into heat (competition_id, round, position, status, slot_count)
       values ($1, 1, 2, 'played', 4) returning id`,
      [competitionId],
    );
    await query(
      `insert into heat_entrant (heat_id, entrant_id, slot, place) values
         ($1, $2, 0, 1), ($1, $3, 1, 2), ($1, $4, 2, 3), ($1, $5, 3, 4),
         ($6, $7, 0, 1), ($6, $8, 1, 2), ($6, $9, 2, 3), ($6, $10, 3, 4),
         ($11, $2, 0, 1), ($11, $7, 1, 2), ($11, $3, 2, 3), ($11, $8, 3, 4)`,
      [heatA.id, e1, e2, e3, e4, heatB.id, e5, e6, e7, e8, finalHeat.id],
    );
    // Every played Heat was recorded, so the still shows "Recorded <time>"
    // on its card.
    await query(
      `update heat set recorded_at = '2026-02-21T19:00:00-05:00'
       where competition_id = $1`,
      [competitionId],
    );
    note(
      `bracket demo: ${seeded ? "seeded" : "added"} competition ${competitionId}, Winner entrant ${e1}`,
    );
  } catch (error) {
    await teardown();
    throw error;
  }
  return { competitionId, teardown };
}
