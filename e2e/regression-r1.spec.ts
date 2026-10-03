import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { formatDayHeading } from "@/lib/schedule";

import {
  deleteXiCompetition,
  runQuery,
  xiParticipantPointsBreakdown,
  xiTeamPointsBreakdown,
} from "./db";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

test.beforeEach(async ({ context }) => {
  await signIn(context, E2E_PARTICIPANT_EMAIL);
});

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812 };
/** The phone BottomTabBar's reserved height (`pb-20` on the edition layout). */
const BOTTOM_TAB_BAR_HEIGHT = 80;
const TOLERANCE = 4;

/** The `<footer>`'s bounding rect, the viewport height and scroll height. */
async function footerMetrics(page: Page) {
  return page.evaluate(() => {
    const footer = document.querySelector("footer");
    if (!footer) throw new Error("No <footer> on the page");
    const rect = footer.getBoundingClientRect();
    return {
      top: rect.top,
      bottom: rect.bottom,
      innerHeight: window.innerHeight,
      scrollHeight: document.documentElement.scrollHeight,
    };
  });
}

/**
 * 01: on a short page the footer's bottom sits at the viewport's bottom
 * (minus the phone BottomTabBar's reserved height) and the page doesn't
 * scroll.
 */
async function checkShortPageFooter(
  page: Page,
  testInfo: TestInfo,
  url: string,
  name: string,
) {
  await page.setViewportSize(PHONE);
  await page.goto(url);
  let metrics = await footerMetrics(page);
  expect(metrics.bottom).toBeGreaterThanOrEqual(
    metrics.innerHeight - BOTTOM_TAB_BAR_HEIGHT - TOLERANCE,
  );
  expect(metrics.bottom).toBeLessThanOrEqual(
    metrics.innerHeight - BOTTOM_TAB_BAR_HEIGHT + TOLERANCE,
  );
  expect(metrics.scrollHeight).toBeLessThanOrEqual(
    metrics.innerHeight + TOLERANCE,
  );
  await page.screenshot({ path: testInfo.outputPath(`${name}-375.png`) });

  await page.setViewportSize(DESKTOP);
  await page.goto(url);
  metrics = await footerMetrics(page);
  expect(metrics.bottom).toBeGreaterThanOrEqual(
    metrics.innerHeight - TOLERANCE,
  );
  expect(metrics.bottom).toBeLessThanOrEqual(metrics.innerHeight + TOLERANCE);
  expect(metrics.scrollHeight).toBeLessThanOrEqual(
    metrics.innerHeight + TOLERANCE,
  );
  await page.screenshot({ path: testInfo.outputPath(`${name}-1280.png`) });
}

/** 01: on a long page the footer's top follows the main content's bottom. */
async function checkLongPageFooter(page: Page, url: string) {
  for (const viewport of [PHONE, DESKTOP]) {
    await page.setViewportSize(viewport);
    await page.goto(url);
    await page.locator("footer").waitFor();
    const mainBottom = await page
      .locator("main")
      .first()
      .evaluate((el) => el.getBoundingClientRect().bottom);
    const metrics = await footerMetrics(page);
    expect(metrics.top).toBeGreaterThanOrEqual(mainBottom - TOLERANCE);
  }
}

test("r1 01 the site footer sits at the bottom of a short page and follows a long page's content", async ({
  page,
}, testInfo) => {
  // /i's FAQ has no items ("No FAQ yet."): a genuinely short page.
  await checkShortPageFooter(page, testInfo, "/i/faq", "faq-short");
  // /xi (home) and /history both have plenty of content.
  await checkLongPageFooter(page, "/xi");
  await checkLongPageFooter(page, "/history");
});

/** Every heading whose text matches /standings/i, and its exact text. */
async function standingsHeadingTexts(page: Page): Promise<string[]> {
  return page.getByRole("heading", { name: /standings/i }).allTextContents();
}

test("r1 02 a free-for-all edition shows only a Standings heading; a teams edition still shows the Team label", async ({
  page,
}) => {
  // /i is seeded free-for-all (and archived: its home page is the Archive
  // detail view, with no Standings section, so only /i/leaderboard is
  // checked for the heading itself).
  await page.goto("/i");
  for (const text of await standingsHeadingTexts(page)) {
    expect(text).toBe("Standings");
  }

  await page.goto("/i/leaderboard");
  await expect(
    page.getByRole("heading", { name: "Standings", exact: true }),
  ).toBeVisible();
  for (const text of await standingsHeadingTexts(page)) {
    expect(text).toBe("Standings");
  }

  // /xi is seeded teams, with Team label "Team".
  await page.goto("/xi");
  await expect(
    page.getByRole("heading", { name: "Team standings", exact: true }),
  ).toBeVisible();

  await page.goto("/xi/leaderboard");
  await expect(
    page.getByRole("heading", { name: "Team standings", exact: true }),
  ).toBeVisible();
});

