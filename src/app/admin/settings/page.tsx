import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { NextWarWeekButton } from "@/components/next-war-week-form";
import { SeedOverwriteWarning } from "@/components/seed-overwrite-warning";
import { Badge } from "@/components/ui/badge";
import { WarWeekLifecycleControls } from "@/components/war-week-lifecycle-controls";
import { WarWeekSettingsForm } from "@/components/war-week-settings-form";
import { settingsInputFrom } from "@/lib/setup";
import { teamSwatches } from "@/lib/theme";
import {
  STATUS_LABELS,
  canCreateNextWarWeek,
  defaultWinner,
  latestWarWeek,
  nextEditionDefaults,
} from "@/lib/war-week-lifecycle";
import { getOpenUnscoredCompetitions } from "@/queries/open-unscored-competitions";
import { getSetupDays, getSetupTeams } from "@/queries/setup";
import { getStandings } from "@/queries/standings";
import { getUnclosedBrackets } from "@/queries/unclosed-brackets";
import { getWarWeeks } from "@/queries/war-weeks";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings · JG War Week" };

const STATUS_HELP = {
  upcoming: "Set it up in advance. Start it when the current War Week ends.",
  live: "This is the current War Week. End it to move it to the Archive with its Winner, or Unstart it while nothing has been scored.",
  complete:
    "In the Archive. You can still correct its results, or reopen it for the live view.",
} as const;

/**
 * The War Week's settings and its Lifecycle (Start, End, Unstart, Reopen,
 * and Create next War Week on the latest War Week once it is complete), for
 * Organizers.
 */
export default async function AdminSettingsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/settings", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const isLive = warWeek.status === "live";
  const [days, teams, existing, standings, unclosedBrackets, openUnscored] =
    await Promise.all([
      getSetupDays(warWeek),
      getSetupTeams(warWeek),
      getWarWeeks(),
      isLive ? getStandings(warWeek) : undefined,
      isLive ? getUnclosedBrackets(warWeek) : [],
      isLive ? getOpenUnscoredCompetitions(warWeek) : [],
    ]);
  const showCreateNext = canCreateNextWarWeek(warWeek, latestWarWeek(existing));
  const suggestedWinner = standings
    ? defaultWinner(standings)
    : (warWeek.winner ?? "");

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Settings"
    >
      <section className="flex max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-bold">Settings</h1>
        <SeedOverwriteWarning />
        <section
          aria-labelledby="lifecycle-heading"
          className="border-border flex flex-col gap-3 rounded-lg border p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="lifecycle-heading" className="font-semibold">
              Lifecycle
            </h2>
            <Badge variant="secondary">{STATUS_LABELS[warWeek.status]}</Badge>
          </div>
          <p className="text-foreground/70 text-sm">
            {STATUS_HELP[warWeek.status]}
          </p>
          <p className="text-foreground/70 text-sm">
            Live makes this the War Week everyone lands on. Nothing is hidden
            before then.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <WarWeekLifecycleControls
              warWeekId={warWeek.id}
              edition={warWeek.edition}
              status={warWeek.status}
              suggestedWinner={suggestedWinner}
              highlights={warWeek.highlights}
              unclosedBrackets={unclosedBrackets.map((c) => c.name)}
              openUnscoredCompetitions={openUnscored}
            />
            {showCreateNext && (
              <NextWarWeekButton
                fromWarWeekId={warWeek.id}
                defaults={nextEditionDefaults(
                  existing,
                  new Date().getFullYear(),
                )}
              />
            )}
          </div>
        </section>
        <section
          aria-labelledby="war-week-settings-heading"
          className="flex flex-col gap-2"
        >
          <WarWeekSettingsForm
            warWeekId={warWeek.id}
            headingId="war-week-settings-heading"
            // Its own saves refresh the page without remounting it (that
            // would drop typing in flight); End and Reopen, which change
            // the Winner and highlights, remount it with theirs.
            key={`${warWeek.id}:${warWeek.status}`}
            initial={settingsInputFrom(warWeek)}
            dayDates={days.map((day) => day.date)}
            teamSwatches={teamSwatches(teams)}
          />
        </section>
      </section>
    </AdminShell>
  );
}
