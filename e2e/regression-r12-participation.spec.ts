import { type Page, type TestInfo, expect, test } from "@playwright/test";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import {
  addE2eHost,
  deleteXiCompetition,
  xiCompetitionEntries,
  xiTeamPointsBreakdown,
} from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  asHost,
  asOrganizer,
  participantPageAs,
} from "./session";
import { teamTotal } from "./standings";

// Epic R12, ticket 69 (69-AC2 as red-team C1 reads it): an Organizer
// creates a team Participation Competition, its Host is added by SQL (the
// e2e Host isn't on the roster, so the Hosts picker can't choose them); the Host
// sets its Placement Points (a team Competition is always ranked by
// headcount) to 5 / 3 / 1 and Self check-in on; two Participants check in; the Host ticks a third; Close
// moves the Standings and Reopen withdraws them. Fixture: the live XI demo
// (seeds/demo/xi.json), Red against Blue.

/** Two Red Participants check themselves in. */
const CHECK_INS = ["Adam Wilson-Hwang", "Albert Hernandez"] as const;
/** The Host ticks a Blue Participant. */
const TICKED = "Alec Haring";

const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
] as const;

/** Screenshots `page` at both viewports as `<step>-<width>.png`. */
async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const { name, width, height } of VIEWPORTS) {
    await page.setViewportSize({ width, height });
    await page.screenshot({
      path: testInfo.outputPath(`${step}-${name}.png`),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

const sum = (rows: { points: number }[]) =>
  rows.reduce((total, row) => total + row.points, 0);

/** Red's and Blue's totals from the independent SQL breakdowns. */
async function breakdownTotals() {
  return {
    red: sum(await xiTeamPointsBreakdown("Red")),
    blue: sum(await xiTeamPointsBreakdown("Blue")),
  };
}

/** The same totals as `/xi/leaderboard` shows them. */
async function leaderboardTotals(page: Page) {
  await page.goto("/xi/leaderboard");
  return {
    red: await teamTotal(page, "Red"),
    blue: await teamTotal(page, "Blue"),
  };
}

test("r12 69 a Host runs a team Participation Competition: check-ins, a tick, Close moves the Standings, Reopen withdraws", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(240_000);
  const name = `R12 Black Midnight ${Date.now()}`;
  const hostContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  const participants: Awaited<ReturnType<typeof participantPageAs>>[] = [];
  try {
    // The Organizer adds it: team scoring (XI's default), Participation.
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/competitions");
    await page.getByRole("button", { name: "Add Competition" }).click();
    const addForm = page
      .getByRole("dialog", { name: "Add Competition" })
      .getByRole("form", { name: "New Competition" });
    await addForm.getByRole("textbox", { name: "Name" }).fill(name);
    await addForm.getByRole("combobox", { name: "Format" }).click();
    await page.getByRole("option", { name: "Participation" }).click();
    await expect(
      addForm.getByText(
        "Points for taking part: the Host ticks who took part, or Participants check in.",
      ),
    ).toBeVisible();
    await shoot(page, testInfo, "create-form");
    await addForm.getByRole("button", { name: "Add Competition" }).click();
    // Add opens the new Competition's page (ticket 101).
    await page.waitForURL(/\/admin\/competitions\/[0-9a-f-]{36}$/);
    const id = page.url().split("/").at(-1) ?? "";

    // …and makes the e2e Host its Host: a roster Participant with the e2e
    // Host's email is added and made Host directly, and the reloaded page
    // shows them among the Hosts.
    const settings = page.getByRole("form", { name: "Competition settings" });
    await addE2eHost(id, E2E_HOST_EMAIL);
    await page.reload();
    await expect(
      settings.getByRole("button", {
        name: "Remove E2E Host",
      }),
    ).toBeVisible();

    const before = await breakdownTotals();
    expect(await leaderboardTotals(page)).toEqual(before);

    // The Host sets the Placement Points to 5 / 3 / 1 and Self check-in on. A
    // team Competition has no mode to choose and no N: Teams are ranked by
    // headcount, so only Placement Points are offered.
    await asHost(hostContext);
    const host = await hostContext.newPage();
    await host.setViewportSize({ width: 1440, height: 900 });
    await openCompetitionPage(host, id);
    await expect(host.getByRole("heading", { name })).toBeVisible();
    await expect(
      host.getByRole("button", { name: "Ranked by headcount" }),
    ).toHaveCount(0);
    await expect(host.getByLabel("Points per Participant")).toHaveCount(0);
    await expect(
      host.getByRole("group", { name: "Placement Points" }),
    ).toBeVisible();
    for (const [place, points] of [
      ["1st", "5"],
      ["2nd", "3"],
      ["3rd", "1"],
    ]) {
      await host.getByRole("button", { name: "Add place" }).click();
      await host.getByLabel(`${place} place Placement Points`).fill(points);
    }
    await host
      .getByRole("switch", { name: "Participants can check in" })
      .click();
    await expectSaved(host);
    await shoot(host, testInfo, "host-settings");

    // Two Participants check themselves in from the Competition's page.
    for (const who of CHECK_INS) {
      const participant = await participantPageAs(browser, who);
      participants.push(participant);
      const you = participant.page;
      await you.setViewportSize({ width: 1440, height: 900 });
      await you.goto(`/xi/competitions/${id}`);
      await expect(
        you.getByRole("region", { name: "Participation" }),
      ).toBeVisible();
      // A Participation Competition is never a Bracket.
      await expect(you.getByRole("region", { name: "Bracket" })).toHaveCount(0);
      await you.getByRole("button", { name: "Check in" }).click();
      await expect(you.getByText("You're checked in").first()).toBeVisible();
      await expect(
        you.getByRole("button", { name: "Check out" }),
      ).toBeVisible();
      await expect(
        you.getByRole("list", { name: "Took part" }).getByText(who),
      ).toBeVisible();
    }
    const first = participants[0].page;
    await expect(
      first.getByRole("heading", { name: /Took part/ }),
    ).toContainText("(2)", { timeout: 20_000 });
    await shoot(participants[1].page, testInfo, "checked-in");

    // The Host ticks a third, on the other Team.
    await host.reload();
    await host
      .getByRole("searchbox", { name: "Search the roster" })
      .fill(TICKED);
    await host.getByRole("checkbox", { name: new RegExp(TICKED) }).click();
    await expect(host.getByText(`${TICKED} took part`)).toBeVisible();
    const counts = host.getByRole("region", { name: "Team counts" });
    await expect(counts.getByRole("listitem")).toHaveText([
      /^1\s*Red\s*2$/,
      /^2\s*Blue\s*1$/,
    ]);
    await shoot(host, testInfo, "host-ticked");

    // The first Participant's page catches up by itself (AutoRefresh).
    await expect(
      first.getByRole("heading", { name: /Took part/ }),
    ).toContainText("(3)", { timeout: 25_000 });
    await expect(
      first.getByRole("list", { name: "Took part" }).getByText(TICKED),
    ).toBeVisible();
    await shoot(first, testInfo, "participant-page");

    // Close: Red (2) takes 1st's 5 points, Blue (1) 2nd's 3.
    await host.getByRole("button", { name: "Close", exact: true }).click();
    await host
      .getByRole("alertdialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(host.getByText("Competition closed")).toBeVisible();
    await shoot(host, testInfo, "closed");
    const closed = await breakdownTotals();
    expect(closed).toEqual({ red: before.red + 5, blue: before.blue + 3 });
    expect(await leaderboardTotals(page)).toEqual(closed);
    await shoot(page, testInfo, "standings-closed");

    // Reopen withdraws them.
    await host.getByRole("button", { name: "Reopen", exact: true }).click();
    await host
      .getByRole("alertdialog")
      .getByRole("button", { name: "Reopen", exact: true })
      .click();
    await expect(host.getByText("Competition reopened")).toBeVisible();
    expect(await breakdownTotals()).toEqual(before);
    expect(await leaderboardTotals(page)).toEqual(before);
    await shoot(page, testInfo, "standings-reopened");
  } finally {
    for (const participant of participants) await participant.close();
    await hostContext.close();
    // Its check-ins, Host row and any generated entries go with it.
    await deleteXiCompetition(name);
  }
});

// Epic R16, ticket 94: an individual Participation Competition gives N points
// to each Participant who took part, and offers no Placement Points.
test("r16 94 an individual Participation Competition gives N points to each Participant who took part", async ({
  context,
  page,
}) => {
  test.setTimeout(180_000);
  const name = `R16 Spirit Week ${Date.now()}`;
  const TOOK_PART = ["Adam Wilson-Hwang", "Alec Haring"] as const;
  try {
    await asOrganizer(context);
    await page.setViewportSize({ width: 1440, height: 900 });
    // The Add sheet asks only name, Format and scoring; the rest is on the
    // Competition's page it opens.
    await addCompetition(page, {
      name,
      format: "Participation",
      scoring: "Individual",
    });

    // N, and no Placement Points or ranking choice.
    await expect(page.getByLabel("Points per Participant")).toHaveValue("1");
    await expect(
      page.getByRole("group", { name: "Placement Points" }),
    ).toHaveCount(0);
    await page.getByLabel("Points per Participant").fill("2");
    await expectSaved(page);

    for (const who of TOOK_PART) {
      await page
        .getByRole("searchbox", { name: "Search the roster" })
        .fill(who);
      await page.getByRole("checkbox", { name: new RegExp(who) }).click();
      await expect(page.getByText(`${who} took part`)).toBeVisible();
    }

    await page.getByRole("button", { name: "Close", exact: true }).click();
    await page
      .getByRole("alertdialog")
      .getByRole("button", { name: "Close", exact: true })
      .click();
    await expect(page.getByText("Competition closed")).toBeVisible();

    // Each who took part gets N (2) as a Points Entry of their own.
    expect(await xiCompetitionEntries(name)).toEqual(
      [...TOOK_PART]
        .sort()
        .map((target) => ({ target, points: 2, generated: true })),
    );
  } finally {
    await deleteXiCompetition(name);
  }
});
