import { expect, test } from "@playwright/test";

import { openCompetitionPage } from "./competition-page";
import { runQuery, xiCompetitionEntries } from "./db";
import { E2E_BASE_URL } from "./env";
import {
  addEntrants,
  addXiCompetition,
  deleteCompetitions,
  shoot,
} from "./r21-logging";
import { asHost, participantPageAs } from "./session";

// Epic R21, AC 6 (and AC 5's Head-to-head part through the form;
// .scratch/competition-setup/spec.md, decisions 7 and 12): a Head-to-head
// Best of 3 between two Entrants. The log form shows the two Entrants as
// fixed rows with a Score each and no player picker, and the Winner
// follows the Scores. After 2–0, logging a third Match is refused by the
// server (a form opened before the series was decided) and the Log button
// is disabled with the reason beside it, for the Entrants and the Host. A
// Best of 3 with draws whose Matches all play out with no majority is drawn: no more Matches, and
// on Close both Entrants get the higher place's full points. Each test's
// Competition is its own, deleted in `finally`.

const ASHLEY = "Ashley Schuliger";
const SAM = "Sam Schantz";
const DECIDED = "This series is decided, so logging is closed.";
const DRAWN =
  "Every Match of this series is played with no majority: the series is drawn.";
const DRAWN_NOTE =
  "Drawn: every Match is played with no majority, so no series Winner.";

