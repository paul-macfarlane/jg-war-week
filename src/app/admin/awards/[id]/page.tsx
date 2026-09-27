import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AwardForm } from "@/components/award-form";
import { getAwardForEdit, getAwardFormOptions } from "@/queries/awards";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit Award · JG War Week" };

export default async function EditAwardPage({
  params,
}: PageProps<"/admin/awards/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage(`/admin/awards/${id}`, "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [award, options] = await Promise.all([
    getAwardForEdit(warWeek, id),
    getAwardFormOptions(warWeek),
  ]);
  if (!award) notFound();

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Awards"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">Edit Award</h1>
        <AwardForm
          warWeekId={warWeek.id}
          awardId={award.id}
          options={options}
          teamLabel={warWeek.teamLabel}
          initial={{
            name: award.name,
            description: award.description,
            teamId: award.team?.id ?? null,
            participantIds: award.participants.map((p) => p.id),
          }}
        />
      </section>
    </AdminShell>
  );
}
