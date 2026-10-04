import { type Page, expect, test } from "@playwright/test";

import {
  type FormatName,
  addCompetition,
  openCompetitionPage,
} from "./competition-page";
import { runQuery } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
  setSelfReport,
  shoot,
} from "./r21-logging";
import {
  E2E_PARTICIPANT_EMAIL,
  asOrganizer,
  participantPageAs,
  signIn,
} from "./session";

// Epic R21, AC 3 (.scratch/competition-setup/spec.md, decision 4): one
// self-report setting, "Participants can log their own results", off on a
// new Competition of every Format and offered on Bracket, Head-to-head and
// Best score only. With it on, a linked Participant logs a Best score
// Attempt as themselves (no picker), a Head-to-head Entrant logs a Match,
// and a Bracket player records their Match; with it off, each of those
// writes is refused by the server with its message (the form was opened
// while it was on). Each test's Competitions are its own, deleted in
// `finally`.

const SWITCH = "Participants can log their own results";
const OFF = "Self-report is off for this Competition.";
const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";

const FORMATS: [FormatName, boolean][] = [
  ["Bracket", true],
  ["Head-to-head", true],
  ["Best score", true],
  ["Placement", false],
  ["Participation", false],
];

test("r21 AC3 the self-report switch is off on a new Competition of every Format, and only Bracket, Head-to-head and Best score offer it", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const names = FORMATS.map(([format]) => `E2E R21 Self ${format} ${stamp}`);
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [i, [format, offered]] of FORMATS.entries()) {
      const id = await addCompetition(page, {
        name: names[i],
        format,
        scoring: "Individual",
      });
      await openCompetitionPage(page, id);
      const toggle = page.getByRole("switch", { name: SWITCH });
      if (offered) {
        await expect(toggle, format).toBeVisible();
        await expect(toggle, format).not.toBeChecked();
      } else {
        await expect(toggle, format).toHaveCount(0);
      }
      const [row] = await runQuery<{ self_report: boolean }>(
        `select self_report from competition where id = $1`,
        [id],
      );
      expect(row.self_report, format).toBe(false);
      if (format === "Best score" || format === "Placement") {
        await shoot(page, testInfo, `settings-${format.replace(" ", "-")}`);
      }
    }
  } finally {
    await deleteCompetitions(...names);
  }
});

/**
 * With the form open (self-report on), turns it off and saves: the server
 * refuses with its message and the form stays; on again, the same save
 * goes through and `success` toasts.
 */
async function refusedThenSaved(
  page: Page,
  id: string,
  save: () => Promise<void>,
  success: string,
) {
  await setSelfReport(id, false);
  await save();
  await expect(page.getByText(OFF)).toBeVisible();
  await setSelfReport(id, true);
  await save();
  await expect(page.getByText(success)).toBeVisible();
}

test("r21 AC3 with self-report on a Participant logs an Attempt as themselves, a Head-to-head Entrant logs a Match and a Bracket player records it; with it off the server refuses each", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const stamp = Date.now();
  const names = {
    series: `E2E R21 Self series ${stamp}`,
    attempts: `E2E R21 Self attempts ${stamp}`,
    bracket: `E2E R21 Self bracket ${stamp}`,
  };
  const series = await addXiCompetition(names.series, {
    format: "head-to-head",
    selfReport: true,
  });
  await addEntrants(series, [ASHLEY, SAM]);
  const attempts = await addXiCompetition(names.attempts, {
    format: "best-score",
    scoreUnit: "laps",
    selfReport: true,
  });
  const bracket = await addXiCompetition(names.bracket, {
    format: "bracket",
    bracketConfig: {
      kind: "head-to-head",
      entrantsPerMatch: 2,
      advancePerMatch: 1,
      thirdPlaceMatch: false,
      rounds: {},
    },
    selfReport: true,
  });
  await addEntrants(bracket, [ASHLEY, SAM]);
  const ashley = await participantPageAs(browser, ASHLEY);
  const unlinked = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    // The Organizer draws the Bracket: Ashley v Sam, the Final.
    await asOrganizer(context);
    await openCompetitionPage(page, bracket);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    const you = ashley.page;
    await you.setViewportSize({ width: 1440, height: 900 });

    // Best score: as themselves, no picker.
    await you.goto(`/xi/competitions/${attempts}`);
    await you.getByRole("button", { name: "Log an Attempt" }).click();
    const attemptForm = you.getByRole("dialog", { name: "Log an Attempt" });
    await expect(attemptForm.getByRole("combobox")).toHaveCount(0);
    await attemptForm.getByLabel("Score (laps)").fill("12");
    await refusedThenSaved(
      you,
      attempts,
      () => attemptForm.getByRole("button", { name: "Log Attempt" }).click(),
      "Attempt logged",
    );
    await expect(attemptForm).toBeHidden();
    const [attempt] = await runQuery<{ logged: string; score: number }>(
      `select p.display_name as logged, a.score::float as score
       from attempt a join participant p on p.id = a.participant_id
       where a.competition_id = $1`,
      [attempts],
    );
    expect(attempt).toEqual({ logged: ASHLEY, score: 12 });

    // Head-to-head: an Entrant logs a Match.
    await you.goto(`/xi/competitions/${series}`);
    await you.getByRole("button", { name: "Log a Match" }).click();
    const matchForm = you.getByRole("dialog", { name: "Log a Match" });
    await matchForm
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: `${ASHLEY} won` })
      .click();
    await refusedThenSaved(
      you,
      series,
      () => matchForm.getByRole("button", { name: "Log Match" }).click(),
      "Match logged",
    );
    await expect(matchForm).toBeHidden();
    await expect(
      you
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${ASHLEY}`]);

    // Bracket: a player records their Match.
    await you.goto(`/xi/competitions/${bracket}`);
    await you
      .getByRole("region", { name: "Bracket" })
      .getByRole("button", { name: "Record result for Final" })
      .click();
    const sheet = you.getByRole("dialog", { name: "Final" });
    await sheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: ASHLEY })
      .click();
    await refusedThenSaved(
      you,
      bracket,
      () => sheet.getByRole("button", { name: "Save Match Result" }).click(),
      "Result reported.",
    );
    await expect(sheet).toBeHidden();
    await shoot(you, testInfo, "bracket-recorded");

    // Turned off, none of the three offers Log or Record to them.
    for (const id of [series, attempts, bracket])
      await setSelfReport(id, false);
    await you.goto(`/xi/competitions/${attempts}`);
    await expect(
      you.getByRole("button", { name: "Log an Attempt" }),
    ).toHaveCount(0);
    await you.goto(`/xi/competitions/${series}`);
    await expect(you.getByRole("button", { name: "Log a Match" })).toHaveCount(
      0,
    );
    await shoot(you, testInfo, "series-off");

    // A JG sign-in linked to no Participant never gets a Log button.
    await setSelfReport(series, true);
    await signIn(unlinked, E2E_PARTICIPANT_EMAIL);
    const outsider = await unlinked.newPage();
    await outsider.goto(`/xi/competitions/${series}`);
    await expect(
      outsider.getByRole("region", { name: "Series" }),
    ).toBeVisible();
    await expect(
      outsider.getByRole("button", { name: "Log a Match" }),
    ).toHaveCount(0);
  } finally {
    await unlinked.close();
    await ashley.close();
    await deleteCompetitions(...Object.values(names));
  }
});
