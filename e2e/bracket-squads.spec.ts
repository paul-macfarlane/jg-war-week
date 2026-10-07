import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import path from "node:path";

import {
  expectEntrantsSaved,
  expectSaved,
  openCompetitionPage,
  setFormat,
} from "./competition-page";
import {
  addE2eHost,
  removeE2eHost,
  runQuery,
  setParticipantEmail,
  xiCompetitionEntries,
  xiCompetitionId,
  xiParticipantId,
  xiTeamId,
} from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  signIn,
} from "./session";

// Cypher is a team-scoring War Week XI Competition with no Points Entries
// and no Placement Points; the flow gives it 3 / 2 / 1 (inside its max of
// 3) and runs it as a head-to-head Bracket of four Squads.
const COMPETITION = "Cypher";

const SQUADS = [
  {
    name: "Red Alpha",
    team: "Red",
    participants: ["Ashley Schuliger", "Sam Schantz"],
  },
  {
    name: "Red Bravo",
    team: "Red",
    participants: ["Ryan Shendler", "Alex Kelly"],
  },
  {
    name: "Blue Alpha",
    team: "Blue",
    participants: ["Graham Macbeth", "Brandon Badgett"],
  },
  {
    name: "Blue Bravo",
    team: "Blue",
    participants: ["Alec Haring", "Victoria Campbell"],
  },
] as const;
const SQUAD_NAMES: readonly string[] = SQUADS.map((squad) => squad.name);

/** Reports for Red Alpha: linked to the roster by email. */
const REPORTER = "Ashley Schuliger";
/** A second stub JG address, cleared with every e2e user (`e2e-%`). */
const E2E_PARTICIPANT_2_EMAIL = "e2e-participant-2@jahnelgroup.com";

/** The Squad help line (Q38), wherever Squads appear. */
const SQUAD_HELP = "a pair or group from one Team, playing as one entrant";

