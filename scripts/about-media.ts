/**
 * Writes the About page's media (tickets 28, 03, 04) from the seeded demo,
 * never by hand: `public/about/finale-poster.png` (War Week XI's Finale on
 * a phone, mid-countdown; a still only — no Finale video is written or
 * shown), the hero's `standings-before.png` / `standings-entry.png` /
 * `standings-after.png` (an Organizer's real Points Entry moving the home
 * Standings), and one still per feature card at `public/about/<slug>.png`.
 * Afterwards it screenshots `/about` as an anonymous visitor at 390px,
 * desktop and with reduced motion into `test-results/28-splash/`, with a
 * log.
 *
 * Needs a production build and a freshly seeded local Postgres, the same
 * prerequisite as `docs/maintainers-guide.md` (`pnpm build`, then
 * `pnpm seed:load --reset seeds/*.json && pnpm seed:demo`), and Google
 * Chrome. Starts its own server on port 3202, signs in as a made-up Organizer
 * (`about-demo@jahnelgroup.com`) that it adds to the Organizer list and
 * lends XI's seeded Points Entries for the run, so no real email is in any
 * file, and restores everything after, including the one Points Entry the
 * Standings hero saves:
 *   pnpm tsx scripts/about-media.ts
 *
 * `--stills` rewrites the feature-card and Standings-hero stills and
 * leaves the Finale poster alone:
 *   pnpm tsx scripts/about-media.ts --stills
 */
import { loadEnvConfig } from "@next/env";
import { makeSignature } from "better-auth/crypto";
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "pg";

import { ABOUT_FEATURES, STATIC_PAGE_THEME } from "@/lib/about";
import { DISPLAY_STORAGE_KEY } from "@/lib/display";
import { FINALE_MAX_MS } from "@/lib/finale";
import { backgroundColorScheme } from "@/lib/theme";
import type { LeaderboardResult } from "@/mcp/leaderboard";
import { DEMO_SEED } from "@/seed/local-files";

loadEnvConfig(process.cwd());

const PORT = 3202;
const BASE_URL = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = 9304;
const MEDIA = path.resolve(process.cwd(), "public/about");
const EVIDENCE = path.resolve(process.cwd(), "test-results/28-splash");
const AUTH_SECRET = `about-media-secret-${randomUUID()}`;
const DEMO_EMAIL = "about-demo@jahnelgroup.com";
const STILL = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
/**
 * Every still and the Finale poster wear XI's base palette, the scheme its
 * Organizer designed, not whatever this Chrome's OS happens to be set to
 * (it has no stored `ww:display`, so under System it would follow the Mac).
 * Pinned per page via `Page.addScriptToEvaluateOnNewDocument`, never
 * `Emulation.setEmulatedMedia` (the reduced-motion capture below replaces
 * its feature list wholesale, which would drop an earlier media pin).
 */
const PINNED_DISPLAY = backgroundColorScheme(STATIC_PAGE_THEME.backgroundColor);
/** Around the Finale: this much of the Start screen before, and after. */
const LEAD_IN_MS = 2_500;
const HOLD_MS = 3_500;
/** A time inside XI's week for the Now / Next still (ET). */
const SCHEDULE_AT = "2026-02-24T12:15:00-05:00";

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log: string[] = [];
const note = (line: string) => {
  console.log(line);
  log.push(line);
};

// ---------------------------------------------------------------------------
// Database

