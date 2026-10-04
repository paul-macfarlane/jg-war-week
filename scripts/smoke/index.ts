import { loadEnvConfig } from "@next/env";
import { existsSync } from "node:fs";
import path from "node:path";

import { isLocalDatabaseUrl } from "@/db/local-url";
import { localSeedFiles } from "@/seed/local-files";

import {
  assertAdminGate,
  assertAdminGuidePage,
  assertAdminLink,
  assertAdminRedirects,
  assertAdminWording,
  assertSignInRequired,
} from "./admin";
import {
  assertAnnouncementActions,
  assertAnnouncementAdminPages,
  assertAnnouncementFeed,
  assertAnnouncementHomePinned,
  assertAnnouncementUnsafeContentStripped,
} from "./announcements";
import { assertArchiveDetail, assertHistory } from "./archive";
import {
  assertAwardCategoriesSeeded,
  assertAwardsPageGrouped,
} from "./award-categories";
import { assertAwardHistoryRoute } from "./award-history";
import {
  assertAwardActions,
  assertAwardAdminPages,
  assertAwardsPage,
  assertFaqPage,
} from "./awards";
import {
  assertBracketLoop,
  assertMatchesLoop,
  assertSquadSelfReportLoop,
} from "./brackets";
import { assertDiscretionaryPoints } from "./discretionary-points";
import { assertFinale } from "./finale";
import { assertGamesLoop } from "./games";
import {
  BASE_URL,
  PORT,
  READY_TIMEOUT_MS,
  SMOKE_HOST_EMAIL,
  SMOKE_ORGANIZER_EMAIL,
  childEnv,
  createSmokeSession,
  deleteSmokeUsers,
  fail,
  killServer,
  ok,
  portInUse,
  runStep,
  setSmokeOrganizer,
  startServer,
  state,
  waitForReady,
} from "./harness";
import {
  assertHostChecks,
  assertParticipantRefused,
  deleteSmokeHosts,
} from "./hosts";
import { assertPostedWarWeekWins, assertWarWeekLifecycle } from "./lifecycle";
import { assertMcp } from "./mcp";
import {
  assertAboutPage,
  assertCompetitionDetail,
  assertCompetitions,
  assertDiscretionaryReasonConstraint,
  assertDisplayScriptInHead,
  assertEditionErrorBoundary,
  assertFinaleSlidesKeptIds,
  assertFreeForAllRoster,
  assertHomeNowNext,
  assertInstallable,
  assertLeaderboard,
  assertLlmsTxt,
  assertMoreLinks,
  assertParticipationColumnsConstraint,
  assertPlacementPointsSeeded,
  assertPlacementTargetConstraint,
  assertPointsEntryTargetConstraint,
  assertPrivacyAndTermsPages,
  assertRootRedirect,
  assertSchedule,
  assertSeedLoadedOnce,
  assertSignInPage,
  assertTeams,
  assertTestSignInOffAndUpdateUserDisabled,
  assertUnknownEdition404,
  assertXiHome,
  assertYouHighlight,
  restoreFaqTable,
  xiFinaleSlideIds,
} from "./pages";
import { assertParticipationLoop } from "./participation";
import { assertScaleSeed } from "./scale";
import {
  assertSetup,
  assertSetupScheduleFaq,
  assertSetupTeamsAndCompetitions,
  assertXiSeededOverride,
} from "./setup";

loadEnvConfig(process.cwd());

