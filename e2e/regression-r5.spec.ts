import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";

import {
  deleteXiCompetition,
  runQuery,
  xiCompetitionId,
  xiParticipantId,
  xiTeamId,
} from "./db";
import { E2E_BASE_URL } from "./env";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 375, height: 812 };
const TOLERANCE = 1;

async function shoot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fullPage = false,
) {
  // Finishes the Sheet's open animation, so it isn't caught mid-fade.
  await page.screenshot({
    path: testInfo.outputPath(`${name}.png`),
    fullPage,
    animations: "disabled",
  });
}

/** The phone's admin bottom bar (the side column is hidden below `md`). */
function adminBar(page: Page) {
  return page.getByRole("navigation", { name: "Admin sections" });
}

async function box(page: Page, selector: string) {
  const rect = await page.locator(selector).first().boundingBox();
  if (!rect) throw new Error(`${selector} isn't visible`);
  return rect;
}

test("r5 30 admin header and section bar on a phone", async ({
  page,
  context,
}, testInfo) => {
  const toastEmail = "e2e-r5-toast@jahnelgroup.com";
  const competitionId = await xiCompetitionId("Pool");
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);

    // 30-1: a one-row header, at most 56px.
    await page.goto("/admin");
    expect((await box(page, "header")).height).toBeLessThanOrEqual(56);
    await expect(adminBar(page)).toHaveCount(1);
    await shoot(page, testInfo, "organizer-overview-375");

    // 30-2: the bar is fixed to the viewport's bottom, Setup current on Setup.
    await page.goto("/admin/setup");
    const bar = adminBar(page);
    await expect(bar.getByRole("link", { name: "Setup" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(bar.getByRole("button", { name: "More" })).not.toHaveAttribute(
      "aria-current",
    );
    const barBox = await bar.boundingBox();
    expect(barBox!.y + barBox!.height).toBeCloseTo(PHONE.height, 0);
    expect(await bar.evaluate((el) => getComputedStyle(el).position)).toBe(
      "fixed",
    );
    await shoot(page, testInfo, "organizer-setup-375");

    // 30-4: More → Awards navigates and the Sheet closes.
    await bar.getByRole("button", { name: "More" }).click();
    const sheet = page.getByRole("dialog", { name: "More" });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Organizers" })).toBeVisible();
    await shoot(page, testInfo, "organizer-more-375");
    await sheet.getByRole("link", { name: "Awards" }).click();
    await expect(page).toHaveURL(/\/admin\/awards$/);
    await expect(sheet).toBeHidden();
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await shoot(page, testInfo, "organizer-awards-375");

    // 30-2: an in-More section highlights More and its row in the Sheet.
    await page.goto("/admin/guide");
    await expect(bar.getByRole("button", { name: "More" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await bar.getByRole("button", { name: "More" }).click();
    await expect(sheet.getByRole("link", { name: "Guide" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await shoot(page, testInfo, "organizer-guide-more-375");
    await sheet.getByRole("link", { name: "Organizers" }).click();
    await expect(page).toHaveURL(/\/admin\/organizers$/);
    await expect(sheet).toBeHidden();

    // 30-5: the footer clears the bar at the bottom of the page...
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const barTop = (await bar.boundingBox())!.y;
    const footer = await box(page, "footer");
    expect(footer.y + footer.height).toBeLessThanOrEqual(barTop + TOLERANCE);
    // ...and a toast shows above the bar.
    await page
      .getByRole("textbox", { name: "Add an Organizer" })
      .fill(toastEmail);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    const toast = page.locator("[data-sonner-toast]").first();
    await expect(toast).toContainText("Organizer added");
    // Sonner animates the toast in; wait for it to settle.
    await expect
      .poll(async () => {
        const t = await toast.boundingBox();
        return t ? t.y + t.height : Infinity;
      })
      .toBeLessThanOrEqual(barTop);
    await shoot(page, testInfo, "organizer-toast-375");

    // 30-1: with the "Editing …" banner, header + banner at most 96px.
    await context.addCookies([
      { name: "admin_edition", value: "xii", url: E2E_BASE_URL },
    ]);
    await page.goto("/admin");
    const banner = page.getByRole("status").filter({ hasText: "Editing" });
    await expect(banner).toBeVisible();
    const bannerBox = (await banner.boundingBox())!;
    const headerTop = (await box(page, "header")).y;
    expect(bannerBox.y + bannerBox.height - headerTop).toBeLessThanOrEqual(96);
    await shoot(page, testInfo, "organizer-banner-375");
    await context.clearCookies({ name: "admin_edition" });

    // 30-7: from `md` the header and side column are as before.
    await page.setViewportSize(DESKTOP);
    for (const [url, name] of [
      ["/admin", "admin"],
      ["/admin/setup", "setup"],
    ] as const) {
      await page.goto(url);
      await expect(adminBar(page)).toHaveCount(1);
      await expect(
        adminBar(page).getByRole("link", { name: "Points Entries" }),
      ).toBeVisible();
      await shoot(page, testInfo, `after-1280-${name}`, true);
    }

    // 30-3: a Host sees no Awards or Organizers in the bar or the Sheet.
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, E2E_HOST_EMAIL],
    );
    await context.clearCookies();
    await asHost(context);
    await page.setViewportSize(PHONE);
    await page.goto("/admin");
    await expect(bar.getByRole("link", { name: "Points" })).toBeVisible();
    await bar.getByRole("button", { name: "More" }).click();
    await expect(sheet.getByRole("link", { name: "Guide" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Finale" })).toBeVisible();
    for (const name of ["Awards", "Organizers"]) {
      await expect(page.getByRole("link", { name })).toHaveCount(0);
    }
    await shoot(page, testInfo, "host-more-375");
  } finally {
    await runQuery(`delete from organizer where email = $1`, [toastEmail]);
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [competitionId, E2E_HOST_EMAIL],
    );
  }
});

/** A visible control's bounding box must be at least 44x44. */
async function expectTouchTarget(locator: Locator, what: string) {
  const rect = await locator.first().boundingBox();
  if (!rect) throw new Error(`${what} isn't visible`);
  expect(rect.width, `${what} width`).toBeGreaterThanOrEqual(44 - TOLERANCE);
  expect(rect.height, `${what} height`).toBeGreaterThanOrEqual(44 - TOLERANCE);
}

/** An icon button's hit area: its box grown by its `::after` insets. */
async function expectAfterTouchTarget(locator: Locator, what: string) {
  const area = await locator.first().evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const after = getComputedStyle(el, "::after");
    const px = (v: string) => Number.parseFloat(v) || 0;
    return {
      position: after.position,
      width: rect.width - px(after.left) - px(after.right),
      height: rect.height - px(after.top) - px(after.bottom),
    };
  });
  expect(area.position, `${what} ::after`).toBe("absolute");
  expect(area.width, `${what} width`).toBeGreaterThanOrEqual(44 - TOLERANCE);
  expect(area.height, `${what} height`).toBeGreaterThanOrEqual(44 - TOLERANCE);
}

test("r5 34 admin controls are 44px on a phone", async ({
  page,
  context,
}, testInfo) => {
  const hostEmail = "e2e-r5-chip@jahnelgroup.com";
  const competitionId = await xiCompetitionId("Pool");
  try {
    await asOrganizer(context);

    // 34-2: at 1280 the controls are as before (compare the before/after PNGs).
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/setup/faq");
    await expect(
      page.getByRole("link", { name: "Edit" }).first(),
    ).toBeVisible();
    await shoot(page, testInfo, "after-1280-faq", true);
    await page.goto("/admin/announcements/new");
    await expect(page.getByRole("toolbar")).toBeVisible();
    await shoot(page, testInfo, "after-1280-announcements-new", true);

    // 34-1, 34-3: at 375 one of each control measures at least 44x44.
    await page.setViewportSize(PHONE);

    await page.goto("/admin/points");
    await expectTouchTarget(
      page.getByRole("button", { name: /^Delete/ }),
      "points Delete",
    );
    await expectAfterTouchTarget(
      page.locator("[data-slot=input-group-button]"),
      "combobox trigger",
    );
    await shoot(page, testInfo, "points-375");

    await page.goto("/admin/announcements");
    await expectTouchTarget(
      page.getByRole("button", { name: /^(Pin|Unpin)$/ }),
      "Pin/Unpin",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Delete", exact: true }),
      "announcement Delete",
    );
    await shoot(page, testInfo, "announcements-375");

    await page.goto("/admin/announcements/new");
    const toolbar = page.getByRole("toolbar", { name: "Formatting" });
    await expectTouchTarget(
      toolbar.getByRole("button", { name: "Bold" }),
      "toolbar Bold",
    );
    await toolbar.getByRole("button", { name: "Link" }).click();
    await expectTouchTarget(
      page.getByRole("button", { name: "Apply link" }),
      "panel Apply link",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Cancel", exact: true }),
      "panel Cancel",
    );
    await shoot(page, testInfo, "announcements-new-375");

    await page.goto("/admin/setup/schedule");
    await expectTouchTarget(
      page.getByRole("link", { name: "Edit" }),
      "schedule Edit",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Delete", exact: true }),
      "schedule Delete",
    );
    await shoot(page, testInfo, "schedule-375");

    await page.goto("/admin/setup/faq");
    await expectTouchTarget(
      page.getByRole("button", { name: /Move ".*" down/ }),
      "FAQ down",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: /Move ".*" up/ }).last(),
      "FAQ up",
    );
    await expectTouchTarget(
      page.getByRole("link", { name: "Edit" }),
      "FAQ Edit",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: "Delete", exact: true }),
      "FAQ Delete",
    );
    await shoot(page, testInfo, "faq-375");

    // The email chip's remove button, on the Competition's Hosts field.
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, hostEmail],
    );
    await page.goto("/admin/setup/competitions");
    // The Hosts field is in the Competition's Sheet.
    await page.getByRole("button", { name: "Edit Pool", exact: true }).click();
    await expectAfterTouchTarget(
      page.getByRole("button", { name: `Remove ${hostEmail}` }),
      "email chip remove",
    );
    await shoot(page, testInfo, "competition-hosts-375");
  } finally {
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [competitionId, hostEmail],
    );
  }
});

