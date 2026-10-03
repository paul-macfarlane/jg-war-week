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

    // 30-1: a one-row header, at most 56px. /admin opens Points (r9 57).
    await page.goto("/admin/points");
    await expect(page).toHaveURL(/\/admin\/points$/);
    expect((await box(page, "header")).height).toBeLessThanOrEqual(56);
    await expect(adminBar(page)).toHaveCount(1);
    await shoot(page, testInfo, "organizer-points-375");

    // 30-2: the bar is fixed to the viewport's bottom, Schedule current on
    // Schedule; its tabs are Points, Competitions, Schedule, Announcements.
    await page.goto("/admin/schedule");
    const bar = adminBar(page);
    await expect(bar.getByRole("link")).toHaveText([
      "Points",
      "Competitions",
      "Schedule",
      "Announcements",
    ]);
    await expect(bar.getByRole("link", { name: "Schedule" })).toHaveAttribute(
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
    await shoot(page, testInfo, "organizer-schedule-375");

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
    await page.goto("/admin/points");
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
      ["/admin/points", "points"],
      ["/admin/schedule", "schedule"],
    ] as const) {
      await page.goto(url);
      await expect(adminBar(page)).toHaveCount(1);
      await expect(
        adminBar(page).getByRole("link", { name: "Points", exact: true }),
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
    await page.goto("/admin/points");
    await expect(bar.getByRole("link")).toHaveText([
      "Points",
      "Competitions",
      "Schedule",
      "Announcements",
    ]);
    await bar.getByRole("button", { name: "More" }).click();
    await expect(sheet.getByRole("link", { name: "Finale" })).toBeVisible();
    await expect(sheet.getByRole("link", { name: "Guide" })).toBeVisible();
    for (const name of ["Roster", "Awards", "FAQ", "Settings", "Organizers"]) {
      await expect(page.getByRole("link", { name, exact: true })).toHaveCount(
        0,
      );
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
  // A dialog zooms in as it opens: measure once its animation has finished.
  await locator
    .first()
    .evaluate(() =>
      Promise.all(document.getAnimations().map((a) => a.finished)),
    );
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
    await page.goto("/admin/faq");
    // Each row's Edit and Delete are buttons named for the row (r9 58).
    await expect(
      page.getByRole("button", { name: /^Edit / }).first(),
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
      page
        .getByRole("list", { name: "Announcements" })
        .getByRole("button", { name: /^Delete / }),
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

    await page.goto("/admin/schedule");
    // The Schedule Items, not the Days above them (r9 57).
    const scheduleItems = page.locator('[aria-label="Schedule Items"]');
    await expectTouchTarget(
      scheduleItems.getByRole("button", { name: /^Edit / }),
      "schedule Edit",
    );
    await expectTouchTarget(
      scheduleItems.getByRole("button", { name: /^Delete / }),
      "schedule Delete",
    );
    await shoot(page, testInfo, "schedule-375");

    await page.goto("/admin/faq");
    await expectTouchTarget(
      page.getByRole("button", { name: /Move ".*" down/ }),
      "FAQ down",
    );
    await expectTouchTarget(
      page.getByRole("button", { name: /Move ".*" up/ }).last(),
      "FAQ up",
    );
    const faqItems = page.getByRole("list", { name: "FAQ Items" });
    await expectTouchTarget(
      faqItems.getByRole("button", { name: /^Edit / }),
      "FAQ Edit",
    );
    await expectTouchTarget(
      faqItems.getByRole("button", { name: /^Delete / }),
      "FAQ Delete",
    );
    await shoot(page, testInfo, "faq-375");

    // The email chip's remove button, on the Competition's Hosts field.
    await runQuery(
      `insert into competition_host (competition_id, email) values ($1, $2)
       on conflict do nothing`,
      [competitionId, hostEmail],
    );
    await page.goto("/admin/competitions");
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
  await page.goto("/admin/settings");
  let t = settingsTriggers(page);
  await expect(t.mode).toBeVisible();
  expect((await rect(t.mode, "Mode")).height).toBeCloseTo(36, 0);
  expect((await rect(t.font, "Font")).height).toBeCloseTo(36, 0);
  // Mode and Team Label share a row at 1280; the trigger is level with the
  // input beside it.
  const mode1280 = await rect(t.mode, "Mode");
  const label1280 = await rect(t.teamLabel, "Team Label");
  expect(
    label1280.x,
    "Team Label sits beside Mode at 1280",
  ).toBeGreaterThanOrEqual(mode1280.x + mode1280.width);
  expect(mode1280.y).toBeCloseTo(label1280.y, 0);
  expect(mode1280.height).toBeCloseTo(label1280.height, 0);
  // The Award form opens in a Sheet from the Awards list (r9 58).
  await page.goto("/admin/awards");
  await page.getByRole("button", { name: "Add Award" }).click();
  // The dialog zooms in; measure once it settles.
  await expect
    .poll(async () =>
      Math.round(
        (await rect(page.locator("#award-team"), "Award Team")).height,
      ),
    )
    .toBe(36);
  await page.goto("/admin/points");
  const switcher = page.getByRole("combobox", {
    name: "War Week to administer",
  });
  expect((await rect(switcher, "switcher")).height).toBeCloseTo(36, 0);

  await page.setViewportSize(PHONE);
  await page.goto("/admin/points");
  // On a phone the switcher lives in the More sheet.
  await adminBar(page).getByRole("button", { name: "More" }).click();
  const sheetSwitcher = page
    .getByRole("dialog", { name: "More" })
    .getByRole("combobox", { name: "War Week to administer" });
  expect((await rect(sheetSwitcher, "switcher")).height).toBeCloseTo(44, 0);
  await page.keyboard.press("Escape");
  await page.goto("/admin/awards");
  await page.getByRole("button", { name: "Add Award" }).click();
  expect(
    (await rect(page.locator("#award-team"), "Award Team")).height,
  ).toBeCloseTo(44, 0);
  await page.goto("/admin/roster");
  // The add form opens in a Sheet from the roster's Add button.
  await page.getByRole("button", { name: "Add Participant" }).click();
  const rosterTeam = page
    .getByRole("dialog", { name: "Add Participant" })
    .getByRole("form", { name: "New Participant" })
    .locator("[data-slot=select-trigger]")
    .first();
  expect((await rect(rosterTeam, "Roster Team")).height).toBeCloseTo(44, 0);

  await page.goto("/admin/settings");
  t = settingsTriggers(page);
  // The Lifecycle box sits above the form; centre Mode before measuring.
  await t.mode.evaluate((el) => el.scrollIntoView({ block: "center" }));
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
  await page.goto("/admin/settings");
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
    await phone.goto("/admin/settings");
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
  const poolId = await xiCompetitionId("Pool");
  const sheetHost = "e2e-r5-sheet-host@jahnelgroup.com";
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);

    // 31-5: Teams & roster is a quarter of its inline-forms height.
    await page.goto("/admin/roster");
    const teams = page.getByRole("list", { name: "Teams" });
    const roster = page.getByRole("list", { name: "Roster" });
    await expect(roster).toBeVisible();
    expect(await pageHeight(page, "Teams & roster")).toBeLessThan(11_000);

    // 31-1: each row's Edit button is "Edit <name>", 44px tall on a phone
    // (r9 58: a visible Edit beside Delete, not a whole-row button); a
    // Team's reads its Team Label too.
    await expectTouchTarget(
      teams.getByRole("button", { name: "Edit Team Red", exact: true }),
      "Team row",
    );
    const row = roster.getByRole("button", {
      name: `Edit ${participant}`,
      exact: true,
    });
    const rowItem = roster.getByRole("listitem").filter({
      has: page.getByRole("button", {
        name: `Edit ${participant}`,
        exact: true,
      }),
    });
    await expectTouchTarget(row, "Participant row");
    await expect(rowItem).toContainText("Blue");
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
    await expect(rowItem).toContainText("Red");
    await expect(rowItem).not.toContainText("Blue");

    // 31-3: add a Team through its Sheet, then delete it from its row's
    // Delete (r9 58): focus lands on the next row's Edit button.
    await page.getByRole("button", { name: "Add Team", exact: true }).click();
    const addSheet = page.getByRole("dialog", { name: "Add Team" });
    await addSheet.getByRole("textbox", { name: "Name" }).fill(throwaway);
    await addSheet.getByRole("button", { name: "Add Team" }).click();
    await expect(page.getByText("Team saved")).toBeVisible();
    await expect(addSheet).toBeHidden();
    await teams
      .getByRole("button", { name: `Delete Team ${throwaway}`, exact: true })
      .click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Delete", exact: true })
      .click();
    await expect(page.getByText("Team deleted")).toBeVisible();
    await expect(
      teams.getByRole("button", {
        name: `Edit Team ${throwaway}`,
        exact: true,
      }),
    ).toHaveCount(0);
    await expect(
      teams.getByRole("button", { name: "Edit Team Red", exact: true }),
    ).toBeFocused();

    // 31-1, 31-5: Competitions too; the Bracket/Games link stays on the row.
    await page.goto("/admin/competitions");
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

    // The Sheet's one Save assigns a Host added there, too.
    await poolSheet
      .getByRole("textbox", { name: "Hosts", exact: true })
      .fill(sheetHost);
    await page.keyboard.press("Enter");
    const removeHost = poolSheet.getByRole("button", {
      name: `Remove ${sheetHost}`,
    });
    await expect(removeHost).toBeVisible();
    await poolSheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Competition saved")).toBeVisible();
    await expect(poolSheet).toBeHidden();
    await pool.click();
    await expect(removeHost).toBeVisible();
    await shoot(page, testInfo, "competition-sheet-host-saved-375");
    await page.keyboard.press("Escape");
    await expect(poolSheet).toBeHidden();

    // 31-8: the same pattern at 1280.
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/roster");
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
    await runQuery(
      `delete from competition_host where competition_id = $1 and email = $2`,
      [poolId, sheetHost],
    );
  }
});