async function main() {
  if (
    !isLocalDatabaseUrl(process.env.DATABASE_URL, process.env.DATABASE_DRIVER)
  ) {
    console.error(
      'FAIL - DATABASE_URL must point at a local database (localhost, 127.0.0.1 or [::1]) with DATABASE_DRIVER not "neon"; smoke resets every seeded War Week and never runs against a hosted database',
    );
    process.exit(1);
  }

  if (!existsSync(path.resolve(process.cwd(), ".next"))) {
    console.error(
      "FAIL - .next build output missing: run `pnpm build` before `pnpm smoke`",
    );
    process.exit(1);
  }

  if (await portInUse(BASE_URL)) {
    console.error(
      `FAIL - something is already listening on ${BASE_URL}; stop it before running the smoke`,
    );
    process.exit(1);
  }

  if (!runStep("pnpm", ["db:migrate"], "pnpm db:migrate")) {
    process.exit(1);
  }
  // Load every seed (the XI demo in place of the real XI) twice: the first load resets each War Week so the counts
  // below match the seeds exactly; the second proves loading is idempotent.
  const seedFiles = localSeedFiles();
  let finaleSlideIds: string[] = [];
  for (const [attempt, flags] of [
    [1, ["--reset"]],
    [2, []],
  ] as const) {
    if (
      !runStep(
        "pnpm",
        ["seed:load", ...flags, ...seedFiles],
        `pnpm ${["seed:load", ...flags].join(" ")} (${seedFiles.length} seeds, load ${attempt})`,
      )
    ) {
      process.exit(1);
    }
    if (attempt === 1) finaleSlideIds = await xiFinaleSlideIds();
  }
  await assertSeedLoadedOnce();
  await assertFinaleSlidesKeptIds(finaleSlideIds);
  await assertPointsEntryTargetConstraint();
  await assertDiscretionaryReasonConstraint();
  await assertPlacementTargetConstraint();
  await assertParticipationColumnsConstraint();
  await assertPlacementPointsSeeded();
  await assertAwardCategoriesSeeded();

  // Clear leftovers from an interrupted run, then add the smoke Organizer
  // to XI's allowlist until the run ends.
  await restoreFaqTable();
  await deleteSmokeUsers();
  await deleteSmokeHosts();
  await setSmokeOrganizer(true);
  const sessions = {
    organizer: await createSmokeSession(SMOKE_ORGANIZER_EMAIL),
    notOrganizer: await createSmokeSession("smoke-participant@jahnelgroup.com"),
    // No Organizer row; assertHostChecks assigns it one XI Competition.
    host: await createSmokeSession(SMOKE_HOST_EMAIL),
    // Can't happen through sign-in (the user-create hook refuses it); the
    // session check still treats it as anonymous.
    outsider: await createSmokeSession("smoke-outsider@example.com"),
  };
  state.viewerCookie = sessions.notOrganizer.cookie;

  const server = startServer(PORT, childEnv);

  try {
    const ready = await waitForReady();
    if (!ready) {
      fail(
        "server ready",
        `did not respond on ${BASE_URL}/xi within ${READY_TIMEOUT_MS}ms`,
      );
    } else {
      ok("server ready");
      await assertRootRedirect();
      await assertXiHome();
      await assertDisplayScriptInHead();
      // Before any check edits XI.
      await assertXiSeededOverride();
      await assertUnknownEdition404();
      await assertLeaderboard();
      await assertSchedule();
      await assertHomeNowNext();
      await assertMoreLinks();
      await assertInstallable();
      await assertLlmsTxt();
      await assertHistory();
      await assertArchiveDetail();
      await assertAwardHistoryRoute();
      await assertCompetitions();
      await assertCompetitionDetail();
      await assertTeams();
      await assertFreeForAllRoster();
      await assertYouHighlight(sessions);
      await assertMcp();
      await assertAboutPage();
      await assertPrivacyAndTermsPages();
      await assertSignInPage();
      await assertTestSignInOffAndUpdateUserDisabled();
      await assertAdminGate(sessions);
      await assertAdminWording(sessions);
      await assertAdminRedirects(sessions);
      await assertSignInRequired();
      await assertAdminLink(sessions);
      await assertAdminGuidePage(sessions);
      await assertDiscretionaryPoints(sessions);
      await assertFinale(sessions);
      await assertAnnouncementFeed();
      await assertAnnouncementHomePinned();
      await assertAnnouncementActions(sessions);
      await assertAnnouncementUnsafeContentStripped(sessions);
      await assertAnnouncementAdminPages(sessions);
      await assertAwardsPage();
      await assertAwardsPageGrouped();
      await assertFaqPage();
      await assertAwardActions(sessions);
      await assertAwardAdminPages(sessions);
      await assertSetup(sessions);
      await assertSetupTeamsAndCompetitions(sessions);
      await assertSetupScheduleFaq(sessions);
      await assertBracketLoop(sessions);
      await assertMatchesLoop(sessions);
      await assertSquadSelfReportLoop(sessions);
      await assertHostChecks(sessions);
      await assertParticipantRefused(sessions);
      await assertParticipationLoop(sessions);
      // Ends XI by SQL in its own step, then restores it.
      await assertGamesLoop(sessions);
      await assertPostedWarWeekWins(sessions);
      // It changes which War Week is current, then restores XI.
      await assertWarWeekLifecycle(sessions);
      // Final phase: reloads the seeds with the XII scale demo, then puts
      // localSeedFiles() back. Before the step below, which can leave the
      // faq_item table hidden until `restoreFaqTable` in `finally`.
      await assertScaleSeed();
      // Last: it hides the faq_item table for one request, then restores it.
      await assertEditionErrorBoundary();
    }
  } finally {
    await restoreFaqTable().catch((error) =>
      fail("restore the faq_item table", String(error)),
    );
    await deleteSmokeHosts().catch((error) =>
      fail("delete the smoke Host's competition_host rows", String(error)),
    );
    await killServer(server);
    await deleteSmokeUsers().catch((error) =>
      fail("delete smoke users", String(error)),
    );
    await setSmokeOrganizer(false).catch((error) =>
      fail("remove the smoke Organizer from XI", String(error)),
    );
  }

  process.exit(state.failures > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
