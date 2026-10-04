import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { openCompetitionPage } from "./competition-page";
import { runQuery, xiParticipantId } from "./db";
import { E2E_PARTICIPANT_EMAIL, asOrganizer, signIn } from "./session";

// Epic R20, deliverable D3 (.scratch/competition-results/spec.md, decision
// 4 and decision 5's last bullet): a Best score Competition's results are
// one row per person, from their best Attempt (in team scoring, by Sum of
// members, each Team's members' bests added up; R21), with Top finishers
// above; a row's other Attempts open under it,
// by keyboard too; an Organizer edits and deletes an Attempt from the
// expanded row on the admin page. Each test makes its own `E2E R20 …`
// Competition in XI (Attempts inserted directly) and deletes it in
// `finally`.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";
const GRAHAM = "Graham Macbeth";

/**
 * Ashley has three Attempts (12, 30, 18 laps, oldest first), Sam one (25)
 * and Graham one (20). Worked by hand: individually Ashley 30, Sam 25,
 * Graham 20; by Team, Sum of members, Red (Ashley 30 + Sam 25) 55 and Blue
 * (Graham) 20. Placement Points 5 / 3 / 1.
 */
const ATTEMPTS: [string, number, number][] = [
  [ASHLEY, 12, 50],
  [SAM, 25, 45],
  [ASHLEY, 30, 40],
  [GRAHAM, 20, 35],
  [ASHLEY, 18, 30],
];

async function addBestScore(
  name: string,
  scoring: "individual" | "team",
): Promise<string> {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition
       (war_week_id, name, scoring, format, score_direction, score_unit,
        best_score_config, placement_points)
     select id, $1, $2, 'best-score', 'higher', 'laps', $3::jsonb, '{5,3,1}'
     from war_week where edition = 'xi'
     returning id`,
    [name, scoring, JSON.stringify({ teamScore: "sum-of-members" })],
  );
  for (const [who, score, minutesAgo] of ATTEMPTS) {
    // Each Attempt counts for its Participant's Team, as at logging.
    await runQuery(
      `insert into attempt (competition_id, participant_id, team_id, score,
         recorded_at, logged_by_email)
       select $1, p.id, p.team_id, $3, now() - make_interval(mins => $4),
         'e2e-organizer@jahnelgroup.com'
       from participant p where p.id = $2`,
      [id, await xiParticipantId(who), score, minutesAgo],
    );
  }
  return id;
}

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function expectNoSidewaysScroll(page: Page) {
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

function resultsTable(page: Page) {
  return page.getByRole("table", { name: "Best score results" });
}

function row(table: Locator, name: string) {
  return table
    .locator('tr[data-slot="results-row"]')
    .filter({ has: table.page().getByRole("rowheader", { name }) });
}

/** The expanded row under `name`'s row (its `aria-controls` target). */
async function expansionOf(table: Locator, name: string) {
  const toggle = row(table, name).locator("button[aria-expanded]");
  const id = await toggle.getAttribute("aria-controls");
  expect(id).not.toBeNull();
  return { toggle, content: table.page().locator(`[id="${id}"]`) };
}

test("r20 D3 Best score: a person with three Attempts holds one place, and their other two open by keyboard; Top finishers above; sorts; no sideways scroll", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R20 Laps best ${Date.now()}`;
  const id = await addBestScore(name, "individual");
  try {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      const table = resultsTable(page);

      // One row per person, by their best Attempt, Rank first.
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        ASHLEY,
        SAM,
        GRAHAM,
      ]);
      await expect(
        table.getByRole("button", { name: "Score (laps)", exact: true }),
      ).toBeVisible();
      await expect(row(table, ASHLEY).getByRole("rowheader")).toContainText(
        "Winner",
      );
      // Provisional points 5 / 3 / 1, folded under the name at 390.
      if (label === "1440") {
        await expect(
          table.locator('tr[data-slot="results-row"]').getByRole("cell"),
        ).toHaveText(["1", "30", "5", "2", "25", "3", "3", "20", "1"]);
      } else {
        await expect(
          table.locator('[data-slot="results-points-folded"]'),
        ).toHaveText(["5 points", "3 points", "1 point"]);
      }
      await expect(
        table.getByRole("button", { name: "Provisional" }),
      ).toBeVisible();

      // Top finishers above the table.
      const top = page.getByRole("region", { name: "Top finishers" });
      await expect(top.getByRole("listitem")).toHaveCount(3);
      await expect(top.getByRole("listitem").first()).toContainText(ASHLEY);
      await expect(top.getByRole("listitem").first()).toContainText("5 points");
      expect(
        (await top.boundingBox())!.y < (await table.boundingBox())!.y,
      ).toBe(true);

      // No separate list of Attempts: each shows only in its person's row.
      // By role: until React reveals the streamed page, a hidden copy of it
      // can still be in the document.
      await expect(
        page.getByRole("region", { name: "Results" }).getByText("18 laps"),
      ).toBeHidden();
      await expect(page.getByRole("region", { name: "Matches" })).toHaveCount(
        0,
      );

      // Keyboard: focus the toggle, press Enter; the other two show.
      const { toggle, content } = await expansionOf(table, ASHLEY);
      await expect(toggle).toContainText("2 more attempts");
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(content.locator('[data-slot="attempt"]')).toHaveCount(2);
      await expect(content.locator('[data-slot="attempt"]')).toContainText([
        "18 laps",
        "12 laps",
      ]);
      await expect(content).not.toContainText("30 laps");
      // A Participant with no right to change them sees no Edit or Delete.
      await expect(content.getByRole("button")).toHaveCount(0);
      // Sam and Graham have no other Attempt: nothing to expand.
      await expect(
        row(table, SAM).locator("button[aria-expanded]"),
      ).toHaveCount(0);
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `best-expanded-${label}`);

      // Sorts by Score both ways; the expansion stays with its row.
      await table
        .getByRole("button", { name: "Score (laps)", exact: true })
        .click();
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        ASHLEY,
        SAM,
        GRAHAM,
      ]);
      await table
        .getByRole("button", { name: "Score (laps)", exact: true })
        .click();
      await expect(
        table.getByRole("columnheader").filter({ hasText: "Score (laps)" }),
      ).toHaveAttribute("aria-sort", "ascending");
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        GRAHAM,
        SAM,
        ASHLEY,
      ]);
      await table
        .getByRole("button", { name: "Participant", exact: true })
        .click();
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        ASHLEY,
        GRAHAM,
        SAM,
      ]);
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `best-sorted-${label}`);
    }
  } finally {
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});

