import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import { runQuery } from "./db";
import { asOrganizer } from "./session";

// Epic R25 (.scratch/schedule-items/spec.md): a Schedule Item's Hosts are
// roster Participants picked by name (or, with a Competition linked, that
// Competition's Hosts), the start time is optional ("Any time"), the form
// asks Category before Competition, and Day, Start and End line up. Every
// item the spec makes is deleted, and every Competition Host it adds removed.

const PHONE = { width: 390, height: 844 };
const DESKTOP = { width: 1440, height: 900 };
const VIEWPORTS = [
  ["1440", DESKTOP],
  ["390", PHONE],
] as const;

const HOST_A = "Ashley Schuliger";
const HOST_B = "Sam Schantz";
const COMPETITION = "Black Midnight";
const PREFIX = "R25 e2e";

async function shoot(page: Page, testInfo: TestInfo, name: string) {
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage: true,
    animations: "disabled",
  });
}

async function cleanUp() {
  await runQuery(
    `delete from schedule_item s using day d, war_week w
     where d.id = s.day_id and w.id = d.war_week_id and w.edition = 'xi'
       and s.title like $1`,
    [`${PREFIX}%`],
  );
}

async function openAddForm(page: Page) {
  await page.goto("/admin/schedule");
  await page
    .getByRole("button", { name: "Add Schedule Item", exact: true })
    .click();
  const form = page.getByRole("dialog");
  await expect(form.getByRole("textbox", { name: "Title" })).toBeVisible();
  return form;
}

async function pickHost(form: Locator, page: Page, name: string) {
  const picker = form.getByRole("combobox", { name: "Hosts", exact: true });
  await picker.fill(name);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
}

async function pickTime(form: Locator, page: Page, id: string, text: string) {
  const input = form.locator(`#${id}`);
  await input.fill(text);
  await input.press("Enter");
}

/** Saves the open form and waits for its Sheet to close. */
async function save(form: Locator, page: Page) {
  await form
    .getByRole("button", { name: /^(Add Schedule Item|Save)$/ })
    .click();
  await expect(page.getByText("Schedule Item saved")).toBeVisible();
  await expect(form).toBeHidden();
}

function cardOf(page: Page, title: string) {
  return page
    .locator("main li")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
}

