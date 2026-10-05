import { type Page, expect, test } from "@playwright/test";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import {
  addE2eHost,
  deleteXiCompetition,
  removeE2eHost,
  setParticipantEmail,
  xiCompetitionId,
  xiParticipantId,
} from "./db";
import { E2E_HOST_EMAIL, asHost, asOrganizer, signIn } from "./session";

// Epic R22, Decisions 1 and 2 (ADR 0012): a Host is a roster Participant,
// chosen with or without an email, and a Host who isn't an Organizer sees
// only their Competitions and the Guide. Hosts are made in demo XI, whose
// Participants have no email; each test restores what it changed in
// `finally`.

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 };
const REFUSAL = "Organizers and Hosts only.";

/** The Host the Organizer picks, with no roster email in demo XI. */
const PERSON = "Brian France";
const PERSON_EMAIL = "e2e-r22-brian@jahnelgroup.com";

const adminNav = (page: Page) =>
  page.getByRole("navigation", { name: "Admin sections" });

test("r22 1 an Organizer makes a no-email Participant a Host; they get access once the Organizer adds their email in Roster", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const name = `E2E R22 Host ${Date.now()}`;
  const personId = await xiParticipantId(PERSON);
  const hostContext = await browser.newContext();
  try {
    await asOrganizer(context);
    await page.setViewportSize(DESKTOP);
    const id = await addCompetition(page, { name, scoring: "Individual" });
    await openCompetitionPage(page, id);

    // The Participant has no email, and can still be picked.
    const picker = page.getByRole("combobox", { name: "Hosts", exact: true });
    await picker.click();
    await picker.fill("Brian");
    const option = page.getByRole("option", { name: /^Brian France/ });
    await expect(option).toBeVisible();
    await expect(option).not.toHaveAttribute("aria-disabled", "true");
    await option.click();
    await page.keyboard.press("Escape");
    const settings = page.getByRole("form", { name: "Competition settings" });
    await expect(
      settings.getByRole("button", { name: `Remove ${PERSON}` }),
    ).toBeVisible();
    await expectSaved(page);
    await page.screenshot({
      path: testInfo.outputPath("organizer-picks-host-1440.png"),
      fullPage: true,
    });

    // With no roster email nobody signs in as them: the stub session for
    // their future email has no access.
    await signIn(hostContext, PERSON_EMAIL);
    const host = await hostContext.newPage();
    await host.setViewportSize(DESKTOP);
    await host.goto(`/admin/competitions/${id}`);
    await expect(host.getByRole("heading", { name: REFUSAL })).toBeVisible();
    await host.screenshot({
      path: testInfo.outputPath("no-email-no-access-1440.png"),
    });

    // The Organizer adds their email in Roster.
    await page.goto("/admin/roster");
    await page
      .getByRole("list", { name: "Roster" })
      .getByRole("button", { name: `Edit ${PERSON}`, exact: true })
      .click();
    const sheet = page.getByRole("dialog", { name: `Edit ${PERSON}` });
    await sheet.getByRole("textbox", { name: "Email" }).fill(PERSON_EMAIL);
    await sheet.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText("Participant saved")).toBeVisible();

    // Now the same session sees that Competition's admin page, at both sizes.
    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await host.setViewportSize(viewport);
      await host.goto(`/admin/competitions/${id}`);
      await expect(host.getByRole("heading", { name })).toBeVisible();
      await expect(host.getByRole("heading", { name: REFUSAL })).toHaveCount(0);
      await host.screenshot({
        path: testInfo.outputPath(`host-with-email-${label}.png`),
      });
    }
  } finally {
    await hostContext.close();
    await setParticipantEmail(personId, null);
    await deleteXiCompetition(name);
  }
});

test("r22 4 a Host sees only their Competitions and the Guide, and the server refuses everything else", async ({
  context,
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const hosted = await xiCompetitionId("Pool");
  const other = await xiCompetitionId("Cypher");
  await addE2eHost(hosted, E2E_HOST_EMAIL);
  try {
    await asHost(context);

    // 1440: the side column holds Competitions and Guide, nothing else.
    await page.setViewportSize(DESKTOP);
    await page.goto("/admin/competitions");
    const nav = adminNav(page);
    await expect(nav.getByRole("link")).toHaveText(["Competitions", "Guide"]);
    for (const hidden of [
      "Discretionary points",
      "Schedule",
      "Roster",
      "Announcements",
      "Awards",
      "FAQ",
      "Finale",
      "Settings",
      "Organizers",
    ]) {
      await expect(
        page.getByRole("link", { name: hidden, exact: true }),
        hidden,
      ).toHaveCount(0);
    }
    // The list is the Competitions they host, with no other.
    const list = page.getByRole("list", { name: "Competitions" });
    await expect(list.getByRole("listitem")).toHaveCount(1);
    await expect(list.getByRole("link", { name: "Edit Pool" })).toBeVisible();
    await expect(list.getByRole("link", { name: "Edit Cypher" })).toHaveCount(
      0,
    );
    await page.screenshot({
      path: testInfo.outputPath("host-nav-1440.png"),
      fullPage: true,
    });

    // 390: one tab, and only the Guide under More.
    await page.setViewportSize(PHONE);
    await page.goto("/admin/competitions");
    await expect(adminNav(page).getByRole("link")).toHaveText(["Competitions"]);
    await adminNav(page).getByRole("button", { name: "More" }).click();
    await expect(
      page.getByRole("link", { name: "Guide", exact: true }),
    ).toBeVisible();
    for (const hidden of ["Schedule", "Announcements", "Finale", "Settings"]) {
      await expect(
        page.getByRole("link", { name: hidden, exact: true }),
        hidden,
      ).toHaveCount(0);
    }
    await page.screenshot({
      path: testInfo.outputPath("host-nav-390.png"),
      fullPage: true,
    });

    // The server refuses the pages, at both sizes.
    for (const [label, viewport] of [
      ["1440", DESKTOP],
      ["390", PHONE],
    ] as const) {
      await page.setViewportSize(viewport);
      for (const [slug, path] of [
        ["schedule", "/admin/schedule"],
        ["announcements", "/admin/announcements"],
        ["new-announcement", "/admin/announcements/new"],
        ["finale", "/admin/finale"],
        ["other-competition", `/admin/competitions/${other}`],
      ] as const) {
        await page.goto(path);
        await expect(
          page.getByRole("heading", { name: REFUSAL }),
          `${path} at ${label}`,
        ).toBeVisible();
        await page.screenshot({
          path: testInfo.outputPath(`refused-${slug}-${label}.png`),
        });
      }
    }

    // Their own Competition's page opens, and the War Week Finale stays
    // readable by any signed-in JG user.
    await openCompetitionPage(page, hosted);
    await expect(page.getByRole("heading", { name: REFUSAL })).toHaveCount(0);
    await page.goto("/xi/finale");
    await expect(page.locator('[data-finale-slide="title"]')).toBeVisible();
  } finally {
    await removeE2eHost(hosted, E2E_HOST_EMAIL);
  }
});
