import { type Locator, expect, test } from "@playwright/test";

import { runQuery } from "./db";
import { finaleStage, nextUntil, openFinale } from "./finale-slides";
import { loadScaleDemo, restoreLocalSeed } from "./scale-demo";
import { asOrganizer } from "./session";

// Epic R24, ticket 113: the Finale's Standings countdown plays only the top
// 10 (every row tied at 10th included), with "…and N more Participants
// scored" under it. All 100 XII Participants score, so the cut matters.

const VIEWPORTS = [
  ["1440x900", { width: 1440, height: 900 }],
  ["390x844", { width: 390, height: 844 }],
] as const;

test.describe("the Finale's Standings countdown with 100 scorers", () => {
  test.beforeAll(async () => {
    loadScaleDemo();
    // Everyone with no points gets a Discretionary entry of 1.0 to 9.9
    // points: mostly distinct, a few ties. The afterAll reload below puts the data back.
    await runQuery(
      `insert into points_entry (war_week_id, participant_id, points, note, entered_by_email)
       select p.war_week_id, p.id, 1 + (row_number() over (order by p.id) % 90) / 10.0,
              'r24 finale', 'e2e@example.com'
       from participant p join war_week w on w.id = p.war_week_id
       where w.edition = 'xii'
         and not exists (select 1 from points_entry e where e.participant_id = p.id)`,
    );
  });

  test.afterAll(() => {
    // Team rule: put the shared seeded data back (drops the entries above).
    restoreLocalSeed();
  });

  async function expected() {
    const rows = await runQuery<{ total: string; rank: string }>(
      `with totals as (
         select e.participant_id, sum(e.points) as total
         from points_entry e join war_week w on w.id = e.war_week_id
         where w.edition = 'xii' and e.participant_id is not null
         group by e.participant_id)
       select total::text, (1 + (select count(*) from totals b where b.total > t.total))::text as rank
       from totals t order by total desc`,
    );
    const ranks = rows.map((r) => Number(r.rank));
    return {
      scorers: rows.length,
      shown: ranks.filter((r) => r <= 10).length,
    };
  }

  async function words(row: Locator) {
    return (await row.innerText()).trim().split(/\s+/);
  }

  for (const [label, size] of VIEWPORTS) {
    test(`r24 113 the countdown shows the top 10 and a more line at ${label}`, async ({
      browser,
    }, testInfo) => {
      test.setTimeout(120_000);
      const context = await browser.newContext({ viewport: size });
      await asOrganizer(context);
      const page = await context.newPage();
      try {
        const want = await expected();
        expect(want.scorers).toBe(100);
        expect(want.shown).toBeGreaterThanOrEqual(10);
        expect(want.shown).toBeLessThan(30);

        // The leaderboard's top rows, as the Finale must show them.
        await page.goto("/xii/leaderboard");
        const board = page
          .getByRole("table", { name: "Standings", exact: true })
          .locator('tr[data-slot="results-row"]');
        await expect(board).toHaveCount(100);
        const top: string[][] = [];
        for (let i = 0; i < want.shown; i++) {
          const row = board.nth(i);
          top.push([
            (await row.getByRole("cell").first().innerText()).trim(),
            ...(await row.locator('[data-slot="results-name"]').innerText())
              .trim()
              .split(/\s+/),
            (
              await row.locator('[data-slot="results-points"]').innerText()
            ).trim(),
          ]);
        }

        // Ties at 10th are in, and the next rank down is not.
        const next = (
          await board.nth(want.shown).getByRole("cell").first().innerText()
        ).trim();
        expect(Number(next)).toBeGreaterThan(10);

        await openFinale(page, "/xii/finale");
        await nextUntil(page, "standings");
        await expect(finaleStage(page)).toHaveAttribute(
          "data-finale-slide",
          "standings",
        );
        await expect(page.getByRole("button", { name: "Replay" })).toBeVisible({
          timeout: 30_000,
        });

        const items = page.getByRole("main").getByRole("listitem");
        await expect(items).toHaveCount(want.shown);
        const shown: string[][] = [];
        for (let i = 0; i < want.shown; i++) {
          // The row's Avatar initials come right after the rank.
          const [rank, , ...rest] = await words(items.nth(i));
          shown.push([rank, ...rest]);
        }
        expect(shown).toEqual(top);
        expect(shown[0][0]).toBe("1");
        for (const row of shown) expect(Number(row[0])).toBeLessThanOrEqual(10);
        const more = want.scorers - want.shown;
        await expect(page.locator("[data-finale-more]")).toHaveText(
          `…and ${more} more Participants scored`,
        );
        await expect(page.locator("[data-finale-more]")).toBeInViewport();
        await page.screenshot({
          path: testInfo.outputPath(`finale-top-10-${label}.png`),
          animations: "disabled",
        });
      } finally {
        await context.close();
      }
    });
  }
});
