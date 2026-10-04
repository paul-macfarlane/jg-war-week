import { type Locator, type Page, expect, test } from "@playwright/test";

import {
  addCompetition,
  chooseOption,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { runQuery, xiParticipantId } from "./db";
import {
  addXiCompetition,
  attemptsOf,
  deleteCompetitions,
  setSelfReport,
  shoot,
} from "./r21-logging";
import { E2E_HOST_EMAIL, asOrganizer, participantPageAs } from "./session";

// Epic R21, AC 7, 8, 9 and 10 (.scratch/competition-setup/spec.md,
// decisions 4 and 13): Best score's "Max attempts per person" binds the
// Participant and an Organizer alike, the form and the Log button say how
// many are left, and there's no Entrant list or enroll button; the Team
// score setting shows only in team scoring, with no Best / Total choice; at
// a limit of 1 the button reads "Update your score" and saving edits the one
// Attempt (an Organizer logging for that person too); with self-report on a
// Participant edits and deletes each of their own Attempts from their
// expanded row (one a Host logged), another Participant can't, and with it
// off they can't either. Each test's Competition is its own, deleted in
// `finally`.

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";
const NONE_LEFT = "No Attempts left: the limit is 3 per person.";

/** The Competition page's results (not a streamed page's hidden copy). */
function results(page: Page): Locator {
  return page.getByRole("region", { name: "Results" });
}

function row(page: Page, name: string): Locator {
  return page
    .getByRole("table", { name: "Best score results" })
    .locator('tr[data-slot="results-row"]')
    .filter({ has: page.getByRole("rowheader", { name }) });
}

/** Opens `name`'s expanded row; returns its list of Attempts. */
async function expand(page: Page, name: string): Promise<Locator> {
  const toggle = row(page, name).locator("button[aria-expanded]");
  // A refresh keeps an open row open.
  if ((await toggle.getAttribute("aria-expanded")) !== "true") {
    await toggle.click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  return page.getByRole("list", { name: `${name}'s attempts` });
}

/** Logs an Attempt from the open page's Log button: `score`, saved. */
async function logAttempt(page: Page, score: string, who?: string) {
  await page.getByRole("button", { name: "Log an Attempt" }).click();
  const form = page.getByRole("dialog", { name: "Log an Attempt" });
  if (who) {
    await form.getByRole("combobox", { name: "Participant" }).click();
    await page.getByRole("option", { name: who, exact: true }).click();
  }
  await form.getByLabel(/^Score/).fill(score);
  await form.getByRole("button", { name: "Log Attempt" }).click();
  await expect(form).toBeHidden();
  await expect(page.getByText("Attempt logged").first()).toBeVisible();
}

test("r21 AC7 AC8 Max attempts 3 refuses a fourth for the Participant and an Organizer, says how many are left, and Best score has no Entrant list, no enroll and Team score only in team scoring", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `E2E R21 Max attempts ${Date.now()}`;
  try {
    // The Organizer sets it up through Settings.
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await addCompetition(page, {
      name,
      format: "Best score",
      scoring: "Individual",
    });
    await openCompetitionPage(page, id);
    await page.getByLabel("Max attempts per person").fill("3");
    await expectSaved(page);
    await page
      .getByRole("switch", { name: "Participants can log their own results" })
      .click();
    await expectSaved(page);
    // No Best / Total, and Team score only once the scoring is team.
    await expect(
      page.getByRole("combobox", { name: "Team score", exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Best \/ Total/)).toHaveCount(0);
    await chooseOption(page, "Scoring", "Team");
    await expectSaved(page);
    await expect(
      page.getByRole("combobox", { name: "Team score", exact: true }),
    ).toBeVisible();
    await chooseOption(page, "Scoring", "Individual");
    await expectSaved(page);
    await expect(
      page.getByRole("combobox", { name: "Team score", exact: true }),
    ).toHaveCount(0);
    // No Entrant list here.
    await expect(
      page.getByRole("button", { name: "Save Entrants" }),
    ).toHaveCount(0);
    const [stored] = await runQuery<{ max_attempts: number }>(
      `select max_attempts from competition where id = $1`,
      [id],
    );
    expect(stored.max_attempts).toBe(3);

    const ashley = await participantPageAs(browser, ASHLEY);
    try {
      const you = ashley.page;
      await you.setViewportSize({ width: 1440, height: 900 });
      await you.goto(`/xi/competitions/${id}`);
      await expect(you.getByRole("button", { name: /Enroll/ })).toHaveCount(0);
      await expect(
        results(you).locator('[data-slot="attempts-left"]'),
      ).toHaveText("3 attempts left");
      await logAttempt(you, "10");
      await expect(
        results(you).locator('[data-slot="attempts-left"]'),
      ).toHaveText("2 attempts left");
      await logAttempt(you, "11");
      await expect(
        results(you).locator('[data-slot="attempts-left"]'),
      ).toHaveText("1 attempt left");

      // Ashley opens her last one; the Organizer logs it for her first.
      await you.getByRole("button", { name: "Log an Attempt" }).click();
      const late = you.getByRole("dialog", { name: "Log an Attempt" });
      await late.getByLabel(/^Score/).fill("14");

      await page.goto(`/xi/competitions/${id}`);
      await page.getByRole("button", { name: "Log an Attempt" }).click();
      const form = page.getByRole("dialog", { name: "Log an Attempt" });
      await form.getByRole("combobox", { name: "Participant" }).click();
      await page.getByRole("option", { name: ASHLEY, exact: true }).click();
      await expect(form.locator('[data-slot="attempts-left"]')).toHaveText(
        "1 attempt left",
      );
      await form.getByLabel(/^Score/).fill("12");
      await form.getByRole("button", { name: "Log Attempt" }).click();
      await expect(page.getByText("Attempt logged")).toBeVisible();

      // A fourth is refused by the server, for Ashley and the Organizer.
      await late.getByRole("button", { name: "Log Attempt" }).click();
      await expect(you.getByText(NONE_LEFT)).toBeVisible();
      await page.reload();
      await page.getByRole("button", { name: "Log an Attempt" }).click();
      const fourth = page.getByRole("dialog", { name: "Log an Attempt" });
      await fourth.getByRole("combobox", { name: "Participant" }).click();
      await page.getByRole("option", { name: ASHLEY, exact: true }).click();
      await expect(fourth.locator('[data-slot="attempts-left"]')).toHaveText(
        "0 attempts left",
      );
      await fourth.getByLabel(/^Score/).fill("13");
      await fourth.getByRole("button", { name: "Log Attempt" }).click();
      await expect(page.getByText(NONE_LEFT)).toBeVisible();
      expect((await attemptsOf(id, ASHLEY)).map((a) => a.score)).toEqual([
        10, 11, 12,
      ]);

      // Ashley's button is disabled, the reason beside it.
      await you.reload();
      await expect(
        you.getByRole("button", { name: "Log an Attempt" }),
      ).toBeDisabled();
      await expect(
        results(you).locator('[data-slot="log-disabled-reason"]'),
      ).toHaveText(NONE_LEFT);
      await shoot(you, testInfo, "no-attempts-left");
    } finally {
      await ashley.close();
    }
  } finally {
    await deleteCompetitions(name);
  }
});

test("r21 AC9 at Max attempts 1 the button reads Update your score and saving edits the one Attempt, for the Participant and an Organizer", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const name = `E2E R21 One attempt ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "best-score",
    scoreUnit: "laps",
    selfReport: true,
    maxAttempts: 1,
  });
  const ashley = await participantPageAs(browser, ASHLEY);
  try {
    const you = ashley.page;
    await you.setViewportSize({ width: 1440, height: 900 });
    await you.goto(`/xi/competitions/${id}`);
    await logAttempt(you, "10");
    const [first] = await attemptsOf(id, ASHLEY);

    await you.reload();
    await expect(
      you.getByRole("button", { name: "Log an Attempt" }),
    ).toHaveCount(0);
    await you.getByRole("button", { name: "Update your score" }).click();
    const update = you.getByRole("dialog", { name: "Update your score" });
    await update.getByLabel("Score (laps)").fill("12");
    await update.getByRole("button", { name: "Save Attempt" }).click();
    await expect(you.getByText("Attempt updated")).toBeVisible();
    expect(await attemptsOf(id, ASHLEY)).toEqual([{ id: first.id, score: 12 }]);

    // The Organizer logging for Ashley edits it too.
    await asOrganizer(context);
    await page.goto(`/xi/competitions/${id}`);
    await page.getByRole("button", { name: "Log an Attempt" }).click();
    const form = page.getByRole("dialog", { name: "Log an Attempt" });
    await form.getByRole("combobox", { name: "Participant" }).click();
    await page.getByRole("option", { name: ASHLEY, exact: true }).click();
    const forAshley = page.getByRole("dialog", {
      name: `Update ${ASHLEY}'s score`,
    });
    await expect(forAshley).toBeVisible();
    await forAshley.getByLabel("Score (laps)").fill("15");
    await forAshley.getByRole("button", { name: "Save Attempt" }).click();
    await expect(page.getByText("Attempt updated")).toBeVisible();
    expect(await attemptsOf(id, ASHLEY)).toEqual([{ id: first.id, score: 15 }]);
    await you.reload();
    await expect(row(you, ASHLEY)).toContainText("15");
    await shoot(you, testInfo, "updated");
  } finally {
    await ashley.close();
    await deleteCompetitions(name);
  }
});

