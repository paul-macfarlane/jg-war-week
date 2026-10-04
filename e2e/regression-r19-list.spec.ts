import { type Page, type TestInfo, expect, test } from "@playwright/test";

import { deleteXiCompetition, runQuery } from "./db";
import { E2E_PARTICIPANT_EMAIL, signIn } from "./session";

// Epic R19, ticket 105 (.scratch/regression-2026-10/issues/105-competitions-list-status.md):
// each row of the Participant Competitions list shows the name, a two-line
// description preview, a status and the Format and scoring badges, with no
// max badge. Demo XI has Not started and Done rows; this spec adds its own
// `E2E R19 …` Competitions for Underway (a Bracket in Round 1 of 2) and
// Closed (an individual Participation run), deleted in `finally`.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

const CLOSED = "E2E R19 Closed check-in";
const KNOCKOUT = "E2E R19 Knockout";

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

/** An individual Participation Competition in XI, Closed with no check-ins. */
async function addClosedParticipation() {
  await runQuery(
    `insert into competition (war_week_id, name, scoring, format,
       participation_points, closed_at)
     select id, $1, 'individual', 'participation', 1, now()
     from war_week where edition = 'xi'`,
    [CLOSED],
  );
}

/**
 * A four-Entrant head-to-head Bracket in XI: Round 1's first Match played,
 * its second ready, the final pending.
 */
async function addKnockoutInRoundOne() {
  const [{ id }] = await runQuery<{ id: string }>(
    `insert into competition (war_week_id, name, scoring, format)
     select id, $1, 'individual', 'bracket' from war_week where edition = 'xi'
     returning id`,
    [KNOCKOUT],
  );
  const entrants = await runQuery<{ id: string }>(
    `insert into entrant (competition_id, participant_id, seed_position)
     select $1, p.id, row_number() over (order by p.display_name)
     from (select p.id, p.display_name from participant p
           join war_week w on w.id = p.war_week_id and w.edition = 'xi'
           order by p.display_name limit 4) p
     returning id`,
    [id],
  );
  const matches = await runQuery<{ id: string }>(
    `insert into bracket_match (competition_id, round, position, status) values
       ($1, 1, 1, 'played'), ($1, 1, 2, 'ready'), ($1, 2, 1, 'pending')
     returning id`,
    [id],
  );
  const [first, second, final] = matches.map((h) => h.id);
  await runQuery(
    `update bracket_match set winner_to_match_id = $1, winner_to_slot = 0 where id = $2`,
    [final, first],
  );
  await runQuery(
    `update bracket_match set winner_to_match_id = $1, winner_to_slot = 1 where id = $2`,
    [final, second],
  );
  await runQuery(
    `insert into bracket_match_entrant (bracket_match_id, entrant_id, slot, place) values
       ($1, $3, 0, 1), ($1, $4, 1, 2), ($2, $5, 0, null), ($2, $6, 1, null),
       ($7, $3, 0, null)`,
    [first, second, ...entrants.map((e) => e.id), final],
  );
}

test("r19 105 the Competitions list shows each status, a two-line preview and no max badge at 1440 and 390", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(90_000);
  try {
    await deleteXiCompetition(CLOSED);
    await deleteXiCompetition(KNOCKOUT);
    await addClosedParticipation();
    await addKnockoutInRoundOne();
    await signIn(context, E2E_PARTICIPANT_EMAIL);

    for (const [viewport, size] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(size);
      await page.goto("/xi/competitions");
      // XI's two Competition Groups are Tabs; the ungrouped ones, these
      // four statuses among them, are the last.
      await page.getByRole("tab", { name: "Other Competitions" }).click();
      const panel = page.getByRole("tabpanel", { name: "Other Competitions" });
      const row = (name: string) =>
        panel.getByRole("listitem").filter({
          has: page.getByText(name, { exact: true }),
        });
      const status = (name: string) => row(name).locator("[data-status]");

      await expect(status("Tuesday Stairs")).toHaveText("Not started");
      await expect(status("Tuesday Stairs")).toBeVisible();
      await expect(status(KNOCKOUT)).toHaveText("Underway · Round 1 of 2");
      await expect(status(KNOCKOUT)).toBeVisible();
      await expect(status(CLOSED)).toHaveText("Closed");
      await expect(status(CLOSED)).toBeVisible();
      // The seeded 1st place (seeds/demo/xi.json).
      await expect(status("Settlers of Catan")).toHaveText(
        "Done · Winner: Anthony Conway",
      );
      await expect(status("Settlers of Catan")).toBeVisible();

      // The description's plain text, clamped to two lines; none when empty.
      const preview = row("Settlers of Catan").locator("p");
      await expect(preview).toHaveText(
        "The 9th annual Catan tournament hosted by Tony Mercadante.",
      );
      await expect(preview).toHaveCSS("-webkit-line-clamp", "2");
      await expect(row(CLOSED).locator("p")).toHaveCount(0);

      // The Format and scoring badges; no max badge anywhere on the list.
      await expect(row("Bouncy Pong")).toContainText("Head-to-head");
      await expect(row("Bouncy Pong")).toContainText(
        "Individual · counts toward Team",
      );
      await expect(page.getByRole("main")).not.toContainText(/\bmax\b/i);

      await shoot(page, testInfo, `competitions-list-${viewport}`);
      // A full-page shot at 390 can draw the fixed bottom nav over a row:
      // one more of the viewport, the Closed and Underway rows in view.
      await row(CLOSED).evaluate((el) =>
        el.scrollIntoView({ block: "center" }),
      );
      await page.screenshot({
        path: testInfo.outputPath(`competitions-list-${viewport}-in-view.png`),
        animations: "disabled",
      });
    }
  } finally {
    await deleteXiCompetition(CLOSED);
    await deleteXiCompetition(KNOCKOUT);
  }
});
