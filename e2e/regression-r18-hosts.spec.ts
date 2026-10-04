import { type Page, expect, test } from "@playwright/test";

import {
  addCompetition,
  expectSaved,
  openCompetitionPage,
} from "./competition-page";
import { deleteXiCompetition, runQuery, withParticipantEmail } from "./db";
import { E2E_HOST_EMAIL, asHost, asOrganizer } from "./session";

// Epic R18, ticket 102 (.scratch/regression-2026-10/issues/102-hosts-from-the-roster.md),
// as R22 changed it (ADR 0012): an Organizer picks Hosts by name from the
// roster, with or without an email and never seeing one; a picked Host runs
// the Competition. The test makes its own `E2E R18 Hosts …` Competition in
// demo XI and deletes it in `finally`; three Participants get roster emails
// for the test only (`withParticipantEmail` gives them back).

const SECOND_HOST_EMAIL = "e2e-r18-second-host@jahnelgroup.com";
const OUTSIDER_EMAIL = "e2e-r18-outsider@example.com";

/** Types `query` in the Hosts picker and picks the option for `name`. */
async function pickHost(page: Page, query: string, name: string) {
  const picker = page.getByRole("combobox", { name: "Hosts", exact: true });
  await picker.click();
  await picker.fill(query);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
}

test("r18 102 an Organizer picks two Hosts by name from the roster, and a picked Host records a result", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(150_000);
  const name = `E2E R18 Hosts ${Date.now()}`;
  const first = "Ashley Schuliger";
  const second = "Adam Wilson-Hwang";
  await withParticipantEmail("xi", first, E2E_HOST_EMAIL, () =>
    withParticipantEmail("xi", second, SECOND_HOST_EMAIL, () =>
      withParticipantEmail("xi", "Casey Snow", OUTSIDER_EMAIL, async () => {
        try {
          await asOrganizer(context);
          await page.setViewportSize({ width: 1440, height: 900 });
          const id = await addCompetition(page, {
            name,
            scoring: "Individual",
          });
          await openCompetitionPage(page, id);

          // Options show the name alone, never an email. A Participant with
          // no email is pickable, and one whose email can't sign in is marked.
          const picker = page.getByRole("combobox", {
            name: "Hosts",
            exact: true,
          });
          await picker.click();
          await picker.fill("Ashley");
          const ashley = page.getByRole("option", {
            name: /^Ashley Schuliger/,
          });
          await expect(ashley).toBeVisible();
          await expect(ashley).not.toContainText("@");
          await picker.fill("Brian");
          const noEmail = page.getByRole("option", { name: /^Brian/ }).first();
          await expect(noEmail).toBeVisible();
          await expect(noEmail).not.toContainText("Add an email in Roster");
          await expect(noEmail).not.toHaveAttribute("aria-disabled", "true");
          await picker.fill("Casey");
          const outsider = page.getByRole("option", { name: /^Casey Snow/ });
          await expect(outsider).toContainText("Can't sign in");
          await expect(outsider).not.toContainText("@");
          await expect(outsider).not.toHaveAttribute("aria-disabled", "true");
          await page.keyboard.press("Escape");
          const html = await page.content();
          for (const email of [
            E2E_HOST_EMAIL,
            SECOND_HOST_EMAIL,
            OUTSIDER_EMAIL,
          ]) {
            expect(html).not.toContain(email);
          }

          await pickHost(page, "Ashley", first);
          await pickHost(page, "Adam Wilson", second);
          await page.keyboard.press("Escape");
          const settings = page.getByRole("form", {
            name: "Competition settings",
          });
          await expect(
            settings.getByRole("button", { name: `Remove ${first}` }),
          ).toBeVisible();
          await expect(
            settings.getByRole("button", { name: `Remove ${second}` }),
          ).toBeVisible();
          await expectSaved(page);
          const saved = await runQuery<{ name: string }>(
            `select p.display_name as name from competition_host h
           join participant p on p.id = h.participant_id
           where h.competition_id = $1 order by p.display_name`,
            [id],
          );
          expect(saved.map((row) => row.name)).toEqual([second, first]);

          // The picked Host signs in, opens the page and records a result.
          const hostContext = await browser.newContext();
          try {
            await asHost(hostContext);
            const host = await hostContext.newPage();
            await host.setViewportSize({ width: 1440, height: 900 });
            await openCompetitionPage(host, id);
            await expect(
              host.getByRole("combobox", { name: "Hosts", exact: true }),
            ).toHaveCount(0);
            const search = host.getByRole("combobox", {
              name: "Add a Participant",
            });
            await search.click();
            await search.fill("Ashley Schuliger");
            await host
              .getByRole("option", { name: /Ashley Schuliger/ })
              .first()
              .click();
            await expect(
              host.getByText("Ashley Schuliger added"),
            ).toBeVisible();
          } finally {
            await hostContext.close();
          }
          await page.screenshot({ path: testInfo.outputPath("hosts.png") });
        } finally {
          await deleteXiCompetition(name);
        }
      }),
    ),
  );
});