/** Switches the admin header's War Week (at 1280, where it shows). */
async function administer(page: Page, edition: "XI" | "XII") {
  await page.goto("/admin/points");
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
  const poolId = await xiCompetitionId("Pool");
  const awardIds: string[] = [];
  const entryIds: string[] = [];
  // Points keeps its cards and table; Announcements and Awards are list
  // rows with Edit and Delete (r9 58).
  const pages = ["points", "announcements", "awards"];
  const rowLists: Record<string, string> = {
    announcements: "Announcements",
    awards: "Awards",
  };
  try {
    const [teamAward] = await runQuery<{ id: string }>(
      `insert into award (war_week_id, name, team_id)
       select w.id, $1, $2 from war_week w where w.edition = 'xi'
       returning id`,
      [awardName, teamId],
    );
    awardIds.push(teamAward.id);
    await runQuery(
      `insert into award_participant (award_id, participant_id)
       values ($1, $2)`,
      [teamAward.id, participantId],
    );
    const [ffaAward] = await runQuery<{ id: string }>(
      `insert into award (war_week_id, name)
       select w.id, $1 from war_week w where w.edition = 'xii'
       returning id`,
      [ffaAwardName],
    );
    awardIds.push(ffaAward.id);
    // A Bracket-generated entry, so the ledger shows "Change in the Bracket"
    // (the seed finalizes no Bracket).
    const [entry] = await runQuery<{ id: string }>(
      `insert into points_entry
         (war_week_id, competition_id, team_id, points, note, entered_by_email,
          generated_by_bracket)
       select war_week_id, id, $2, 1, 'R5 32 generated',
         'e2e-r5@jahnelgroup.com', true
       from competition where id = $1
       returning id`,
      [poolId, teamId],
    );
    entryIds.push(entry.id);
    await asOrganizer(context);

    // 32-2, 32-6: at 1280 Points' table renders as today; the others' rows.
    await page.setViewportSize(DESKTOP);
    for (const name of pages) {
      await page.goto(`/admin/${name}`);
      await expect(
        rowLists[name]
          ? page.getByRole("list", { name: rowLists[name] })
          : page.getByRole("table"),
      ).toBeVisible();
      await shoot(page, testInfo, `after-1280-${name}`, true);
    }
    await expect(
      page
        .getByRole("list", { name: "Awards" })
        .getByRole("listitem")
        .filter({ hasText: awardName }),
    ).toContainText(`${teamLabel}: Red`);

    // 32-1, 32-3, 32-6: at 375 each list is cards that fit, actions in view.
    await page.setViewportSize(PHONE);
    for (const name of pages) {
      await page.goto(`/admin/${name}`);
      const list = rowLists[name]
        ? page.getByRole("list", { name: rowLists[name] })
        : page.locator("ul:has(> li > [data-slot=card])").last();
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
      const edits = rowLists[name]
        ? list.getByRole(name === "announcements" ? "link" : "button", {
            name: /^Edit /,
          })
        : list.getByRole("link", { name: "Edit", exact: true });
      expect(await edits.count(), `${name} Edit links`).toBeGreaterThan(0);
      for (let i = 0; i < (await edits.count()); i++) {
        await expectTouchTarget(edits.nth(i), `${name} Edit`);
      }
      if (name === "points") {
        // 34: the generated entry's text link is a 44px target too.
        await expectTouchTarget(
          list.getByRole("link", { name: "Change in the Bracket" }),
          "Change in the Bracket",
        );
      }
      await shoot(page, testInfo, `${name}-375`, true);
    }
    const award = page
      .getByRole("list", { name: "Awards" })
      .getByRole("listitem")
      .filter({ hasText: awardName });
    await expect(award).toContainText(`${teamLabel}: Red`);
    await expect(award).toContainText("Abby Rivera");

    // 32-4: XI shows Team in the Award form (in its Sheet, r9 58).
    await page.getByRole("button", { name: "Add Award" }).click();
    await expect(page.locator("#award-team")).toBeVisible();
    await shoot(page, testInfo, "award-form-xi-375");
    await page.keyboard.press("Escape");

    // 32-5: the Points Entry target reads the Team Label on XI.
    await page.goto("/admin/points");
    await expect(
      page.getByRole("combobox", { name: teamLabel, exact: true }),
    ).toBeVisible();

    // 32-4, 32-5: XII is free-for-all with no Team on any Award.
    await page.setViewportSize(DESKTOP);
    await administer(page, "XII");
    await page.goto("/admin/awards");
    const ffaAwardRow = page
      .getByRole("list", { name: "Awards" })
      .getByRole("listitem")
      .filter({ hasText: ffaAwardName });
    await expect(ffaAwardRow).toBeVisible();
    await expect(ffaAwardRow).not.toContainText(`${teamLabel}:`);
    await shoot(page, testInfo, "awards-xii-1280", true);
    await page.setViewportSize(PHONE);
    await page.goto("/admin/awards");
    await expect(
      page.getByRole("listitem").filter({ hasText: ffaAwardName }),
    ).not.toContainText(`${teamLabel}:`);
    await shoot(page, testInfo, "awards-xii-375", true);
    await page.getByRole("button", { name: "Add Award" }).click();
    const ffaSheet = page.getByRole("dialog", { name: "Add Award" });
    await expect(
      ffaSheet.getByRole("textbox", { name: "Name", exact: true }),
    ).toBeVisible();
    await expect(ffaSheet.locator("#award-team")).toHaveCount(0);
    await expect(ffaSheet.getByText(teamLabel, { exact: true })).toHaveCount(0);
    await shoot(page, testInfo, "award-form-xii-375");
    await page.keyboard.press("Escape");
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
    await runQuery(`delete from award where id = any($1)`, [awardIds]);
    await runQuery(`delete from points_entry where id = any($1)`, [entryIds]);
  }
});