/** A visible trigger's bounding box. */
async function rect(locator: Locator, what: string) {
  const r = await locator.first().boundingBox();
  if (!r) throw new Error(`${what} isn't visible`);
  return r;
}

test("r5 35 selects and the color picker on a phone", async ({
  page,
  browser,
  context,
}, testInfo) => {
  await asOrganizer(context);

  // 35-1: at 1280 the triggers are 36px like Input; at 375, 44px.
  const settingsTriggers = (p: Page) => ({
    mode: p.locator("#settings-mode"),
    font: p.locator("#settings-fontPreset"),
    teamLabel: p.locator("#settings-teamLabel"),
  });
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/setup/war-week");
  let t = settingsTriggers(page);
  await expect(t.mode).toBeVisible();
  expect((await rect(t.mode, "Mode")).height).toBeCloseTo(36, 0);
  expect((await rect(t.font, "Font")).height).toBeCloseTo(36, 0);
  const mode1280 = await rect(t.mode, "Mode");
  const label1280 = await rect(t.teamLabel, "Team Label");
  if (Math.abs(mode1280.y + mode1280.height / 2 - (label1280.y + 18)) < 20) {
    expect(mode1280.y).toBeCloseTo(label1280.y, 0);
  }
  await page.goto("/admin/awards/new");
  expect(
    (await rect(page.locator("#award-team"), "Award Team")).height,
  ).toBeCloseTo(36, 0);
  await page.goto("/admin");
  const switcher = page.getByRole("combobox", {
    name: "War Week to administer",
  });
  expect((await rect(switcher, "switcher")).height).toBeCloseTo(36, 0);

  await page.setViewportSize(PHONE);
  await page.goto("/admin");
  // On a phone the switcher lives in the More sheet.
  await adminBar(page).getByRole("button", { name: "More" }).click();
  const sheetSwitcher = page
    .getByRole("dialog", { name: "More" })
    .getByRole("combobox", { name: "War Week to administer" });
  expect((await rect(sheetSwitcher, "switcher")).height).toBeCloseTo(44, 0);
  await page.keyboard.press("Escape");
  await page.goto("/admin/awards/new");
  expect(
    (await rect(page.locator("#award-team"), "Award Team")).height,
  ).toBeCloseTo(44, 0);
  await page.goto("/admin/setup/teams");
  // The add form opens in a Sheet from the roster's Add button.
  await page.getByRole("button", { name: "Add Participant" }).click();
  const rosterTeam = page
    .getByRole("dialog", { name: "Add Participant" })
    .getByRole("form", { name: "New Participant" })
    .locator("[data-slot=select-trigger]")
    .first();
  expect((await rect(rosterTeam, "Roster Team")).height).toBeCloseTo(44, 0);

  await page.goto("/admin/setup/war-week");
  t = settingsTriggers(page);
  const modeBox = await rect(t.mode, "Mode");
  expect(modeBox.height).toBeCloseTo(44, 0);
  expect((await rect(t.font, "Font")).height).toBeCloseTo(44, 0);
  expect((await rect(t.teamLabel, "Team Label")).height).toBeCloseTo(44, 0);

  // 35-2: the Mode list opens below the trigger, clear of the field above.
  await t.mode.click();
  const list = page.getByRole("listbox");
  await expect(list).toBeVisible();
  const above = await rect(
    t.mode.locator(
      "xpath=ancestor::*[@data-slot='field'][1]/preceding-sibling::*[1]",
    ),
    "field above Mode",
  );
  // The popup zooms in; wait for it to settle before measuring.
  await expect
    .poll(async () => (await rect(list, "Mode list")).y)
    .toBeGreaterThanOrEqual(modeBox.y + modeBox.height - 1);
  const listBox = await rect(list, "Mode list");
  expect(listBox.y).toBeGreaterThanOrEqual(modeBox.y + modeBox.height - 1);
  expect(listBox.y).toBeGreaterThanOrEqual(above.y + above.height - 1);
  await expect
    .poll(async () => (await rect(list, "Mode list")).width)
    .toBeGreaterThanOrEqual(modeBox.width - 1);
  await shoot(page, testInfo, "mode-open-375");
  await page.keyboard.press("Escape");

  // 35-3: a mouse at 1280 focuses the hex input as before.
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/setup/war-week");
  await page.getByLabel("Background color", { exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Hex color" })).toBeFocused();

  // 35-3: a touch pointer opens it without focusing the hex input.
  const touch = await browser.newContext({
    baseURL: E2E_BASE_URL,
    viewport: PHONE,
    hasTouch: true,
    isMobile: true,
  });
  try {
    await asOrganizer(touch);
    const phone = await touch.newPage();
    await phone.goto("/admin/setup/war-week");
    await phone.getByLabel("Background color", { exact: true }).tap();
    const hex = phone.getByRole("textbox", { name: "Hex color" });
    await expect(hex).toBeVisible();
    await expect(hex).not.toBeFocused();
    expect(
      await phone.evaluate(() => document.activeElement?.tagName),
    ).not.toBe("INPUT");
    await shoot(phone, testInfo, "color-open-375");
  } finally {
    await touch.close();
  }
});

/** The page's full height, logged so the run records it. */
async function pageHeight(page: Page, what: string) {
  const height = await page.evaluate(
    () => document.documentElement.scrollHeight,
  );
  console.log(`${what} at ${page.viewportSize()?.width}px: ${height}px tall`);
  return height;
}

test("r5 31 setup rows open in a Sheet", async ({
  page,
  context,
}, testInfo) => {
  const participant = "Abby Rivera";
  const participantId = await xiParticipantId(participant);
  const [{ team_id: originalTeamId }] = await runQuery<{ team_id: string }>(
    `select team_id from participant where id = $1`,
    [participantId],
  );
  // Teams list by name, so this one sits between Blue and Red.
  const throwaway = "Green E2E R5";
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);

    // 31-5: Teams & roster is a quarter of its inline-forms height.
    await page.goto("/admin/setup/teams");
    const teams = page.getByRole("list", { name: "Teams" });
    const roster = page.getByRole("list", { name: "Roster" });
    await expect(roster).toBeVisible();
    expect(await pageHeight(page, "Teams & roster")).toBeLessThan(11_000);

    // 31-1: each row is one "Edit <name>" button, 44px tall on a phone.
    await expectTouchTarget(
      teams.getByRole("button", { name: "Edit Red", exact: true }),
      "Team row",
    );
    const row = roster.getByRole("button", {
      name: `Edit ${participant}`,
      exact: true,
    });
    await expectTouchTarget(row, "Participant row");
    await expect(row).toContainText("Blue");
    await shoot(page, testInfo, "teams-list-375");

    await row.click();
    const sheet = page.getByRole("dialog", { name: `Edit ${participant}` });
    await expect(sheet).toBeVisible();
    await shoot(page, testInfo, "participant-sheet-375");

    // 31-2: a refusal keeps the Sheet open, the typed value, the error
    // under its field and focus on it.
    const name = sheet.getByRole("textbox", { name: "Display name" });
    await name.fill("   ");
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(name).toBeFocused();
    await expect(name).toHaveAttribute("aria-invalid", "true");
    await expect(sheet.locator("[data-slot=field-error]")).toBeVisible();
    await expect(sheet).toBeVisible();
    await expect(name).toHaveValue("   ");

    // 31-2: a save toasts, closes the Sheet and refreshes the row.
    await name.fill(participant);
    await sheet.getByRole("combobox", { name: "Team" }).click();
    await page.getByRole("option", { name: "Red", exact: true }).click();
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Participant saved")).toBeVisible();
    await expect(sheet).toBeHidden();
    await expect(row).toContainText("Red");
    await expect(row).not.toContainText("Blue");

    // 31-3: add a Team through its Sheet, then delete it from its own:
    // focus lands on the next row's Edit button.
    await page.getByRole("button", { name: "Add Team", exact: true }).click();
    const addSheet = page.getByRole("dialog", { name: "Add Team" });
    await addSheet.getByRole("textbox", { name: "Name" }).fill(throwaway);
    await addSheet.getByRole("button", { name: "Add Team" }).click();
    await expect(page.getByText("Team saved")).toBeVisible();
    await expect(addSheet).toBeHidden();
    await teams
      .getByRole("button", { name: `Edit ${throwaway}`, exact: true })
      .click();
    const teamSheet = page.getByRole("dialog", { name: `Edit ${throwaway}` });
    await teamSheet
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(teamSheet).toBeHidden();
    await expect(
      teams.getByRole("button", { name: `Edit ${throwaway}`, exact: true }),
    ).toHaveCount(0);
    await expect(
      teams.getByRole("button", { name: "Edit Red", exact: true }),
    ).toBeFocused();

    // 31-1, 31-5: Competitions too; the Bracket/Games link stays on the row.
    await page.goto("/admin/setup/competitions");
    const competitions = page.getByRole("list", { name: "Competitions" });
    await expect(competitions).toBeVisible();
    expect(await pageHeight(page, "Competitions")).toBeLessThan(6_500);
    const pool = competitions.getByRole("button", {
      name: "Edit Pool",
      exact: true,
    });
    await expectTouchTarget(pool, "Competition row");
    await expect(
      competitions
        .getByRole("listitem")
        .filter({
          has: page.getByRole("button", { name: "Edit Pool", exact: true }),
        })
        .getByRole("link"),
    ).toBeVisible();
    await shoot(page, testInfo, "competitions-list-375");
    await pool.click();
    const poolSheet = page.getByRole("dialog", { name: "Edit Pool" });
    await expect(poolSheet.getByText("Hosts", { exact: true })).toBeVisible();
    await shoot(page, testInfo, "competition-sheet-375");

    // 31-8: the same pattern at 1280.
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/setup/teams");
    await expect(roster).toBeVisible();
    await shoot(page, testInfo, "teams-list-1280");
    await row.click();
    await expect(sheet).toBeVisible();
    await shoot(page, testInfo, "participant-sheet-1280");
  } finally {
    await runQuery(`update participant set team_id = $2 where id = $1`, [
      participantId,
      originalTeamId,
    ]);
    await runQuery(
      `delete from team t using war_week w
       where w.id = t.war_week_id and w.edition = 'xi' and t.name = $1`,
      [throwaway],
    );
  }
});