test.describe("R25 Schedule items", () => {
  test.beforeEach(async () => {
    await cleanUp();
  });
  test.afterEach(async () => {
    await cleanUp();
  });

  for (const [label, viewport] of VIEWPORTS) {
    test(`AC1 two Hosts picked by name show as Hosted by with an avatar each at ${label}`, async ({
      context,
      page,
    }, testInfo) => {
      const title = `${PREFIX} hosts ${label}`;
      await asOrganizer(context);
      await page.setViewportSize(viewport);
      const form = await openAddForm(page);
      await form.getByRole("textbox", { name: "Title" }).fill(title);
      await pickTime(form, page, "schedule-start-time", "9:15 PM");
      await pickHost(form, page, HOST_A);
      await pickHost(form, page, HOST_B);
      await shoot(page, testInfo, `form-hosts-${label}`);
      await save(form, page);

      await page.goto("/xi/schedule");
      const card = cardOf(page, title);
      const hosted = card.getByTestId("schedule-item-hosts");
      await expect(hosted).toContainText("Hosted by");
      await expect(hosted).toContainText(HOST_A);
      await expect(hosted).toContainText(HOST_B);
      const hosts = hosted.getByTestId("schedule-item-host");
      await expect(hosts).toHaveCount(2);
      for (const name of [HOST_A, HOST_B]) {
        const host = hosts.filter({ hasText: name });
        await expect(host.locator('[data-slot="avatar"]')).toHaveCount(1);
      }
      await shoot(page, testInfo, `schedule-hosted-by-${label}`);

      // The admin form shows the saved Hosts again.
      await page.goto("/admin/schedule");
      await page
        .getByRole("button", { name: `Edit ${title}`, exact: true })
        .click();
      const edit = page.getByRole("dialog");
      await expect(edit).toContainText(HOST_A);
      await expect(edit).toContainText(HOST_B);
    });
  }

  test("AC3 a linked item shows the Competition's Hosts and the form has no Host field", async ({
    context,
    page,
  }, testInfo) => {
    const title = `${PREFIX} linked`;
    const [competition] = await runQuery<{ id: string }>(
      `select c.id from competition c join war_week w on w.id = c.war_week_id
       where w.edition = 'xi' and c.name = $1`,
      [COMPETITION],
    );
    const hostRows = await runQuery<{ id: string }>(
      `select id from competition_host where competition_id = $1`,
      [competition.id],
    );
    expect(hostRows, "no seeded Competition has Hosts").toHaveLength(0);
    try {
      await runQuery(
        `insert into competition_host (competition_id, participant_id)
         select $1, p.id from participant p join war_week w on w.id = p.war_week_id
         where w.edition = 'xi' and p.display_name = any($2)`,
        [competition.id, [HOST_A, HOST_B]],
      );
      await asOrganizer(context);
      await page.setViewportSize(DESKTOP);
      const form = await openAddForm(page);
      await form.getByRole("textbox", { name: "Title" }).fill(title);
      await expect(
        form.getByRole("combobox", { name: "Hosts", exact: true }),
      ).toBeVisible();
      await form.getByRole("combobox", { name: "Category" }).click();
      await page.getByRole("option", { name: "Competition" }).click();
      await form.getByRole("combobox", { name: /^Competition/ }).click();
      await page.getByRole("option", { name: COMPETITION }).click();
      await expect(
        form.getByRole("combobox", { name: "Hosts", exact: true }),
      ).toHaveCount(0);
      await shoot(page, testInfo, "form-linked-no-hosts");
      await save(form, page);

      await page.goto("/xi/schedule");
      const hosted = cardOf(page, title).getByTestId("schedule-item-hosts");
      await expect(hosted).toContainText("Hosted by");
      await expect(hosted).toContainText(HOST_A);
      await expect(hosted).toContainText(HOST_B);
      await expect(hosted.getByTestId("schedule-item-host")).toHaveCount(2);
      await shoot(page, testInfo, "schedule-competition-hosts");
    } finally {
      await runQuery(`delete from competition_host where competition_id = $1`, [
        competition.id,
      ]);
    }
  });

  test("AC6/AC14 an untimed item reads Any time on both pages and sorts first", async ({
    context,
    page,
  }, testInfo) => {
    const title = `${PREFIX} untimed`;
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    const form = await openAddForm(page);
    await form.getByRole("textbox", { name: "Title" }).fill(title);
    await expect(form.locator("#schedule-start-time")).toHaveValue("");
    await save(form, page);

    await page.goto("/xi/schedule");
    const card = cardOf(page, title);
    await expect(card).toContainText("Any time");
    // First in its Day's list, ahead of every timed item.
    await expect(card.locator("xpath=..").locator("li").first()).toContainText(
      title,
    );
    await shoot(page, testInfo, "schedule-any-time");

    await page.goto("/admin/schedule");
    const row = page
      .locator('main [aria-label="Schedule Items"] li')
      .filter({ hasText: title });
    await expect(row).toContainText("Any time");
    await expect(row.locator("xpath=..").locator("li").first()).toContainText(
      title,
    );
    await shoot(page, testInfo, "admin-any-time");
  });

  test("AC11 Competition shows only for the Competition category, clears, and fills an empty title", async ({
    context,
    page,
  }, testInfo) => {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    const form = await openAddForm(page);
    const category = form.getByRole("combobox", { name: "Category" });
    const competition = form.getByRole("combobox", { name: /^Competition/ });
    const title = form.getByRole("textbox", { name: "Title" });
    const chooseCategory = async (name: string) => {
      await category.click();
      await page.getByRole("option", { name, exact: true }).click();
    };

    await expect(competition).toHaveCount(0);
    await chooseCategory("Competition");
    await expect(competition).toBeVisible();

    // An empty title takes the Competition's name.
    await competition.click();
    await page.getByRole("option", { name: COMPETITION }).click();
    await expect(title).toHaveValue(COMPETITION);

    // Changing Category away clears the Competition and hides the field.
    await chooseCategory("Meal");
    await expect(competition).toHaveCount(0);
    await chooseCategory("Competition");
    await expect(competition).toHaveValue("No Competition");

    // A typed title is never overwritten.
    await title.fill(`${PREFIX} typed`);
    await competition.click();
    await page.getByRole("option", { name: "AI Survey Completion" }).click();
    await expect(title).toHaveValue(`${PREFIX} typed`);
    await shoot(page, testInfo, "form-category-competition");
  });

  for (const [label, viewport] of VIEWPORTS) {
    test(`AC12 Day, Start time and End time line up at ${label}`, async ({
      context,
      page,
    }, testInfo) => {
      await asOrganizer(context);
      await page.setViewportSize(viewport);
      const form = await openAddForm(page);
      // The Day trigger and each time control's whole box (the group around
      // the time input), once the Sheet has finished sliding in.
      const controls = [
        form.locator("#schedule-day"),
        form.locator('[data-slot="input-group"]:has(#schedule-start-time)'),
        form.locator('[data-slot="input-group"]:has(#schedule-end-time)'),
      ];
      await expect(async () => {
        const boxes = [];
        for (const control of controls) {
          const box = await control.boundingBox();
          expect(box).not.toBeNull();
          boxes.push(box!);
        }
        for (const box of boxes) {
          expect(Math.abs(box.height - boxes[0].height)).toBeLessThanOrEqual(1);
        }
        if (label === "1440") {
          // One row: top and bottom edges match.
          for (const box of boxes) {
            expect(Math.abs(box.y - boxes[0].y)).toBeLessThanOrEqual(1);
            expect(
              Math.abs(box.y + box.height - (boxes[0].y + boxes[0].height)),
            ).toBeLessThanOrEqual(1);
          }
        } else {
          // At 390 the three stack one per row by design: equal heights
          // only, each below the last.
          expect(boxes[1].y).toBeGreaterThanOrEqual(
            boxes[0].y + boxes[0].height,
          );
          expect(boxes[2].y).toBeGreaterThanOrEqual(
            boxes[1].y + boxes[1].height,
          );
        }
      }).toPass();
      await shoot(page, testInfo, `form-alignment-${label}`);
    });
  }
});
