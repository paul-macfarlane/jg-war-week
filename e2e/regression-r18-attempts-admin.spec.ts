import { type Page, expect, test } from "@playwright/test";

import { addCompetition, openCompetitionPage } from "./competition-page";
import { deleteXiCompetition, runQuery } from "./db";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

// Epic R18, ticket 104 (.scratch/regression-2026-10/issues/104-*.md): a
// Host logs, edits and deletes a Best score attempt from the Competition's
// admin page (spec R20 decision 4: edit and delete sit in the person's
// expanded row); the Competition's own results (not War Week Standings)
// follow. The test makes its own `E2E R18 Best score …` Competition in demo
// XI and deletes it in `finally`.

const PLAYER = "Ashley Schuliger";

/** The player's row in a Best score results table (admin or Participant page). */
function resultsRow(page: Page) {
  return page
    .getByRole("table", { name: "Best score results" })
    .getByRole("row")
    .filter({ has: page.getByRole("rowheader", { name: PLAYER }) });
}

test("r18 104 a Host logs, edits and deletes a Best score Attempt from admin (in the person's expanded row), and the Competition's results follow", async ({
  browser,
  context,
  page,
}) => {
  test.setTimeout(150_000);
  const name = `E2E R18 Best score ${Date.now()}`;
  try {
    // An Organizer sets the Competition up: Best score, which has no
    // Entrant list (spec R21, decision 5).
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    const id = await addCompetition(page, {
      name,
      format: "Best score",
      scoring: "Individual",
    });
    await openCompetitionPage(page, id);
    await expect(
      page.getByRole("button", { name: "Save Entrants" }),
    ).toHaveCount(0);
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
      const attempts = host.getByRole("region", { name: "Attempts" });
      // No Attempt yet, so no row.
      await expect(attempts.getByText("No Attempts yet.")).toBeVisible();

      // Log an attempt for a Participant who is not the signed-in Host.
      await attempts.getByRole("button", { name: "Log an Attempt" }).click();
      const form = host.getByRole("dialog", { name: "Log an Attempt" });
      await form.getByRole("combobox", { name: "Participant" }).click();
      await host.getByRole("option", { name: PLAYER, exact: true }).click();
      await form.getByLabel(/^Score/).fill("42");
      await form.getByRole("button", { name: "Log Attempt" }).click();
      await expect(host.getByText("Attempt logged")).toBeVisible();
      await expect(form).toBeHidden();
      await expect(resultsRow(host)).toContainText("42");

      // Edit it to 55 from the person's expanded row.
      const toggle = resultsRow(host).getByRole("button", {
        name: /1 attempt/,
      });
      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await attempts
        .getByRole("button", { name: `Edit Attempt: ${PLAYER} · 42` })
        .click();
      const edit = host.getByRole("dialog");
      await edit.getByLabel(/^Score/).fill("55");
      await edit.getByRole("button", { name: "Save Attempt" }).click();
      await expect(host.getByText("Attempt updated")).toBeVisible();
      await expect(edit).toBeHidden();

      // The Competition's own results show the edited score.
      await host.goto(`/xi/competitions/${id}`);
      await expect(resultsRow(host)).toContainText("55");
      await expect(resultsRow(host)).not.toContainText("42");

      // Delete it from the expanded row behind the ConfirmDialog.
      await openCompetitionPage(host, id);
      await resultsRow(host)
        .getByRole("button", { name: /1 attempt/ })
        .click();
      await attempts
        .getByRole("button", { name: `Delete Attempt: ${PLAYER} · 55` })
        .click();
      const confirm = host.getByRole("alertdialog");
      await expect(confirm).toContainText("Delete this Attempt?");
      await confirm.getByRole("button", { name: "Delete" }).click();
      await expect(host.getByText("Attempt deleted")).toBeVisible();
      await expect(attempts.getByText("No Attempts yet.")).toBeVisible();
      await host.goto(`/xi/competitions/${id}`);
      await expect(host.getByText("No Attempts yet.")).toBeVisible();
      await expect(resultsRow(host)).toHaveCount(0);
    } finally {
      await hostContext.close();
    }
  } finally {
    await deleteXiCompetition(name);
  }
});