/** Screenshots at 375 and 1280 under `test-results/e2e/bracket-squads-help/`. */
async function shootHelp(page: Page, testInfo: TestInfo, name: string) {
  for (const width of SCREENSHOT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.screenshot({
      path: path.join(
        testInfo.project.outputDir,
        "bracket-squads-help",
        `${name}-${width}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

const VIEWPORT_WIDTHS = [375, 768, 1280] as const;
/** Only these widths get a screenshot; 768 is checked for overflow only. */
const SCREENSHOT_WIDTHS: readonly number[] = [375, 1280];

async function assertNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

/**
 * Checks no horizontal overflow at 375/768/1280 (of the page, and of
 * `dialog` when one is open), screenshotting 375/1280.
 */
async function checkViewports(
  page: Page,
  testInfo: TestInfo,
  name: string,
  dialog?: Locator,
) {
  for (const width of VIEWPORT_WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await assertNoHorizontalOverflow(page);
    if (dialog) {
      expect(
        await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth),
      ).toBe(true);
    }
    if (SCREENSHOT_WIDTHS.includes(width)) {
      await page.screenshot({
        path: testInfo.outputPath(`${name}-${width}.png`),
        fullPage: true,
        // The Sheet slides in and toasts stack: capture their settled state.
        animations: "disabled",
      });
    }
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/**
 * The box of the Match named `match` in the Bracket's tree, admin's or the
 * Competition page's (the last match: the Final's Round is named Final too).
 */
function matchCard(page: Page, match: string): Locator {
  return page
    .locator("[data-bracket-tree]")
    .getByRole("group", { name: match, exact: true })
    .last();
}

/** The Squad named in a Winner button's text. */
function squadIn(text: string): string {
  const name = SQUAD_NAMES.find((squad) => text.includes(squad));
  if (!name) throw new Error(`No Squad named in "${text}"`);
  return name;
}

/** Records the Match named `match` as the Host, its first-listed Squad winning. */
async function recordMatch(page: Page, match: string): Promise<string> {
  // From the admin Bracket's tree, the one Participants see.
  await page
    .locator("[data-bracket-tree]")
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const sheet = page.getByRole("dialog", { name: match });
  const winner = sheet
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  const name = squadIn(await winner.innerText());
  await winner.click();
  await sheet.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${name} wins ${match}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return name;
}

/** Adds a Squad through the builder's Squad form. */
async function addSquad(page: Page, squad: (typeof SQUADS)[number]) {
  await page.getByRole("button", { name: "Add Squad" }).click();
  const sheet = page.getByRole("dialog", { name: "Add Squad" });
  // The last save's toast goes as the Sheet opens: left at the bottom, it
  // covers the Sheet's fields, and a pointer over it keeps it there.
  // Under Sonner's 4s, so the toast was dismissed rather than expired.
  await expect(
    page.getByRole("region", { name: /^Notifications/ }).getByRole("listitem"),
  ).toHaveCount(0, { timeout: 2_000 });
  await sheet.getByLabel("Name", { exact: true }).fill(squad.name);
  await sheet.getByRole("combobox", { name: "Team", exact: true }).click();
  await page.getByRole("option", { name: squad.team, exact: true }).click();
  const find = sheet.getByRole("combobox", { name: /^Participants/ });
  for (const participant of squad.participants) {
    await find.fill(participant);
    await page
      .getByRole("option", { name: new RegExp(`^${participant}`) })
      .click();
  }
  await expect(sheet.getByText("Participants (2 chosen)")).toBeVisible();
  // Closes the Participants list without closing the Sheet.
  await sheet.getByRole("heading", { name: "Add Squad" }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await expect(sheet).toBeHidden();
  await expect(
    page.getByRole("region", { name: "Squads" }).getByText(squad.name),
  ).toBeVisible();
}

test("a Squad Bracket with self-report: a Participant reports, the other player changes it (D1d), the Host can't change a Semifinal the Final used until the Final is cleared (D1c)", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const id = await xiCompetitionId(COMPETITION);
  const reporterId = await xiParticipantId(REPORTER);
  let opponentParticipantId: string | null = null;
  // What the flow changes on Cypher, restored in `finally` so the test can
  // run again without a fresh seed; and its Points Entries before it, so
  // only the ones the Bracket generates are removed.
  const [before] = await runQuery<{ settings: string }>(
    `select row_to_json(c)::text as settings from (
       select format, bracket_config, self_report, closed_at,
              placement_points, self_enroll, entrant_limit
       from competition where id = $1) c`,
    [id],
  );
  const seededEntryIds = (
    await runQuery<{ id: string }>(
      `select id from points_entry where competition_id = $1`,
      [id],
    )
  ).map((row) => row.id);
  await addE2eHost(id, E2E_HOST_EMAIL);
  await runQuery(
    `update competition set placement_points = '{3,2,1}' where id = $1`,
    [id],
  );
  try {
    // The Host builds: Format, four Squads, Squads as the Entrants,
    // self-report on (and off and on again), Generate.
    await asHost(context);
    await openCompetitionPage(page, id);
    await setFormat(page, "Bracket");

    for (const squad of SQUADS) await addSquad(page, squad);
    // 15-3: the Squad help line in the builder's Squads section.
    await expect(
      page.getByRole("region", { name: "Squads" }).getByText(SQUAD_HELP),
    ).toBeVisible();
    await shootHelp(page, testInfo, "builder");

    await page.getByRole("combobox", { name: "Entrants are" }).click();
    await page.getByRole("option", { name: "Squads", exact: true }).click();
    await page.getByRole("button", { name: "All Squads" }).click();
    await expect(page.getByText("Squads (4 chosen)")).toBeVisible();
    await expectEntrantsSaved(page);

    // Self-report is a setting: it autosaves.
    const selfReport = page.getByRole("switch", {
      name: "Participants can log their own results",
    });
    await selfReport.click();
    await expect(selfReport).toBeChecked();
    await expectSaved(page);
    await selfReport.click();
    await expect(selfReport).not.toBeChecked();
    await expectSaved(page);
    await selfReport.click();
    await expect(selfReport).toBeChecked();
    await expectSaved(page);
    const [stored] = await runQuery<{ self_report: boolean }>(
      `select self_report from competition where id = $1`,
      [id],
    );
    expect(stored.self_report).toBe(true);

    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();
    await checkViewports(page, testInfo, "squad-builder");

    // The draw is random: Red Alpha's Semifinal and its opponent, by SQL.
    const [draw] = await runQuery<{ position: number; opponent: string }>(
      `select h.position, s2.name as opponent from bracket_match h
       join bracket_match_entrant he on he.bracket_match_id = h.id
       join entrant e on e.id = he.entrant_id
       join squad s on s.id = e.squad_id
       join bracket_match_entrant he2 on he2.bracket_match_id = h.id and he2.entrant_id <> he.entrant_id
       join entrant e2 on e2.id = he2.entrant_id
       join squad s2 on s2.id = e2.squad_id
       where h.competition_id = $1 and h.round = 1 and s.name = 'Red Alpha'`,
      [id],
    );
    if (!draw) throw new Error("Red Alpha isn't in a Round 1 Match");
    const semifinal = `Semifinal ${draw.position}`;
    const otherSemifinal = `Semifinal ${draw.position === 1 ? 2 : 1}`;
    const opponent = draw.opponent;
    const opponentSquad = SQUADS.find((squad) => squad.name === opponent)!;

    await setParticipantEmail(reporterId, E2E_PARTICIPANT_EMAIL);
    opponentParticipantId = await xiParticipantId(
      opponentSquad.participants[0],
    );
    await setParticipantEmail(opponentParticipantId, E2E_PARTICIPANT_2_EMAIL);

    // Two Participants, linked by email with no pick, see Report result.
    const firstContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    await signIn(firstContext, E2E_PARTICIPANT_EMAIL);
    const first = await firstContext.newPage();
    const secondContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    await signIn(secondContext, E2E_PARTICIPANT_2_EMAIL);
    const second = await secondContext.newPage();
    // 15-3: the Squad help line on the Competition page, by the Bracket.
    await first.goto(`/xi/competitions/${id}`);
    await expect(
      first.getByRole("region", { name: "Bracket" }).getByText(SQUAD_HELP),
    ).toBeVisible();
    await shootHelp(first, testInfo, "competition-page");
    for (const you of [first, second]) {
      await you.goto(`/xi/competitions/${id}`);
      // Tree only: no List toggle.
      await expect(
        you.getByRole("region", { name: "Bracket" }).getByRole("tab"),
      ).toHaveCount(0);
      // Their own Match carries Record result in the tree; the other doesn't.
      await expect(
        matchCard(you, semifinal).getByRole("button", {
          name: `Record result for ${semifinal}`,
        }),
      ).toBeVisible();
      await expect(
        matchCard(you, otherSemifinal).getByRole("button"),
      ).toHaveCount(0);
      const nextMatch = you
        .getByRole("region", { name: "Bracket" })
        .getByLabel("Your next Match");
      await expect(nextMatch).toContainText(`Your next Match · ${semifinal}`);
      await expect(
        nextMatch.getByRole("button", { name: "Report result" }),
      ).toBeVisible();
    }

    // The second opens its Sheet first and picks its own Squad, unsaved.
    await second
      .getByRole("region", { name: "Bracket" })
      .getByLabel("Your next Match")
      .getByRole("button", { name: "Report result" })
      .click();
    const secondSheet = second.getByRole("dialog", { name: semifinal });
    await secondSheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: opponent })
      .click();

    // The first reports Red Alpha's win; it counts at once.
    await first
      .getByRole("region", { name: "Bracket" })
      .getByLabel("Your next Match")
      .getByRole("button", { name: "Report result" })
      .click();
    const firstSheet = first.getByRole("dialog", { name: semifinal });
    await expect(firstSheet).toBeVisible();
    await checkViewports(first, testInfo, "participant-report", firstSheet);
    await firstSheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await firstSheet.getByRole("button", { name: "Save Match Result" }).click();
    await expect(first.getByText("Result reported.")).toBeVisible();
    await expect(firstSheet).toBeHidden();
    await expect(matchCard(first, "Final")).toContainText("Red Alpha");
    await checkViewports(first, testInfo, "participant-reported");

    // The second player saves after it: a player may change their Match's
    // recorded result (spec R21, D1d), so theirs stands.
    await secondSheet
      .getByRole("button", { name: "Save Match Result" })
      .click();
    await expect(second.getByText("Result reported.")).toBeVisible();
    await expect(secondSheet).toBeHidden();
    await second.reload();
    await expect(
      matchCard(second, semifinal).locator("[data-advances]"),
    ).toContainText(opponent);
    await expect(matchCard(second, "Final")).not.toContainText("Red Alpha");
    await secondContext.close();

    // The first player edits it back from the tree: Red Alpha won.
    await first.reload();
    await matchCard(first, semifinal)
      .getByRole("button", { name: `Edit ${semifinal}` })
      .click();
    const firstEdit = first.getByRole("dialog", { name: semifinal });
    await firstEdit
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await firstEdit.getByRole("button", { name: "Save Match Result" }).click();
    await expect(first.getByText("Result reported.")).toBeVisible();
    await expect(matchCard(first, "Final")).toContainText("Red Alpha");

    // The Host sees who reported it.
    await openCompetitionPage(page, id);
    await expect(matchCard(page, semifinal)).toContainText(
      `Reported by ${REPORTER}`,
    );
    await checkViewports(page, testInfo, "results-reported");
    const otherFinalist = await recordMatch(page, otherSemifinal);

    // The first reports the Final too, from its Record result in the tree.
    await first.reload();
    const nextMatch = first
      .getByRole("region", { name: "Bracket" })
      .getByLabel("Your next Match");
    await expect(nextMatch).toContainText("Your next Match · Final");
    await matchCard(first, "Final")
      .getByRole("button", { name: "Record result for Final" })
      .click();
    const finalSheet = first.getByRole("dialog", { name: "Final" });
    await finalSheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await finalSheet.getByRole("button", { name: "Save Match Result" }).click();
    await expect(first.getByText("Result reported.")).toBeVisible();
    await firstContext.close();

    // The Final used Red Alpha's Semifinal: its Edit and Clear result are
    // disabled, the reason in a tooltip, and nothing resets (D1c).
    await page.reload();
    await expect(matchCard(page, "Final")).toContainText(
      `Reported by ${REPORTER}`,
    );
    const locked = matchCard(page, semifinal);
    await expect(
      locked.getByRole("button", { name: `Edit ${semifinal}` }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      locked.getByRole("button", { name: `Clear result of ${semifinal}` }),
    ).toHaveAttribute("aria-disabled", "true");
    // The lock icon marks it; the reason is the disabled controls' tooltip
    // (focus the control), not text under every locked Match (R26 D8).
    await expect(locked.locator('[data-slot="match-lock-icon"]')).toBeVisible();
    await expect(locked.locator('[data-slot="match-lock-reason"]')).toHaveCount(
      0,
    );
    await locked.locator('[data-slot="locked-control"]').first().focus();
    await expect(page.locator('[data-slot="tooltip-content"]')).toHaveText(
      "A later Match already used this result. Change that Match first.",
    );
    await checkViewports(page, testInfo, "semifinal-locked");

    // The Host clears the Final, then overwrites the Semifinal.
    await page.getByRole("button", { name: "Edit Final" }).click();
    const finalEdit = page.getByRole("dialog", { name: "Final" });
    await finalEdit.getByRole("button", { name: "Clear result" }).click();
    await page
      .getByRole("alertdialog", { name: "Clear the Final result?" })
      .getByRole("button", { name: "Clear result" })
      .click();
    await expect(page.getByText("Final result cleared")).toBeVisible();
    await expect(finalEdit).toBeHidden();
    await page.getByRole("button", { name: `Edit ${semifinal}` }).click();
    const overwrite = page.getByRole("dialog", { name: semifinal });
    await overwrite
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: opponent })
      .click();
    await overwrite.getByRole("button", { name: "Save Match Result" }).click();
    await expect(page.getByText(`${opponent} wins ${semifinal}`)).toBeVisible();
    await expect(overwrite).toBeHidden();
    await expect(matchCard(page, semifinal)).not.toContainText("Reported by");
    await expect(matchCard(page, "Final")).not.toContainText("Reported by");
    await expect(matchCard(page, "Final")).toContainText(opponent);
    await expect(matchCard(page, "Final")).not.toContainText("Red Alpha");
    await expect(
      page.getByRole("button", { name: "Record result for Final" }),
    ).toBeVisible();

    // Put Red Alpha back, play the Final, close.
    await page.getByRole("button", { name: `Edit ${semifinal}` }).click();
    await overwrite
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await overwrite.getByRole("button", { name: "Save Match Result" }).click();
    await expect(page.getByText(`Red Alpha wins ${semifinal}`)).toBeVisible();
    await expect(overwrite).toBeHidden();
    const winner = await recordMatch(page, "Final");
    await page
      .getByRole("region", { name: "Bracket", exact: true })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Bracket closed")).toBeVisible();

    // Each finalist Squad's Placement Points (3 / 2 / 1) go to its Team;
    // with no 3rd place match the semifinal losers get nothing.
    await page.goto(`/xi/competitions/${id}`);
    await expect(
      page.getByRole("heading", { name: "Points Entries" }),
    ).toHaveCount(0);
    const teamOf = (squad: string) =>
      SQUADS.find((s) => s.name === squad)!.team;
    const runnerUp = winner === "Red Alpha" ? otherFinalist : "Red Alpha";
    const expected = [
      { target: teamOf(winner), points: 3 },
      { target: teamOf(runnerUp), points: 2 },
    ];
    const entries = (await xiCompetitionEntries(COMPETITION)).filter(
      (entry) => entry.generated,
    );
    expect(
      entries
        .map((entry) => ({ target: entry.target, points: entry.points }))
        .sort((a, b) => b.points - a.points),
    ).toEqual(expected);
    const byTeam = await runQuery<{ team_id: string; points: number }>(
      `select team_id, points::float as points from points_entry
       where competition_id = $1 and generated
       order by points desc`,
      [id],
    );
    expect(byTeam).toEqual([
      { team_id: await xiTeamId(expected[0].target), points: 3 },
      { team_id: await xiTeamId(expected[1].target), points: 2 },
    ]);

    // Reopen, so the Team Standings later flows read are unchanged.
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Reopen", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reopen", exact: true })
      .click();
    await expect(page.getByText("Bracket reopened")).toBeVisible();
    expect(
      (await xiCompetitionEntries(COMPETITION)).filter(
        (entry) => entry.generated,
      ),
    ).toHaveLength(0);
  } finally {
    await setParticipantEmail(reporterId, null);
    if (opponentParticipantId) {
      await setParticipantEmail(opponentParticipantId, null);
    }
    await removeE2eHost(id, E2E_HOST_EMAIL);
    // The Bracket, its Entrants and Squads (their Match Entrants and Squad
    // members cascade), the Points Entries it generated, then Cypher as it
    // was.
    await runQuery(`delete from bracket_match where competition_id = $1`, [id]);
    await runQuery(`delete from entrant where competition_id = $1`, [id]);
    await runQuery(`delete from squad where competition_id = $1`, [id]);
    await runQuery(
      `delete from points_entry
       where competition_id = $1 and not (id = any($2::uuid[]))`,
      [id, seededEntryIds],
    );
    await runQuery(
      `update competition c set
         format = b.format, bracket_config = b.bracket_config,
         self_report = b.self_report, closed_at = b.closed_at,
         placement_points = b.placement_points, self_enroll = b.self_enroll,
         entrant_limit = b.entrant_limit
       from json_populate_record(null::competition, $2::json) b
       where c.id = $1`,
      [id, before.settings],
    );
  }
});
