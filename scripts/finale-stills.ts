/**
 * Writes the Finale stills: every slide the XII demo's Finale plays, at
 * 1920×1080 (the projector) and 390×844 (a phone), to
 * `<out>/<kind>-<w>x<h>.png` (a second slide of one kind gets
 * `<kind>-2-…`). Each slide is shot in its final state (every Award
 * shown, the countdown done), with reduced motion so no frame is
 * mid-animation. Never part of CI. Needs a production build and a local
 * Postgres seeded with the XII demo:
 *   pnpm build && pnpm seed:demo:xii && pnpm stills:finale
 *
 * `--out <dir>` picks the folder (default `test-results/finale-stills`),
 * which is emptied first. Starts its own server on port 3212 and signs in
 * as a made-up Organizer (`finale-stills@jahnelgroup.com`), so the stills
 * show what the Organizer presents. So every built-in slide has something
 * to show, it adds, and removes again afterwards: two Awards in Award
 * Categories, a closed Matches Bracket (`setupBracketDemo`, closed
 * here with its placings' points) and the seeded Ping Pong Head-to-head
 * Competition closed with a winner. Pass an edition to shoot another War
 * Week's demo:
 *   pnpm stills:finale xiii
 */
import { loadEnvConfig } from "@next/env";
import { type Page, chromium } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

import { backgroundColorScheme } from "@/lib/theme";

import {
  type DemoWarWeek,
  SESSION_COOKIE,
  createDemoSession,
  displayInitScript,
  query,
  setupBracketDemo,
  startDemoServer,
} from "./media/demo";

loadEnvConfig(process.cwd());

const PORT = 3212;
const AUTH_SECRET = `finale-stills-secret-${randomUUID()}`;
const DEMO_EMAIL = "finale-stills@jahnelgroup.com";

/** `--out <dir>` and an optional edition, in any order. */
function parseArgs(args: string[]): { out: string; edition: string } {
  let out = "test-results/finale-stills";
  const rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--out") {
      const dir = args[++i];
      if (!dir) throw new Error("--out needs a folder");
      out = dir;
    } else {
      rest.push(args[i]);
    }
  }
  return { out, edition: rest[0] ?? "xii" };
}

const ARGS = parseArgs(process.argv.slice(2));
const OUT = path.resolve(process.cwd(), ARGS.out);
const EDITION = ARGS.edition;
const SIZES = [
  { width: 1920, height: 1080 },
  { width: 390, height: 844 },
];
/** The Award Categories the two demo Awards go in (seeded keys). */
const AWARD_CATEGORIES = ["war-week-mvp", "grind"];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const note = (line: string) => console.log(line);

type StillsWarWeek = DemoWarWeek & { background_color: string };

/** Undo steps, run in reverse in `finally` whatever happened. */
const undo: (() => Promise<unknown>)[] = [];

/** Two Awards, each in a seeded Award Category, with recipients. */
async function addAwards(warWeek: StillsWarWeek) {
  const people = await query<{ id: string }>(
    `select id from participant where war_week_id = $1 order by display_name limit 3`,
    [warWeek.id],
  );
  const awards = [
    {
      key: AWARD_CATEGORIES[0],
      name: "MVP",
      description: "Showed up for every Competition and carried the room.",
      recipients: people.slice(0, 1),
    },
    {
      key: AWARD_CATEGORIES[1],
      name: "Hardest Worker",
      description: "Billable hours by day, Matches by night.",
      recipients: people.slice(1, 3),
    },
  ];
  for (const award of awards) {
    const [row] = await query<{ id: string }>(
      `insert into award (war_week_id, name, description, category_id)
       values ($1, $2, $3, (select id from award_category where key = $4))
       returning id`,
      [warWeek.id, award.name, award.description, award.key],
    );
    undo.push(() => query(`delete from award where id = $1`, [row.id]));
    for (const p of award.recipients) {
      await query(
        `insert into award_participant (award_id, participant_id) values ($1, $2)`,
        [row.id, p.id],
      );
    }
    note(`fixture: Award "${award.name}" in ${award.key}`);
  }
}

/**
 * Closes a Competition the way close or close leaves it: its
 * placings' generated Points Entries (`[participantId, points]`) and its
 * close time; the undo removes both.
 */
async function close(
  competitionId: string,
  placings: [string, number][],
  what: string,
) {
  undo.push(async () => {
    await query(
      `delete from points_entry where competition_id = $1 and generated`,
      [competitionId],
    );
    await query(`update competition set closed_at = null where id = $1`, [
      competitionId,
    ]);
  });
  for (const [participantId, points] of placings) {
    await query(
      `insert into points_entry (war_week_id, competition_id, participant_id, points, note, entered_by_email, generated)
       select war_week_id, id, $2, $3, 'Finale stills', $4, true from competition where id = $1`,
      [competitionId, participantId, points, DEMO_EMAIL],
    );
  }
  await query(`update competition set closed_at = now() where id = $1`, [
    competitionId,
  ]);
  note(`fixture: ${what} closed`);
}

/** A finished Matches Bracket, closed: its Final's places get 5, 3, 1. */
async function addClosedBracket(warWeek: StillsWarWeek) {
  const bracket = await setupBracketDemo(warWeek, note);
  undo.push(bracket.teardown);
  const final = await query<{ participant_id: string }>(
    `select e.participant_id from bracket_match h
     join bracket_match_entrant he on he.bracket_match_id = h.id
     join entrant e on e.id = he.entrant_id
     where h.competition_id = $1
       and h.round = (select max(round) from bracket_match where competition_id = $1)
       and not h.third_place
     order by he.place limit 3`,
    [bracket.competitionId],
  );
  await close(
    bracket.competitionId,
    final.map((row, i): [string, number] => [row.participant_id, [5, 3, 1][i]]),
    "the Bracket",
  );
}