/** Switches the admin header's War Week (at 1280, where it shows). */
async function administer(page: Page, edition: "XI" | "XII") {
  await page.goto("/admin");
  await page.getByRole("combobox", { name: "War Week to administer" }).click();
  await page
    .getByRole("option", { name: new RegExp(`War Week ${edition} `) })
    .click();
  await expect(
    page.getByRole("combobox", { name: "War Week to administer" }),
  ).toContainText(`War Week ${edition}`);
}

test("r5 32 admin lists fit a phone; free-for-all drops Team", async ({
  page,
  context,
}, testInfo) => {
  const awardName = "R5 32 Award";
  const ffaAwardName = "R5 32 free-for-all Award";
  const [{ team_label: teamLabel }] = await runQuery<{ team_label: string }>(
    `select team_label from war_week where edition = 'xi'`,
  );
  const teamId = await xiTeamId("Red");
  const participantId = await xiParticipantId("Abby Rivera");
  await runQuery(
    `insert into award (war_week_id, name, team_id)
     select w.id, $1, $2 from war_week w where w.edition = 'xi'`,
    [awardName, teamId],
  );
  await runQuery(
    `insert into award_participant (award_id, participant_id)
     select id, $2 from award where name = $1`,
    [awardName, participantId],
  );
  await runQuery(
    `insert into award (war_week_id, name)
     select w.id, $1 from war_week w where w.edition = 'xii'`,
    [ffaAwardName],
  );
  const pages = ["points", "announcements", "awards"];
  try {
    await asOrganizer(context);

    // 32-2, 32-6: at 1280 the tables render as today.
    await page.setViewportSize(DESKTOP);
    for (const name of pages) {
      await page.goto(`/admin/${name}`);
      await expect(page.getByRole("table")).toBeVisible();
      await shoot(page, testInfo, `after-1280-${name}`, true);
    }
    await expect(
      page.getByRole("columnheader", { name: teamLabel }),
    ).toBeVisible();

    // 32-1, 32-3, 32-6: at 375 each list is cards that fit, actions in view.
    await page.setViewportSize(PHONE);
    for (const name of pages) {
      await page.goto(`/admin/${name}`);
      const list = page.locator("ul:has(> li > [data-slot=card])").last();
      await expect(list).toBeVisible();
      await expect(page.getByRole("table")).toBeHidden();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
        `${name} page scrolls sideways`,
      ).toBe(true);
      expect(
        await list.evaluate((el) => el.scrollWidth <= el.clientWidth),
        `${name} list scrolls sideways`,
      ).toBe(true);
      const rows = list.getByRole("listitem");
      for (let i = 0; i < (await rows.count()); i++) {
        const row = rows.nth(i);
        await row.scrollIntoViewIfNeeded();
        const actions = row.locator("a, button");
        expect(
          await actions.count(),
          `${name} row ${i} actions`,
        ).toBeGreaterThan(0);
        for (let j = 0; j < (await actions.count()); j++) {
          await expect(actions.nth(j)).toBeInViewport();
        }
      }
      const edits = list.getByRole("link", { name: "Edit", exact: true });
      expect(await edits.count(), `${name} Edit links`).toBeGreaterThan(0);
      for (let i = 0; i < (await edits.count()); i++) {
        await expectTouchTarget(edits.nth(i), `${name} Edit`);
      }
      await shoot(page, testInfo, `${name}-375`, true);
    }
    const award = page
      .locator("ul:has(> li > [data-slot=card])")
      .last()
      .getByRole("listitem")
      .filter({ hasText: awardName });
    await expect(award).toContainText(`${teamLabel}: Red`);
    await expect(award).toContainText("Abby Rivera");

    // 32-4: XI shows Team in the Award form.
    await page.goto("/admin/awards/new");
    await expect(page.locator("#award-team")).toBeVisible();
    await shoot(page, testInfo, "award-form-xi-375", true);

    // 32-5: the Points Entry target reads the Team Label on XI.
    await page.goto("/admin/points");
    await expect(
      page.getByRole("combobox", { name: teamLabel, exact: true }),
    ).toBeVisible();

    // 32-4, 32-5: XII is free-for-all with no Team on any Award.
    await page.setViewportSize(DESKTOP);
    await administer(page, "XII");
    await page.goto("/admin/awards");
    await expect(page.getByRole("cell", { name: ffaAwardName })).toBeVisible();
    await expect(page.getByRole("columnheader")).toHaveCount(3);
    await expect(
      page.getByRole("columnheader", { name: teamLabel }),
    ).toHaveCount(0);
    await shoot(page, testInfo, "awards-xii-1280", true);
    await page.setViewportSize(PHONE);
    await page.goto("/admin/awards");
    await expect(
      page.getByRole("listitem").filter({ hasText: ffaAwardName }),
    ).not.toContainText(`${teamLabel}:`);
    await shoot(page, testInfo, "awards-xii-375", true);
    await page.goto("/admin/awards/new");
    await expect(
      page.getByRole("textbox", { name: "Name", exact: true }),
    ).toBeVisible();
    await expect(page.locator("#award-team")).toHaveCount(0);
    await expect(page.getByText(teamLabel, { exact: true })).toHaveCount(0);
    await shoot(page, testInfo, "award-form-xii-375", true);
    await page.goto("/admin/points");
    await expect(
      page.getByRole("combobox", { name: "Participant", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: teamLabel, exact: true }),
    ).toHaveCount(0);
    await shoot(page, testInfo, "points-xii-375", true);
  } finally {
    await page.setViewportSize(DESKTOP);
    await administer(page, "XI").catch(() => {});
    await runQuery(`delete from award where name = any($1)`, [
      [awardName, ffaAwardName],
    ]);
  }
});

