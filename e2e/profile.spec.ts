import { type Page, expect, test } from "@playwright/test";
import path from "node:path";

import { runQuery, xiCompetitionId, xiParticipantId } from "./db";
import { E2E_BASE_URL } from "./env";
import { asOrganizer, participantPageAs } from "./session";

// Epic R10, ticket 60 (wave 3): the Profile name and picture on every
// surface. A Participant's Google photo shows first; a Profile name and
// picture URL replace it on Standings, the roster and a Games Competition;
// the Organizer's roster form shows the name read-only; Use Google photo
// puts the Google photo back.

// XI's live demo has a roster and Points Entries, but no logged Games, so
// the flow logs one for Bouncy Pong (an open individual Head-to-head or Best score
// Competition) and removes it after.
const PARTICIPANT = "Anthony Conway";
const OPPONENT = "Alec Haring";
const COMPETITION = "Bouncy Pong";
const PROFILE_NAME = "Tony Profile";
const GOOGLE_URL = "https://lh3.googleusercontent.com/a/e2e-profile-test";
const PICTURE_URL = "https://images.example.test/me.png";
// A 1×1 PNG, served for both hosts so no request leaves the machine.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==",
  "base64",
);

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

/** The one `<img>` in the row/list item that shows `name`. */
const avatarOf = (page: Page, name: string, scope?: string) =>
  page
    .locator(scope ?? "main")
    .getByText(name, { exact: false })
    .first()
    .locator("xpath=ancestor::*[self::li or self::tr][1]")
    .locator("img");

for (const viewport of VIEWPORTS) {
  test(`60 the Profile name and picture show on the leaderboard, teams and a Games Competition, and the roster form reads the name read-only, at ${viewport.width}`, async ({
    browser,
  }) => {
    const participantId = await xiParticipantId(PARTICIPANT);
    // The same email `participantPageAs` links the Participant with.
    const email = `e2e-p-${participantId}@jahnelgroup.com`;
    const competitionId = await xiCompetitionId(COMPETITION);
    const opponentId = await xiParticipantId(OPPONENT);
    const { page, close } = await participantPageAs(browser, PARTICIPANT);
    const orgContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    const shot = (name: string, target: Page = page) =>
      target.screenshot({
        path: path.resolve(
          "test-results/r10-accounts",
          `profile-surfaces-${viewport.width}`,
          `${name}.png`,
        ),
        animations: "disabled",
      });
    let gameId: string | undefined;
    try {
      for (const host of ["lh3.googleusercontent.com", "images.example.test"]) {
        await page.route(`https://${host}/**`, (route) =>
          route.fulfill({ status: 200, contentType: "image/png", body: PNG }),
        );
      }
      await page.setViewportSize(viewport);
      await runQuery(`update "user" set image = $1 where email = $2`, [
        GOOGLE_URL,
        email,
      ]);
      // A logged Game, so the Participant appears on the Games page.
      [{ id: gameId }] = await runQuery<{ id: string }>(
        `insert into game (competition_id, logged_by_email) values ($1, $2) returning id`,
        [competitionId, "e2e-organizer@jahnelgroup.com"],
      );
      await runQuery(
        `insert into game_player (game_id, participant_id, place) values ($1, $2, 1), ($1, $3, 2)`,
        [gameId, participantId, opponentId],
      );

      // The Google photo shows before anything is set.
      await page.goto("/xi/profile");
      await expect(
        page.getByRole("figure", { name: "Light preview" }).locator("img"),
      ).toHaveAttribute("src", GOOGLE_URL);
      await page.goto("/xi/leaderboard");
      await expect(avatarOf(page, PARTICIPANT)).toHaveAttribute(
        "src",
        GOOGLE_URL,
      );
      await shot("leaderboard-google");

      // Set a Profile name and a picture URL.
      await page.goto("/xi/profile");
      await page.getByLabel("Profile name").fill(PROFILE_NAME);
      await page.getByLabel("Picture URL").fill(PICTURE_URL);
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Profile saved")).toBeVisible();
      await shot("profile");

      // Leaderboard (Standings), teams roster, and the Games Competition.
      await page.goto("/xi/leaderboard");
      await expect(page.getByText(PROFILE_NAME).first()).toBeVisible();
      await expect(avatarOf(page, PROFILE_NAME)).toHaveAttribute(
        "src",
        PICTURE_URL,
      );
      await shot("leaderboard");

      await page.goto("/xi/teams");
      await expect(avatarOf(page, PROFILE_NAME)).toHaveAttribute(
        "src",
        PICTURE_URL,
      );
      await shot("teams");

      await page.goto(`/xi/competitions/${competitionId}`);
      const gamesRow = page
        .getByRole("region", { name: "Games" })
        .getByRole("row")
        .filter({ has: page.getByRole("rowheader", { name: PROFILE_NAME }) });
      await expect(gamesRow.locator("img")).toHaveAttribute("src", PICTURE_URL);
      // The logged Game's entry in the Game log names them by Profile name.
      await expect(
        page
          .getByRole("region", { name: "Games" })
          .getByRole("listitem")
          .filter({ hasText: `${PROFILE_NAME} beat ${OPPONENT}` }),
      ).toBeVisible();
      await shot("games");

      // The Organizer's roster form: the name read-only, set by the person.
      await asOrganizer(orgContext);
      const admin = await orgContext.newPage();
      await admin.setViewportSize(viewport);
      await admin.goto("/admin/roster");
      await admin
        .getByRole("button", { name: `Edit ${PARTICIPANT}`, exact: true })
        .click();
      const sheet = admin.getByRole("dialog", { name: `Edit ${PARTICIPANT}` });
      await expect(sheet.getByText("Set by the person")).toBeVisible();
      await expect(sheet.getByLabel("Display name")).toHaveValue(PROFILE_NAME);
      await expect(sheet.getByLabel("Display name")).toHaveAttribute(
        "readonly",
        "",
      );
      await shot("admin-roster-form", admin);

      // Use Google photo restores it; the name stays.
      await page.goto("/xi/profile");
      await page.getByRole("button", { name: "Use Google photo" }).click();
      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Profile saved")).toBeVisible();
      await page.goto("/xi/leaderboard");
      await expect(avatarOf(page, PROFILE_NAME)).toHaveAttribute(
        "src",
        GOOGLE_URL,
      );
      await shot("leaderboard-google-again");
    } finally {
      await orgContext.close();
      await close();
      if (gameId) await runQuery(`delete from game where id = $1`, [gameId]);
      await runQuery(`delete from profile where email = $1`, [email]);
      await runQuery(`delete from "user" where email = $1`, [email]);
    }
  });
}