/** The seeded Ping Pong (Head-to-head) Competition, closed with a winner. */
async function closePingPong(warWeek: StillsWarWeek) {
  const [pong] = await query<{ id: string }>(
    `select id from competition where war_week_id = $1 and name = 'Ping Pong' and format in ('head-to-head', 'best-score')`,
    [warWeek.id],
  );
  if (!pong) throw new Error(`${warWeek.edition} has no Ping Pong to close`);
  const people = await query<{ id: string }>(
    `select id from participant where war_week_id = $1 order by display_name desc limit 3`,
    [warWeek.id],
  );
  await close(
    pong.id,
    people.map((p, i): [string, number] => [p.id, [3, 2, 1][i]]),
    "Ping Pong",
  );
}

/** Where the presenter is: "<slide index>:<step>". */
const position = (page: Page) =>
  page
    .locator("[data-finale-slide-index]")
    .evaluate(
      (stage) =>
        `${stage.getAttribute("data-finale-slide-index")}:${stage.getAttribute("data-finale-step")}`,
    );

/** Presses `key` and says whether the presenter moved. */
async function press(page: Page, key: string): Promise<boolean> {
  const before = await position(page);
  await page.keyboard.press(key);
  for (let i = 0; i < 20; i++) {
    await sleep(50);
    if ((await position(page)) !== before) return true;
  }
  return false;
}

/** Whether the slide on screen scrolls (it should fit the projector). */
const scrolls = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll("[data-finale-slide-index] section *"),
    ).some(
      (el) =>
        el instanceof HTMLElement &&
        getComputedStyle(el).overflowY === "auto" &&
        el.scrollHeight > el.clientHeight + 1,
    ),
  );

/** One shot, named once every shot of its size is in. */
type Shot = { index: number; kind: string; scrolls: boolean; file: string };

/**
 * Shoots every slide at `size`: → to the end (every step of every slide),
 * then ← back to the first, as Back shows each slide in its final state.
 */
async function shoot(
  page: Page,
  size: { width: number; height: number },
): Promise<Shot[]> {
  await page.setViewportSize(size);
  await page.goto(`/${EDITION}/finale`);
  await page.locator("[data-finale-hydrated]").waitFor({ state: "attached" });
  while (await press(page, "ArrowRight"));
  const shots: Shot[] = [];
  const stage = page.locator("[data-finale-slide-index]");
  do {
    await sleep(400);
    const index = Number(await stage.getAttribute("data-finale-slide-index"));
    const file = path.join(OUT, `.${index}-${size.width}x${size.height}.png`);
    await page.screenshot({ path: file });
    shots.push({
      index,
      kind: (await stage.getAttribute("data-finale-slide")) ?? "slide",
      scrolls: await scrolls(page),
      file,
    });
  } while (await press(page, "ArrowLeft"));
  return shots.sort((a, b) => a.index - b.index);
}

/** Names each shot `<kind>-<w>x<h>.png`, `<kind>-2-…` for a second one. */
function nameShots(shots: Shot[], size: { width: number; height: number }) {
  const count = new Map<string, number>();
  for (const shot of shots) {
    const n = (count.get(shot.kind) ?? 0) + 1;
    count.set(shot.kind, n);
    const name = `${shot.kind}${n > 1 ? `-${n}` : ""}-${size.width}x${size.height}.png`;
    renameSync(shot.file, path.join(OUT, name));
    note(
      `wrote ${path.join(ARGS.out, name)}${shot.scrolls ? " (the slide scrolls)" : ""}`,
    );
  }
}

async function main() {
  const [warWeek] = await query<StillsWarWeek>(
    `select id, edition, background_color from war_week where edition = $1`,
    [EDITION],
  );
  if (!warWeek) {
    throw new Error(`no War Week ${EDITION}: run \`pnpm seed:demo:xii\` first`);
  }
  const server = await startDemoServer(PORT, AUTH_SECRET);
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  try {
    // Setup is inside the `try`, so the `finally` undoes whatever got done.
    await query(
      `insert into organizer (email) values ($1) on conflict (email) do nothing`,
      [DEMO_EMAIL],
    );
    undo.push(() =>
      query(`delete from organizer where email = $1`, [DEMO_EMAIL]),
    );
    undo.push(() => query(`delete from "user" where email = $1`, [DEMO_EMAIL]));
    const cookie = await createDemoSession(
      DEMO_EMAIL,
      AUTH_SECRET,
      "Finale stills",
    );
    await addAwards(warWeek);
    await addClosedBracket(warWeek);
    await closePingPong(warWeek);

    await server.ready();

    const context = await browser.newContext({
      baseURL: server.baseUrl,
      reducedMotion: "reduce",
      deviceScaleFactor: 1,
    });
    await context.addCookies([
      {
        name: SESSION_COOKIE,
        value: cookie,
        url: server.baseUrl,
        httpOnly: true,
      },
    ]);
    // The War Week's own palette, not this machine's light or dark mode.
    await context.addInitScript(
      displayInitScript(backgroundColorScheme(warWeek.background_color)),
    );
    const page = await context.newPage();
    for (const size of SIZES) nameShots(await shoot(page, size), size);
    await context.close();
  } finally {
    // Every undo runs on its own: one throwing must not skip the rest.
    const errors: unknown[] = [];
    await browser.close().catch((error) => errors.push(error));
    try {
      server.stop();
    } catch (error) {
      errors.push(error);
    }
    for (const step of undo.reverse()) {
      await step().catch((error) => errors.push(error));
    }
    for (const error of errors) console.error("cleanup failed:", error);
    if (errors.length > 0) process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
