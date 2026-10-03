import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import path from "node:path";

import {
  runQuery,
  setParticipantEmail,
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

/** The Card of the Heat named `heat` (exactly: not "Waiting for …"). */
function heatCard(page: Page, heat: string): Locator {
  return page
    .getByRole("listitem")
    .filter({ has: page.getByText(heat, { exact: true }) });
}

/**
 * Switches the Competition page's Bracket from its default tree to the
 * List, whose Heat Cards `heatCard` finds.
 */
async function showList(page: Page) {
  await page
    .getByRole("region", { name: "Bracket" })
    .getByRole("tab", { name: "List" })
    .click();
}

/** The Squad named in a Winner button's text. */
function squadIn(text: string): string {
  const name = SQUAD_NAMES.find((squad) => text.includes(squad));
  if (!name) throw new Error(`No Squad named in "${text}"`);
  return name;
}

/** Records the Heat named `heat` as the Host, its first-listed Squad winning. */
async function recordHeat(page: Page, heat: string): Promise<string> {
  await page.getByRole("button", { name: `Record result for ${heat}` }).click();
  const sheet = page.getByRole("dialog", { name: heat });
  const winner = sheet
    .getByRole("group", { name: "Winner" })
    .getByRole("button")
    .first();
  const name = squadIn(await winner.innerText());
  await winner.click();
  await sheet.getByRole("button", { name: "Save Heat Result" }).click();
  await expect(page.getByText(`${name} wins ${heat}`)).toBeVisible();
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

test("a Squad Bracket with self-report: a Participant reports, a second report is refused, the Host overwrites", async ({
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
       select format, bracket_config, self_report, finalized_at,
              placement_points, self_enroll, entrant_limit, enroll_closes_at
       from competition where id = $1) c`,
    [id],
  );
  const seededEntryIds = (
    await runQuery<{ id: string }>(
      `select id from points_entry where competition_id = $1`,
      [id],
    )
  ).map((row) => row.id);
  await runQuery(
    `insert into competition_host (competition_id, email) values ($1, $2)
     on conflict do nothing`,
    [id, E2E_HOST_EMAIL],
  );
  await runQuery(
    `update competition set placement_points = '{3,2,1}' where id = $1`,
    [id],
  );
  try {
    // The Host builds: Format, four Squads, Squads as the Entrants,
    // self-report on (and off and on again), Generate.
    await asHost(context);
    await page.goto(`/admin/competitions/${id}/bracket`);
    await page.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Bracket", exact: true }).click();
    await expect(page.getByText("Format set to Bracket")).toBeVisible();

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
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();

    const selfReport = page.getByRole("switch", { name: "Self-report" });
    await selfReport.click();
    await expect(page.getByText("Self-report on")).toBeVisible();
    await expect(selfReport).toBeChecked();
    await selfReport.click();
    await expect(page.getByText("Self-report off")).toBeVisible();
    await expect(selfReport).not.toBeChecked();
    await selfReport.click();
    await expect(selfReport).toBeChecked();

    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();
    await checkViewports(page, testInfo, "squad-builder");

    // The draw is random: Red Alpha's Semifinal and its opponent, by SQL.
    const [draw] = await runQuery<{ position: number; opponent: string }>(
      `select h.position, s2.name as opponent from heat h
       join heat_entrant he on he.heat_id = h.id
       join entrant e on e.id = he.entrant_id
       join squad s on s.id = e.squad_id
       join heat_entrant he2 on he2.heat_id = h.id and he2.entrant_id <> he.entrant_id
       join entrant e2 on e2.id = he2.entrant_id
       join squad s2 on s2.id = e2.squad_id
       where h.competition_id = $1 and h.round = 1 and s.name = 'Red Alpha'`,
      [id],
    );
    if (!draw) throw new Error("Red Alpha isn't in a Round 1 Heat");
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
      await showList(you);
      const nextHeat = you
        .getByRole("region", { name: "Bracket" })
        .getByLabel("Your next Heat");
      await expect(nextHeat).toContainText(`Your next Heat · ${semifinal}`);
      await expect(
        nextHeat.getByRole("button", { name: "Report result" }),
      ).toBeVisible();
    }

    // The second opens its Sheet first and picks its own Squad, unsaved.
    await second
      .getByRole("region", { name: "Bracket" })
      .getByLabel("Your next Heat")
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
      .getByLabel("Your next Heat")
      .getByRole("button", { name: "Report result" })
      .click();
    const firstSheet = first.getByRole("dialog", { name: semifinal });
    await expect(firstSheet).toBeVisible();
    await checkViewports(first, testInfo, "participant-report", firstSheet);
    await firstSheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await firstSheet.getByRole("button", { name: "Save Heat Result" }).click();
    await expect(first.getByText("Result reported.")).toBeVisible();
    await expect(firstSheet).toBeHidden();
    await expect(heatCard(first, "Final")).toContainText("Red Alpha");
    await checkViewports(first, testInfo, "participant-reported");

    // The second's report now comes too late.
    await secondSheet.getByRole("button", { name: "Save Heat Result" }).click();
    await expect(
      second.getByText("This Heat already has a result."),
    ).toBeVisible();
    await expect(secondSheet).toBeVisible();
    await second.keyboard.press("Escape");
    await expect(secondSheet).toBeHidden();
    await second.reload();
    await showList(second);
    await expect(
      heatCard(second, semifinal)
        .getByRole("listitem")
        .filter({ hasText: "Red Alpha" })
        .getByLabel("Winner"),
    ).toBeVisible();
    await secondContext.close();

    // The Host sees who reported it.
    await page.goto(`/admin/brackets/${id}`);
    await expect(heatCard(page, semifinal)).toContainText(
      `Reported by ${REPORTER}`,
    );
    await checkViewports(page, testInfo, "results-reported");
    await recordHeat(page, otherSemifinal);

    // The first reports the Final too.
    await first.reload();
    const nextHeat = first
      .getByRole("region", { name: "Bracket" })
      .getByLabel("Your next Heat");
    await expect(nextHeat).toContainText("Your next Heat · Final");
    await nextHeat.getByRole("button", { name: "Report result" }).click();
    const finalSheet = first.getByRole("dialog", { name: "Final" });
    await finalSheet
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await finalSheet.getByRole("button", { name: "Save Heat Result" }).click();
    await expect(first.getByText("Result reported.")).toBeVisible();
    await firstContext.close();

    // The Host overwrites Red Alpha's Semifinal: the reported Final resets.
    await page.reload();
    await expect(heatCard(page, "Final")).toContainText(
      `Reported by ${REPORTER}`,
    );
    await page.getByRole("button", { name: `Edit ${semifinal}` }).click();
    const overwrite = page.getByRole("dialog", { name: semifinal });
    await overwrite
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: opponent })
      .click();
    await overwrite.getByRole("button", { name: "Save Heat Result" }).click();
    const resetConfirm = page.getByRole("alertdialog");
    await expect(resetConfirm).toContainText(`Change the ${semifinal} result?`);
    await expect(resetConfirm).toContainText("Final will be reset.");
    await resetConfirm.getByRole("button", { name: "Save and reset" }).click();
    await expect(
      page.getByText(`${opponent} wins ${semifinal} · 1 later Heat reset`),
    ).toBeVisible();
    await expect(overwrite).toBeHidden();
    await expect(heatCard(page, semifinal)).not.toContainText("Reported by");
    await expect(heatCard(page, "Final")).not.toContainText("Reported by");
    await expect(heatCard(page, "Final")).toContainText(opponent);
    await expect(heatCard(page, "Final")).not.toContainText("Red Alpha");
    await expect(
      page.getByRole("button", { name: "Record result for Final" }),
    ).toBeVisible();

    // Put Red Alpha back, play the Final, finalize.
    await page.getByRole("button", { name: `Edit ${semifinal}` }).click();
    await overwrite
      .getByRole("group", { name: "Winner" })
      .getByRole("button", { name: "Red Alpha" })
      .click();
    await overwrite.getByRole("button", { name: "Save Heat Result" }).click();
    await expect(page.getByText(`Red Alpha wins ${semifinal}`)).toBeVisible();
    await expect(overwrite).toBeHidden();
    await recordHeat(page, "Final");
    await page.getByRole("button", { name: "Finalize" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Finalize" })
      .click();
    await expect(page.getByText("Bracket finalized")).toBeVisible();

    // Each Squad's Placement Points go to its Team: two Red, two Blue.
    await page.goto(`/xi/competitions/${id}`);
    const entries = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Points Entries" }) })
      .getByRole("listitem")
      .filter({ hasText: "From bracket" });
    await expect(entries).toHaveCount(4);
    await expect(entries.filter({ hasText: /^\s*Red/ })).toHaveCount(2);
    await expect(entries.filter({ hasText: /^\s*Blue/ })).toHaveCount(2);
    const byTeam = await runQuery<{ team_id: string; count: number }>(
      `select team_id, count(*)::int as count from points_entry
       where competition_id = $1 and generated_by_bracket group by team_id`,
      [id],
    );
    const counts = Object.fromEntries(
      byTeam.map((row) => [row.team_id, row.count]),
    );
    expect(counts).toEqual({
      [await xiTeamId("Red")]: 2,
      [await xiTeamId("Blue")]: 2,
    });

    // Un-finalize, so the Team Standings later flows read are unchanged.
    await page.goto(`/admin/brackets/${id}`);
    await page.getByRole("button", { name: "Un-finalize" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Un-finalize" })
      .click();
    await expect(page.getByText("Bracket un-finalized")).toBeVisible();
    await page.goto(`/xi/competitions/${id}`);
    await expect(entries).toHaveCount(0);
  } finally {
    await setParticipantEmail(reporterId, null);
    if (opponentParticipantId) {
      await setParticipantEmail(opponentParticipantId, null);
    }
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [id, E2E_HOST_EMAIL],
    );
    // The Bracket, its Entrants and Squads (their Heat Entrants and Squad
    // members cascade), the Points Entries it generated, then Cypher as it
    // was.
    await runQuery(`delete from heat where competition_id = $1`, [id]);
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
         self_report = b.self_report, finalized_at = b.finalized_at,
         placement_points = b.placement_points, self_enroll = b.self_enroll,
         entrant_limit = b.entrant_limit, enroll_closes_at = b.enroll_closes_at
       from json_populate_record(null::competition, $2::json) b
       where c.id = $1`,
      [id, before.settings],
    );
  }
});
