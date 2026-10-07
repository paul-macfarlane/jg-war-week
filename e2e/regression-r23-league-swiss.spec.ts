import { type Page, expect, test } from "@playwright/test";

import {
  addCompetition,
  expectEntrantsSaved,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import {
  runQuery,
  xiCompetitionEntries,
  xiCompetitionId,
  xiParticipantPointsBreakdown,
} from "./db";
import { deleteCompetitions, shoot } from "./r21-logging";
import {
  matchLines,
  matchRow,
  matchRows,
  recordMatch,
  resultDialog,
  roundSection,
} from "./r23-league";
import { asOrganizer } from "./session";

// An action that can't complete fails with its reason instead of
// waiting out the test's timeout (CI showed only a hang).
test.use({ actionTimeout: 20_000 });

// Epic R23, AC 3 and AC 6 (.scratch/league/spec.md, decisions 4 to 11;
// reading R7 and R10): an Organizer makes a Swiss League through the UI (6
// Entrants from the picker), pairs round 1, swaps two Entrants before a
// result (the round shows the swap), and after one result Edit pairings is
// off with its reason. Results (a Draw among them) take it to round 3, the
// default of 3 rounds for 6 Entrants; Close waits, with its reason, until
// every Match is played; Close writes the Placement Points "From league";
// Reopen takes them away. Record result is a centred dialog at 1440 and a
// bottom sheet at 390. The Competition is this spec's own, deleted in
// `finally`.

const PEOPLE = [
  "Abby Rivera",
  "Adam Wilson-Hwang",
  "Ashley Schuliger",
  "Brandon Badgett",
  "Graham Macbeth",
  "Sam Schantz",
];
const ROUND_HAS_RESULT = "A Match in this round has a result.";
const UNFINISHED = "Finish every Match before closing.";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };

/** "Ada v Bo" as its two names. */
function sides(line: string): [string, string] {
  const [a, b] = line.split(" v ");
  return [a, b];
}

/** Picks `name` in the Edit pairings select labelled `label`. */
async function pick(page: Page, label: string, name: string) {
  await page
    .getByRole("dialog", { name: "Edit pairings" })
    .getByRole("combobox", { name: label, exact: true })
    .click();
  await expect(page.getByRole("listbox")).toBeVisible();
  // Clicking a popup that is still opening closes it.
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished),
    ),
  );
  await page.getByRole("option", { name, exact: true }).click();
}

/** The run area's Close button (the Record result sheet's X is also named "Close"). */
function closeButton(page: Page) {
  return page.getByRole("main").getByRole("button", {
    name: "Close",
    exact: true,
  });
}

