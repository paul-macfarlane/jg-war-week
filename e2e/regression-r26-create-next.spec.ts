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

/** `YYYY-MM-DD` plus `n` days. */
function addDays(day: string, n: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

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
  test.setTimeout(120_000);
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

    // Dates through the range picker, navigated to the months after XII's
    // end date (never the current calendar month), then the Story Theme.
    const [xiiRow] = await runQuery<{ end_date: string }>(
      "select end_date::text from war_week where edition = 'xii'",
    );
    const xiiEnds = xiiRow.end_date;
    const pickRange = async (from: string, to: string) => {
      await dialog.getByLabel("Dates").click();
      const calendar = page
        .getByRole("dialog")
        .filter({ has: page.getByRole("button", { name: "Done" }) });
      for (const day of [from, to]) {
        const cell = calendar.locator(`td[data-day="${day}"]`);
        for (let i = 0; i < 48 && (await cell.count()) === 0; i++) {
          // Which way the calendar must go: compare with its first visible day.
          const shown = await calendar
            .locator("td[data-day]")
            .first()
            .getAttribute("data-day");
          const toNext = day > shown!;
          await calendar
            .getByRole("button", {
              name: toNext ? /Next Month/ : /Previous Month/,
            })
            .click();
        }
        await cell.getByRole("button").first().click();
      }
      await calendar.getByRole("button", { name: "Done" }).click();
    };
    await dialog.getByLabel("Story Theme").fill("E2E next");

    // A start on XII's last day is refused on the Dates field; nothing is made.
    await pickRange(xiiEnds, addDays(xiiEnds, 4));
    await dialog.getByRole("button", { name: "Create War Week" }).click();
    await expect(
      dialog.getByText(/^Start date must be after War Week XII ends \(/),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    const [early] = await runQuery<{ n: string }>(
      "select count(*)::text as n from war_week where edition = 'xiii'",
    );
    expect(early.n).toBe("0");

    // Dates after XII's end are accepted.
    const start = addDays(xiiEnds, 7);
    const end = addDays(xiiEnds, 11);
    await pickRange(start, end);
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

    // XIII is now the latest and upcoming, so XII (complete) is no longer
    // the latest: it loses the button. Fails if the rule were defeated by dates.
    await viewEdition(page, "xii");
    await expect(lifecycle.getByText("Archive", { exact: true })).toBeVisible();
    await expect(button).toHaveCount(0);
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