/**
 * The competition/time/points a Points breakdown row shows, read straight
 * from the DOM (not through any app formatting helper).
 */
async function breakdownRows(
  content: ReturnType<Page["locator"]>,
): Promise<{ competition: string; when: string; points: string }[]> {
  return content.evaluate((el) =>
    Array.from(el.querySelectorAll("li")).map((li) => {
      const spans = li.children;
      const competition = (spans[0]?.textContent ?? "").trim();
      const timeAndPoints = spans[1]?.children;
      return {
        competition,
        when: (timeAndPoints?.[0]?.textContent ?? "").trim(),
        points: (timeAndPoints?.[1]?.textContent ?? "").trim(),
      };
    }),
  );
}

test("r1 10 expanding a Team or Participant row on the leaderboard shows its Points Entries, newest first, summing to the row total", async ({
  page,
}, testInfo) => {
  await page.goto("/xi/leaderboard");

  // Team row: Red.
  const teamTrigger = page.getByRole("button", {
    name: /\bRed\b.*points breakdown/,
  });
  const teamTotalText = await teamTrigger
    .locator("span.tabular-nums")
    .last()
    .innerText();
  await teamTrigger.click();
  // Scope to the panel right after the Red trigger.
  const teamPanel = teamTrigger
    .locator("..")
    .locator('[data-slot="collapsible-content"]');
  await expect(teamPanel.locator("li").first()).toBeVisible();
  const teamRows = await breakdownRows(teamPanel);
  expect(teamRows.length).toBeGreaterThan(0);
  for (const row of teamRows) {
    expect(row.competition).not.toBe("");
    expect(row.when).not.toBe("");
    expect(row.points).not.toBe("");
  }
  const expectedTeamOrder = (await xiTeamPointsBreakdown("Red")).map(
    (r) => r.competition,
  );
  expect(teamRows.map((r) => r.competition)).toEqual(expectedTeamOrder);
  const teamSum = teamRows.reduce((sum, r) => sum + parseFloat(r.points), 0);
  expect(teamSum).toBeCloseTo(parseFloat(teamTotalText), 5);

  await page.setViewportSize(PHONE);
  await page.goto("/xi/leaderboard");
  await teamTrigger.click();
  await expect(teamPanel.locator("li").first()).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(PHONE.width);
  await page.screenshot({
    path: testInfo.outputPath("team-breakdown-375.png"),
    fullPage: true,
  });

  await page.setViewportSize(DESKTOP);
  await page.goto("/xi/leaderboard");
  await teamTrigger.click();
  await expect(teamPanel.locator("li").first()).toBeVisible();

  // Individual row: Anthony Conway (untouched by any Bracket flow).
  // The team name is concatenated straight after the Participant's name
  // with no separator ("Anthony ConwayRed"), so the match can't require a
  // word boundary right after "Conway".
  const participantTrigger = page.getByRole("button", {
    name: /\bAnthony Conway.*points breakdown/,
  });
  const participantTotalText = await participantTrigger
    .locator("span.tabular-nums")
    .last()
    .innerText();
  const participantPanel = participantTrigger
    .locator("..")
    .locator('[data-slot="collapsible-content"]');
  await participantTrigger.click();
  await expect(participantPanel.locator("li").first()).toBeVisible();
  const participantRows = await breakdownRows(participantPanel);
  expect(participantRows.length).toBeGreaterThan(0);
  const expectedParticipantOrder = (
    await xiParticipantPointsBreakdown("Anthony Conway")
  ).map((r) => r.competition);
  expect(participantRows.map((r) => r.competition)).toEqual(
    expectedParticipantOrder,
  );
  const participantSum = participantRows.reduce(
    (sum, r) => sum + parseFloat(r.points),
    0,
  );
  expect(participantSum).toBeCloseTo(parseFloat(participantTotalText), 5);
  await page.screenshot({
    path: testInfo.outputPath("participant-breakdown-1280.png"),
    fullPage: true,
  });
});

