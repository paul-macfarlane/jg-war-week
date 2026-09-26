/**
 * Writes the About page's media (ticket 28) from the seeded demo, never by
 * hand: `public/about/finale.mp4` and `finale-poster.png` (War Week XI's
 * Finale on a phone: the Start screen, then the countdown) and one still per feature
 * card at `public/about/<slug>.png`. Afterwards it screenshots `/about` as an
 * anonymous visitor at 390px, desktop and with reduced motion into
 * `test-results/28-splash/`, with a log.
 *
 * Needs a production build, the seeded local Postgres (run `pnpm smoke`
 * first), Google Chrome and ffmpeg on PATH. Starts its own server on port
 * 3202, signs in as a made-up Organizer (`about-demo@jahnelgroup.com`) that
 * it adds to XI's allowlist and lends XI's seeded Points Entries for the
 * run, so no real email is in any file, and restores everything after:
 *   pnpm tsx scripts/about-media.ts
 */
import { loadEnvConfig } from "@next/env";
import { makeSignature } from "better-auth/crypto";
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  copyFileSync,
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

import { ABOUT_FEATURES, ABOUT_THEME } from "@/lib/about";
import { FINALE_MAX_MS } from "@/lib/finale";
import type { LeaderboardResult } from "@/mcp/leaderboard";

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
    readFileSync(path.resolve(process.cwd(), "seeds/xi.json"), "utf8"),
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

  static async open(): Promise<Page> {
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

async function recordFinale(cookie: string, ffmpeg: string) {
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

  const dir = mkdtempSync(path.join(os.tmpdir(), "about-frames-"));
  try {
    const list: string[] = [];
    kept.forEach((frame, i) => {
      const file = path.join(dir, `${String(i).padStart(4, "0")}.png`);
      writeFileSync(file, Buffer.from(frame.data, "base64"));
      const next = kept[i + 1];
      const duration = next ? (next.at - frame.at) / 1000 : HOLD_MS / 1000;
      list.push(`file '${file}'`, `duration ${duration.toFixed(3)}`);
    });
    // The concat demuxer needs the last file repeated to honour its duration.
    list.push(
      `file '${path.join(dir, `${String(kept.length - 1).padStart(4, "0")}.png`)}'`,
    );
    const listFile = path.join(dir, "frames.txt");
    writeFileSync(listFile, list.join("\n") + "\n");
    copyFileSync(
      path.join(dir, "0000.png"),
      path.join(MEDIA, "finale-poster.png"),
    );

    const result = spawnSync(
      ffmpeg,
      [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        listFile,
        "-vf",
        "scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
        "-r",
        "30",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "24",
        "-movflags",
        "+faststart",
        "-an",
        path.join(MEDIA, "finale.mp4"),
      ],
      { stdio: ["ignore", "inherit", "pipe"] },
    );
    if (result.status !== 0) {
      throw new Error(`ffmpeg failed: ${result.stderr?.toString()}`);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// A finished single-elimination Bracket for the "brackets" still

const BRACKET_COMP_NAME = "Capture the Flag";

/**
 * Builds a small, already-finished single-elimination Bracket on XI (4
 * Participant Entrants, two Round 1 Heats and a decided final) directly in
 * SQL, the way `scripts/brackets-evidence.ts` sets its demo Bracket up. The
 * caller deletes the Competition (which cascades its Entrants and Heats)
 * when done.
 */
async function setupBracketDemo(): Promise<string> {
  const [xiWarWeek] = await query<{ id: string }>(
    `select id from war_week where edition = 'xi'`,
  );
  const [comp] = await query<{ id: string }>(
    `insert into competition (war_week_id, name, scoring, format)
     values ($1, $2, 'individual', 'single-elimination') returning id`,
    [xiWarWeek.id, BRACKET_COMP_NAME],
  );
  const competitionId = comp.id;
  const participants = await query<{ id: string }>(
    `select id from participant where war_week_id = $1 order by display_name limit 4`,
    [xiWarWeek.id],
  );
  if (participants.length < 4) {
    throw new Error("XI needs at least 4 Participants for the Bracket demo");
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
  const [e1, e2, e3, e4] = entrantIds;
  const [finalHeat] = await query<{ id: string }>(
    `insert into heat (competition_id, round, position, status)
     values ($1, 2, 1, 'played') returning id`,
    [competitionId],
  );
  const [heatA] = await query<{ id: string }>(
    `insert into heat (competition_id, round, position, status, winner_to_heat_id, winner_to_slot)
     values ($1, 1, 1, 'played', $2, 0) returning id`,
    [competitionId, finalHeat.id],
  );
  const [heatB] = await query<{ id: string }>(
    `insert into heat (competition_id, round, position, status, winner_to_heat_id, winner_to_slot)
     values ($1, 1, 2, 'played', $2, 1) returning id`,
    [competitionId, finalHeat.id],
  );
  await query(
    `insert into heat_entrant (heat_id, entrant_id, slot, place) values
       ($1, $2, 0, 1), ($1, $3, 1, 2),
       ($4, $5, 0, 1), ($4, $6, 1, 2),
       ($7, $2, 0, 1), ($7, $5, 1, 2)`,
    [heatA.id, e1, e4, heatB.id, e2, e3, finalHeat.id],
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
) {
  const page = await Page.open();
  await page.viewport(STILL, false);
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
 * Picks a Competition in the Points Entry form's combobox the way a person
 * does: focus it, type the name, and choose the option.
 */
async function selectCompetition(page: Page, name: string): Promise<string> {
  await page.evaluate(
    `document.querySelector('input[aria-label="Competition"]').focus()`,
  );
  await page.send("Input.insertText", { text: name });
  await sleep(500);
  const picked = await page.evaluate<string | null>(`(() => {
    const option = Array.from(document.querySelectorAll('[role="option"]')).find((o) => o.innerText.includes(${JSON.stringify(name)}));
    option?.click();
    return option ? option.innerText : null;
  })()`);
  if (!picked) throw new Error(`no Competition option for ${name}`);
  return picked;
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
  const t = ABOUT_THEME;
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
  const video = await desktop.evaluate<Record<string, unknown>>(
    `(() => { const v = document.querySelector("video"); return { readyState: v.readyState, paused: v.paused, muted: v.muted, loop: v.loop, poster: v.poster.endsWith("/about/finale-poster.png"), videoWidth: v.videoWidth, videoHeight: v.videoHeight, duration: v.duration }; })()`,
  );
  note(`evidence: desktop hero video ${JSON.stringify(video)}`);
  await desktop.screenshot(path.join(EVIDENCE, "about-desktop.png"), true);

  await desktop.send("Emulation.setEmulatedMedia", {
    features: [{ name: "prefers-reduced-motion", value: "reduce" }],
  });
  await sleep(500);
  const reduced = await desktop.evaluate<Record<string, unknown>>(
    `(() => { const v = document.querySelector("video"); const img = document.querySelector('img[src="/about/finale-poster.png"]'); return { videoHidden: getComputedStyle(v).display === "none", posterShown: getComputedStyle(img).display !== "none" }; })()`,
  );
  note(`evidence: reduced motion ${JSON.stringify(reduced)}`);
  await desktop.screenshot(
    path.join(EVIDENCE, "about-desktop-reduced-motion.png"),
  );
  await desktop.close();

  const prerendered = existsSync(
    path.resolve(process.cwd(), ".next/server/app/about.html"),
  );
  note(
    `evidence: /about prerendered at build (.next/server/app/about.html exists): ${prerendered}`,
  );
  if (!prerendered)
    throw new Error("/about was not prerendered: it must stay static");
}

// ---------------------------------------------------------------------------

async function main() {
  if (spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status !== 0) {
    console.error("Install ffmpeg: brew install ffmpeg");
    process.exit(1);
  }
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
    `update war_week set organizer_emails = array_append(organizer_emails, $1) where edition = 'xi' and not ($1 = any(organizer_emails))`,
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

    await recordFinale(cookie, "ffmpeg");

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
      "finale.mp4",
      "finale-poster.png",
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
    await query(
      `update war_week set organizer_emails = array_remove(organizer_emails, $1) where edition = 'xi'`,
      [DEMO_EMAIL],
    );
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
