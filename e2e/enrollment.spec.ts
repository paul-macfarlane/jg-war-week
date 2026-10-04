import {
  type Locator,
  type Page,
  type TestInfo,
  expect,
  test,
} from "@playwright/test";
import path from "node:path";

import { DISPLAY_STORAGE_KEY } from "@/lib/display";

import { openCompetitionPage } from "./competition-page";
import {
  addE2eHost,
  openForBracket,
  removeE2eHost,
  runQuery,
  setParticipantEmail,
  xiCompetitionId,
  xiParticipantId,
} from "./db";
import { E2E_BASE_URL } from "./env";
import {
  E2E_HOST_EMAIL,
  E2E_PARTICIPANT_EMAIL,
  asHost,
  signIn,
} from "./session";

// Pool is an individual War Week XI Competition (counts toward Team) that
// no other flow touches: the flow runs it as a head-to-head Bracket
// with "Participants can enroll" on, then puts it back.
const COMPETITION = "Pool";

// The seeded Competitions are Closed Placement sheets; open each for a
// Bracket and put the sheet back afterwards.
let restoreCompetition: (() => Promise<void>) | null = null;
test.beforeEach(async () => {
  restoreCompetition = await openForBracket(await xiCompetitionId(COMPETITION));
});
test.afterEach(async () => {
  await restoreCompetition?.();
  restoreCompetition = null;
});
/** Enrolls, withdraws and enrolls again; linked by email. */
const ENROLLEE = "Alex Nikolis";
/** The second Entrant, added by SQL (Generate needs two). */
const SECOND = "Andrew Bushey";
/** A linked Participant who never enrolled, refused once it's built. */
const LATECOMER = "Awad Khawaja";
/** A second stub JG address, cleared with every e2e user (`e2e-%`). */
const E2E_PARTICIPANT_2_EMAIL = "e2e-participant-2@jahnelgroup.com";
const BUILT = "Enrollment is closed: the Bracket is built.";

/** Screenshots at 375 and 1280 under `test-results/e2e/enrollment-<step>/`. */
async function shoot(page: Page, testInfo: TestInfo, step: string) {
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: path.join(
        testInfo.project.outputDir,
        `enrollment-${step}`,
        `${width}.png`,
      ),
      fullPage: true,
      animations: "disabled",
    });
  }
  await page.setViewportSize({ width: 1280, height: 900 });
}

/**
 * A disabled button's computed `background-color` equals the theme root's
 * resolved `--muted` (not `--primary`), and its top border is dashed — the
 * non-colour disabled cue (ticket 22).
 */
async function assertDisabledButtonStyle(button: Locator) {
  const styles = await button.evaluate((el) => {
    const root = el.closest("[data-theme-root]") ?? document.documentElement;
    const probe = document.createElement("div");
    root.appendChild(probe);
    probe.style.backgroundColor = "var(--muted)";
    const muted = getComputedStyle(probe).backgroundColor;
    probe.style.backgroundColor = "var(--primary)";
    const primary = getComputedStyle(probe).backgroundColor;
    root.removeChild(probe);
    const computed = getComputedStyle(el);
    return {
      background: computed.backgroundColor,
      borderTopStyle: computed.borderTopStyle,
      muted,
      primary,
    };
  });
  expect(styles.background).toBe(styles.muted);
  expect(styles.background).not.toBe(styles.primary);
  expect(styles.borderTopStyle).toBe("dashed");
}

/**
 * A disabled outline button reads as disabled: muted text, as
 * `--muted-foreground` resolves in its themed root, and a dashed border.
 */
async function assertDisabledOutlineButtonStyle(button: Locator) {
  const styles = await button.evaluate((el) => {
    const root = el.closest("[data-theme-root]") ?? document.documentElement;
    const probe = document.createElement("div");
    root.appendChild(probe);
    probe.style.color = "var(--muted-foreground)";
    const mutedForeground = getComputedStyle(probe).color;
    root.removeChild(probe);
    const computed = getComputedStyle(el);
    return {
      color: computed.color,
      borderTopStyle: computed.borderTopStyle,
      mutedForeground,
    };
  });
  expect(styles.color).toBe(styles.mutedForeground);
  expect(styles.borderTopStyle).toBe("dashed");
}

/** Whether `participantId` is one of the Competition's Entrants. */
async function isEntrant(competitionId: string, participantId: string) {
  const rows = await runQuery(
    `select 1 from entrant where competition_id = $1 and participant_id = $2`,
    [competitionId, participantId],
  );
  return rows.length === 1;
}

function enrollmentCard(page: Page) {
  return page
    .locator("[data-slot=card]")
    .filter({ has: page.getByRole("heading", { name: "Enrollment" }) });
}