test("r1 05 the End War Week dialog shows the computed Winner read-only", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  // War Week XI is the live one, so /admin/settings shows End War Week.
  await page.goto("/admin/settings");
  await page.getByRole("button", { name: "End War Week" }).click();
  const dialog = page.getByRole("alertdialog", { name: "End War Week XI?" });
  await expect(dialog).toBeVisible();

  const winner = dialog.locator("#end-winner");
  await expect(winner).toBeVisible();
  await expect(winner).toHaveAttribute("readonly", "");
  expect(await winner.getAttribute("name")).toBeNull();
  const winnerText = (await winner.inputValue()).trim();
  expect(winnerText.length).toBeGreaterThan(0);
  await page.screenshot({
    path: testInfo.outputPath("end-war-week-dialog.png"),
  });

  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(dialog).toBeHidden();
  // Didn't end it: still live.
  const [row] = await runQuery<{ status: string }>(
    `select status from war_week where edition = 'xi'`,
  );
  expect(row.status).toBe("live");
});

test("r1 06 09 the Competitions form offers Format including Bracket formats and no points cap, linking a Bracket Competition to its Bracket setup", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  await page.goto("/admin/competitions");

  // The empty form opens in a Sheet from the list's Add button.
  await page.getByRole("button", { name: "Add Competition" }).click();
  const addForm = page
    .getByRole("dialog", { name: "Add Competition" })
    .getByRole("form", { name: "New Competition" });
  // Placement Points are the only points a Competition sets; no cap on them.
  await expect(addForm.getByText("Placement Points")).toBeVisible();
  await expect(addForm.getByLabel(/^Max\b/i)).toHaveCount(0);

  await expect(addForm.getByRole("combobox", { name: "Format" })).toBeVisible();
  await expect(addForm.getByText("Placement:")).toBeVisible();
  await expect(addForm.getByText("Bracket:")).toBeVisible();
  await expect(
    addForm.getByText(
      "One result on one sheet: give each Team or Participant a Place, optionally a Score, then Finalize.",
    ),
  ).toBeVisible();
  await expect(
    addForm.getByText(
      "Entrants play in Heats and a set number advance each Round, down to a final. Two per Heat with one advancing is a head-to-head knockout.",
    ),
  ).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("competition-form.png"),
    fullPage: true,
  });

  try {
    await addForm
      .getByRole("textbox", { name: "Name" })
      .fill("R1 E2E Knockout");
    await addForm.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Bracket", exact: true }).click();
    await addForm.getByRole("button", { name: "Add Competition" }).click();
    await expect(page.getByText("Competition saved")).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/competitions\/[0-9a-f-]+\/bracket$/);
    await page.screenshot({
      path: testInfo.outputPath("created-links-to-bracket.png"),
    });
  } finally {
    await deleteXiCompetition("R1 E2E Knockout");
  }
});

async function xiDays(): Promise<string[]> {
  const rows = await runQuery<{ date: string }>(
    `select to_char(d.date, 'YYYY-MM-DD') as date from day d
     join war_week w on w.id = d.war_week_id
     where w.edition = 'xi' order by d.date`,
  );
  return rows.map((r) => r.date);
}

/**
 * A Day's section. While a page streams, Next briefly keeps a hidden copy
 * of it in the DOM, so a bare `#day-…` can match twice: take the shown one.
 */
function daySection(page: Page, date: string) {
  return page.locator(`#day-${date}`).filter({ visible: true });
}

test("r1 08 the Schedule defaults to All and filters to one Day by URL", async ({
  page,
}, testInfo) => {
  const days = await xiDays();
  expect(days.length).toBeGreaterThan(1);

  for (const viewport of [PHONE, DESKTOP]) {
    await page.setViewportSize(viewport);
    await page.goto("/xi/schedule");
    await expect(
      page.getByRole("link", { name: "All", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    for (const date of days) {
      await expect(daySection(page, date)).toBeVisible();
    }
    await page.screenshot({
      path: testInfo.outputPath(`schedule-all-${viewport.width}.png`),
    });

    const targetDate = days[0];
    await page.goto(`/xi/schedule?day=${targetDate}`);
    await expect(page).toHaveURL(new RegExp(`\\?day=${targetDate}$`));
    for (const date of days) {
      if (date === targetDate) {
        await expect(daySection(page, date)).toBeVisible();
      } else {
        await expect(page.locator(`#day-${date}`)).toHaveCount(0);
      }
    }
    const dayLink = page.getByRole("link", {
      name: formatDayHeading(targetDate),
      exact: true,
    });
    await expect(dayLink).toHaveAttribute("aria-current", "true");
    await page.screenshot({
      path: testInfo.outputPath(`schedule-one-day-${viewport.width}.png`),
    });

    // An unknown day falls back to All.
    await page.goto("/xi/schedule?day=not-a-day");
    await expect(
      page.getByRole("link", { name: "All", exact: true }),
    ).toHaveAttribute("aria-current", "true");
    for (const date of days) {
      await expect(daySection(page, date)).toBeVisible();
    }
  }
});
