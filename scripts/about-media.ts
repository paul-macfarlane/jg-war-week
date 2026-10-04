/**
 * Writes the About page's media (tickets 28, 03, 04, 43) from the current
 * War Week's seeded demo, never by hand: `public/about/finale-poster.png`
 * (its Finale's Title slide on a phone, which gives nothing away; a still
 * only — no Finale video is written or shown), the hero's
 * `standings-before.png` / `standings-entry.png` / `standings-after.png`
 * (an Organizer's real Discretionary points moving the home Standings), and one
 * still per feature card at `public/about/<slug>.png`. Every one of them is
 * written twice (the About dark stills fix): `<name>.png` under the light
 * Display and `<name>-dark.png` under the dark one, so `/about` can show
 * the still matching its viewer's Display. Afterwards it screenshots
 * `/about` as an anonymous visitor at 390px, desktop (light and dark) and
 * with reduced motion into `test-results/about-media/`, with a log (and a
 * logged-Game still there as evidence).
 *
 * Every page is the current War Week's (live, else next upcoming, else most
 * recent completed: the same resolution as `/` and `/about`), in its
 * Appearance Theme and Teams or free-for-all mode. Needs a production build,
 * a local Postgres seeded with that edition's demo, and Google Chrome:
 *   pnpm build && pnpm seed:demo:xii
 * (next year, write `seeds/demo/<edition>.json` and use
 * `pnpm seed:demo:<edition>`). Starts its own server on port 3202 (override with
 * `ABOUT_MEDIA_PORT`, and Chrome's debugging port 9304 with
 * `ABOUT_MEDIA_DEBUG_PORT`, when another session uses them), signs in
 * as a made-up Organizer (`about-demo@jahnelgroup.com`) that it adds to the
 * Organizer list and lends the War Week's seeded Points Entries and
 * Announcements for the run, so no real email is in any file, and restores
 * everything after, including the one Points Entry the Standings hero saves:
 *   pnpm tsx scripts/about-media.ts
 *
 * `--stills` rewrites the feature-card and Standings-hero stills (both
 * schemes) and leaves the Finale poster alone (both schemes):
 *   pnpm tsx scripts/about-media.ts --stills
 */