test("r21 AC10 with self-report on a Participant edits and deletes each of their own three Attempts (one a Host logged) from their expanded row; another can't, and with it off neither can they", async ({
  browser,
}, testInfo) => {
  test.setTimeout(180_000);
  const name = `E2E R21 Own attempts ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "best-score",
    scoreUnit: "laps",
    selfReport: true,
    maxAttempts: 3,
  });
  const ashleyId = await xiParticipantId(ASHLEY);
  // Oldest first: a Host logged 20, Ashley logged 30 and 25.
  for (const [score, minutesAgo, byHost] of [
    [20, 30, true],
    [30, 20, false],
    [25, 10, false],
  ] as const) {
    await runQuery(
      `insert into attempt (competition_id, participant_id, team_id, score,
         recorded_at, logged_by_email, logged_by_participant_id)
       select $1, p.id, p.team_id, $2, now() - make_interval(mins => $3),
         $4, $5
       from participant p where p.id = $6`,
      [
        id,
        score,
        minutesAgo,
        byHost ? E2E_HOST_EMAIL : "e2e-ashley@jahnelgroup.com",
        byHost ? null : ashleyId,
        ashleyId,
      ],
    );
  }
  const ashley = await participantPageAs(browser, ASHLEY);
  const sam = await participantPageAs(browser, SAM);
  try {
    // Sam can't change Ashley's Attempts: her row lists the other two,
    // with no Edit or Delete.
    await sam.page.goto(`/xi/competitions/${id}`);
    const theirs = await expand(sam.page, ASHLEY);
    await expect(theirs.locator('[data-slot="attempt"]')).toHaveCount(2);
    await expect(theirs.getByRole("button")).toHaveCount(0);

    // Ashley: Edit and Delete on each of the three, the Host's included.
    const you = ashley.page;
    await you.setViewportSize({ width: 1440, height: 900 });
    await you.goto(`/xi/competitions/${id}`);
    let mine = await expand(you, ASHLEY);
    for (const score of ["20", "30", "25"]) {
      await expect(
        mine.getByRole("button", {
          name: `Edit Attempt: ${ASHLEY} · ${score} laps`,
        }),
      ).toBeVisible();
      await expect(
        mine.getByRole("button", {
          name: `Delete Attempt: ${ASHLEY} · ${score} laps`,
        }),
      ).toBeVisible();
    }
    await shoot(you, testInfo, "own-attempts");

    // She edits the Host's 20 to 35 (editing never counts against 3)…
    await mine
      .getByRole("button", { name: `Edit Attempt: ${ASHLEY} · 20 laps` })
      .click();
    const edit = you.getByRole("dialog", { name: "Edit Attempt" });
    await edit.getByLabel("Score (laps)").fill("35");
    await edit.getByRole("button", { name: "Save Attempt" }).click();
    await expect(you.getByText("Attempt updated")).toBeVisible();
    // …and deletes her 25.
    mine = await expand(you, ASHLEY);
    await mine
      .getByRole("button", { name: `Delete Attempt: ${ASHLEY} · 25 laps` })
      .click();
    await you
      .getByRole("alertdialog", { name: "Delete this Attempt?" })
      .getByRole("button", { name: "Delete" })
      .click();
    await expect(you.getByText("Attempt deleted")).toBeVisible();
    expect(
      (await attemptsOf(id, ASHLEY)).map((a) => a.score).sort((a, b) => a - b),
    ).toEqual([30, 35]);

    // With self-report off, she can't change them either.
    await setSelfReport(id, false);
    await you.reload();
    mine = await expand(you, ASHLEY);
    await expect(mine.locator('[data-slot="attempt"]')).toHaveCount(1);
    await expect(mine.getByRole("button")).toHaveCount(0);
    await shoot(you, testInfo, "self-report-off");
  } finally {
    await ashley.close();
    await sam.close();
    await deleteCompetitions(name);
  }
});