async function query<T = Record<string, unknown>>(
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

async function createSession(email: string): Promise<string> {
  const userId = `smoke-${randomUUID()}`;
  const token = `smoke-${randomUUID()}`;
  await query(`delete from "user" where email = $1`, [email]);
  await query(
    `insert into "user" (id, name, email, email_verified) values ($1, 'About demo', $2, true)`,
    [userId, email],
  );
  await query(
    `insert into session (id, token, user_id, expires_at) values ($1, $2, $3, now() + interval '1 hour')`,
    [`smoke-${randomUUID()}`, token, userId],
  );
  return encodeURIComponent(
    `${token}.${await makeSignature(token, AUTH_SECRET)}`,
  );
}

/** The seeded Organizer, whose email must not appear in any file written. */
function seededOrganizerEmail(): string {
  const seed = JSON.parse(
    readFileSync(path.resolve(process.cwd(), DEMO_SEED), "utf8"),
  ) as { organizers: string[] };
  return seed.organizers[0];
}

// ---------------------------------------------------------------------------
// Chrome DevTools Protocol

type Handler = (params: Record<string, unknown>) => void;

/** A minimal CDP client for one page, with events. */
class Page {
  private nextId = 1;
  private pending = new Map<
    number,
    { resolve: (r: unknown) => void; reject: (e: unknown) => void }
  >();
  private handlers = new Map<string, Handler[]>();

  private constructor(
    private ws: WebSocket,
    readonly targetId: string,
  ) {
    ws.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id !== undefined) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error)
          pending.reject(new Error(JSON.stringify(message.error)));
        else pending.resolve(message.result);
        return;
      }
      for (const handler of this.handlers.get(message.method) ?? []) {
        handler(message.params ?? {});
      }
    });
  }

  static async open(display: "light" | "dark" = PINNED_DISPLAY): Promise<Page> {
    const target = (await (
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?about:blank`, {
        method: "PUT",
      })
    ).json()) as { id: string; webSocketDebuggerUrl: string };
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const page = new Page(ws, target.id);
    await page.send("Page.enable");
    await page.send("Network.enable");
    await page.send("Runtime.enable");
    await page.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try{localStorage.setItem(${JSON.stringify(DISPLAY_STORAGE_KEY)},${JSON.stringify(display)})}catch(e){}`,
    });
    return page;
  }

  on(method: string, handler: Handler) {
    this.handlers.set(method, [...(this.handlers.get(method) ?? []), handler]);
  }

  send<T = Record<string, unknown>>(
    method: string,
    params: Record<string, unknown> = {},
  ): Promise<T> {
    const id = this.nextId++;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) =>
      this.pending.set(id, {
        resolve: resolve as (r: unknown) => void,
        reject,
      }),
    );
  }

  async evaluate<T>(expression: string): Promise<T> {
    const { result } = await this.send<{ result: { value: T } }>(
      "Runtime.evaluate",
      { expression, returnByValue: true, awaitPromise: true },
    );
    return result.value;
  }

  async viewport(
    size: { width: number; height: number },
    mobile: boolean,
    scale = 2,
  ) {
    await this.send("Emulation.setDeviceMetricsOverride", {
      width: size.width,
      height: size.height,
      deviceScaleFactor: scale,
      mobile,
    });
  }

  async cookie(value: string) {
    await this.send("Network.setCookie", {
      name: "better-auth.session_token",
      value,
      url: BASE_URL,
      httpOnly: true,
    });
  }

  async goto(target: string, settleMs = 2_500) {
    await this.send("Page.navigate", {
      url: target.startsWith("data:") ? target : `${BASE_URL}${target}`,
    });
    await sleep(settleMs);
  }

  /** Scrolls through the page so lazy images load, then back to the top. */
  async loadLazyImages() {
    await this.evaluate(`(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, 0);
      await Promise.all(Array.from(document.images).map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
      return document.images.length;
    })()`);
    await sleep(500);
  }

  async screenshot(file: string, fullPage = false) {
    if (fullPage) await this.loadLazyImages();
    const clip = fullPage
      ? await this.send<{
          contentSize: { width: number; height: number };
        }>("Page.getLayoutMetrics").then(({ contentSize }) => ({
          x: 0,
          y: 0,
          width: contentSize.width,
          height: contentSize.height,
          scale: 1,
        }))
      : undefined;
    const { data } = await this.send<{ data: string }>(
      "Page.captureScreenshot",
      { format: "png", clip, captureBeyondViewport: fullPage },
    );
    writeFileSync(file, Buffer.from(data, "base64"));
  }

  async close() {
    this.ws.close();
    await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/close/${this.targetId}`);
  }
}

function launchChrome(): { process: ChildProcess; dir: string } {
  const dir = mkdtempSync(path.join(os.tmpdir(), "about-media-"));
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      `--remote-debugging-port=${DEBUG_PORT}`,
      `--user-data-dir=${dir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--autoplay-policy=no-user-gesture-required",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  return { process: child, dir };
}

async function waitForChrome() {
  for (let i = 0; i < 50; i++) {
    await sleep(200);
    try {
      await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      return;
    } catch {
      // not up yet
    }
  }
  throw new Error("Chrome did not start");
}

/**
 * Every capture is checked first: the only email allowed on screen is the
 * made-up demo Organizer's, so no real address lands in a committed file.
 */
async function assertNoRealEmail(page: Page, what: string) {
  const emails = await page.evaluate<string[]>(
    `Array.from(new Set(document.body.innerText.match(/[\\w.+-]+@[\\w-]+\\.[\\w.-]+/g) ?? []))`,
  );
  const others = emails.filter((e) => e.toLowerCase() !== DEMO_EMAIL);
  if (others.length > 0) {
    throw new Error(`${what}: a real email is on screen: ${others.join(", ")}`);
  }
}

// ---------------------------------------------------------------------------
// The Finale recording

type Frame = { at: number; data: string };

async function recordFinale(cookie: string) {
  const page = await Page.open();
  // The screencast sends CSS-pixel frames whatever the device scale, so
  // the page is laid out at 390px inside a doubled viewport, zoomed 2x.
  await page.viewport(
    { width: PHONE.width * 2, height: PHONE.height * 2 },
    true,
    1,
  );
  await page.cookie(cookie);
  await page.goto("/xi/finale", 3_000);
  await page.evaluate(`(document.documentElement.style.zoom = "2")`);
  await sleep(500);
  await assertNoRealEmail(page, "finale");

  const frames: Frame[] = [];
  page.on("Page.screencastFrame", (params) => {
    frames.push({ at: Date.now(), data: params.data as string });
    void page.send("Page.screencastFrameAck", {
      sessionId: params.sessionId,
    });
  });
  await page.send("Page.startScreencast", {
    format: "png",
    everyNthFrame: 1,
    maxWidth: PHONE.width * 2,
    maxHeight: PHONE.height * 2,
  });
  await sleep(LEAD_IN_MS);

  const pressedAt = Date.now();
  await page.evaluate(
    `Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === "Start")?.click()`,
  );
  let startedAt: number | null = null;
  while (Date.now() - pressedAt < 20_000 && startedAt === null) {
    const value = await page.evaluate<string | null>(
      `document.querySelector("[data-finale-started-at]")?.dataset.finaleStartedAt ?? null`,
    );
    if (value) startedAt = Number(value);
    else await sleep(100);
  }
  if (startedAt === null) throw new Error("the Finale never started");
  note(`finale: countdown started ${startedAt - pressedAt} ms after Start`);
  await sleep(FINALE_MAX_MS + HOLD_MS);
  await page.send("Page.stopScreencast");
  await page.close();

  // Keep the lead-in before the Finale and the hold after it; a frame only
  // arrives when something changes, so each one lasts until the next.
  const from = startedAt - LEAD_IN_MS;
  const to = startedAt + FINALE_MAX_MS + HOLD_MS;
  const before = frames.filter((f) => f.at <= from).at(-1);
  const kept = [
    ...(before ? [{ ...before, at: from }] : []),
    ...frames.filter((f) => f.at > from && f.at <= to),
  ];
  if (kept.length < 10) {
    throw new Error(`only ${kept.length} frames recorded around the Finale`);
  }
  note(`finale: ${frames.length} frames captured, ${kept.length} kept`);

  // Only the poster still is kept; no Finale video is written or shown.
  writeFileSync(
    path.join(MEDIA, "finale-poster.png"),
    Buffer.from(kept[0].data, "base64"),
  );
}

// ---------------------------------------------------------------------------
// A finished Heats Bracket for the "brackets" still

const BRACKET_COMP_NAME = "Capture the Flag";

/**
 * Builds a small, already-finished Heats Bracket on XI (8 Participant
 * Entrants, 4 per Heat with the top 2 advancing, two Round 1 Heats and a
 * decided Final) directly in SQL: the Competition, its Entrants at Seed
 * Positions 1–8, and each Heat with its slots and places. The caller deletes
 * the Competition (which cascades its Entrants and Heats) when done.
 */
async function setupBracketDemo(): Promise<string> {
  const [xiWarWeek] = await query<{ id: string }>(
    `select id from war_week where edition = 'xi'`,
  );
  const [comp] = await query<{ id: string }>(
    `insert into competition (war_week_id, name, scoring, format, bracket_config)
     values ($1, $2, 'individual', 'heats', $3) returning id`,
    [
      xiWarWeek.id,
      BRACKET_COMP_NAME,
      { entrantsPerHeat: 4, advancePerHeat: 2 },
    ],
  );
  const competitionId = comp.id;
  const participants = await query<{ id: string }>(
    `select id from participant where war_week_id = $1 order by display_name limit 8`,
    [xiWarWeek.id],
  );
  if (participants.length < 8) {
    throw new Error("XI needs at least 8 Participants for the Bracket demo");
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
  // One Heat's time and place, so the still shows a when-line
  // ("Sunday, Feb 22 · 7:00 PM ET · Main room") on its card.
  await query(
    `update heat set day_id = (select id from day where war_week_id = $2 order by date limit 1),
       start_time = '19:00', location = 'Main room'
     where id = $1`,
    [heatA.id, xiWarWeek.id],
  );
  note(`bracket demo: competition ${competitionId}, champion entrant ${e1}`);
  return competitionId;
}

async function teardownBracketDemo(competitionId: string) {
  await query(`delete from competition where id = $1`, [competitionId]);
}

// ---------------------------------------------------------------------------
// The stills

async function still(
  slug: string,
  cookie: string | null,
  target: string,
  prepare?: (page: Page) => Promise<void>,
  viewport: { width: number; height: number } = STILL,
) {
  const page = await Page.open();
  await page.viewport(viewport, viewport === PHONE);
  if (cookie) await page.cookie(cookie);
  await page.goto(target);
  if (prepare) await prepare(page);
  await assertNoRealEmail(page, slug);
  await page.screenshot(path.join(MEDIA, `${slug}.png`));
  await page.close();
  note(
    `still: ${slug} from ${target.startsWith("data:") ? "a rendered card" : target}`,
  );
}

/**
 * Picks an option in one of the Points Entry form's `EntityCombobox`
 * fields the way a person does: focus it by its `aria-label`, type the
 * name, and choose the matching option.
 */
async function selectComboboxOption(
  page: Page,
  ariaLabel: string,
  name: string,
): Promise<string> {
  await page.evaluate(
    `document.querySelector('input[aria-label="${ariaLabel}"]').focus()`,
  );
  await page.send("Input.insertText", { text: name });
  await sleep(500);
  const picked = await page.evaluate<string | null>(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((o) => o.innerText.includes(${JSON.stringify(name)}));
    option?.click();
    return option ? option.innerText : null;
  })()`);
  if (!picked) throw new Error(`no ${ariaLabel} option for ${name}`);
  return picked;
}

/** Picks a Competition in the Points Entry form's combobox. */
async function selectCompetition(page: Page, name: string): Promise<string> {
  return selectComboboxOption(page, "Competition", name);
}

const scrollToText = (text: string) => `(() => {
  const el = Array.from(document.querySelectorAll('section, h2, [data-slot="card"]')).find((e) => e.innerText.toLowerCase().includes(${JSON.stringify(text)}.toLowerCase()));
  el?.scrollIntoView({ block: "start" });
  window.scrollBy(0, -16);
  return Boolean(el);
})()`;

/** The real `get_leaderboard` answer from `/api/mcp`, as a signed-in user. */
async function askMcp(cookie: string): Promise<LeaderboardResult> {
  const call = async (body: Record<string, unknown>, sessionId?: string) => {
    const res = await fetch(`${BASE_URL}/api/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        cookie: `better-auth.session_token=${cookie}`,
        ...(sessionId ? { "mcp-session-id": sessionId } : {}),
      },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    const data = (res.headers.get("content-type") ?? "").includes(
      "event-stream",
    )
      ? text
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .filter(Boolean)
          .at(-1)
      : text;
    return {
      json: data ? (JSON.parse(data) as Record<string, unknown>) : undefined,
      sessionId: res.headers.get("mcp-session-id") ?? undefined,
    };
  };
  const init = await call({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "about-media", version: "0.1.0" },
    },
  });
  const answer = await call(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "get_leaderboard", arguments: { kind: "team" } },
    },
    init.sessionId,
  );
  const text = (
    answer.json?.result as { content?: { text: string }[] } | undefined
  )?.content?.[0]?.text;
  if (!text) throw new Error("get_leaderboard returned nothing");
  return JSON.parse(text) as LeaderboardResult;
}