test("r5 33 Save stays in reach on long admin forms", async ({
  page,
  context,
}, testInfo) => {
  await asOrganizer(context);
  const form = page.getByRole("form", { name: "War Week settings" });
  const save = form.getByRole("button", { name: "Save settings" });
  const sticky = form.locator('[data-slot="sticky-form-actions"]');

  // 33-3: from md the form looks as today (fullPage, same seeded data).
  await page.setViewportSize(DESKTOP);
  await page.goto("/admin/setup/war-week");
  await expect(save).toBeVisible();
  await shoot(page, testInfo, "settings-1280", true);
  expect(await sticky.evaluate((el) => getComputedStyle(el).position)).toBe(
    "static",
  );

  await page.setViewportSize(PHONE);
  await page.goto("/admin/setup/war-week");
  await expect(save).toBeVisible();
  const bar = adminBar(page);

  // 33-1: Save in view at the top and after scrolling to any field, and
  // never over the section bar.
  async function saveClearOfBar() {
    await expect(save).toBeInViewport({ ratio: 1 });
    const saveBox = await save.boundingBox();
    const barBox = await bar.boundingBox();
    if (!saveBox || !barBox) throw new Error("Save or the bar isn't visible");
    expect(saveBox.y + saveBox.height).toBeLessThanOrEqual(
      barBox.y + TOLERANCE,
    );
  }
  await saveClearOfBar();
  await shoot(page, testInfo, "settings-top-375");
  const fields = [
    form.getByLabel("Story Theme"),
    form.getByLabel("Slack URL"),
    form.getByRole("textbox").last(),
  ];
  for (const field of fields) {
    await field.scrollIntoViewIfNeeded();
    await saveClearOfBar();
  }
  await shoot(page, testInfo, "settings-last-field-375");

  // 33-2: the last field scrolls clear of the sticky bar.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const lastBox = await form.getByRole("textbox").last().boundingBox();
  const stickyBox = await sticky.boundingBox();
  if (!lastBox || !stickyBox) throw new Error("Last field isn't visible");
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(
    stickyBox.y + TOLERANCE,
  );
  await shoot(page, testInfo, "settings-bottom-375");

  // 33-2: a refused save focuses a field that isn't under the bar.
  const slackUrl = form.getByLabel("Slack URL");
  await slackUrl.fill("http://slack.example.com/x");
  await save.click();
  await expect(slackUrl).toHaveAttribute("aria-invalid", "true");
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.id))
    .toBe("settings-slackChannelUrl");
  const focused = await slackUrl.boundingBox();
  const stickyNow = await sticky.boundingBox();
  if (!focused || !stickyNow) throw new Error("Refused field isn't visible");
  expect(focused.y + focused.height).toBeLessThanOrEqual(
    stickyNow.y + TOLERANCE,
  );
  await shoot(page, testInfo, "settings-refused-375");

  // 33-5: "Reset to derived" is a 44px target below sm.
  const reset = form.getByRole("button", { name: "Reset to derived" }).first();
  await reset.scrollIntoViewIfNeeded();
  expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(44);

  // 33-4: the other forms' heights at 375 on XI; each over two screens
  // uses the sticky Save row.
  const others = [
    ["announcement", "/admin/announcements/new"],
    ["schedule item", "/admin/setup/schedule/new"],
    ["next War Week", "/admin/setup/next"],
    ["award", "/admin/awards/new"],
  ];
  for (const [name, path] of others) {
    await page.goto(path);
    const other = page.locator("main form").first();
    await expect(other).toBeVisible();
    const height = (await other.boundingBox())?.height ?? 0;
    console.log(`r5 33 ${name} form at 375: ${Math.round(height)}px`);
    if (height > 1624) {
      await expect(
        other.locator('[data-slot="sticky-form-actions"]'),
      ).toHaveCount(1);
    }
  }
});

