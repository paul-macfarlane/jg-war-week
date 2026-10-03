import { expect, test } from "@playwright/test";

import { runQuery, xiTeamId } from "./db";
import { asOrganizer } from "./session";

// Epic R9: navigation and Home (.scratch/regression-2026-09/epics/R9-*).

const FIRST = "R9 Recent Spirit";
const SECOND = "R9 Recent Cleanup";

test.afterEach(async () => {
  await runQuery(`delete from points_entry where note in ($1, $2)`, [
    FIRST,
    SECOND,
  ]);
});

test("r9 56 Home shows Recent results newest first, one row per Discretionary entry", async ({
  page,
  context,
}, testInfo) => {
  await asOrganizer(context);
  await runQuery(`delete from points_entry where note in ($1, $2)`, [
    FIRST,
    SECOND,
  ]);
  const red = await xiTeamId("Red");
  const blue = await xiTeamId("Blue");
  // Future timestamps so these are the newest rows whatever else is seeded.
  const add = (note: string, teamId: string, points: number, minutes: number) =>
    runQuery(
      `insert into points_entry
         (war_week_id, team_id, points, note, entered_by_email, entered_at)
       select id, $1, $2, $3, 'e2e-organizer@jahnelgroup.com',
         now() + make_interval(mins => $4)
       from war_week where edition = 'xi'`,
      [teamId, points, note, minutes],
    );
  await add(FIRST, red, 10, 60 * 24);
  await add(SECOND, blue, 3, 60 * 48);

  await page.goto("/xi");
  const section = page.getByRole("region", { name: "Recent results" });
  await expect(section).toBeVisible();
  const rows = section.getByRole("listitem");
  await expect(rows.nth(0)).toContainText("Discretionary points");
  await expect(rows.nth(0)).toContainText(SECOND);
  await expect(rows.nth(0)).toContainText("Blue");
  await expect(rows.nth(0)).toContainText("3");
  await expect(rows.nth(1)).toContainText(FIRST);
  await expect(rows.nth(1)).toContainText("Red");
  await expect(rows.nth(1)).toContainText("10");
  expect(await rows.count()).toBeLessThanOrEqual(5);

  await expect(
    section.getByRole("link", { name: "All Competitions" }),
  ).toHaveAttribute("href", "/xi/competitions");
  await page.goto("/xi");
  await page.screenshot({
    path: testInfo.outputPath("home-recent-results.png"),
    fullPage: true,
  });
});