const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!,
  );

/**
 * A chat card in XI's theme: the question, then Claude's answer written
 * from the real tool result, with the tool call shown underneath.
 */
function chatCardUrl(result: LeaderboardResult): string {
  const answer = `<p>${escapeHtml(result.teamLabel)} Standings for War Week XI right now:</p><ol>${result.standings
    .slice(0, 5)
    .map(
      (row) =>
        `<li><span class="dot" style="background:${"color" in row ? escapeHtml(row.color) : "#888"}"></span><b>${escapeHtml(row.name)}</b><span class="pts">${row.total} pts</span></li>`,
    )
    .join(
      "",
    )}</ol><p>${escapeHtml(result.standings[0]?.name ?? "")} lead${result.standings.length > 1 ? `, ${result.standings[0].total - result.standings[1].total} points ahead of ${escapeHtml(result.standings[1].name)}` : ""}.</p>`;
  const t = STATIC_PAGE_THEME;
  return `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;height:100%;background:${t.backgroundColor};color:${t.foregroundColor};font:16px/1.5 ui-monospace,"JetBrains Mono",Menlo,monospace}
  body{display:flex;align-items:center;justify-content:center;background:radial-gradient(ellipse at top,color-mix(in oklch,${t.primaryColor} 18%,transparent),transparent 60%),${t.backgroundColor}}
  .chat{width:760px;display:flex;flex-direction:column;gap:24px;zoom:1.5}
  .msg{max-width:80%;padding:16px 20px;border-radius:18px;border:1px solid ${t.accentColor}}
  .you{align-self:flex-end;background:${t.primaryColor};color:${t.primaryForegroundColor};border-color:${t.primaryColor}}
  .claude{align-self:flex-start;background:color-mix(in oklch,${t.backgroundColor} 85%,${t.accentColor})}
  .claude p{margin:0 0 8px}.claude ol{margin:0 0 12px;padding-left:24px}.claude li{margin:4px 0;display:flex;align-items:center;gap:10px}
  .dot{width:12px;height:12px;border-radius:50%;display:inline-block;border:1px solid rgba(255,255,255,.3)}
  .pts{margin-left:auto;opacity:.7}
  .tool{font-size:12px;opacity:.6;margin-top:12px;border-top:1px dashed ${t.accentColor};padding-top:8px}
  .who{font-size:12px;letter-spacing:.2em;text-transform:uppercase;opacity:.6;margin-bottom:6px}
  </style></head><body><div class="chat">
  <div class="msg you"><div class="who">You</div>Who's winning War Week XI?</div>
  <div class="msg claude"><div class="who">Claude</div>${answer}<div class="tool">jg-war-week · get_leaderboard(kind: "team")</div></div>
  </div></body></html>`)}`;
}

