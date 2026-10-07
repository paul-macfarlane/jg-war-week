import { type Page, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { E2E_BASE_URL } from "./env";
import { asOrganizer } from "./session";

// Epic R26, decisions 2 and 3: Create next War Week lives in the Lifecycle
// box, shows only on the latest War Week by start date once it is complete,
// opens in a dialog and copies nothing.
//
// This spec changes shared seeded data (War Week statuses) and creates War
// Week XIII, so it snapshots every War Week's status first and, in finally,
// deletes the War Weeks it created and puts each status back. Fixture: the
// seeded XI (live) and XII (upcoming, the latest by start date).

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

type Snapshot = { id: string; status: string };

async function viewEdition(page: Page, edition: string) {
  await page
    .context()
    .addCookies([{ name: "admin_edition", value: edition, url: E2E_BASE_URL }]);
  await page.goto("/admin/settings");
  await expect(page.getByRole("region", { name: "Lifecycle" })).toBeVisible();
}

const setStatus = (edition: string, status: string) =>
  runQuery("update war_week set status = $2 where edition = $1", [
    edition,
    status,
  ]);

test("r26 Create next War Week shows only on the latest complete War Week and copies nothing", async ({
  browser,
}, testInfo) => {
  const before = await runQuery<Snapshot>(
    "select id, status from war_week order by edition_number",
  );
  const context = await browser.newContext();
  await asOrganizer(context);
  const page = await context.newPage();
  await page.setViewportSize(DESKTOP);
  const lifecycle = page.getByRole("region", { name: "Lifecycle" });
  const button = lifecycle.getByRole("button", {
    name: "Create next War Week",
  });
  try {
    // XII is the latest and upcoming: no button on it, none on live XI.
    await viewEdition(page, "xii");
    await expect(
      lifecycle.getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(button).toHaveCount(0);
    await viewEdition(page, "xi");
    await expect(lifecycle.getByText("Live", { exact: true })).toBeVisible();
    await expect(button).toHaveCount(0);

    // Both ended: XII is the latest and complete, XI is an older Archive.
    await setStatus("xi", "complete");
    await setStatus("xii", "complete");
    await viewEdition(page, "xi");
    await expect(lifecycle.getByText("Archive", { exact: true })).toBeVisible();
    await expect(button).toHaveCount(0);
    await viewEdition(page, "xii");
    await expect(lifecycle.getByText("Archive", { exact: true })).toBeVisible();
    await expect(button).toBeVisible();

    // The dialog, prefilled with the next edition.
    await button.click();
    const dialog = page.getByRole("dialog", { name: "Create next War Week" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel("Edition", { exact: true })).toHaveValue(
      "XIII",
    );
    await expect(dialog.getByLabel("Edition number")).toHaveValue("13");
    await expect(dialog.getByText("Copy from")).toHaveCount(0);
    await expect(dialog.getByRole("switch")).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("dialog-1440.png"),
      animations: "disabled",
    });
    await page.setViewportSize(PHONE);
    await expect(dialog).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("dialog-390.png"),
      animations: "disabled",
    });
    await page.setViewportSize(DESKTOP);

    // Dates through the range picker, then the Story Theme.
    await dialog.getByLabel("Dates").click();
    const calendar = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("button", { name: "Done" }) });
    const cells = calendar.locator("td[data-day]");
    await cells.nth(10).getByRole("button").click();
    await cells.nth(14).getByRole("button").click();
    const start = await cells.nth(10).getAttribute("data-day");
    const end = await cells.nth(14).getAttribute("data-day");
    await calendar.getByRole("button", { name: "Done" }).click();
    await dialog.getByLabel("Story Theme").fill("E2E next");
    await dialog.getByRole("button", { name: "Create War Week" }).click();
    await expect(page.getByText("War Week XIII created")).toBeVisible();
    await expect(dialog).toBeHidden();

    // Upcoming, default settings, no Competitions, no FAQ.
    const [made] = await runQuery<{
      status: string;
      story_theme: string;
      start_date: string;
      end_date: string;
      team_label: string;
      leader_title: string;
      font_preset: string;
      competitions: string;
      faq: string;
    }>(
      `select w.status, w.story_theme, w.start_date::text, w.end_date::text,
         w.team_label, w.leader_title, w.font_preset,
         (select count(*)::text from competition c where c.war_week_id = w.id) as competitions,
         (select count(*)::text from faq_item f where f.war_week_id = w.id) as faq
       from war_week w where w.edition = 'xiii'`,
    );
    expect(made).toEqual({
      status: "upcoming",
      story_theme: "E2E next",
      start_date: start,
      end_date: end,
      team_label: "Team",
      leader_title: "Captain",
      font_preset: "sans",
      competitions: "0",
      faq: "0",
    });

    // The admin now shows XIII, upcoming and latest: no button again.
    await expect(
      lifecycle.getByText("Upcoming", { exact: true }),
    ).toBeVisible();
    await expect(button).toHaveCount(0);
    await page.screenshot({
      path: testInfo.outputPath("created-1440.png"),
      animations: "disabled",
    });
  } finally {
    await context.clearCookies({ name: "admin_edition" });
    const keep = before.map((w) => w.id);
    await runQuery("delete from war_week where id <> all($1::uuid[])", [keep]);
    for (const w of before.filter((x) => x.status !== "live")) {
      await runQuery("update war_week set status = $2 where id = $1", [
        w.id,
        w.status,
      ]);
    }
    for (const w of before.filter((x) => x.status === "live")) {
      await runQuery("update war_week set status = $2 where id = $1", [
        w.id,
        w.status,
      ]);
    }
    await context.close();
  }
});