test("r21 AC6 a Best of 3 at 2–0 refuses a third Match on the server and disables Log a Match with the reason; the form has two fixed rows and no picker", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `E2E R21 Series ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "head-to-head",
    scoreDirection: "higher",
    scoreUnit: "pts",
    selfReport: true,
  });
  await addEntrants(id, [ASHLEY, SAM]);
  const ashley = await participantPageAs(browser, ASHLEY);
  const sam = await participantPageAs(browser, SAM);
  try {
    // Ashley logs Match 1 from Scores: two fixed rows, no picker.
    const you = ashley.page;
    await you.setViewportSize({ width: 1440, height: 900 });
    await you.goto(`/xi/competitions/${id}`);
    await you.getByRole("button", { name: "Log a Match" }).click();
    const form = you.getByRole("dialog", { name: "Log a Match" });
    await expect(form.getByRole("combobox")).toHaveCount(0);
    await expect(form.getByLabel(/Score \(pts\)$/)).toHaveCount(2);
    await form.getByLabel(`${ASHLEY}: Score (pts)`).fill("21");
    await form.getByLabel(`${SAM}: Score (pts)`).fill("15");
    const winner = form.getByRole("group", { name: "Winner" });
    await expect(
      winner.getByRole("button", { name: `${ASHLEY} won` }),
    ).toHaveAttribute("aria-pressed", "true");
    await shoot(you, testInfo, "log-form");
    await form.getByRole("button", { name: "Log Match" }).click();
    await expect(you.getByText("Match logged")).toBeVisible();

    // Sam opens the form while the series is still open…
    const rival = sam.page;
    await rival.goto(`/xi/competitions/${id}`);
    await rival.getByRole("button", { name: "Log a Match" }).click();
    const late = rival.getByRole("dialog", { name: "Log a Match" });
    await late.getByLabel(`${ASHLEY}: Score (pts)`).fill("10");
    await late.getByLabel(`${SAM}: Score (pts)`).fill("21");

    // …and the Host logs Match 2: Ashley 2–0, a majority of 3.
    await asHost(context);
    await page.goto(`/xi/competitions/${id}`);
    await page.getByRole("button", { name: "Log a Match" }).click();
    const hostForm = page.getByRole("dialog", { name: "Log a Match" });
    await hostForm.getByLabel(`${ASHLEY}: Score (pts)`).fill("21");
    await hostForm.getByLabel(`${SAM}: Score (pts)`).fill("9");
    await hostForm.getByRole("button", { name: "Log Match" }).click();
    await expect(page.getByText("Match logged")).toBeVisible();
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-score"]'),
    ).toHaveText("2–0");

    // Sam's save is refused by the server.
    await late.getByRole("button", { name: "Log Match" }).click();
    await expect(rival.getByText(DECIDED)).toBeVisible();
    await expect(late).toBeVisible();
    const [{ matches }] = await runQuery<{ matches: number }>(
      `select count(*)::int as matches from series_match where competition_id = $1`,
      [id],
    );
    expect(matches).toBe(2);

    // Every viewer who could log sees the button disabled, the reason beside it.
    await rival.reload();
    for (const viewer of [rival, page]) {
      await viewer.goto(`/xi/competitions/${id}`);
      await expect(
        viewer.getByRole("button", { name: "Log a Match" }),
      ).toBeDisabled();
      await expect(
        viewer
          .getByRole("region", { name: "Results" })
          .locator('[data-slot="log-disabled-reason"]'),
      ).toHaveText(DECIDED);
    }
    await openCompetitionPage(page, id);
    const admin = page.getByRole("region", { name: "Matches" });
    await expect(
      admin.getByRole("button", { name: "Log a Match" }),
    ).toBeDisabled();
    await expect(admin.locator('[data-slot="log-disabled-reason"]')).toHaveText(
      DECIDED,
    );
    await shoot(page, testInfo, "admin-decided");
    await shoot(rival, testInfo, "participant-decided");
  } finally {
    await ashley.close();
    await sam.close();
    await deleteCompetitions(name);
  }
});

test("r21 AC6 a drawn Best of 3 that runs out takes no more Matches, and both Entrants share the higher place's full points on Close", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const name = `E2E R21 Drawn series ${Date.now()}`;
  const id = await addXiCompetition(name, {
    format: "head-to-head",
    scoreDirection: "higher",
    seriesConfig: { drawsAllowed: true, bestOf: 3 },
    selfReport: true,
    placementPoints: [5, 2],
  });
  await addEntrants(id, [ASHLEY, SAM]);
  const ashley = await participantPageAs(browser, ASHLEY);
  try {
    await asHost(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/xi/competitions/${id}`);
    // Ashley wins, then equal Scores twice: two Draws (draws are allowed).
    // 1–0 in wins, but every Match is played with no majority: drawn.
    for (const [a, s] of [
      ["21", "15"],
      ["7", "7"],
      ["9", "9"],
    ]) {
      await page.getByRole("button", { name: "Log a Match" }).click();
      const form = page.getByRole("dialog", { name: "Log a Match" });
      await form.getByLabel(`${ASHLEY}: Score`).fill(a);
      await form.getByLabel(`${SAM}: Score`).fill(s);
      await form.getByRole("button", { name: "Log Match" }).click();
      await expect(form).toBeHidden();
    }
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-match-result"]'),
    ).toHaveText([`Winner: ${ASHLEY}`, "Draw", "Draw"]);
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-note"]'),
    ).toHaveText(DRAWN_NOTE);

    // All three played with no majority: drawn, no more Matches.
    await expect(
      page.getByRole("button", { name: "Log a Match" }),
    ).toBeDisabled();
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="log-disabled-reason"]'),
    ).toHaveText(DRAWN);
    await ashley.page.goto(`${E2E_BASE_URL}/xi/competitions/${id}`);
    await expect(
      ashley.page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="log-disabled-reason"]'),
    ).toHaveText(DRAWN);

    // Close: both share 1st, so both get its full 5 points.
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("alertdialog", { name: "Close this Competition?" })
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Competition closed")).toBeVisible();
    expect(await xiCompetitionEntries(name)).toEqual([
      { target: ASHLEY, points: 5, generated: true },
      { target: SAM, points: 5, generated: true },
    ]);
    await page.goto(`/xi/competitions/${id}`);
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-points-value"]'),
    ).toHaveText(["5 points", "5 points"]);
    await expect(
      page
        .getByRole("region", { name: "Results" })
        .locator('[data-slot="series-note"]'),
    ).toHaveText(DRAWN_NOTE);
    await shoot(page, testInfo, "drawn-closed");
  } finally {
    await ashley.close();
    await deleteCompetitions(name);
  }
});