// ---------------------------------------------------------------------------
// A logged Game for the "games" still (R3)

/** The seeded head-to-head, open-to-everyone `games` Competition on XI. */
const GAMES_COMP_NAME = "Bouncy Pong";

/** Bouncy Pong's id and two Participant names to log a Game between. */
async function findGamesDemo(): Promise<{
  competitionId: string;
  playerA: string;
  playerB: string;
}> {
  const [comp] = await query<{ id: string }>(
    `select c.id from competition c
     join war_week w on w.id = c.war_week_id
     where w.edition = 'xi' and c.name = $1`,
    [GAMES_COMP_NAME],
  );
  if (!comp) {
    throw new Error(`no seeded "${GAMES_COMP_NAME}" Competition on XI`);
  }
  const [xiWarWeek] = await query<{ id: string }>(
    `select id from war_week where edition = 'xi'`,
  );
  const participants = await query<{ display_name: string }>(
    `select display_name from participant where war_week_id = $1
     order by display_name limit 2`,
    [xiWarWeek.id],
  );
  if (participants.length < 2) {
    throw new Error("XI needs at least 2 Participants for the Games demo");
  }
  return {
    competitionId: comp.id,
    playerA: participants[0].display_name,
    playerB: participants[1].display_name,
  };
}

/**
 * Picks `name` in a combobox found by its `<label for>` text (the Game
 * form's fields have no `aria-label`, unlike the Points Entry form's).
 */
