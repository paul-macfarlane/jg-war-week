import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { BracketResults } from "@/components/bracket-results";
import { getBracket } from "@/queries/brackets";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Bracket results · JG War Week" };

export default async function BracketResultsPage({
  params,
}: PageProps<"/admin/brackets/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/brackets/${id}`);
  if (!allowed || !runs(id)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }

  const view = await getBracket(id);
  if (!view || view.competition.warWeekId !== warWeek.id) notFound();
  const { competition } = view;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Points Entries"
    >
      <section className="flex max-w-xl min-w-0 flex-col gap-4">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link
            href="/admin/points"
            className="text-primary underline-offset-4 hover:underline"
          >
            ← Points Entries
          </Link>
          <Link
            href={`/admin/setup/competitions/${competition.id}/bracket`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Builder
          </Link>
          <Link
            href={`/${warWeek.edition}/competitions/${competition.id}`}
            className="text-primary underline-offset-4 hover:underline"
          >
            Participant view
          </Link>
        </div>
        <h1 className="text-2xl font-bold">{competition.name} · Results</h1>
        {competition.format === "points" ? (
          <p className="text-foreground/70 text-sm">
            This Competition isn&apos;t run as a Bracket. Set its Format in the
            builder.
          </p>
        ) : (
          <BracketResults
            competitionId={competition.id}
            scoring={competition.scoring}
            entrants={view.entrants}
            bracket={view.bracket}
            champion={view.champion}
            finalized={view.finalized}
            primaryColor={warWeek.primaryColor}
          />
        )}
      </section>
    </AdminShell>
  );
}