import { TZDate } from "@date-fns/tz";
import { loadEnvConfig } from "@next/env";
import { type ChildProcess, spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";

import { ABOUT_FEATURES } from "@/lib/about";
import { DISPLAY_CHANGE_EVENT, DISPLAY_STORAGE_KEY } from "@/lib/display";
import { FINALE_MAX_MS } from "@/lib/finale";
import { backgroundColorScheme } from "@/lib/theme";
import type { LeaderboardResult } from "@/mcp/leaderboard";

import {
  type DemoServer,
  SESSION_COOKIE,
  createDemoSession,
  displayInitScript,
  query,
  setupBracketDemo as setupBracketDemoOn,
  startDemoServer,
} from "./media/demo";

loadEnvConfig(process.cwd());

const PORT = Number(process.env.ABOUT_MEDIA_PORT ?? 3202);
const BASE_URL = `http://localhost:${PORT}`;
const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEBUG_PORT = Number(process.env.ABOUT_MEDIA_DEBUG_PORT ?? 9304);
const MEDIA = path.resolve(process.cwd(), "public/about");
const EVIDENCE = path.resolve(process.cwd(), "test-results/about-media");
const AUTH_SECRET = `about-media-secret-${randomUUID()}`;
const DEMO_EMAIL = "about-demo@jahnelgroup.com";
const STILL = { width: 1280, height: 720 };
const PHONE = { width: 390, height: 844 };
/** After the Standings countdown: this long on its final state. */
const HOLD_MS = 3_500;
/** Between the presenter's → presses on the way to the countdown. */
const STEP_MS = 700;

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const log: string[] = [];
const note = (line: string) => {
  console.log(line);
  log.push(line);
};

// ---------------------------------------------------------------------------
// Database

/** The War Week every capture is taken from, resolved once in `main`. */
type CurrentWarWeek = {
  id: string;
  edition: string;
  mode: "teams" | "free-for-all";
  background_color: string;
};

let current: CurrentWarWeek;
/** The current War Week's home: `/` and its edition. */
const home = () => `/${current.edition}`;
/**
 * The About stills and the Finale poster are captured once per scheme in
 * `SCHEMES` (the About dark stills fix); anything else (the Games and
 * `/about` evidence) wears the current War Week's base palette, the scheme
 * its Organizer designed. Either way the Display is pinned, never whatever
 * this Chrome's OS happens to be set to (it has no stored `ww:display`, so
 * under System it would follow the Mac). Pinned per page via
 * `Page.addScriptToEvaluateOnNewDocument`, never `Emulation.setEmulatedMedia`
 * (the reduced-motion capture below replaces its feature list wholesale,
 * which would drop an earlier media pin).
 */
const pinnedDisplay = () => backgroundColorScheme(current.background_color);
/** Every About still is written once per Display scheme. */
const SCHEMES = ["light", "dark"] as const;
type Scheme = (typeof SCHEMES)[number];
/** `<name>.png` for the light Display, `<name>-dark.png` for the dark. */
const stillFile = (name: string, scheme: Scheme) =>
  scheme === "light" ? `${name}.png` : `${name}-dark.png`;
/**
 * Switches an open page's Display the way `DisplayMenu` does (stored,
 * applied to `html[data-display]`, change event), without a reload.
 */
const switchDisplay = (scheme: Scheme) =>
  `(() => { try { localStorage.setItem(${JSON.stringify(DISPLAY_STORAGE_KEY)}, ${JSON.stringify("__S__")}); } catch (e) {} document.documentElement.dataset.display = ${JSON.stringify("__S__")}; window.dispatchEvent(new Event(${JSON.stringify(DISPLAY_CHANGE_EVENT)})); })()`.replaceAll(
    "__S__",
    scheme,
  );
/** Teams-mode Standings rank Teams; free-for-all, Participants. */
const standingsKind = () =>
  current.mode === "teams" ? ("team" as const) : ("individual" as const);

const createSession = (email: string) =>
  createDemoSession(email, AUTH_SECRET, "About demo");

/**
 * The current War Week, resolved as `getCurrentWarWeek` does
 * (`selectCurrentWarWeek`): live, else the earliest upcoming, else the
 * latest completed, with the same `editionNumber` tie-breaks (the SQL
 * mirrors it, as importing the selector would load the app's database).
 */
async function resolveCurrentWarWeek(): Promise<CurrentWarWeek> {
  const [row] = await query<CurrentWarWeek>(
    `select id, edition, mode, background_color from war_week
     where status in ('live', 'upcoming', 'complete')
     order by case status when 'live' then 0 when 'upcoming' then 1 else 2 end,
       case when status = 'upcoming' then start_date end asc,
       case when status = 'upcoming' then edition_number end asc,
       start_date desc, edition_number desc
     limit 1`,
  );
  if (!row) {
    throw new Error("no War Week: run `pnpm seed:demo:<edition>` first");
  }
  return row;
}

/**
 * Lends the current War Week's seeded Points Entries and Announcements to
 * the demo Organizer, so whoever entered them (an email) never appears in a
 * capture; returns the undo, which puts each row's own author back.
 */
async function lendAuthorship(): Promise<() => Promise<void>> {
  const entries = await query<{ id: string; email: string }>(
    `update points_entry p set entered_by_email = $1
     from points_entry old
     where p.id = old.id and p.war_week_id = $2
     returning p.id, old.entered_by_email as email`,
    [DEMO_EMAIL, current.id],
  );
  const announcements = await query<{ id: string; email: string }>(
    `update announcement a set author_email = $1
     from announcement old
     where a.id = old.id and a.war_week_id = $2
     returning a.id, old.author_email as email`,
    [DEMO_EMAIL, current.id],
  );
  return async () => {
    for (const { id, email } of entries) {
      await query(
        `update points_entry set entered_by_email = $2 where id = $1`,
        [id, email],
      );
    }
    for (const { id, email } of announcements) {
      await query(`update announcement set author_email = $2 where id = $1`, [
        id,
        email,
      ]);
    }
  };
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

  static async open(display = pinnedDisplay()): Promise<Page> {
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
      source: displayInitScript(display),
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
      name: SESSION_COOKIE,
      value,
      url: BASE_URL,
      httpOnly: true,
    });
  }

  async goto(target: string, settleMs = 2_500) {
    await this.send("Page.navigate", {
      url: `${BASE_URL}${target}`,
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
      // A still for the other Display is display: none and, lazy, never loads.
      await Promise.all(Array.from(document.images).filter((img) => img.checkVisibility()).map((img) => img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })));
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

async function recordFinale(cookie: string, scheme: Scheme) {
  const page = await Page.open(scheme);
  // The screencast sends CSS-pixel frames whatever the device scale, so
  // the page is laid out at 390px inside a doubled viewport, zoomed 2x.
  await page.viewport(
    { width: PHONE.width * 2, height: PHONE.height * 2 },
    true,
    1,
  );
  await page.cookie(cookie);
  await page.goto(`${home()}/finale`, 3_000);
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

  // The slideshow's keys work once it has hydrated.
  for (let i = 0; i < 100; i++) {
    const hydrated = await page.evaluate<boolean>(
      `document.querySelector("[data-finale-hydrated]") !== null`,
    );
    if (hydrated) break;
    await sleep(100);
  }
  await sleep(1_000);
  const slideKind = () =>
    page.evaluate<string | null>(
      `document.querySelector("[data-finale-slide]")?.dataset.finaleSlide ?? null`,
    );
  // The poster is the Title slide: it opens the slideshow and shows no
  // Standings.
  const titleKind = await slideKind();
  if (titleKind !== "title") {
    throw new Error(`the Finale opened on "${titleKind}", not its Title slide`);
  }
  const poster = frames.at(-1);
  if (!poster) throw new Error("no frame recorded of the Title slide");

  // The presenter's →, one press at a time, until the next press lands on
  // the Standings countdown: that press is the "pressed" moment.
  const press = async () => {
    for (const type of ["rawKeyDown", "keyUp"]) {
      await page.send("Input.dispatchKeyEvent", {
        type,
        key: "ArrowRight",
        code: "ArrowRight",
        windowsVirtualKeyCode: 39,
      });
    }
  };
  let pressedAt = Date.now();
  let presses = 0;
  while ((await slideKind()) !== "standings") {
    if (++presses > 60) throw new Error("→ never reached the Standings slide");
    pressedAt = Date.now();
    await press();
    await sleep(STEP_MS);
  }
  note(`finale (${scheme}): reached Standings after ${presses} presses`);

  let startedAt: number | null = null;
  while (Date.now() - pressedAt < 20_000 && startedAt === null) {
    const value = await page.evaluate<string | null>(
      `document.querySelector("[data-finale-started-at]")?.dataset.finaleStartedAt ?? null`,
    );
    if (value) startedAt = Number(value);
    else await sleep(100);
  }
  if (startedAt === null) throw new Error("the countdown never started");
  note(
    `finale (${scheme}): countdown started ${startedAt - pressedAt} ms after the → onto Standings`,
  );
  await sleep(FINALE_MAX_MS + HOLD_MS);
  await page.send("Page.stopScreencast");
  await page.close();

  // A sanity check only (no video is written): the countdown really
  // played. A frame only arrives when something changes.
  const to = startedAt + FINALE_MAX_MS + HOLD_MS;
  const kept = frames.filter((f) => f.at >= startedAt && f.at <= to);
  if (kept.length < 10) {
    throw new Error(`only ${kept.length} frames recorded of the countdown`);
  }
  note(
    `finale (${scheme}): ${frames.length} frames captured, ${kept.length} kept`,
  );

  // Only the poster still is kept; no Finale video is written or shown.
  writeFileSync(
    path.join(MEDIA, stillFile("finale-poster", scheme)),
    Buffer.from(poster.data, "base64"),
  );
}

// ---------------------------------------------------------------------------
// A finished Heats Bracket for the "competitions" still (`setupBracketDemo`
// in `scripts/media/demo.ts`, shared with the Finale stills)

const setupBracketDemo = () => setupBracketDemoOn(current, note);

// ---------------------------------------------------------------------------
// The stills

async function still(
  slug: string,
  cookie: string,
  target: string,
  prepare?: (page: Page) => Promise<void>,
  viewport: { width: number; height: number } = STILL,
) {
  for (const scheme of SCHEMES) {
    const page = await Page.open(scheme);
    await page.viewport(viewport, viewport === PHONE);
    await page.cookie(cookie);
    await page.goto(target);
    if (prepare) await prepare(page);
    await assertNoRealEmail(page, slug);
    await page.screenshot(path.join(MEDIA, stillFile(slug, scheme)));
    await page.close();
    note(`still: ${stillFile(slug, scheme)} from ${target}`);
  }
}

/**
 * Picks an option in one of the Discretionary points form's `EntityCombobox`
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

/** Clicks the first button whose text is `text`, as a person would. */
async function clickButton(page: Page, text: string): Promise<void> {
  const clicked = await page.evaluate<boolean>(`(() => {
    const button = Array.from(document.querySelectorAll('button')).find((b) => b.innerText.trim() === ${JSON.stringify(text)});
    button?.click();
    return Boolean(button);
  })()`);
  if (!clicked) throw new Error(`no "${text}" button on the page`);
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
      params: {
        name: "get_leaderboard",
        arguments: { kind: standingsKind() },
      },
    },
    init.sessionId,
  );
  const text = (
    answer.json?.result as { content?: { text: string }[] } | undefined
  )?.content?.[0]?.text;
  if (!text) throw new Error("get_leaderboard returned nothing");
  return JSON.parse(text) as LeaderboardResult;
}