test("r21 Best score by Team, Sum of members: the row is each member's best added up, and the expansion lists every Attempt", async ({
  context,
  page,
}, testInfo) => {
  const name = `E2E R21 Laps team ${Date.now()}`;
  const id = await addBestScore(name, "team");
  try {
    await signIn(context, E2E_PARTICIPANT_EMAIL);
    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      const table = resultsTable(page);
      await expect(table.locator('[data-slot="results-name"]')).toHaveText([
        "Red",
        "Blue",
      ]);
      // Ashley's best 30 + Sam's 25 = 55; Ashley's 12 and 18 don't add.
      await expect(row(table, "Red").getByRole("cell").nth(1)).toHaveText("55");
      const { toggle, content } = await expansionOf(table, "Red");
      await expect(toggle).toContainText("4 attempts");
      await toggle.focus();
      await page.keyboard.press("Enter");
      await expect(content.locator('[data-slot="attempt"]')).toContainText([
        new RegExp(`${ASHLEY}\\s*18 laps`),
        new RegExp(`${ASHLEY}\\s*30 laps`),
        new RegExp(`${SAM}\\s*25 laps`),
        new RegExp(`${ASHLEY}\\s*12 laps`),
      ]);
      await expect(content).not.toContainText("Best");
      await expectNoSidewaysScroll(page);
      await shoot(page, testInfo, `team-sum-${label}`);
    }
  } finally {
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});

test("r20 D3 Best score admin: no separate list; an Organizer edits and deletes an Attempt from the person's expanded row", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = `E2E R20 Laps admin ${Date.now()}`;
  const id = await addBestScore(name, "individual");
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await openCompetitionPage(page, id);
    const attempts = page.getByRole("region", { name: "Attempts" });
    const table = attempts.getByRole("table", { name: "Best score results" });
    await expect(table.locator('[data-slot="results-name"]')).toHaveText([
      ASHLEY,
      SAM,
      GRAHAM,
    ]);
    // The list of Attempts is gone: only the table's rows.
    await expect(attempts.getByRole("listitem")).toHaveCount(3); // Top finishers

    // Expand Ashley's row: all three Attempts, the best marked, each with
    // Edit and Delete.
    let { toggle, content } = await expansionOf(table, ASHLEY);
    await expect(toggle).toContainText("2 more attempts");
    await toggle.focus();
    await page.keyboard.press("Enter");
    await expect(content.locator('[data-slot="attempt"]')).toHaveCount(3);
    await expect(
      content.locator('[data-slot="attempt"]').first(),
    ).toContainText("Best");
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "admin-expanded-1440");
    await page.setViewportSize(PHONE);
    await expectNoSidewaysScroll(page);
    await shoot(page, testInfo, "admin-expanded-390");
    await page.setViewportSize(DESKTOP);

    // Edit the 18 to 35: it becomes Ashley's best.
    await content
      .getByRole("button", { name: `Edit Attempt: ${ASHLEY} · 18 laps` })
      .click();
    const edit = page.getByRole("dialog");
    await edit.getByLabel(/^Score/).fill("35");
    await edit.getByRole("button", { name: "Save Attempt" }).click();
    await expect(page.getByText("Attempt updated")).toBeVisible();
    await expect(edit).toBeHidden();
    await expect(row(table, ASHLEY).getByRole("cell").nth(1)).toHaveText("35");

    // Delete the 35 behind the ConfirmDialog: 30 is the best again. The
    // row stays open across the refresh.
    ({ toggle, content } = await expansionOf(table, ASHLEY));
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await content
      .getByRole("button", { name: `Delete Attempt: ${ASHLEY} · 35 laps` })
      .click();
    const confirm = page.getByRole("alertdialog", {
      name: "Delete this Attempt?",
    });
    await confirm.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByText("Attempt deleted")).toBeVisible();
    await expect(row(table, ASHLEY).getByRole("cell").nth(1)).toHaveText("30");
    await expect(toggle).toContainText("1 more attempt");
    const [{ count }] = await runQuery<{ count: number }>(
      `select count(*)::int as count from attempt where competition_id = $1`,
      [id],
    );
    expect(count).toBe(4);

    // The Participant page follows.
    await page.goto(`/xi/competitions/${id}`);
    await expect(
      row(resultsTable(page), ASHLEY).getByRole("cell").nth(1),
    ).toHaveText("30");
    await shoot(page, testInfo, "after-delete-1440");
  } finally {
    await runQuery(`delete from competition where id = $1`, [id]);
  }
});
