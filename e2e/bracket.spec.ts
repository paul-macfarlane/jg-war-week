import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { formatDayHeading } from "@/lib/schedule";

import { runQuery, xiCompetitionId } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  asOrganizer,
  participantPageAs,
  signIn,
} from "./session";

// Beyblades is an individual War Week XI Competition with Placement Points
// 5 / 3 / 1. None of these four has a hand-entered Beyblades Points Entry.
const COMPETITION = "Beyblades";
const ENTRANTS = [
  "Ashley Schuliger",
  "Sam Schantz",
  "Ryan Shendler",
  "Alex Kelly",
];

/** Whose Heat the Host times, and sees in "Your next Heat" and Now/Next. */
const TIMED_ENTRANT = "Ashley Schuliger";
/** In XI's first Day, before its 7:00 PM Heat (ET). */
const HOME_AT = "2026-02-22T18:30:00-05:00";

const VIEWPORT_WIDTHS = [375, 768, 1280] as const;
/** Only these widths get a screenshot; 768 is checked for overflow only. */
const SCREENSHOT_WIDTHS: readonly number[] = [375, 1280];

/**
 * Checks no horizontal overflow at 375/768/1280, screenshotting 375/1280
 * as `<name>-<width>.png`.
 */
async function checkViewports(page: Page, testInfo: TestInfo, name: string) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    if (SCREENSHOT_WIDTHS.includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/** The name of the Round 1 Heat that holds `displayName` (the draw is random). */
async function round1HeatOf(
  competitionId: string,
  displayName: string,
): Promise<string> {
  const [row] = await runQuery<{ position: number }>(
    `select h.position from heat h
     join heat_entrant he on he.heat_id = h.id
     join entrant e on e.id = he.entrant_id
     join participant p on p.id = e.participant_id
     where h.competition_id = $1 and h.round = 1 and p.display_name = $2`,
    [competitionId, displayName],
  );
  if (!row) throw new Error(`No Round 1 Heat holds "${displayName}"`);
  return `Semifinal ${row.position}`;
}

/** War Week XI's first Day, as `YYYY-MM-DD`. */
async function xiFirstDay(): Promise<string> {
  const [row] = await runQuery<{ date: string }>(
    `select to_char(d.date, 'YYYY-MM-DD') as date from day d
     join war_week w on w.id = d.war_week_id
     where w.edition = 'xi' order by d.date limit 1`,
  );
  if (!row) throw new Error("War Week XI has no Days");
  return row.date;
}

/** Records the Heat named `heat`, with its first-listed Entrant winning. */
async function recordHeat(page: Page, heat: string): Promise<string> {
  await page.getByRole("button", { name: `Record ${heat}` }).click();
  const sheet = page.getByRole("dialog", { name: heat });
  const winner = sheet
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  // The button also shows the Avatar's initials; keep the Entrant's name.
  const text = await winner.innerText();
  const name = ENTRANTS.find((entrant) => text.includes(entrant));
  if (!name) throw new Error(`No Entrant named in "${text}"`);
  await winner.click();
  await sheet.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return name;
}

test("a Bracket is built, run and finalized into Points Entries", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  await asOrganizer(context);
  const id = await xiCompetitionId(COMPETITION);
  // The e2e Host hosts Beyblades for this flow only.
  await runQuery(
    `insert into competition_host (competition_id, email) values ($1, $2)
     on conflict do nothing`,
    [id, E2E_HOST_EMAIL],
  );
  try {
    await page.goto(`/admin/setup/competitions/${id}/bracket`);
    await page.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Single elimination" }).click();
    await expect(
      page.getByText("Format set to Single elimination"),
    ).toBeVisible();

    // Not by accessible name: its FieldLabel is "Pick Participants (N chosen)"
    // and changes as Entrants are added, so a fixed-name role locator would
    // stop matching after the first pick.
    const find = page.locator("#bracket-entrants");
    for (const entrant of ENTRANTS) {
      await find.fill(entrant);
      await page
        .getByRole("option", { name: new RegExp(`^${entrant}`) })
        .click();
    }
    await expect(page.getByText("(4 chosen)")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(page.getByText("Entrants saved")).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("bracket-built.png"),
      fullPage: true,
    });

    // As the Host: time and place for the Heat that holds TIMED_ENTRANT.
    const timedHeat = await round1HeatOf(id, TIMED_ENTRANT);
    const when = `${formatDayHeading(await xiFirstDay())} · 7:00 PM ET · Main room`;
    const hostContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    await asHost(hostContext);
    const host = await hostContext.newPage();
    await host.goto(`/admin/brackets/${id}`);
    await host
      .getByRole("button", { name: `Time & place for ${timedHeat}` })
      .click();
    const form = host.getByRole("form", {
      name: `Time & place for ${timedHeat}`,
    });
    await form.getByRole("combobox", { name: "Day" }).click();
    await host.getByRole("option", { name: "Sunday, Feb 22" }).click();
    const startTime = form.getByRole("combobox", { name: "Start time (ET)" });
    await startTime.fill("7:00 PM");
    await startTime.press("Enter");
    await form.getByLabel("Location (optional)").fill("Main room");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(host.getByText("Time and place saved")).toBeVisible();
    await expect(form).toBeHidden();
    await expect(host.getByText(when, { exact: true })).toBeVisible();
    await checkViewports(host, testInfo, "results-timed");
    await hostContext.close();

    // TIMED_ENTRANT sees it in "Your next Heat" and in the home page's Up next.
    const you = await participantPageAs(browser, TIMED_ENTRANT);
    await you.page.goto(`/xi/competitions/${id}`);
    const nextHeat = you.page.getByLabel("Your next Heat");
    await expect(nextHeat).toContainText(`Your next Heat · ${timedHeat}`);
    await expect(nextHeat).toContainText("7:00 PM ET");
    await expect(nextHeat).toContainText("Main room");
    await checkViewports(you.page, testInfo, "participant-timed");

    await you.page.goto(`/xi?at=${encodeURIComponent(HOME_AT)}`);
    const upNext = you.page
      .getByRole("heading", { name: "Up next" })
      .locator("..");
    await expect(upNext).toContainText(`${COMPETITION} · ${timedHeat}`);
    await expect(upNext).toContainText("Main room");
    await expect(upNext).toContainText(TIMED_ENTRANT);
    await checkViewports(you.page, testInfo, "now-next-heat");
    await you.context.close();

    await page.getByRole("link", { name: "Run results" }).click();
    await expect(
      page.getByRole("heading", { name: `${COMPETITION} · Results` }),
    ).toBeVisible();
    await recordHeat(page, "Semifinal 1");
    await recordHeat(page, "Semifinal 2");
    // Both semifinal winners advanced, so the Final is recordable.
    const champion = await recordHeat(page, "Final");
    await expect(page.getByLabel("Champion", { exact: true })).toContainText(
      champion,
    );

    await page.getByRole("button", { name: "Finalize" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalize" })
      .click();
    await expect(page.getByText("Bracket finalized")).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("bracket-finalized.png"),
      fullPage: true,
    });

    await page.goto(`/xi/competitions/${id}`);
    const entries = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Points Entries" }) })
      .getByRole("listitem")
      .filter({ hasText: "From bracket" });
    // Placement Points 5 / 3 / 1: the champion, the runner-up, and both
    // semifinal losers tied for third.
    await expect(entries).toHaveCount(4);
    await expect(entries.filter({ hasText: champion })).toHaveText(
      /From bracket\s*5$/,
    );
    await page.screenshot({
      path: testInfo.outputPath("competition-points-entries.png"),
      fullPage: true,
    });

    // The Bracket Finale plays the placings and ends on the champion.
    await page.goto(`/xi/finale/${id}`);
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
      timeout: 20_000,
    });
    const championCard = page.getByLabel("Champion", { exact: true });
    await expect(championCard).toContainText(champion);
    await expect(championCard).toContainText(`Champion of ${COMPETITION}`);
    await checkViewports(page, testInfo, "bracket-finale");

    // Reduced motion shows the final state as soon as Start is pressed:
    // well inside the ~3.9 s a four-Entrant count-in takes with motion.
    const still = await browser.newContext({
      baseURL: E2E_BASE_URL,
      reducedMotion: "reduce",
    });
    await signIn(still, E2E_PARTICIPANT_EMAIL);
    const stillPage = await still.newPage();
    await stillPage.goto(`/xi/finale/${id}`);
    await stillPage.getByRole("button", { name: "Start" }).click();
    await expect(stillPage.locator('[data-finale="done"]')).toBeVisible({
      timeout: 2_000,
    });
    await expect(
      stillPage.getByLabel("Champion", { exact: true }),
    ).toContainText(champion, { timeout: 2_000 });
    await still.close();
  } finally {
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [id, E2E_HOST_EMAIL],
    );
  }
});
