import { expect, test } from "@playwright/test";

import { deleteXiCompetition, runQuery, xiTeamId } from "./db";
import { asOrganizer } from "./session";

// Epic R9: navigation and Home (.scratch/regression-2026-09/epics/R9-*).

const FIRST = "R9 Recent Trivia";
const SECOND = "R9 Recent Darts";

test.afterEach(async () => {
  await deleteXiCompetition(FIRST);
  await deleteXiCompetition(SECOND);
});

test("r9 56 Home shows Recent results newest first, one row per Competition's entries", async ({
  page,
  context,
}, testInfo) => {
  await asOrganizer(context);
  await deleteXiCompetition(FIRST);
  await deleteXiCompetition(SECOND);
  const red = await xiTeamId("Red");
  const blue = await xiTeamId("Blue");
  // Future timestamps so these are the newest rows whatever else is seeded.
  const ids: Record<string, string> = {};
  for (const name of [FIRST, SECOND]) {
    const [row] = await runQuery<{ id: string }>(
      `insert into competition (war_week_id, name, scoring)
       select id, $1, 'team' from war_week where edition = 'xi'
       returning id`,
      [name],
    );
    ids[name] = row.id;
  }
  const add = (name: string, teamId: string, points: number, minutes: number) =>
    runQuery(
      `insert into points_entry
         (competition_id, team_id, points, entered_by_email, entered_at)
       values ($1, $2, $3, 'e2e-organizer@jahnelgroup.com',
         now() + make_interval(mins => $4))`,
      [ids[name], teamId, points, minutes],
    );
  // Trivia: two entries added together; Darts: one, later.
  await add(FIRST, red, 10, 60 * 24);
  await add(FIRST, blue, 5, 60 * 24 + 1);
  await add(SECOND, blue, 3, 60 * 48);

  await page.goto("/xi");
  const section = page.getByRole("region", { name: "Recent results" });
  await expect(section).toBeVisible();
  const rows = section.getByRole("listitem");
  await expect(rows.nth(0)).toContainText(SECOND);
  await expect(rows.nth(0)).toContainText("Blue");
  await expect(rows.nth(0)).toContainText("3");
  await expect(rows.nth(1)).toContainText(FIRST);
  await expect(rows.nth(1)).toContainText("Red");
  await expect(rows.nth(1)).toContainText("10");
  await expect(rows.nth(1)).toContainText("Blue");
  await expect(rows.nth(1)).toContainText("5");
  expect(await rows.count()).toBeLessThanOrEqual(5);

  await expect(
    section.getByRole("link", { name: "All Competitions" }),
  ).toHaveAttribute("href", "/xi/competitions");
  await rows.nth(0).getByRole("link", { name: SECOND }).click();
  await expect(page).toHaveURL(new RegExp(`/xi/competitions/${ids[SECOND]}$`));

  await page.goto("/xi");
  await page.screenshot({
    path: testInfo.outputPath("home-recent-results.png"),
    fullPage: true,
  });
});