test("enrollment: a Participant enrolls, withdraws and enrolls again; once the Host builds the Bracket, enrollment is refused", async ({
  browser,
  context,
  page,
}, testInfo) => {
  test.setTimeout(180_000);
  const id = await xiCompetitionId(COMPETITION);
  const enrolleeId = await xiParticipantId(ENROLLEE);
  const secondId = await xiParticipantId(SECOND);
  const latecomerId = await xiParticipantId(LATECOMER);
  const [original] = await runQuery<{
    format: string;
    bracket_config: unknown;
    self_enroll: boolean;
    closed_at: Date | null;
  }>(
    `select format::text as format, bracket_config, self_enroll, closed_at
     from competition where id = $1`,
    [id],
  );
  await runQuery(
    `update competition set format = 'bracket',
       bracket_config = '{"kind":"head-to-head","entrantsPerMatch":2,"advancePerMatch":1,"thirdPlaceMatch":false,"rounds": {}}'::jsonb,
       self_enroll = true
     where id = $1`,
    [id],
  );
  await addE2eHost(id, E2E_HOST_EMAIL);
  await setParticipantEmail(enrolleeId, E2E_PARTICIPANT_EMAIL);
  await setParticipantEmail(latecomerId, E2E_PARTICIPANT_2_EMAIL);
  const youContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  const lateContext = await browser.newContext({ baseURL: E2E_BASE_URL });
  try {
    await signIn(youContext, E2E_PARTICIPANT_EMAIL);
    const you = await youContext.newPage();
    await you.goto(`/xi/competitions/${id}`);
    const card = enrollmentCard(you);
    await expect(card).toBeVisible();
    await shoot(you, testInfo, "open");

    // Enroll → an Entrant row.
    await card.getByRole("button", { name: "Enroll" }).click();
    await expect(you.getByText("You're enrolled")).toBeVisible();
    await expect(card.getByText("You're entered.")).toBeVisible();
    expect(await isEntrant(id, enrolleeId)).toBe(true);
    await shoot(you, testInfo, "enrolled");

    // Withdraw (confirmed) → gone.
    await card.getByRole("button", { name: "Withdraw" }).click();
    const confirm = you.getByRole("alertdialog", {
      name: `Withdraw from ${COMPETITION}?`,
    });
    await shoot(you, testInfo, "withdraw-confirm");
    await confirm.getByRole("button", { name: "Withdraw" }).click();
    await expect(you.getByText("You've withdrawn")).toBeVisible();
    await expect(card.getByRole("button", { name: "Enroll" })).toBeEnabled();
    expect(await isEntrant(id, enrolleeId)).toBe(false);

    // Enroll again → back.
    await card.getByRole("button", { name: "Enroll" }).click();
    await expect(card.getByText("You're entered.")).toBeVisible();
    expect(await isEntrant(id, enrolleeId)).toBe(true);

    // A second Entrant by SQL, never through the Host's picker.
    await runQuery(
      `insert into entrant (competition_id, participant_id, seed_position)
       select $1, $2, coalesce(max(seed_position), 0) + 1
       from entrant where competition_id = $1`,
      [id, secondId],
    );

    // The Host generates the Bracket.
    await asHost(context);
    await openCompetitionPage(page, id);
    await page.getByRole("button", { name: "Generate" }).click();
    await expect(page.getByText("Bracket generated")).toBeVisible();
    await shoot(page, testInfo, "generated");

    // Enrollment is closed: Withdraw for the Entrant, Enroll for a
    // latecomer, both refused with the rule's reason.
    await you.reload();
    await expect(card.getByText(BUILT)).toBeVisible();
    const withdrawButton = card.getByRole("button", { name: "Withdraw" });
    await expect(withdrawButton).toBeDisabled();
    await assertDisabledOutlineButtonStyle(withdrawButton);
    await shoot(you, testInfo, "closed-entered");

    await signIn(lateContext, E2E_PARTICIPANT_2_EMAIL);
    const late = await lateContext.newPage();
    await late.goto(`/xi/competitions/${id}`);
    const lateCard = enrollmentCard(late);
    await expect(lateCard.getByText(BUILT)).toBeVisible();
    const lateEnrollButton = lateCard.getByRole("button", { name: "Enroll" });
    await expect(lateEnrollButton).toBeDisabled();
    expect(await isEntrant(id, latecomerId)).toBe(false);
    await assertDisabledButtonStyle(lateEnrollButton);
    await shoot(late, testInfo, "closed-refused");

    // Same disabled Enroll, pinned to the Dark scheme, in a fresh context
    // (the stored Display must be set before the first page load).
    const darkContext = await browser.newContext({ baseURL: E2E_BASE_URL });
    try {
      await darkContext.addInitScript(
        ([key, value]) => window.localStorage.setItem(key, value),
        [DISPLAY_STORAGE_KEY, "dark"] as const,
      );
      await signIn(darkContext, E2E_PARTICIPANT_2_EMAIL);
      const darkPage = await darkContext.newPage();
      await darkPage.goto(`/xi/competitions/${id}`);
      const darkCard = enrollmentCard(darkPage);
      await expect(darkCard.getByText(BUILT)).toBeVisible();
      const darkEnrollButton = darkCard.getByRole("button", {
        name: "Enroll",
      });
      await expect(darkEnrollButton).toBeDisabled();
      await assertDisabledButtonStyle(darkEnrollButton);
      await darkPage.setViewportSize({ width: 375, height: 900 });
      await darkPage.screenshot({
        path: path.join(
          testInfo.project.outputDir,
          "enrollment-closed-refused",
          "375-dark.png",
        ),
        fullPage: true,
        animations: "disabled",
      });
    } finally {
      await darkContext.close();
    }
  } finally {
    await youContext.close();
    await lateContext.close();
    await runQuery(`delete from bracket_match where competition_id = $1`, [id]);
    await runQuery(`delete from entrant where competition_id = $1`, [id]);
    await runQuery(
      `update competition set format = $2::competition_format,
         bracket_config = $3, self_enroll = $4, closed_at = $5
       where id = $1`,
      [
        id,
        original.format,
        original.bracket_config === null
          ? null
          : JSON.stringify(original.bracket_config),
        original.self_enroll,
        original.closed_at,
      ],
    );
    await setParticipantEmail(enrolleeId, null);
    await setParticipantEmail(latecomerId, null);
    await removeE2eHost(id, E2E_HOST_EMAIL);
  }
});
