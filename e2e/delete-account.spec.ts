import { type BrowserContext, expect, test } from "@playwright/test";
import path from "node:path";

import { runQuery, withParticipantEmail } from "./db";
import { signIn } from "./session";

// Epic R10, ticket 61 (wave 3): Delete my account. XII has no roster in
// the local seeds; XI's live demo does.
const PARTICIPANT = "Anthony Conway";
const PROFILE_NAME = "Tony Deleted Profile";
const EMAIL = "e2e-delete-account@jahnelgroup.com";

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
] as const;

async function rows(table: string, column: string) {
  const [{ n }] = await runQuery<{ n: string }>(
    `select count(*)::text as n from "${table}" where ${column} = $1`,
    [EMAIL],
  );
  return Number(n);
}

async function userRows() {
  return rows("user", "email");
}

for (const viewport of VIEWPORTS) {
  test(`61 a signed-in person deletes their account by typing their email, and lands signed out, at ${viewport.width}`, async ({
    browser,
  }) => {
    const context: BrowserContext = await browser.newContext();
    try {
      await withParticipantEmail("xi", PARTICIPANT, EMAIL, async () => {
        await signIn(context, EMAIL);
        await runQuery(
          `insert into profile (email, name) values ($1, $2)
           on conflict (email) do update set name = excluded.name`,
          [EMAIL, PROFILE_NAME],
        );
        const page = await context.newPage();
        await page.setViewportSize(viewport);

        // The roster shows the Profile name while the account exists.
        await page.goto("/xi/teams");
        await expect(page.getByText(PROFILE_NAME).first()).toBeVisible();

        await page.goto("/xi/profile");
        await expect(
          page.getByRole("heading", { name: "Delete my account" }),
        ).toBeVisible();
        await page
          .getByRole("button", { name: "Delete my account" })
          .first()
          .click();
        const dialog = page.getByRole("alertdialog");
        const confirm = dialog.getByRole("button", {
          name: "Delete my account",
        });
        await expect(confirm).toBeDisabled();
        await dialog
          .getByLabel(`Type ${EMAIL} to confirm`)
          .fill(` ${EMAIL.toUpperCase()} `);
        await expect(confirm).toBeEnabled();
        await page.screenshot({
          path: path.resolve(
            "test-results/r10-accounts",
            `delete-${viewport.width}`,
            "confirm.png",
          ),
          animations: "disabled",
        });
        await confirm.click();

        await expect(page).toHaveURL(/\/$/);
        await page.goto("/xi");
        await expect(page).toHaveURL(/\/sign-in/);

        expect(await userRows()).toBe(0);
        const [{ n: sessions }] = await runQuery<{ n: string }>(
          `select count(*)::text as n from session s
           where s.user_id not in (select id from "user")`,
        );
        expect(Number(sessions)).toBe(0);
        expect(await rows("profile", "email")).toBe(0);
        const [participant] = await runQuery<{ display_name: string }>(
          `select p.display_name from participant p join war_week w on w.id = p.war_week_id
           where w.edition = 'xi' and p.email = $1`,
          [EMAIL],
        );
        expect(participant.display_name).toBe(PARTICIPANT);

        // Seen by someone else, the roster shows the roster name again.
        await signIn(context, "e2e-delete-viewer@jahnelgroup.com");
        await page.goto("/xi/teams");
        await expect(page.getByText(PARTICIPANT).first()).toBeVisible();
        await expect(page.getByText(PROFILE_NAME)).toHaveCount(0);
      });
    } finally {
      await context.close();
      await runQuery(`delete from profile where email = $1`, [EMAIL]);
      await runQuery(`delete from "user" where email = $1`, [EMAIL]);
    }
  });
}