test("r5 33 Reset to derived is a 44px target on a phone", async ({
  page,
  context,
}) => {
  await asOrganizer(context);
  // The War Week settings form autosaves and has no Save row (r9 59), and
  // no admin form has a sticky Save row any more: Schedule Items and Awards
  // edit in a Sheet whose footer sticks (r9 58). 33-1 to 33-4 went with it.
  const form = page.getByRole("form", { name: "War Week settings" });
  await page.setViewportSize(PHONE);
  await page.goto("/admin/settings");
  await expect(form).toBeVisible();

  // 33-5: "Reset to derived" is a 44px target below sm.
  const reset = form.getByRole("button", { name: "Reset to derived" }).first();
  await reset.scrollIntoViewIfNeeded();
  expect((await reset.boundingBox())?.height).toBeGreaterThanOrEqual(44);
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
    await page.goto("/admin/competitions");
    await page.getByRole("button", { name: "Add Competition" }).click();
    const addForm = page
      .getByRole("dialog", { name: "Add Competition" })
      .getByRole("form", { name: "New Competition" });
    await addForm.getByRole("textbox", { name: "Name" }).fill(name);
    await addForm.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Single elimination" }).click();
    await addForm.getByRole("button", { name: "Add Competition" }).click();
    await expect(page).toHaveURL(/\/admin\/competitions\/[0-9a-f-]+\/bracket$/);
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
  { path: "/admin/points", slug: "points", hostSees: true },
  { path: "/admin/schedule", slug: "schedule", hostSees: true },
  { path: "/admin/roster", slug: "teams", hostSees: false },
  { path: "/admin/competitions", slug: "competitions", hostSees: true },
  { path: "/admin/settings", slug: "war-week", hostSees: false },
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

test("r5 37 pinned Announcement card fits its content", async ({
  page,
  context,
}, testInfo) => {
  const title = "R5 37 pinned one-liner";
  const videoTitle = "R5 37 pinned title only with video";
  const deleteFixture = () =>
    runQuery(`delete from announcement where title = any($1)`, [
      [title, videoTitle],
    ]);
  await deleteFixture();
  try {
    await asOrganizer(context);
    await page.setViewportSize(PHONE);

    // Through the real editor, as an Organizer would: one line, pinned.
    await page.goto("/admin/announcements/new");
    await page.getByLabel("Title").fill(title);
    await page.locator(".ProseMirror").click();
    await page.keyboard.type("Doors open at nine.");
    await page.getByRole("switch", { name: /Pinned/ }).click();
    await page.getByRole("button", { name: "Post Announcement" }).click();
    await expect(page).toHaveURL(/\/admin\/announcements$/);

    const [stored] = await runQuery<{ body: unknown }>(
      `select body from announcement where title = $1`,
      [title],
    );
    console.log(`r5 37 stored body: ${JSON.stringify(stored.body)}`);

    // 37-1: the card is as tall as its header, the line and the padding.
    for (const path of ["/xi", "/xi/announcements"]) {
      await page.goto(path);
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: title }) });
      await expect(card).toBeVisible();
      const height = (await card.boundingBox())?.height ?? 0;
      console.log(
        `r5 37 pinned card at 375 on ${path}: ${Math.round(height)}px`,
      );
      expect(height).toBeLessThan(160);
      if (path === "/xi") {
        await card.scrollIntoViewIfNeeded();
        await shoot(page, testInfo, "home-pinned-375");
      }
    }

    // 37-2: a title-only Announcement (empty body) with a video. The empty
    // body renders nothing, so the video is the only thing in the card's
    // content and the only gap above it is the card's own.
    await runQuery(`delete from announcement where title = $1`, [title]);
    await runQuery(
      `insert into announcement (war_week_id, title, body, pinned, author_email)
       select id, $1, $2::jsonb, true, $3 from war_week where edition = 'xi'`,
      [
        videoTitle,
        JSON.stringify({
          type: "doc",
          content: [
            {
              type: "video",
              attrs: { src: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
            },
          ],
        }),
        E2E_HOST_EMAIL,
      ],
    );
    for (const path of ["/xi", "/xi/announcements"]) {
      await page.goto(path);
      const card = page
        .locator("article")
        .filter({ has: page.getByRole("heading", { name: videoTitle }) });
      await expect(card).toBeVisible();
      const content = card.locator('[data-slot="card-content"]');
      // The video is a body block now; it's the only thing in the card.
      await expect(content.locator("> *")).toHaveCount(1);
      await expect(content.locator("iframe")).toHaveCount(1);
      const height = (await card.boundingBox())?.height ?? 0;
      console.log(
        `r5 37 pinned video card at 375 on ${path}: ${Math.round(height)}px`,
      );
      if (path === "/xi") {
        await card.scrollIntoViewIfNeeded();
        await shoot(page, testInfo, "home-pinned-video-375");
      }
    }
  } finally {
    await deleteFixture();
  }
});
