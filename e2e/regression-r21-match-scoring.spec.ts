import { type Page, expect, test } from "@playwright/test";

import { openCompetitionPage } from "./competition-page";
import { runQuery } from "./db";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
  shoot,
} from "./r21-logging";
import { asHost, asOrganizer } from "./session";

// Epic R21, AC 5 (.scratch/competition-setup/spec.md, decision 7): Scores
// decide places and Winners. In a Group Bracket Match of four, once every
// Entrant has a Score the finishing order (and who advances) follows the
// direction; equal Scores need the order set by hand, shown "Set by hand".
// In a Head-to-head Match the better Score wins; equal Scores record a
// Draw when draws are allowed, and otherwise need the Winner picked (the
// server refuses the save without one), shown "Set by hand". Each test's
// Competition is its own, deleted in `finally`.

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";
const RYAN = "Ryan Shendler";
const ADAM = "Adam Wilson-Hwang";
const EQUAL = "The Scores are equal: pick the Winner.";

/** The place badge an Entrant's finishing-order button shows, or none. */
function placeOf(page: Page, who: string) {
  return page
    .getByRole("group", { name: "Finishing order" })
    .getByRole("button", { name: new RegExp(who) })
    .locator('[aria-label^="Place "]');
}

test("r21 AC5 a Group Bracket Match's places follow its Scores; equal Scores are settled by hand and shown Set by hand", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const name = `E2E R21 Group scores ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "bracket",
    scoreDirection: "higher",
    scoreUnit: "pts",
    bracketConfig: {
      kind: "group",
      entrantsPerMatch: 4,
      advancePerMatch: 2,
      thirdPlaceMatch: false,
      rounds: {},
    },
  });
  await addEntrants(id, [ASHLEY, SAM, RYAN, ADAM]);
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    const tree = page.locator("[data-bracket-tree]").first();
    await tree.getByRole("button", { name: "Record result for Final" }).click();
    const sheet = page.getByRole("dialog", { name: "Final" });
    const save = sheet.getByRole("button", { name: "Save Match Result" });
    await expect(save).toBeDisabled();
    for (const [who, score] of [
      [ASHLEY, "30"],
      [SAM, "10"],
      [RYAN, "20"],
      [ADAM, "40"],
    ]) {
      await sheet.getByLabel(`${who} score (pts)`).fill(score);
    }
    // Every Score in: the order follows them, higher first.
    for (const [who, place] of [
      [ADAM, "Place 1"],
      [ASHLEY, "Place 2"],
      [RYAN, "Place 3"],
      [SAM, "Place 4"],
    ]) {
      await expect(placeOf(page, who)).toHaveAttribute("aria-label", place);
    }
    await expect(sheet.locator('[data-slot="set-by-hand"]')).toHaveCount(0);
    await save.click();
    await expect(page.getByText(`${ADAM} wins Final`)).toBeVisible();
    const final = tree
      .getByRole("group", { name: "Final", exact: true })
      .last();
    await expect(final.locator('[data-slot="set-by-hand"]')).toHaveCount(0);
    const stored = () =>
      runQuery<{ name: string; place: number }>(
        `select p.display_name as name, me.place
         from bracket_match m
         join bracket_match_entrant me on me.bracket_match_id = m.id
         join entrant e on e.id = me.entrant_id
         join participant p on p.id = e.participant_id
         where m.competition_id = $1 order by me.place`,
        [id],
      );
    expect(await stored()).toEqual([
      { name: ADAM, place: 1 },
      { name: ASHLEY, place: 2 },
      { name: RYAN, place: 3 },
      { name: SAM, place: 4 },
    ]);

    // Sam ties Adam at 40: no order until it's settled by hand.
    await tree.getByRole("button", { name: "Edit Final", exact: true }).click();
    await sheet.getByLabel(`${SAM} score (pts)`).fill("40");
    await expect(save).toBeDisabled();
    await expect(
      sheet.getByText("Equal Scores: settle the order by hand."),
    ).toBeVisible();
    for (const who of [SAM, ADAM, ASHLEY, RYAN]) {
      await sheet
        .getByRole("group", { name: "Finishing order" })
        .getByRole("button", { name: new RegExp(who) })
        .click();
    }
    await expect(sheet.locator('[data-slot="set-by-hand"]')).toBeVisible();
    await save.click();
    await expect(page.getByText(`${SAM} wins Final`)).toBeVisible();
    await expect(final.locator('[data-slot="set-by-hand"]')).toHaveText(
      "Set by hand",
    );
    expect((await stored()).map((r) => r.name)).toEqual([
      SAM,
      ADAM,
      ASHLEY,
      RYAN,
    ]);
    await shoot(page, testInfo, "group-set-by-hand");
  } finally {
    await deleteCompetitions(name);
  }
});

test("r21 AC5 a Head-to-head Match's Winner follows its Scores; equal Scores record a Draw with draws allowed, else need a pick shown Set by hand", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const stamp = Date.now();
  const draws = `E2E R21 H2H draws ${stamp}`;
  const noDraws = `E2E R21 H2H no draws ${stamp}`;
  const withDraws = await addXiCompetition(draws, {
    format: "head-to-head",
    scoreDirection: "lower",
    scoreUnit: "sec",
    seriesConfig: { drawsAllowed: true, bestOf: 3 },
  });
  await addEntrants(withDraws, [ASHLEY, SAM]);
  const without = await addXiCompetition(noDraws, {
    format: "head-to-head",
    scoreDirection: "higher",
    seriesConfig: { drawsAllowed: false, bestOf: 3 },
  });
  await addEntrants(without, [ASHLEY, SAM]);
  try {
    await asHost(context);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Lower is better: Ashley's 12 sec beats Sam's 15.
    await page.goto(`/xi/competitions/${withDraws}`);
    const log = async (a: string, s: string) => {
      await page.getByRole("button", { name: "Log a Match" }).click();
      const form = page.getByRole("dialog", { name: "Log a Match" });
      await form.getByLabel(`${ASHLEY}: Score (sec)`).fill(a);
      await form.getByLabel(`${SAM}: Score (sec)`).fill(s);
      return form;
    };
    let form = await log("12", "15");
    const winner = form.getByRole("group", { name: "Winner" });
    await expect(
      winner.getByRole("button", { name: `${ASHLEY} won` }),
    ).toHaveAttribute("aria-pressed", "true");
    await form.getByRole("button", { name: "Log Match" }).click();
    await expect(form).toBeHidden();
    // Equal Scores, draws allowed: a Draw.
    form = await log("9", "9");
    await expect(
      form.getByRole("group", { name: "Winner" }).getByRole("button", {
        name: "Draw",
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await form.getByRole("button", { name: "Log Match" }).click();
    await expect(form).toBeHidden();
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${ASHLEY}`, "Draw"]);
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="set-by-hand"]'),
    ).toHaveCount(0);

    // No draws: equal Scores need a pick; the server refuses the save
    // without one.
    await page.goto(`/xi/competitions/${without}`);
    await page.getByRole("button", { name: "Log a Match" }).click();
    form = page.getByRole("dialog", { name: "Log a Match" });
    await form.getByLabel(`${ASHLEY}: Score`).fill("7");
    await form.getByLabel(`${SAM}: Score`).fill("7");
    const pick = form.getByRole("group", { name: "Winner" });
    await expect(pick.getByRole("button", { name: "Draw" })).toHaveCount(0);
    await expect(pick.getByRole("button", { pressed: true })).toHaveCount(0);
    await expect(form.getByText(EQUAL)).toBeVisible();
    await form.getByRole("button", { name: "Log Match" }).click();
    // The server's refusal, as a toast.
    await expect(
      page.locator("[data-sonner-toast]").filter({ hasText: EQUAL }),
    ).toBeVisible();
    await expect(form).toBeVisible();
    await pick.getByRole("button", { name: `${SAM} won` }).click();
    await expect(form.locator('[data-slot="set-by-hand"]')).toHaveText(
      "Set by hand",
    );
    await form.getByRole("button", { name: "Log Match" }).click();
    await expect(form).toBeHidden();
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${SAM}`]);
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="set-by-hand"]'),
    ).toHaveText(["Set by hand"]);
    const [{ matches }] = await runQuery<{ matches: number }>(
      `select count(*)::int as matches from series_match where competition_id = $1`,
      [without],
    );
    expect(matches).toBe(1);
    await shoot(page, testInfo, "h2h-set-by-hand");
  } finally {
    await deleteCompetitions(draws, noDraws);
  }
});
