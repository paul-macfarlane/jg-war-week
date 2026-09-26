import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AnnouncementForm } from "@/components/announcement-form";

import { loadAdminPage } from "../../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "New Announcement · JG War Week" };

export default async function NewAnnouncementPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/announcements/new");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Announcements"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <h1 className="text-2xl font-bold">New Announcement</h1>
        <AnnouncementForm warWeekId={warWeek.id} canPin={isOrganizer} />
      </section>
    </AdminShell>
  );
}
