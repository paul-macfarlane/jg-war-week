import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { ScheduleItemForm } from "@/components/schedule-item-form";
import { sanitizeContent } from "@/lib/rich-text/content";
import { scheduleItemInputFrom } from "@/lib/setup-schedule-faq";
import { getSetupDays } from "@/queries/setup";
import {
  getCompetitionOptions,
  getScheduleItemForEdit,
} from "@/queries/setup-schedule-faq";

import { loadAdminPage } from "../../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Edit Schedule Item · JG War Week" };

export default async function EditScheduleItemPage({
  params,
}: PageProps<"/admin/setup/schedule/[id]">) {
  const { id } = await params;
  const { warWeek, email, allowed, isOrganizer, editions, runs } =
    await loadAdminPage(`/admin/setup/schedule/${id}`);
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const [item, days, allCompetitions] = await Promise.all([
    getScheduleItemForEdit(warWeek, id),
    getSetupDays(warWeek),
    getCompetitionOptions(warWeek),
  ]);
  if (!item) notFound();
  if (!runs(item.competitionId)) {
    return <AdminRefused warWeek={warWeek} email={email} />;
  }
  const competitions = allCompetitions.filter((c) => runs(c.id));

  // Sanitized on write; again here so the editor only gets the closed set.
  const description = item.description && sanitizeContent(item.description);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Setup"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <Link
          href="/admin/setup/schedule"
          className="text-primary text-sm underline-offset-4 hover:underline"
        >
          ← Schedule
        </Link>
        <h1 className="text-2xl font-bold">Edit Schedule Item</h1>
        <ScheduleItemForm
          warWeekId={warWeek.id}
          requireCompetition={!isOrganizer}
          itemId={item.id}
          initial={scheduleItemInputFrom({
            ...item,
            description: description?.ok ? description.content : null,
          })}
          days={days}
          competitions={competitions}
        />
      </section>
    </AdminShell>
  );
}
