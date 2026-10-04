import { type Page, expect, test } from "@playwright/test";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { deleteXiCompetition, runQuery } from "./db";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

// Epic R18, ticket 104 (.scratch/regression-2026-10/issues/104-log-games-from-admin.md):
// a Host logs, edits and deletes a Best score attempt from the Competition's
// admin page; the Competition's own leaderboard (not War Week Standings)
// follows. The test makes its own `E2E R18 Best score …` Competition in demo
// XI and deletes it in `finally`.

const PLAYER = "Ashley Schuliger";

/** The player's row on the Competition page's Games leaderboard. */
function leaderboardRow(page: Page) {
  return page
    .getByRole("region", { name: "Games" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: PLAYER }) });
}

test("r18 104 a Host logs, edits and deletes a Best score Game from admin, and the Competition leaderboard follows", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(150_000);
  const name = `E2E R18 Best score ${Date.now()}`;
  try {
    // An Organizer sets the Competition up: Best score, one fixed Entrant.
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await addCompetition(page, {
      name,
      format: "Best score",
      scoring: "Individual",
    });
    await openCompetitionPage(page, id);
    await page.getByRole("combobox", { name: "Entrants", exact: true }).click();
    await page
      .getByRole("option", { name: "A fixed list", exact: true })
      .click();
    await expectSaved(page);
    const find = page.locator("#games-entrants");
    await find.fill("Ashley");
    await page.getByRole("option", { name: new RegExp(`^${PLAYER}`) }).click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)`,
      [id, E2E_HOST_EMAIL],
    );

    const hostContext = await browser.newContext();
    try {
      await asHost(hostContext);
      const host = await hostContext.newPage();
      await host.setViewportSize({ width: 1440, height: 900 });
      await openCompetitionPage(host, id);
      const games = host.getByRole("region", { name: "Games" });
      await expect(games.getByText("No Games yet.")).toBeVisible();

      // Log an attempt for a Participant who is not the signed-in Host.
      await games.getByRole("button", { name: "Log a Game" }).click();
      const form = host.getByRole("dialog", { name: "Log a Game" });
      await form.getByRole("combobox", { name: "Player" }).click();
      await host.getByRole("option", { name: PLAYER, exact: true }).click();
      await form.getByLabel(/^Score/).fill("42");
      await form.getByRole("button", { name: "Log Game" }).click();
      await expect(host.getByText("Game logged")).toBeVisible();
      await expect(form).toBeHidden();
      await expect(games.getByText(/42/)).toBeVisible();

      // Edit it to 55.
      await games.getByRole("button", { name: /^Edit Game:/ }).click();
      const edit = host.getByRole("dialog");
      await edit.getByLabel(/^Score/).fill("55");
      await edit.getByRole("button", { name: "Save Game" }).click();
      await expect(host.getByText("Game updated")).toBeVisible();
      await expect(edit).toBeHidden();

      // The Competition's own leaderboard shows the edited score.
      await host.goto(`/xi/competitions/${id}`);
      await expect(leaderboardRow(host)).toContainText("55");
      await expect(leaderboardRow(host)).not.toContainText("42");

      // Delete it behind the ConfirmDialog; it leaves the leaderboard.
      await openCompetitionPage(host, id);
      await games.getByRole("button", { name: /^Delete Game:/ }).click();
      const confirm = host.getByRole("alertdialog");
      await expect(confirm).toContainText("Delete this Game?");
      await confirm.getByRole("button", { name: "Delete" }).click();
      await expect(host.getByText("Game deleted")).toBeVisible();
      await expect(games.getByText("No Games yet.")).toBeVisible();
      await host.goto(`/xi/competitions/${id}`);
      await expect(leaderboardRow(host).getByRole("cell").nth(0)).toHaveText(
        "—",
      );
      await expect(leaderboardRow(host)).not.toContainText("55");
    } finally {
      await hostContext.close();
    }
  } finally {
    await deleteXiCompetition(name);
  }
});