test("r5 38 Escape keeps chosen Entrants; Tree shows a Heat's place; Format help", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(120_000);
  const name = "R5 E2E Knockout";
  // Individual Entrants: War Week XI seeds only two Teams.
  const teams = [
    "Ashley Schuliger",
    "Sam Schantz",
    "Ryan Shendler",
    "Alex Kelly",
  ].map((name) => ({ name }));
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/setup/competitions");
    await page.getByRole("button", { name: "Add Competition" }).click();
    const addForm = page
      .getByRole("dialog", { name: "Add Competition" })
      .getByRole("form", { name: "New Competition" });
    await addForm.getByRole("textbox", { name: "Name" }).fill(name);
    await addForm.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Single elimination" }).click();
    await addForm.getByRole("button", { name: "Add Competition" }).click();
    await expect(page).toHaveURL(
      /\/admin\/setup\/competitions\/[0-9a-f-]+\/bracket$/,
    );
    const id = page.url().split("/").at(-2) ?? "";
    await runQuery(
      `update competition set scoring = 'individual' where id = $1`,
      [id],
    );
    await page.reload();

    // 38-3: the Format help text doesn't read as if Points were chosen.
    await expect(
      page.getByText(
        "A Format can't change while the Competition has Entrants.",
      ),
    ).toBeVisible();
    await expect(page.getByText("Points is Points Entries only")).toHaveCount(
      0,
    );

    // 38-2: Escape with the popup closed keeps every chosen Entrant.
    const find = page.locator("#bracket-entrants");
    for (const team of teams.slice(0, 3)) {
      await find.fill(team.name);
      await page
        .getByRole("option", { name: new RegExp(`^${team.name}`) })
        .click();
    }
    await expect(page.getByText("(3 chosen)")).toBeVisible();
    await page.keyboard.press("Escape"); // closes the popup
    await find.focus();
    await page.keyboard.press("Escape"); // the old bug emptied the picker
    await expect(page.getByText("(3 chosen)")).toBeVisible();
    await shoot(page, testInfo, "escape-keeps-entrants-1280");
    await page.setViewportSize(PHONE);
    await find.focus();
    await page.keyboard.press("Escape");
    await expect(page.getByText("(3 chosen)")).toBeVisible();
    await shoot(page, testInfo, "escape-keeps-entrants-375");
    await page.setViewportSize(DESKTOP);

    // Build the Bracket and place a Heat, to see it in the Tree.
    await find.fill(teams[3].name);
    await page
      .getByRole("option", { name: new RegExp(`^${teams[3].name}`) })
      .click();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Save Entrants" }).click();
    await expect(
      page.getByText("Entrants saved", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();

    await page.goto(`/admin/brackets/${id}`);
    await page
      .getByRole("button", { name: "Time & place for Semifinal 1" })
      .click();
    const form = page.getByRole("form", {
      name: "Time & place for Semifinal 1",
    });
    await form.getByLabel("Location (optional)").fill("Team Room 4");
    await form.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Time and place saved")).toBeVisible();

    // 38-1: the Tree (the default layout) shows the Heat's place.
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      await page.goto(`/xi/competitions/${id}`);
      const tree = page.locator("[data-bracket-tree]").first();
      await expect(tree).toBeVisible();
      await expect(
        tree
          .getByRole("group", { name: "Semifinal 1" })
          .getByText("Team Room 4"),
      ).toBeVisible();
      await shoot(page, testInfo, `tree-heat-place-${viewport.width}`, true);
    }
  } finally {
    await deleteXiCompetition(name);
  }
});

