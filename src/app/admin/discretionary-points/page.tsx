import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { DiscretionaryPointsEditor } from "@/components/discretionary-points-editor";
import { discretionaryAllowsTeams } from "@/lib/discretionary-points";
import { getDiscretionaryLedger } from "@/queries/discretionary-points";
import { getTargetOptions } from "@/queries/target-options";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Discretionary points · JG War Week",
};

export default async function AdminDiscretionaryPointsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/discretionary-points", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [ledger, options] = await Promise.all([
    getDiscretionaryLedger(warWeek),
    getTargetOptions(warWeek),
  ]);
  const targets = [
    ...(discretionaryAllowsTeams(warWeek.mode)
      ? options.teams.map((t) => ({
          id: t.id,
          name: t.name,
          detail: warWeek.teamLabel,
        }))
      : []),
    ...options.participants.map((p) => ({
      id: p.id,
      name: p.name,
      detail: p.team ?? undefined,
    })),
  ];

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Discretionary points"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Discretionary points</h1>
        <p className="text-foreground/70 text-sm">
          Points with no Competition behind them, for a {warWeek.teamLabel} or a
          Participant, with a reason. Competitions are recorded on their own
          pages.
        </p>
        <DiscretionaryPointsEditor
          warWeekId={warWeek.id}
          entries={ledger}
          targets={targets}
          teamLabel={warWeek.teamLabel}
          mode={warWeek.mode}
        />
      </section>
    </AdminShell>
  );
}