test("r23 AC3 AC6 a Swiss League of 6 is paired, edited, played to round 3, Closed into Placement Points and Reopened", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(300_000);
  const name = `E2E R23 Swiss ${Date.now()}`;
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);

    // A League through the Add sheet, Pairing Swiss in its Settings.
    const id = await addCompetition(page, {
      name,
      format: "League",
      scoring: "Individual",
    });
    await runQuery(
      `update competition set placement_points = array[5, 3, 1] where id = $1`,
      [id],
    );
    await openCompetitionPage(page, id);
    const settings = page.getByRole("form", { name: "Competition settings" });
    const swiss = settings.getByRole("button", { name: "Swiss", exact: true });
    await expect(
      settings.getByRole("button", { name: "Round robin", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await swiss.click();
    await expectSaved(page);
    await expect(swiss).toHaveAttribute("aria-pressed", "true");
    await expect(settings.getByLabel("Rounds")).toBeVisible();
    const [saved] = await runQuery<{ league_config: unknown }>(
      `select league_config from competition where id = $1`,
      [id],
    );
    expect(saved.league_config).toEqual({ pairing: "swiss", rounds: null });

    // 6 Entrants by the picker.
    const find = page.locator("#league-entrants");
    for (const person of PEOPLE) {
      await find.fill(person);
      await page
        .getByRole("option", { name: new RegExp(`^${person}`) })
        .first()
        .click();
    }
    await expect(page.getByText("(6 chosen)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expectEntrantsSaved(page);
    await expect(
      settings.getByText("Blank: ⌈log₂ N⌉, 3 for 6 Entrants."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Pair round 1", exact: true }),
    ).toBeEnabled();
    await shoot(page, testInfo, "swiss-setup");

    // Pair round 1: 3 Matches, every Entrant once.
    await page.getByRole("button", { name: "Pair round 1" }).click();
    await expect(page.getByText("Paired", { exact: true })).toBeVisible();
    await expect(roundSection(page, 1)).toBeVisible();
    await expect(matchRows(page, 1)).toHaveCount(3);
    const round1 = await matchLines(page, 1);
    expect(round1).toHaveLength(3);
    expect(round1.flatMap(sides).sort()).toEqual([...PEOPLE].sort());
    await expect(roundSection(page, 2)).toHaveCount(0);
    // Settings and Entrants are locked now.
    await expect(
      settings
        .getByRole("group", { name: "Pairing" })
        .first()
        .locator('[data-slot="lock-reason"]'),
    ).toHaveText("Locked once round 1 is paired.");
    await expect(find).toBeDisabled();
    await expect(swiss).toBeDisabled();
    await expect(settings.getByLabel("Rounds")).toBeDisabled();
    await shoot(page, testInfo, "swiss-round-1");

    // AC 6: before any result, Edit pairings swaps two Entrants and the
    // round shows the swap (the first Match's first Entrant with the second
    // Match's first).
    const [a, b] = sides(round1[0]);
    const [c, d] = sides(round1[1]);
    await roundSection(page, 1)
      .getByRole("button", { name: "Edit pairings" })
      .click();
    const edit = page.getByRole("dialog", { name: "Edit pairings" });
    await expect(edit).toBeVisible();
    for (const label of ["Swap", "With"]) {
      await expect(
        edit.getByRole("combobox", { name: label, exact: true }),
      ).toContainText("Choose an Entrant");
    }
    await pick(page, "Swap", a);
    await pick(page, "With", c);
    await expect(edit.locator('[data-slot="swap-warning"]')).toHaveCount(0);
    await shoot(page, testInfo, "swiss-edit-pairings");
    await edit.getByRole("button", { name: "Save pairings" }).click();
    await expect(
      page.getByText("Pairings updated", { exact: true }),
    ).toBeVisible();
    await expect(edit).toBeHidden();
    const swapped = [`${c} v ${b}`, `${a} v ${d}`, round1[2]];
    await expect.poll(() => matchLines(page, 1)).toEqual(swapped);

    // Record result: a centred dialog at 1440, a bottom sheet at 390.
    await matchRow(page, 1, swapped[0])
      .getByRole("button", { name: "Record result" })
      .click();
    const form = resultDialog(page);
    await expect(form).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(1);
    // A centred dialog: narrower than the page, clear of both edges.
    await expect
      .poll(async () => {
        const box = (await form.boundingBox())!;
        return (
          box.width < 700 &&
          box.x > 300 &&
          box.y > 50 &&
          box.y + box.height < DESKTOP.height - 50
        );
      })
      .toBe(true);
    // A bottom sheet: nearly the page's width, resting on its bottom edge.
    await page.setViewportSize(PHONE);
    await expect
      .poll(async () => {
        const box = (await form.boundingBox())!;
        return (
          box.x >= 0 &&
          box.width > PHONE.width * 0.9 &&
          box.width <= PHONE.width &&
          box.y > 0 &&
          box.y + box.height >= PHONE.height - 20
        );
      })
      .toBe(true);
    await page.setViewportSize(DESKTOP);
    await shoot(page, testInfo, "swiss-record-result");
    await form
      .getByRole("group", { name: "Result" })
      .getByRole("button", { name: `${c} won`, exact: true })
      .click();
    await form.getByRole("button", { name: "Save result" }).click();
    await expect(
      page.getByText("Result recorded", { exact: true }),
    ).toBeVisible();
    await expect(form).toBeHidden();
    await expect
      .poll(() => matchLines(page, 1))
      .toEqual([`${c} 1–0 ${b}`, swapped[1], swapped[2]]);

    // AC 6: after one result the control is off, with its reason.
    const edits = roundSection(page, 1).getByRole("button", {
      name: "Edit pairings",
    });
    await expect(edits).toBeDisabled();
    await expect(
      roundSection(page, 1).locator('[data-slot="edit-disabled-reason"]'),
    ).toHaveText(ROUND_HAS_RESULT);
    // The next round waits for this one.
    await expect(
      page.getByRole("button", { name: "Pair next round", exact: true }),
    ).toBeDisabled();

    // Round 1 played, a Draw among the results.
    const [e, f] = sides(swapped[2]);
    await recordMatch(page, 1, swapped[1], "Draw");
    await recordMatch(page, 1, swapped[2], `${f} won`);
    await expect
      .poll(() => matchLines(page, 1))
      .toEqual([`${c} 1–0 ${b}`, `${a} ½–½ ${d}`, `${e} 0–1 ${f}`]);

    // Round 2.
    await page.getByRole("button", { name: "Pair next round" }).click();
    await expect(page.getByText("Round paired", { exact: true })).toBeVisible();
    await expect(matchRows(page, 2)).toHaveCount(3);
    const round2 = await matchLines(page, 2);
    expect(round2).toHaveLength(3);
    expect(round2.flatMap(sides).sort()).toEqual([...PEOPLE].sort());
    // Swiss never repeats a pair.
    const met = new Set(
      [swapped[0], swapped[1], swapped[2]].map((line) =>
        sides(line).sort().join("|"),
      ),
    );
    for (const line of round2) {
      expect(met.has(sides(line).sort().join("|")), line).toBe(false);
    }
    await recordMatch(page, 2, round2[0], `${sides(round2[0])[0]} won`);
    await recordMatch(page, 2, round2[1], "Draw");
    await recordMatch(page, 2, round2[2], `${sides(round2[2])[1]} won`);

    // Round 3, the default for 6 Entrants; Close waits for it.
    await page.getByRole("button", { name: "Pair next round" }).click();
    await expect(page.getByText("Round paired", { exact: true })).toBeVisible();
    await expect(matchRows(page, 3)).toHaveCount(3);
    const round3 = await matchLines(page, 3);
    expect(round3).toHaveLength(3);
    await expect(roundSection(page, 4)).toHaveCount(0);
    await expect(closeButton(page)).toBeDisabled();
    await expect(page.locator('[data-slot="close-reason"]')).toContainText(
      UNFINISHED,
    );
    await shoot(page, testInfo, "swiss-close-waits");
    await recordMatch(page, 3, round3[0], `${sides(round3[0])[0]} won`);
    await recordMatch(page, 3, round3[1], `${sides(round3[1])[1]} won`);
    await expect(closeButton(page)).toBeDisabled();
    await expect(page.locator('[data-slot="close-reason"]')).toContainText(
      UNFINISHED,
    );
    await recordMatch(page, 3, round3[2], "Draw");
    await expect(page.locator('[data-slot="close-reason"]')).toHaveCount(0);
    await expect(closeButton(page)).toBeEnabled();

    // Close: Placement Points, each "From league".
    await closeButton(page).click();
    await page
      .getByRole("alertdialog", { name: "Close this Competition?" })
      .getByRole("button", { name: "Close" })
      .click();
    await expect(page.getByText("Competition closed")).toBeVisible();
    await shoot(page, testInfo, "swiss-closed-admin");

    const entries = await xiCompetitionEntries(name);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    expect(entries.every((entry) => entry.generated)).toBe(true);
    const notes = await runQuery<{ note: string }>(
      `select note from points_entry where competition_id = $1`,
      [id],
    );
    expect(notes.map((row) => row.note)).toEqual(
      entries.map(() => "From league"),
    );

    // The Participant page: each row's points are its Points Entry; 1st
    // took the first Placement Points (5).
    await page.goto(`/xi/competitions/${id}`);
    const table = page.getByRole("table", { name: "League results" });
    await expect(table).toBeVisible();
    await expect(
      table.getByRole("button", { name: "Provisional" }),
    ).toHaveCount(0);
    const rows = table.locator('tr[data-slot="results-row"]');
    await expect(rows).toHaveCount(6);
    const byName = new Map(
      entries.map((entry) => [entry.target, entry.points]),
    );
    for (const person of PEOPLE) {
      const shown = byName.get(person);
      await expect(
        rows
          .filter({ hasText: person })
          .locator('[data-slot="results-points"]'),
      ).toHaveText(shown === undefined ? "–" : String(shown));
    }
    const first = await rows
      .first()
      .locator('[data-slot="results-name"]')
      .innerText();
    expect(byName.get(first)).toBe(5);
    expect(await xiParticipantPointsBreakdown(first)).toEqual([
      expect.objectContaining({ competition: name, points: 5 }),
    ]);
    await shoot(page, testInfo, "swiss-closed-page");

    // Reopen takes every Placement Point away.
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Reopen", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "Reopen this Competition?" })
      .getByRole("button", { name: "Reopen" })
      .click();
    await expect(page.getByText("Competition reopened")).toBeVisible();
    expect(await xiCompetitionEntries(name)).toEqual([]);
    expect(
      (await xiParticipantPointsBreakdown(first)).filter(
        (row) => row.competition === name,
      ),
    ).toEqual([]);
    expect(await xiCompetitionId(name)).toBe(id);
    await expect(closeButton(page)).toBeEnabled();
  } finally {
    await deleteCompetitions(name);
  }
});
