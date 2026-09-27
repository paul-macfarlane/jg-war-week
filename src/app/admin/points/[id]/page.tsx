import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { PointsEntryForm } from "@/components/points-entry-form";
import {
  getPointsEntryForEdit,
  getPointsEntryFormOptions,
} from "@/queries/points-entries";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit Points Entry · JG War Week" };

export default async function EditPointsEntryPage({
  params,
}: PageProps<"/admin/points/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/points/${id}`);
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [entry, allOptions] = await Promise.all([
    getPointsEntryForEdit(warWeek, id),
    getPointsEntryFormOptions(warWeek),
  ]);
  if (!entry) notFound();
  if (!runs(entry.competitionId)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }
  const options = {
    ...allOptions,
    competitions: allOptions.competitions.filter((c) => runs(c.id)),
  };

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Points Entries"
    >
      <section className="flex max-w-md flex-col gap-4">
        <h1 className="text-2xl font-bold">Edit Points Entry</h1>
        <p className="text-foreground/70 text-sm">
          Entered by {entry.enteredByEmail}.
        </p>
        <PointsEntryForm
          options={options}
          teamLabel={warWeek.teamLabel}
          entryId={entry.id}
          initial={{
            competitionId: entry.competitionId,
            targetId: entry.targetId,
            points: String(entry.points),
            note: entry.note ?? "",
          }}
        />
      </section>
    </AdminShell>
  );
}