async function selectLabeledCombobox(
  page: Page,
  labelText: string,
  name: string,
): Promise<string> {
  const inputId = await page.evaluate<string | null>(`(() => {
    const label = Array.from(document.querySelectorAll("label")).find((l) => l.textContent?.trim() === ${JSON.stringify(labelText)});
    return label ? label.getAttribute("for") : null;
  })()`);
  if (!inputId) throw new Error(`no field labeled "${labelText}"`);
  await page.evaluate(
    `document.getElementById(${JSON.stringify(inputId)})?.focus()`,
  );
  await page.send("Input.insertText", { text: name });
  await sleep(500);
  const picked = await page.evaluate<string | null>(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((o) => o.innerText.includes(${JSON.stringify(name)}));
    option?.click();
    return option ? option.innerText : null;
  })()`);
  if (!picked) throw new Error(`no "${labelText}" option for ${name}`);
  return picked;
}

/**
 * Logs one head-to-head Game on Bouncy Pong through the real Game form (the
 * `logGame` action, as the demo Organizer): opens "Log a Game" from the
 * Competition page, picks both players and who won, and saves. Returns the
 * logged Game's id so the caller can undo it in `finally`.
 */
async function captureGamesDemo(cookie: string): Promise<{
  gameId: string;
  competitionId: string;
}> {
  const { competitionId, playerA, playerB } = await findGamesDemo();
  const page = await Page.open();
  await page.viewport(STILL, false);
  await page.cookie(cookie);
  await page.goto(`/xi/competitions/${competitionId}`);

  const opened = await page.evaluate<boolean>(
    `(() => { const b = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === "Log a Game"); b?.click(); return Boolean(b); })()`,
  );
  if (!opened) throw new Error('no "Log a Game" button on Bouncy Pong');
  await sleep(500);

  await selectLabeledCombobox(page, "Player A", playerA);
  await selectLabeledCombobox(page, "Player B", playerB);
  const wonLabel = `${playerA} won`;
  const wonPicked = await page.evaluate<boolean>(`(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === ${JSON.stringify(wonLabel)});
    button?.click();
    return Boolean(button);
  })()`);
  if (!wonPicked) throw new Error(`no "${wonLabel}" button in the Game form`);
  await sleep(300);

  const submitted = await page.evaluate<boolean>(
    `(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) => b.innerText.trim() === "Log Game"); b?.click(); return Boolean(b); })()`,
  );
  if (!submitted) throw new Error('no "Log Game" submit button');

  let saved = false;
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const stillOpen = await page.evaluate<boolean>(
      `document.body.innerText.includes("Choose both players and who won.")`,
    );
    if (!stillOpen) {
      saved = true;
      break;
    }
  }
  if (!saved) throw new Error("the demo Game never finished saving");

  // The TopNav is `sticky top-0` (`primary-nav.tsx:164`), so scrolling the
  // Competition's `h1` to the frame's top hides it under the header; scroll
  // to the very top instead and frame wide enough to hold the title, the
  // Leaderboard and the first Game row together (ticket 26).
  await page.evaluate(`window.scrollTo(0, 0)`);
  await sleep(300);

  const measureGamesFrame = `(() => {
    const h1 = document.querySelector("h1");
    const header = document.querySelector("header");
    const gamesHeading = Array.from(document.querySelectorAll("h2")).find(
      (h) => h.textContent?.trim() === "Games",
    );
    const row = gamesHeading?.parentElement?.nextElementSibling?.querySelector("li");
    if (!h1 || !header || !row) return null;
    return {
      h1Top: h1.getBoundingClientRect().top,
      headerBottom: header.getBoundingClientRect().bottom,
      rowBottom: row.getBoundingClientRect().bottom,
      innerHeight: window.innerHeight,
    };
  })()`;

  const gamesFrames = [
    { width: 1600, height: 900, scale: 1.6 },
    { width: 1920, height: 1080, scale: 1.3333 },
  ];
  let usedGamesFrame: (typeof gamesFrames)[number] | null = null;
  let gamesMeasurement: Record<string, number> | null = null;
  for (const frame of gamesFrames) {
    await page.viewport(
      { width: frame.width, height: frame.height },
      false,
      frame.scale,
    );
    await sleep(300);
    gamesMeasurement = await page.evaluate<Record<string, number> | null>(
      measureGamesFrame,
    );
    if (
      gamesMeasurement &&
      gamesMeasurement.h1Top >= gamesMeasurement.headerBottom &&
      gamesMeasurement.rowBottom <= gamesMeasurement.innerHeight
    ) {
      usedGamesFrame = frame;
      break;
    }
  }
  if (!usedGamesFrame) {
    throw new Error(
      `games still: the Competition name or first Game row never fit either frame: ${JSON.stringify(gamesMeasurement)}`,
    );
  }
  note(
    `games: frame ${usedGamesFrame.width}x${usedGamesFrame.height}@${usedGamesFrame.scale} used ` +
      `(h1 top ${gamesMeasurement?.h1Top}, header bottom ${gamesMeasurement?.headerBottom}, ` +
      `first Game row bottom ${gamesMeasurement?.rowBottom}, viewport height ${gamesMeasurement?.innerHeight})`,
  );
  // The "Game logged" toast would sit over the still: wait it out.
  let toastGone = false;
  for (let i = 0; i < 75; i++) {
    toastGone = await page.evaluate<boolean>(
      `document.querySelector("[data-sonner-toast]") === null`,
    );
    if (toastGone) break;
    await sleep(200);
  }
  if (!toastGone) throw new Error('the "Game logged" toast never went away');
  await assertNoRealEmail(page, "games");
  await page.screenshot(path.join(MEDIA, "games.png"));
  note(`still: games from /xi/competitions/${competitionId}, one Game logged`);
  await page.close();

  const [row] = await query<{ id: string }>(
    `select id from game where competition_id = $1 and logged_by_email = $2
     order by created_at desc limit 1`,
    [competitionId, DEMO_EMAIL],
  );
  if (!row) throw new Error("could not find the demo Game to undo");
  return { gameId: row.id, competitionId };
}

/** Undoes the one Game `captureGamesDemo` logged. */
async function teardownGamesDemo(gameId: string) {
  await query(`delete from game where id = $1`, [gameId]);
}

// ---------------------------------------------------------------------------
// The About hero: Standings moving after a Points Entry (ticket 04)

/**
 * The competition the hero uses to move the home Standings: team-scored,
 * with no Max points cap, so any margin needed to move the last-place Team
 * into first saves without a warning.
 */
const STANDINGS_DEMO_COMPETITION = "Beast Mode Workout";

/**
 * Three stills for the About page's hero (ticket 04): the home Standings
 * before, the Points Entry form about to save a big win for the Team
 * currently in last place, and the same home Standings right after,
 * reordered. Uses the real Points Entry form and the real `get_leaderboard`
 * MCP tool to read the Team Standings, not a hand-crafted fixture.
 */
async function captureStandingsDemo(cookie: string): Promise<string> {
  await still(
    "standings-before",
    cookie,
    "/xi/leaderboard",
    () => sleep(500),
    PHONE,
  );

  const before = await askMcp(cookie);
  const last = before.standings.at(-1);
  const first = before.standings[0];
  if (!last || !first || before.standings.length < 2) {
    throw new Error("need at least two Teams for the Standings demo");
  }
  // Enough to overtake first place outright, so the reorder is unmistakable.
  const margin = Math.max(first.total - last.total + 15, 15);
  note(
    `standings demo: moving ${JSON.stringify(last.name)} from last (${last.total}) past first (${first.total}) with +${margin}`,
  );

  const page = await Page.open();
  await page.viewport(PHONE, true);
  await page.cookie(cookie);
  await page.goto("/admin/points");
  await selectCompetition(page, STANDINGS_DEMO_COMPETITION);
  await sleep(300);
  await selectComboboxOption(page, before.teamLabel, last.name);
  await page.evaluate(`document.querySelector('#points-entry-points').focus()`);
  await page.send("Input.insertText", { text: String(margin) });
  await sleep(400);
  await assertNoRealEmail(page, "standings-entry");
  await page.screenshot(path.join(MEDIA, "standings-entry.png"));
  note("still: standings-entry from /admin/points, filled in");

  await page.evaluate(
    `document.querySelector('form[aria-label="Points Entry"] button[type="submit"]').click()`,
  );
  let saved = false;
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const text = await page.evaluate<string>(
      `document.querySelector('form[aria-label="Points Entry"] button[type="submit"]')?.innerText ?? ""`,
    );
    if (text === "Add Points Entry") {
      saved = true;
      break;
    }
  }
  if (!saved) throw new Error("the demo Points Entry never finished saving");
  await page.close();

  await still(
    "standings-after",
    cookie,
    "/xi/leaderboard",
    () => sleep(500),
    PHONE,
  );

  const after = await askMcp(cookie);
  const lastAfter = after.standings.find((row) => row.name === last.name);
  note(
    `standings demo: ${JSON.stringify(last.name)} is now #${
      after.standings.findIndex((row) => row.name === last.name) + 1
    } of ${after.standings.length} (${lastAfter?.total} pts)`,
  );
  if (after.standings[0]?.name !== last.name) {
    throw new Error("the demo Points Entry did not move the Team to first");
  }

  const [entry] = await query<{ id: string }>(
    `select id from points_entry where entered_by_email = $1 order by created_at desc limit 1`,
    [DEMO_EMAIL],
  );
  if (!entry) throw new Error("could not find the demo Points Entry to undo");
  return entry.id;
}

/** Undoes the one Points Entry `captureStandingsDemo` created. */
async function teardownStandingsDemo(entryId: string) {
  await query(`delete from points_entry where id = $1`, [entryId]);
}

// ---------------------------------------------------------------------------
// Evidence: /about as an anonymous visitor

async function evidence() {
  const phone = await Page.open();
  await phone.viewport(PHONE, true);
  await phone.goto("/about", 3_000);
  const status = await phone.evaluate<string>(`location.pathname`);
  note(`evidence: anonymous /about landed on ${status}`);
  if (status !== "/about") throw new Error("anonymous /about was redirected");
  await assertNoRealEmail(phone, "about");
  await phone.screenshot(path.join(EVIDENCE, "about-390.png"), true);
  const broken = await phone.evaluate<number>(
    `Array.from(document.images).filter((img) => img.complete && img.naturalWidth === 0).length`,
  );
  note(`evidence: images that failed to load on /about: ${broken}`);
  if (broken > 0) throw new Error("an About page image failed to load");
  await phone.close();

  const desktop = await Page.open();
  await desktop.viewport({ width: 1440, height: 900 }, false, 1);
  await desktop.goto("/about", 3_000);
  const hero = await desktop.evaluate<Record<string, unknown>>(
    `(() => { const imgs = Array.from(document.querySelectorAll('[data-standings-step]')); return { steps: imgs.map((i) => i.dataset.standingsStep), loaded: imgs.every((i) => i.complete && i.naturalWidth > 0), finalePoster: document.querySelector('img[src="/about/finale-poster.png"]') !== null, noVideo: document.querySelector("video") === null }; })()`,
  );
  note(`evidence: desktop hero ${JSON.stringify(hero)}`);
  if (!hero.noVideo)
    throw new Error("the About page hero must be stills, not a video");
  await desktop.screenshot(path.join(EVIDENCE, "about-desktop.png"), true);

  const desktopLight = await Page.open("light");
  await desktopLight.viewport({ width: 1440, height: 900 }, false, 1);
  await desktopLight.goto("/about", 3_000);
  await assertNoRealEmail(desktopLight, "about-light");
  await desktopLight.screenshot(
    path.join(EVIDENCE, "about-desktop-light.png"),
    true,
  );
  await desktopLight.close();
  note("evidence: /about desktop captured under the light Display");

  await desktop.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(500);
  await desktop.screenshot(
    path.join(EVIDENCE, "about-desktop-reduced-motion.png"),
  );
  await desktop.close();

  // /about now reads the current War Week (ticket 03), so it must be
  // dynamic, not prerendered at build with a stale one.
  const prerendered = existsSync(
    path.resolve(process.cwd(), ".next/server/app/about.html"),
  );
  note(
    `evidence: /about prerendered at build (.next/server/app/about.html exists): ${prerendered}`,
  );
  if (prerendered)
    throw new Error(
      "/about was statically prerendered: it must read the current War Week dynamically",
    );
}

// ---------------------------------------------------------------------------

/** Only the feature-card and Standings-hero stills; the Finale poster stays as it is. */
const STILLS_ONLY = process.argv.includes("--stills");

async function main() {
  if (!existsSync(path.resolve(process.cwd(), ".next/BUILD_ID"))) {
    console.error("No production build in .next: run `pnpm build` first.");
    process.exit(1);
  }
  if (
    await fetch(BASE_URL).then(
      () => true,
      () => false,
    )
  ) {
    throw new Error(`something is already listening on ${BASE_URL}`);
  }
  mkdirSync(MEDIA, { recursive: true });
  rmSync(EVIDENCE, { recursive: true, force: true });
  mkdirSync(EVIDENCE, { recursive: true });

  const realOrganizer = seededOrganizerEmail();
  await query(
    `insert into organizer (email) values ($1) on conflict (email) do nothing`,
    [DEMO_EMAIL],
  );
  await query(
    `update points_entry set entered_by_email = $1 where entered_by_email = $2 and competition_id in (select id from competition where war_week_id = (select id from war_week where edition = 'xi'))`,
    [DEMO_EMAIL, realOrganizer],
  );
  await query(
    `update announcement set author_email = $1 where author_email = $2 and war_week_id = (select id from war_week where edition = 'xi')`,
    [DEMO_EMAIL, realOrganizer],
  );
  const cookie = await createSession(DEMO_EMAIL);
  const bracketCompetitionId = await setupBracketDemo();

  const server = spawn("pnpm", ["start", "-p", String(PORT)], {
    env: {
      ...process.env,
      BETTER_AUTH_SECRET: AUTH_SECRET,
      BETTER_AUTH_URL: BASE_URL,
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
      MCP_TOKEN: "",
    },
    stdio: "ignore",
    detached: true,
  });
  const chrome = launchChrome();
  let standingsEntryId: string | undefined;
  let gamesDemoGameId: string | undefined;

  try {
    for (let i = 0; i < 60; i++) {
      await sleep(500);
      if (
        await fetch(`${BASE_URL}/sign-in`).then(
          (r) => r.ok,
          () => false,
        )
      )
        break;
    }
    await waitForChrome();

    standingsEntryId = await captureStandingsDemo(cookie);

    if (!STILLS_ONLY) await recordFinale(cookie);

    const slugs = ABOUT_FEATURES.map((f) => f.slug);
    await still("organizer-setup", cookie, "/admin/setup");
    await still("points", cookie, "/admin/points", async (page) => {
      const picked = await selectCompetition(page, "Settlers of Catan");
      await sleep(500);
      const presets = await page.evaluate<number>(
        `document.querySelectorAll('button').length && Array.from(document.querySelectorAll('button')).filter((b) => /^1st/.test(b.innerText)).length`,
      );
      note(
        `points: picked ${picked}, "1st" preset buttons on screen: ${presets}`,
      );
      if (!presets) throw new Error("no Placement Points buttons on screen");
    });
    await still(
      "schedule",
      cookie,
      `/xi?at=${encodeURIComponent(SCHEDULE_AT)}`,
      async (page) => {
        const found = await page.evaluate<boolean>(scrollToText("Today"));
        await sleep(300);
        if (!found) throw new Error("no Now / Next section on the XI home");
      },
    );
    await still("announcements", cookie, "/xi/news", () => sleep(2_000));
    await still(
      "brackets",
      cookie,
      `/xi/competitions/${bracketCompetitionId}`,
      async (page) => {
        const found = await page.evaluate<boolean>(scrollToText("champion"));
        await sleep(300);
        if (!found) throw new Error("no champion card on the Bracket view");
      },
    );
    const gamesDemo = await captureGamesDemo(cookie);
    gamesDemoGameId = gamesDemo.gameId;
    await still("lifecycle", cookie, "/admin/setup", async (page) => {
      const found = await page.evaluate<boolean>(scrollToText("Lifecycle"));
      await sleep(300);
      if (!found) throw new Error("no Lifecycle box on /admin/setup");
    });
    await still("archive", cookie, "/history");
    const result = await askMcp(cookie);
    note(`ask-claude: get_leaderboard rows=${result.standings.length}`);
    await still("ask-claude", null, chatCardUrl(result));

    await evidence();

    for (const name of [
      ...(STILLS_ONLY ? [] : ["finale-poster.png"]),
      "standings-before.png",
      "standings-entry.png",
      "standings-after.png",
      ...slugs.map((s) => `${s}.png`),
    ]) {
      note(
        `wrote public/about/${name}: ${(statSync(path.join(MEDIA, name)).size / 1024).toFixed(0)} KB`,
      );
    }
  } finally {
    chrome.process.kill();
    try {
      if (server.pid) process.kill(-server.pid, "SIGTERM");
    } catch {
      // server already gone
    }
    await sleep(1_000);
    rmSync(chrome.dir, { recursive: true, force: true, maxRetries: 3 });
    if (standingsEntryId) await teardownStandingsDemo(standingsEntryId);
    if (gamesDemoGameId) await teardownGamesDemo(gamesDemoGameId);
    await query(`delete from organizer where email = $1`, [DEMO_EMAIL]);
    await query(
      `update points_entry set entered_by_email = $1 where entered_by_email = $2`,
      [realOrganizer, DEMO_EMAIL],
    );
    await query(
      `update announcement set author_email = $1 where author_email = $2`,
      [realOrganizer, DEMO_EMAIL],
    );
    await query(`delete from "user" where email = $1`, [DEMO_EMAIL]);
    await teardownBracketDemo(bracketCompetitionId);
    writeFileSync(
      path.join(EVIDENCE, "about-media.txt"),
      log.join("\n") + "\n",
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
