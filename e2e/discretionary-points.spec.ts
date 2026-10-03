import { expect, test } from "@playwright/test";

import { runQuery, xiCompetitionId } from "./db";
import { fillDiscretionary, openGiveForm } from "./discretionary";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";
import { teamTotal } from "./standings";

// Part 91: Discretionary points on demo XI. Everything the spec adds is
// removed in `finally`, by its reason prefix, so a rerun starts clean.
const REASON = "e2e Discretionary";

async function deleteSpecEntries() {
  await runQuery(`delete from points_entry where note like $1`, [`${REASON}%`]);
}

test("an Organizer gives 3 Discretionary points to a Team, edits it to 4 and deletes it, and the leaderboard follows", async ({
  context,
  page,
}, testInfo) => {
  const reason = `${REASON} ${Date.now()}`;
  try {
    await asOrganizer(context);
    await page.goto("/xi/leaderboard");
    const before = await teamTotal(page, "Blue");

    await page.goto("/admin/discretionary-points");
    const form = await openGiveForm(page);
    await fillDiscretionary(page, form, {
      target: "Blue",
      points: "3",
      reason,
    });
    await form
      .getByRole("button", { name: "Give Discretionary points" })
      .click();
    await expect(page.getByText("Discretionary points saved")).toBeVisible();

    const ledger = page.getByRole("list", { name: "Discretionary points" });
    const row = ledger.getByRole("listitem").filter({ hasText: reason });
    await expect(row).toContainText("Blue");
    await expect(row).toContainText("e2e-organizer@jahnelgroup.com");
    await expect(row).not.toContainText("edited");
    await page.screenshot({
      path: testInfo.outputPath("discretionary-points-given.png"),
      fullPage: true,
    });

    await page.goto("/xi/leaderboard");
    expect(await teamTotal(page, "Blue")).toBeCloseTo(before + 3, 2);

    // Edit 3 to 4: the row keeps its entered-by and shows it was edited.
    // The ledger marks an entry edited only when the edit is over a second
    // after it was given; the flow is faster than that, so backdate it.
    await runQuery(
      `update points_entry set created_at = created_at - interval '1 minute'
       where note = $1`,
      [reason],
    );
    await page.goto("/admin/discretionary-points");
    await page.getByRole("button", { name: "Edit 3 points to Blue" }).click();
    const editForm = page.getByRole("form", { name: "Discretionary points" });
    await expect(editForm.getByLabel("Reason", { exact: true })).toHaveValue(
      reason,
    );
    await editForm.getByLabel("Points", { exact: true }).fill("4");
    await editForm.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Discretionary points saved")).toBeVisible();
    const edited = page
      .getByRole("list", { name: "Discretionary points" })
      .getByRole("listitem")
      .filter({ hasText: reason });
    await expect(edited).toContainText("edited");
    await expect(edited).toContainText("e2e-organizer@jahnelgroup.com");

    await page.goto("/xi/leaderboard");
    expect(await teamTotal(page, "Blue")).toBeCloseTo(before + 4, 2);

    // Delete: confirm, and the leaderboard returns to where it started.
    await page.goto("/admin/discretionary-points");
    await page.getByRole("button", { name: "Delete 4 points to Blue" }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.getByText("Discretionary points deleted")).toBeVisible();
    await expect(page.getByText(reason)).toHaveCount(0);

    await page.goto("/xi/leaderboard");
    expect(await teamTotal(page, "Blue")).toBeCloseTo(before, 2);
  } finally {
    await deleteSpecEntries();
  }
});

test("a Discretionary entry without a reason is refused under Reason", async ({
  context,
  page,
}) => {
  try {
    await asOrganizer(context);
    await page.goto("/admin/discretionary-points");
    const form = await openGiveForm(page);
    await fillDiscretionary(page, form, {
      target: "Blue",
      points: "1",
      reason: "   ",
    });
    await form
      .getByRole("button", { name: "Give Discretionary points" })
      .click();
    await expect(
      form.getByRole("alert").filter({ hasText: "Give a reason." }),
    ).toBeVisible();
    await expect(form.getByLabel("Reason", { exact: true })).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    const [{ n }] = await runQuery<{ n: string }>(
      `select count(*)::text as n from points_entry where note like $1 or note = '   '`,
      [`${REASON}%`],
    );
    expect(n).toBe("0");
  } finally {
    await deleteSpecEntries();
  }
});

test("a Host gets the refusal page and no nav link for Discretionary points", async ({
  context,
  page,
}) => {
  const competitionId = await xiCompetitionId("Pool");
  try {
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, E2E_HOST_EMAIL],
    );
    await asHost(context);
    await page.goto("/admin/discretionary-points");
    await expect(
      page.getByRole("heading", { name: "Organizers and Hosts only." }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Give Discretionary points" }),
    ).toHaveCount(0);

    await page.goto("/admin/competitions");
    await expect(
      page.getByRole("link", { name: "Discretionary points" }),
    ).toHaveCount(0);
  } finally {
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [competitionId, E2E_HOST_EMAIL],
    );
  }
});

test("the old Points links redirect, and /admin lands on Competitions", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  await page.goto("/admin/points");
  await expect(page).toHaveURL(/\/admin\/discretionary-points$/);
  await page.goto("/admin/points/00000000-0000-4000-8000-000000000000");
  await expect(page).toHaveURL(/\/admin\/discretionary-points$/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/competitions$/);
});
