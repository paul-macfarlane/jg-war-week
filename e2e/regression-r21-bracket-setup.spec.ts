import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { addCompetition, expectSaved } from "./competition-page";
import {
  deleteXiCompetition,
  runQuery,
  xiCompetitionEntries,
  xiCompetitionId,
} from "./db";
import { expectPodium } from "./podium";
import { asOrganizer } from "./session";

// Epic R21 (.scratch/competition-setup/spec.md, decisions 10 and 11):
// AC 12, Bracket settings toggle Head-to-head / Group, each showing only its
// own fields; AC 13, a Group Bracket of 11 seeded War Week XI Participants
// at 4 per Match with 2 advancing, edited in its tree (a move, a Match of 3
// with 1 advancing), run through the Match result form to a final of 4 and
// Closed into Points. The Competition is this spec's own, deleted in
// `finally`. Screenshots at 1440×900 and 390×844.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const ROUND_LOCKED =
  "Editing a round is locked once any Match in it has a result.";

/** The Settings form, and nothing else on the page. */
function settingsForm(page: Page) {
  return page.getByRole("form", { name: "Competition settings" });
}

/** The admin Bracket's tree. */
function tree(page: Page) {
  return page.locator("[data-bracket-tree]");
}

/** Screenshots the page at both viewports, the page never scrolling sideways. */
async function shoot(page: Page, testInfo: TestInfo, name: string) {
  for (const [label, viewport] of [
    ["1440", DESKTOP],
    ["390", PHONE],
  ] as const) {
    await page.setViewportSize(viewport);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`${name}-${label}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize(DESKTOP);
}

/** Each stored Match as "slots/advancing", by Round: an independent check. */
async function storedShape(competitionId: string): Promise<string[][]> {
  const rows = await runQuery<{
    round: number;
    slot_count: number;
    advance_count: number;
  }>(
    `select round, slot_count, advance_count from bracket_match
     where competition_id = $1 order by round, position`,
    [competitionId],
  );
  const rounds: string[][] = [];
  for (const row of rows) {
    (rounds[row.round - 1] ??= []).push(
      `${row.slot_count}/${row.advance_count}`,
    );
  }
  return rounds;
}

/**
 * Records `match` through the Match result form by tapping its Entrants in
 * the order the form lists them (finishing order), and returns that order.
 */
async function recordMatch(
  page: Page,
  names: string[],
  match: string,
): Promise<string[]> {
  await tree(page)
    .getByRole("button", { name: `Record result for ${match}` })
    .click();
  const sheet = page.getByRole("dialog", { name: match });
  await expect(sheet).toBeVisible();
  const buttons = sheet
    .getByRole("group", { name: "Finishing order" })
    .getByRole("button");
  const count = await buttons.count();
  const order: string[] = [];
  for (let i = 0; i < count; i++) {
    const button = buttons.nth(i);
    const text = await button.innerText();
    const name = names.find((n) => text.includes(n));
    if (!name) throw new Error(`No Entrant named in "${text}"`);
    order.push(name);
    await button.click();
  }
  await sheet.getByRole("button", { name: "Save Match Result" }).click();
  await expect(page.getByText(`${order[0]} wins ${match}`)).toBeVisible();
  await expect(sheet).toBeHidden();
  return order;
}

/** Opens a Round's editor from its heading in the tree. */
async function openRoundEditor(page: Page, round: string): Promise<Locator> {
  await tree(page)
    .getByRole("button", { name: `Edit ${round}`, exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: `Edit ${round}` });
  await expect(editor).toBeVisible();
  return editor;
}

test("r21 AC12 AC13 a Bracket toggles Head-to-head / Group, and a Group of 11 is edited in its tree, run and Closed into Points", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `E2E R21 Group of 11 ${Date.now()}`;
  const people = (
    await runQuery<{ display_name: string }>(
      `select p.display_name from participant p
       join war_week w on w.id = p.war_week_id and w.edition = 'xi'
       order by p.display_name limit 11`,
    )
  ).map((row) => row.display_name);
  expect(people).toHaveLength(11);

  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await addCompetition(page, {
      name,
      format: "Bracket",
      scoring: "Individual",
    });
    const id = await xiCompetitionId(name);
    await runQuery(
      `update competition set placement_points = array[5, 3, 1] where id = $1`,
      [id],
    );
    await page.reload();

    // AC 12: Head-to-head (the default) shows the 3rd place Match only.
    const form = settingsForm(page);
    const headToHead = form.getByRole("button", {
      name: "Head-to-head",
      exact: true,
    });
    const group = form.getByRole("button", { name: "Group", exact: true });
    const perMatch = form.getByRole("combobox", { name: "Entrants per Match" });
    const advance = form.getByRole("combobox", { name: "How many advance" });
    const thirdPlace = form.getByRole("switch", { name: "3rd place Match" });
    await expect(headToHead).toHaveAttribute("aria-pressed", "true");
    await expect(group).toHaveAttribute("aria-pressed", "false");
    await expect(thirdPlace).toBeVisible();
    await expect(perMatch).toHaveCount(0);
    await expect(advance).toHaveCount(0);
    await shoot(page, testInfo, "toggle-head-to-head");

    // Group shows the size fields only, saved as a group config.
    await group.click();
    await expectSaved(page);
    await expect(group).toHaveAttribute("aria-pressed", "true");
    await expect(perMatch).toContainText("4 per Match");
    await expect(advance).toContainText("Top 2 advance");
    await expect(thirdPlace).toHaveCount(0);
    const [saved] = await runQuery<{ bracket_config: { kind: string } }>(
      `select bracket_config from competition where id = $1`,
      [id],
    );
    expect(saved.bracket_config).toMatchObject({
      kind: "group",
      entrantsPerMatch: 4,
      advancePerMatch: 2,
    });
    await shoot(page, testInfo, "toggle-group");

    // AC 13: 11 Entrants, generated into Matches of 3, 4 and 4.
    const find = page.locator("#bracket-entrants");
    for (const person of people) {
      await find.fill(person);
      await page
        .getByRole("option", { name: new RegExp(`^${person}`) })
        .first()
        .click();
    }
    await expect(page.getByText("(11 chosen)")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();
    expect(await storedShape(id)).toEqual([
      ["3/2", "4/2", "4/2"],
      ["3/2", "3/2"],
      ["4/1"],
    ]);

    // Edit Round 1: move an Entrant of Match 2 to Match 1, then Match 2 (now
    // 3) sends on 1.
    let editor = await openRoundEditor(page, "Round 1");
    const move = editor
      .getByRole("region", { name: "Round 1 Match 2" })
      .getByRole("combobox", { name: /^Move .+ to$/ })
      .first();
    const moved = (await move.getAttribute("aria-label"))!.slice(5, -3);
    expect(people).toContain(moved);
    await move.click();
    await page.getByRole("option", { name: "Round 1 Match 1" }).click();
    await expect(
      page.getByText(`${moved} moved to Round 1 Match 1`),
    ).toBeVisible();
    await expect(
      editor
        .getByRole("region", { name: "Round 1 Match 1" })
        .getByRole("combobox", { name: `Move ${moved} to` }),
    ).toBeVisible();
    await editor
      .getByRole("combobox", { name: "How many advance from Round 1 Match 2" })
      .click();
    await page.getByRole("option", { name: "Top 1 advances" }).click();
    await expect(
      page.getByText("Round 1 Match 2: Top 1 advances"),
    ).toBeVisible();
    await shoot(page, testInfo, "round-1-editor");
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();

    // 2 + 1 + 2 = 5 go on: Round 2 is Matches of 3 and 2 (a bye).
    expect(await storedShape(id)).toEqual([
      ["4/2", "3/1", "4/2"],
      ["3/2", "2/2"],
      ["4/1"],
    ]);
    const round2Bye = tree(page).getByRole("group", {
      name: "Round 2 Match 2",
    });
    await expect(round2Bye).toContainText("Bye — advances");
    await expect(
      tree(page).getByRole("group", { name: "Round 1 Match 2" }),
    ).toContainText("Top 1 advances");

    // Results through the existing form, by places.
    await recordMatch(page, people, "Round 1 Match 1");
    // Round 1 has a result: its editor says why and offers nothing.
    editor = await openRoundEditor(page, "Round 1");
    await expect(editor.getByText(ROUND_LOCKED)).toBeVisible();
    await expect(
      editor.getByRole("button", { name: "Save Round defaults" }),
    ).toBeDisabled();
    for (const select of await editor.getByRole("combobox").all()) {
      await expect(select).toBeDisabled();
    }
    await shoot(page, testInfo, "round-1-locked");
    await page.keyboard.press("Escape");
    await expect(editor).toBeHidden();

    const second = await recordMatch(page, people, "Round 1 Match 2");
    await recordMatch(page, people, "Round 1 Match 3");
    // The bye is decided with its Round: no result to record.
    await expect(
      round2Bye.getByRole("button", { name: /Record result/ }),
    ).toHaveCount(0);
    // Match 2's winner, its only advancer, is in Round 2.
    await expect(
      tree(page).getByRole("group", { name: /^Round 2 Match/ }),
    ).toContainText([second[0]]);
    await recordMatch(page, people, "Round 2 Match 1");
    const final = await recordMatch(page, people, "Final");
    expect(final).toHaveLength(4);

    const podium = final.map((person, i) => ({
      place: ["1st", "2nd", "3rd", "4th"][i],
      name: person,
      points: ["5 points", "3 points", "1 point", "No points"][i],
    }));
    await expectPodium(page, podium);

    await page
      .getByRole("region", { name: "Bracket", exact: true })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Bracket closed")).toBeVisible();

    // Close wrote the final's places 1–3 as 5 · 3 · 1; 4th earns none.
    const entries = (await xiCompetitionEntries(name)).filter(
      (entry) => entry.generated,
    );
    expect(
      entries
        .map(({ target, points }) => ({ target, points }))
        .sort((a, b) => b.points - a.points),
    ).toEqual([
      { target: final[0], points: 5 },
      { target: final[1], points: 3 },
      { target: final[2], points: 1 },
    ]);
    // Closed: no Round can be edited.
    await expect(
      tree(page).getByRole("button", { name: /^Edit Round/ }),
    ).toHaveCount(0);

    // At 390 the tree scrolls sideways in its own region; the page doesn't.
    await page.setViewportSize(PHONE);
    const rounds = tree(page).getByRole("region", { name: "Rounds" });
    expect(await rounds.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(
      true,
    );
    await shoot(page, testInfo, "closed");
  } finally {
    await deleteXiCompetition(name);
  }
});