const EPIC_PAGES = [
  { path: "/admin", slug: "overview", hostSees: true },
  { path: "/admin/points", slug: "points", hostSees: true },
  { path: "/admin/setup/teams", slug: "teams", hostSees: false },
  { path: "/admin/setup/competitions", slug: "competitions", hostSees: true },
  { path: "/admin/setup/war-week", slug: "war-week", hostSees: false },
  { path: "/admin/announcements", slug: "announcements", hostSees: true },
  { path: "/admin/awards", slug: "awards", hostSees: false },
];

test("r5 epic admin pages at 375 and 1280, as Organizer and Host", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const competitionId = await xiCompetitionId("Pool");
  const refusal = page.getByRole("heading", {
    name: "Organizers and Hosts only.",
  });

  async function visit(role: "organizer" | "host") {
    for (const viewport of [PHONE, DESKTOP]) {
      await page.setViewportSize(viewport);
      for (const { path, slug, hostSees } of EPIC_PAGES) {
        await page.goto(path);
        const sees = role === "organizer" || hostSees;
        const label = `${role} ${path} at ${viewport.width}`;
        if (sees) {
          await expect(refusal, label).toHaveCount(0);
          await expect(page.locator("main").first(), label).toBeVisible();
          if (viewport.width === PHONE.width) {
            await expect(adminBar(page), label).toHaveCount(1);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= window.innerWidth,
              ),
              `${label} scrolls sideways`,
            ).toBe(true);
          }
        } else {
          await expect(refusal, label).toBeVisible();
        }
        await shoot(page, testInfo, `${role}-${slug}-${viewport.width}`, true);
      }
    }
  }

  try {
    await asOrganizer(context);
    await visit("organizer");

    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, E2E_HOST_EMAIL],
    );
    await context.clearCookies();
    await asHost(context);
    await visit("host");
  } finally {
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [competitionId, E2E_HOST_EMAIL],
    );
  }
});