// ---------------------------------------------------------------------------
// A logged Game, as evidence beside the "competitions" still (R3)

/**
 * The current War Week's seeded head-to-head, individual, open-to-everyone
 * Head-to-head or Best score Competition, and two Participant names to log a Game between.
 */
async function findGamesDemo(): Promise<{
  competitionId: string;
  playerA: string;
  playerB: string;
}> {
  const [comp] = await query<{ id: string }>(
    `select id from competition
     where war_week_id = $1 and format = 'head-to-head'
       and scoring = 'individual' and entrants_open
     order by name limit 1`,
    [current.id],
  );
  if (!comp) {
    throw new Error(
      `no seeded open Head-to-head Competition on ${current.edition}`,
    );
  }
  const participants = await query<{ display_name: string }>(
    `select display_name from participant where war_week_id = $1
     order by display_name limit 2`,
    [current.id],
  );
  if (participants.length < 2) {
    throw new Error(
      `${current.edition} needs at least 2 Participants for the Games demo`,
    );
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
 * Logs one head-to-head Match through the real form (the
 * `logGame` action, as the demo Organizer): opens "Log a Match" from the
 * Competition page, picks both players and who won, and saves. The
 * `finally` undoes the Match by the demo email (`teardownGamesDemo`).
 */
async function captureGamesDemo(cookie: string): Promise<void> {
  const { competitionId, playerA, playerB } = await findGamesDemo();
  const page = await Page.open();
  await page.viewport(STILL, false);
  await page.cookie(cookie);
  await page.goto(`${home()}/competitions/${competitionId}`);

  const opened = await page.evaluate<boolean>(
    `(() => { const b = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === "Log a Match"); b?.click(); return Boolean(b); })()`,
  );
  if (!opened) throw new Error('no "Log a Match" button on the Competition');
  await sleep(500);

  await selectLabeledCombobox(page, "Player A", playerA);
  await selectLabeledCombobox(page, "Player B", playerB);
  const wonLabel = `${playerA} won`;
  const wonPicked = await page.evaluate<boolean>(`(() => {
    const button = Array.from(document.querySelectorAll("button")).find((b) => b.innerText.trim() === ${JSON.stringify(wonLabel)});
    button?.click();
    return Boolean(button);
  })()`);
  if (!wonPicked) throw new Error(`no "${wonLabel}" button in the Match form`);
  await sleep(300);

  const submitted = await page.evaluate<boolean>(
    `(() => { const b = Array.from(document.querySelectorAll('button[type="submit"]')).find((b) => b.innerText.trim() === "Log Match"); b?.click(); return Boolean(b); })()`,
  );
  if (!submitted) throw new Error('no "Log Match" submit button');

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
      (h) => h.textContent?.trim() === "Matches",
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
  if (!toastGone) throw new Error('the "Match logged" toast never went away');
  await assertNoRealEmail(page, "games");
  await page.screenshot(path.join(EVIDENCE, "games.png"));
  note(
    `evidence: games from ${home()}/competitions/${competitionId}, one Match logged`,
  );
  await page.close();
}

/**
 * Undoes every Game the demo Organizer logged (the one `captureGamesDemo`
 * saves), by the demo email, so a throw after the save still cleans up.
 */
async function teardownGamesDemo() {
  await query(`delete from game where logged_by_email = $1`, [DEMO_EMAIL]);
}

// ---------------------------------------------------------------------------
// The About hero: Standings moving after a Points Entry (ticket 04)

/**
 * Three stills for the About page's hero (ticket 04): the home Standings
 * before, the Discretionary points form about to save a big win for
 * whoever is currently in last place (a Team, or in free-for-all a
 * Participant), and the same home Standings right after, reordered. Uses the
 * real Discretionary points form and the real `get_leaderboard` MCP tool to
 * read the Standings, not a hand-crafted fixture.
 */
async function captureStandingsDemo(cookie: string): Promise<void> {
  await still(
    "standings-before",
    cookie,
    `${home()}/leaderboard`,
    () => sleep(500),
    PHONE,
  );

  const before = await askMcp(cookie);
  const last = before.standings.at(-1);
  const first = before.standings[0];
  if (!last || !first || before.standings.length < 2) {
    throw new Error("need at least two in the Standings for the demo");
  }
  // Enough to overtake first place outright, so the reorder is unmistakable.
  const margin = Math.max(first.total - last.total + 15, 15);
  note(
    `standings demo: moving ${JSON.stringify(last.name)} from last (${last.total}) past first (${first.total}) with +${margin}`,
  );

  const page = await Page.open(SCHEMES[0]);
  await page.viewport(PHONE, true);
  await page.cookie(cookie);
  await page.goto("/admin/discretionary-points");
  await clickButton(page, "Give Discretionary points");
  await sleep(500);
  await selectComboboxOption(
    page,
    standingsKind() === "team"
      ? `${before.teamLabel} or Participant`
      : "Participant",
    last.name,
  );
  await page.evaluate(`document.querySelector('input[name="points"]').focus()`);
  await page.send("Input.insertText", { text: String(margin) });
  await page.evaluate(`document.querySelector('input[name="reason"]').focus()`);
  await page.send("Input.insertText", { text: "Spirit award" });
  await sleep(400);
  await assertNoRealEmail(page, "standings-entry");
  // One filled-in form, shot in each scheme: the Display switches in place,
  // so only one Points Entry is ever saved.
  for (const scheme of SCHEMES) {
    await page.evaluate(switchDisplay(scheme));
    await sleep(400);
    await page.screenshot(
      path.join(MEDIA, stillFile("standings-entry", scheme)),
    );
    note(
      `still: ${stillFile("standings-entry", scheme)} from /admin/discretionary-points, filled in`,
    );
  }

  // The save may land even if a later check throws: remember how many
  // entries the demo Organizer holds now, so the teardown can tell.
  standingsEntryBaseline = await demoEntryCount();
  await page.evaluate(
    `document.querySelector('form[aria-label="New Discretionary points"] button[type="submit"]').click()`,
  );
  // The Sheet closes once the entry saves.
  let saved = false;
  for (let i = 0; i < 40; i++) {
    await sleep(200);
    const open = await page.evaluate<boolean>(
      `Boolean(document.querySelector('form[aria-label="New Discretionary points"]'))`,
    );
    if (!open) {
      saved = true;
      break;
    }
  }
  if (!saved) {
    throw new Error("the demo Discretionary points never finished saving");
  }
  await page.close();

  await still(
    "standings-after",
    cookie,
    `${home()}/leaderboard`,
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
    throw new Error(
      "the demo Discretionary points did not move last place to first",
    );
  }
}

/** Points Entries credited to the demo Organizer (the lent seeded ones too). */
async function demoEntryCount(): Promise<number> {
  const [row] = await query<{ n: string }>(
    `select count(*)::text as n from points_entry where entered_by_email = $1`,
    [DEMO_EMAIL],
  );
  return Number(row.n);
}

/** The demo Organizer's entry count just before the Standings save; null before. */
let standingsEntryBaseline: number | null = null;

/**
 * Undoes the Points Entry `captureStandingsDemo` saved, if one landed: the
 * seeded entries are lent to the demo Organizer (`lendAuthorship`), so this
 * runs before the authorship is restored and removes only the newest one,
 * and only when the count grew past the baseline.
 */
async function teardownStandingsDemo() {
  if (standingsEntryBaseline === null) return;
  if ((await demoEntryCount()) > standingsEntryBaseline) {
    await query(
      `delete from points_entry where id = (
         select id from points_entry where entered_by_email = $1
         order by created_at desc limit 1)`,
      [DEMO_EMAIL],
    );
  }
  standingsEntryBaseline = null;
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
    `Array.from(document.images).filter((img) => img.checkVisibility() && img.complete && img.naturalWidth === 0).length`,
  );
  note(`evidence: images that failed to load on /about: ${broken}`);
  if (broken > 0) throw new Error("an About page image failed to load");
  await phone.close();

  const desktop = await Page.open();
  await desktop.viewport({ width: 1440, height: 900 }, false, 1);
  await desktop.goto("/about", 3_000);
  const hero = await desktop.evaluate<Record<string, unknown>>(
    `(() => { const imgs = Array.from(document.querySelectorAll('[data-standings-step]')).filter((i) => i.checkVisibility()); return { steps: imgs.map((i) => i.dataset.standingsStep), loaded: imgs.every((i) => i.complete && i.naturalWidth > 0), finalePoster: document.querySelector('img[src="/about/finale-poster.png"]') !== null, noVideo: document.querySelector("video") === null }; })()`,
  );
  note(`evidence: desktop hero ${JSON.stringify(hero)}`);
  if (!hero.noVideo)
    throw new Error("the About page hero must be stills, not a video");
  await desktop.screenshot(path.join(EVIDENCE, "about-desktop.png"), true);

  // Each Display shows only its own stills (the About dark stills fix).
  for (const scheme of SCHEMES) {
    const desktopScheme = await Page.open(scheme);
    await desktopScheme.viewport({ width: 1440, height: 900 }, false, 1);
    await desktopScheme.goto("/about", 3_000);
    await assertNoRealEmail(desktopScheme, `about-${scheme}`);
    await desktopScheme.screenshot(
      path.join(EVIDENCE, `about-desktop-${scheme}.png`),
      true,
    );
    const shown = await desktopScheme.evaluate<
      { src: string; loaded: boolean }[]
    >(
      `Array.from(document.querySelectorAll("img[data-still-scheme]")).filter((i) => i.checkVisibility()).map((i) => ({ src: new URL(i.currentSrc).pathname, loaded: i.complete && i.naturalWidth > 0 }))`,
    );
    const wrong = shown.filter(
      (s) => s.src.endsWith("-dark.png") !== (scheme === "dark") || !s.loaded,
    );
    note(
      `evidence: /about desktop under the ${scheme} Display shows ${shown.length} stills, ${wrong.length} wrong or unloaded`,
    );
    if (shown.length !== 10 || wrong.length > 0)
      throw new Error(
        `/about under the ${scheme} Display: ${JSON.stringify(shown)}`,
      );
    await desktopScheme.close();
  }

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

/**
 * A moment inside the current War Week for the Now / Next still: 12:15 PM
 * ET on its middle Day.
 */
async function scheduleTime(): Promise<string> {
  const days = await query<{ date: string }>(
    `select date::text as date from day where war_week_id = $1 order by date`,
    [current.id],
  );
  const day = days[Math.floor(days.length / 2)];
  if (!day) throw new Error(`${current.edition} has no Days to schedule`);
  const [y, m, d] = day.date.split("-").map(Number);
  return new TZDate(y, m - 1, d, 12, 15, 0, "America/New_York").toISOString();
}

/** Only the feature-card and Standings-hero stills; the Finale poster stays as it is. */
const STILLS_ONLY = process.argv.includes("--stills");

async function main() {
  mkdirSync(MEDIA, { recursive: true });
  rmSync(EVIDENCE, { recursive: true, force: true });
  mkdirSync(EVIDENCE, { recursive: true });

  current = await resolveCurrentWarWeek();
  note(
    `current War Week: ${current.edition} (${current.mode}, ${pinnedDisplay()} base palette)`,
  );
  const scheduleAt = await scheduleTime();
  const server: DemoServer = await startDemoServer(PORT, AUTH_SECRET);
  const chrome = launchChrome();
  let restoreAuthorship: (() => Promise<void>) | undefined;
  let bracketDemo: Awaited<ReturnType<typeof setupBracketDemo>> | undefined;

  try {
    // Setup is inside the `try`, so the `finally` undoes whatever got done.
    await query(
      `insert into organizer (email) values ($1) on conflict (email) do nothing`,
      [DEMO_EMAIL],
    );
    restoreAuthorship = await lendAuthorship();
    const cookie = await createSession(DEMO_EMAIL);
    bracketDemo = await setupBracketDemo();
    const bracketCompetitionId = bracketDemo.competitionId;

    await server.ready();
    await waitForChrome();

    // Undone straight away, so the later stills show the seeded Standings.
    await captureStandingsDemo(cookie);
    await teardownStandingsDemo();

    if (!STILLS_ONLY)
      for (const scheme of SCHEMES) await recordFinale(cookie, scheme);

    const slugs = ABOUT_FEATURES.map((f) => f.slug);
    await still("organizer-admin", cookie, "/admin/schedule");
    await still(
      "points",
      cookie,
      "/admin/discretionary-points",
      async (page) => {
        await clickButton(page, "Give Discretionary points");
        await sleep(500);
        const form = await page.evaluate<boolean>(
          `Boolean(document.querySelector('form[aria-label="New Discretionary points"]'))`,
        );
        note(`points: the Discretionary points form is open: ${form}`);
        if (!form) throw new Error("no Discretionary points form on screen");
      },
    );
    await still(
      "schedule",
      cookie,
      `${home()}?at=${encodeURIComponent(scheduleAt)}`,
      async (page) => {
        const found = await page.evaluate<boolean>(scrollToText("Today"));
        await sleep(300);
        if (!found) throw new Error(`no Now / Next section on ${home()}`);
      },
    );
    await still("announcements", cookie, `${home()}/announcements`, () =>
      sleep(2_000),
    );
    await still(
      "competitions",
      cookie,
      `${home()}/competitions/${bracketCompetitionId}`,
      async (page) => {
        const found = await page.evaluate<boolean>(
          scrollToText("Top finishers"),
        );
        await sleep(300);
        if (!found) throw new Error("no Top finishers on the Bracket view");
      },
    );
    await captureGamesDemo(cookie);
    await still("archive", cookie, "/history");
    await evidence();

    for (const name of [
      ...(STILLS_ONLY ? [] : ["finale-poster"]),
      "standings-before",
      "standings-entry",
      "standings-after",
      ...slugs,
    ].flatMap((still) => SCHEMES.map((scheme) => stillFile(still, scheme)))) {
      note(
        `wrote public/about/${name}: ${(statSync(path.join(MEDIA, name)).size / 1024).toFixed(0)} KB`,
      );
    }
  } finally {
    // Every undo runs on its own: one throwing must not skip the rest.
    const errors: unknown[] = [];
    const attempt = async (step: () => Promise<unknown> | unknown) => {
      try {
        await step();
      } catch (error) {
        errors.push(error);
      }
    };
    await attempt(() => chrome.process.kill());
    await attempt(() => server.stop());
    await sleep(1_000);
    await attempt(() =>
      rmSync(chrome.dir, { recursive: true, force: true, maxRetries: 3 }),
    );
    await attempt(() => teardownStandingsDemo());
    await attempt(() => teardownGamesDemo());
    await attempt(() =>
      query(`delete from organizer where email = $1`, [DEMO_EMAIL]),
    );
    if (restoreAuthorship) await attempt(restoreAuthorship);
    await attempt(() =>
      query(`delete from "user" where email = $1`, [DEMO_EMAIL]),
    );
    if (bracketDemo) await attempt(bracketDemo.teardown);
    await attempt(() =>
      writeFileSync(
        path.join(EVIDENCE, "about-media.txt"),
        log.join("\n") + "\n",
      ),
    );
    for (const error of errors) console.error("cleanup failed:", error);
    if (errors.length > 0) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
