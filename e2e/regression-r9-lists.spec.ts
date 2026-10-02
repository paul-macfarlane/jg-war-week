import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

/** Every row of `list` has a visible Edit and Delete named for the row. */
async function expectEditAndDeletePerRow(
  list: Locator,
  what: string,
  { editIsLink = false, lastMayStay = false } = {},
) {
  const rows = list.getByRole("listitem");
  const count = await rows.count();
  expect(count, `${what} rows`).toBeGreaterThan(0);
  const edits = list.getByRole(editIsLink ? "link" : "button", {
    name: /^Edit /,
  });
  const deletes = list.getByRole("button", { name: /^Delete / });
  await expect(edits, `${what} Edit per row`).toHaveCount(count);
  // The last Organizer can't be deleted, so has no Delete.
  await expect(deletes, `${what} Delete per row`).toHaveCount(
    lastMayStay && count === 1 ? 0 : count,
  );
  await expect(edits.first()).toBeVisible();
  await expect(edits.first()).toHaveText("Edit");
  if (!(lastMayStay && count === 1)) {
    await expect(deletes.first()).toBeVisible();
    await expect(deletes.first()).toHaveText("Delete");
  }
}

/** Confirms the open delete `ConfirmDialog`. */
async function confirmDelete(page: Page) {
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Delete", exact: true })
    .click();
}

test.describe("58 one Edit and Delete pattern for every admin list", () => {
  test("every admin list shows Edit and Delete per row at 390 and 1440", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    await asOrganizer(context);
    const lists: [
      string,
      string,
      Parameters<typeof expectEditAndDeletePerRow>[2]?,
    ][] = [
      ["/admin/competitions", "Competitions"],
      ["/admin/schedule", "Days"],
      ["/admin/schedule", "Schedule Items"],
      ["/admin/roster", "Teams"],
      ["/admin/roster", "Roster"],
      ["/admin/faq", "FAQ Items"],
      ["/admin/awards", "Awards"],
      ["/admin/announcements", "Announcements", { editIsLink: true }],
      ["/admin/organizers", "Organizers", { lastMayStay: true }],
    ];
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      for (const [path, name, options] of lists) {
        await page.goto(path);
        // Schedule Items group their Day lists under one labelled region.
        const list = page.locator(`main [aria-label="${name}"]`).first();
        await expectEditAndDeletePerRow(
          list,
          `${name} at ${viewport.width}`,
          options,
        );
      }
      for (const [path, slug] of [
        ["/admin/roster", "roster"],
        ["/admin/schedule", "schedule"],
      ]) {
        await page.goto(path);
        await shoot(page, testInfo, `${slug}-${viewport.width}`);
      }
    }
  });

  test("edit and delete a Participant and a Schedule Item through the row buttons", async ({
    context,
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    const participant = "R9 58 Participant";
    const renamed = "R9 58 Participant renamed";
    const title = "R9 58 Schedule Item";
    const retitled = "R9 58 Schedule Item retitled";
    const cleanUp = async () => {
      await runQuery(
        `delete from participant p using war_week w
         where w.id = p.war_week_id and w.edition = 'xi'
           and p.display_name = any($1)`,
        [[participant, renamed]],
      );
      await runQuery(
        `delete from schedule_item s using day d, war_week w
         where d.id = s.day_id and w.id = d.war_week_id and w.edition = 'xi'
           and s.title = any($1)`,
        [[title, retitled]],
      );
    };
    await cleanUp();
    try {
      await runQuery(
        `insert into participant (war_week_id, display_name)
         select id, $1 from war_week where edition = 'xi'`,
        [participant],
      );
      await runQuery(
        `insert into schedule_item (day_id, start_time, title, category)
         select d.id, '23:30', $1, 'social'
         from day d join war_week w on w.id = d.war_week_id
         where w.edition = 'xi' order by d.date limit 1`,
        [title],
      );
      await asOrganizer(context);
      await page.setViewportSize(PHONE);

      // A Participant: Edit opens the form in a Sheet; Save renames them.
      await page.goto("/admin/roster");
      const roster = page.getByRole("list", { name: "Roster" });
      await roster
        .getByRole("button", { name: `Edit ${participant}`, exact: true })
        .click();
      const participantSheet = page.getByRole("dialog", {
        name: `Edit ${participant}`,
      });
      await participantSheet
        .getByRole("textbox", { name: "Display name" })
        .fill(renamed);
      await participantSheet
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect(page.getByText("Participant saved")).toBeVisible();
      await expect(participantSheet).toBeHidden();
      const renamedRow = roster
        .getByRole("listitem")
        .filter({ hasText: renamed });
      await expect(renamedRow).toBeVisible();
      await shoot(page, testInfo, "participant-renamed-390");

      // Delete confirms, toasts and removes the row.
      await roster
        .getByRole("button", { name: `Delete ${renamed}`, exact: true })
        .click();
      await expect(page.getByRole("alertdialog")).toContainText(
        `Delete ${renamed}?`,
      );
      await confirmDelete(page);
      await expect(page.getByText("Participant deleted")).toBeVisible();
      await expect(renamedRow).toHaveCount(0);
      expect(
        await runQuery(
          `select 1 from participant where display_name = any($1)`,
          [[participant, renamed]],
        ),
      ).toHaveLength(0);

      // A Schedule Item: the same pattern on the Schedule page.
      await page.goto("/admin/schedule");
      const items = page.locator('main [aria-label="Schedule Items"]');
      await items
        .getByRole("button", { name: `Edit ${title}`, exact: true })
        .click();
      const itemSheet = page.getByRole("dialog", { name: `Edit ${title}` });
      await itemSheet
        .getByRole("textbox", { name: "Title", exact: true })
        .fill(retitled);
      await itemSheet
        .getByRole("button", { name: "Save", exact: true })
        .click();
      await expect(page.getByText("Schedule Item saved")).toBeVisible();
      await expect(itemSheet).toBeHidden();
      await expect(page).toHaveURL(/\/admin\/schedule$/);
      const retitledRow = items
        .getByRole("listitem")
        .filter({ hasText: retitled });
      await expect(retitledRow).toBeVisible();
      await shoot(page, testInfo, "schedule-item-retitled-390");

      await items
        .getByRole("button", { name: `Delete ${retitled}`, exact: true })
        .click();
      await confirmDelete(page);
      await expect(page.getByText("Schedule Item deleted")).toBeVisible();
      await expect(retitledRow).toHaveCount(0);
      expect(
        await runQuery(`select 1 from schedule_item where title = any($1)`, [
          [title, retitled],
        ]),
      ).toHaveLength(0);
    } finally {
      await cleanUp();
    }
  });

  test("the old Schedule Item, FAQ and Award pages land on their lists", async ({
    context,
    page,
  }) => {
    await asOrganizer(context);
    for (const [from, to] of [
      ["/admin/schedule/new", "/admin/schedule"],
      ["/admin/faq/new", "/admin/faq"],
      ["/admin/awards/new", "/admin/awards"],
      ["/admin/awards/00000000-0000-4000-8000-000000000000", "/admin/awards"],
    ]) {
      await page.goto(from);
      await expect(page).toHaveURL(new RegExp(`${to}$`));
    }
  });
});
