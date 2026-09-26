import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { BracketBuilder } from "@/components/bracket-builder";
import { getBracket } from "@/queries/brackets";
import { getPointsEntryFormOptions } from "@/queries/points-entries";

import { loadAdminPage } from "../../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bracket · JG War Week" };

export default async function BracketBuilderPage({
  params,
}: PageProps<"/admin/setup/competitions/[id]/bracket">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/setup/competitions/${id}/bracket`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const [view, options] = await Promise.all([
    getBracket(id),
    getPointsEntryFormOptions(warWeek),
  ]);
  if (!view || view.competition.warWeekId !== warWeek.id) notFound();
  const { competition } = view;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl min-w-0 flex-col gap-4">
        <Link
          href="/admin/setup/competitions"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Competitions
        </Link>
        <h1 className="text-2xl font-bold">{competition.name} · Bracket</h1>
        <BracketBuilder
          competition={{
            id: competition.id,
            name: competition.name,
            scoring: competition.scoring,
            format: competition.format,
            finalized: view.finalized,
          }}
          entrants={view.entrants}
          bracket={view.bracket}
          teams={options.teams}
          participants={options.participants}
          teamLabel={warWeek.teamLabel}
        />
      </section>
    </AdminShell>
  );
}
