import { type Page, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R9, ticket 59: the War Week settings save themselves
// (.scratch/regression-2026-09/issues/59-settings-autosave.md).

type XiSettings = { story_theme: string; slack_channel_url: string };

async function readXi(): Promise<XiSettings> {
  const [row] = await runQuery<XiSettings>(
    "select story_theme, slack_channel_url from war_week where edition = 'xi'",
  );
  return row;
}

function restoreXi(before: XiSettings) {
  return runQuery(
    "update war_week set story_theme = $1, slack_channel_url = $2 where edition = 'xi'",
    [before.story_theme, before.slack_channel_url],
  );
}

/** `/admin/settings`'s settings form and the save status by its heading. */
async function openSettings(page: Page) {
  await page.goto("/admin/settings");
  const form = page.getByRole("form", { name: "War Week settings" });
  await expect(form).toBeVisible();
  return { form, status: page.locator('[data-slot="autosave-status"]') };
}

test("r9 59-1 a Story Theme change saves itself and survives a reload", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  const before = await readXi();
  const changed = `${before.story_theme} (r9 59)`.slice(0, 120);
  try {
    const { form, status } = await openSettings(page);
    await expect(form.getByRole("button", { name: /^Save/ })).toHaveCount(0);
    await expect(status).toHaveText("Changes save automatically");

    await form.getByLabel("Story Theme").fill(changed);
    await expect(status).toHaveText("Saved");
    await page.screenshot({
      path: testInfo.outputPath("settings-saved.png"),
      animations: "disabled",
    });

    await page.reload();
    await expect(form.getByLabel("Story Theme")).toHaveValue(changed);
    expect((await readXi()).story_theme).toBe(changed);
  } finally {
    await restoreXi(before);
  }
});

test("r9 59-2 a bad Slack URL shows its error at the field and isn't saved; other fields still save", async ({
  context,
  page,
}, testInfo) => {
  await asOrganizer(context);
  const before = await readXi();
  const bad = "http://slack.example.com/x";
  try {
    const { form, status } = await openSettings(page);
    const slackUrl = form.getByLabel("Slack URL");
    await slackUrl.fill(bad);

    const slackField = form
      .getByRole("group")
      .filter({ has: page.getByLabel("Slack URL") });
    await expect(
      slackField.getByRole("alert").filter({
        hasText: "Slack URL must be an https URL.",
      }),
    ).toBeVisible();
    await expect(slackUrl).toHaveAttribute("aria-invalid", "true");
    await expect(slackUrl).toHaveValue(bad);
    await expect(status).toHaveText(/^Not saved/);
    await page.screenshot({
      path: testInfo.outputPath("settings-refused.png"),
      animations: "disabled",
    });

    // Another field saves on its own, without the refused URL.
    const changed = `${before.story_theme} (r9 59)`.slice(0, 120);
    await form.getByLabel("Story Theme").fill(changed);
    await expect.poll(async () => (await readXi()).story_theme).toBe(changed);
    expect((await readXi()).slack_channel_url).toBe(before.slack_channel_url);
    await expect(slackUrl).toHaveValue(bad);

    // The refused value isn't saved: the page warns before leaving, and the
    // reload shows the saved URL.
    page.on("dialog", (dialog) => void dialog.accept());
    await expect(status).toHaveText(/^Not saved/);
    await page.reload();
    await expect(form.getByLabel("Slack URL")).toHaveValue(
      before.slack_channel_url,
    );
  } finally {
    await restoreXi(before);
  }
});

test("r9 59-3 a value stored after the page loaded survives another field's save", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  const before = await readXi();
  const [{ winner }] = await runQuery<{ winner: string | null }>(
    "select winner from war_week where edition = 'xi'",
  );
  const newer = "Tie: Red & Blue (r9 59)";
  try {
    const { form, status } = await openSettings(page);
    // Written elsewhere (End War Week, another tab) after the form loaded.
    await runQuery("update war_week set winner = $1 where edition = 'xi'", [
      newer,
    ]);

    const changed = `${before.story_theme} (r9 59)`.slice(0, 120);
    await form.getByLabel("Story Theme").fill(changed);
    await expect(status).toHaveText("Saved");
    expect((await readXi()).story_theme).toBe(changed);
    const [after] = await runQuery<{ winner: string | null }>(
      "select winner from war_week where edition = 'xi'",
    );
    expect(after.winner).toBe(newer);
  } finally {
    await restoreXi(before);
    await runQuery("update war_week set winner = $1 where edition = 'xi'", [
      winner,
    ]);
  }
});

test("r9 59-4 leaving Settings with a refused field asks first; Cancel stays", async ({
  context,
  page,
}) => {
  await asOrganizer(context);
  const before = await readXi();
  try {
    const { form, status } = await openSettings(page);
    await form.getByLabel("Slack URL").fill("http://slack.example.com/x");
    await expect(status).toHaveText(/^Not saved/);

    await page
      .getByRole("navigation", { name: "Admin sections" })
      .getByRole("link", { name: "Points" })
      .click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("Leave without saving?");
    await expect(dialog).toContainText(
      "Slack URL wasn't saved: Slack URL must be an https URL.",
    );

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/admin\/settings$/);
    await expect(form.getByLabel("Slack URL")).toHaveValue(
      "http://slack.example.com/x",
    );
    // The refused value still isn't saved: let the page go without asking.
    page.on("dialog", (beforeUnload) => void beforeUnload.accept());
  } finally {
    await restoreXi(before);
  }
});
