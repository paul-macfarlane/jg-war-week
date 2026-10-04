import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AnnouncementsList } from "@/components/announcements-list";
import { buttonVariants } from "@/components/ui/button";
import { formatPublishedAt } from "@/lib/announcements";
import { getAdminAnnouncementRows } from "@/queries/announcements";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Announcements · JG War Week" };

export default async function AdminAnnouncementsPage() {
  const { warWeek, email, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/announcements", "organizers");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const announcements = await getAdminAnnouncementRows(warWeek);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
      editions={editions}
      current="Announcements"
    >
      <section className="flex max-w-3xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="text-2xl font-bold">Announcements</h1>
          <Link
            href="/admin/announcements/new"
            className={buttonVariants({ className: "ml-auto" })}
          >
            New Announcement
          </Link>
        </div>

        {announcements.length === 0 ? (
          <p className="text-foreground/70 text-sm">No Announcements yet.</p>
        ) : (
          <AnnouncementsList
            canPin={isOrganizer}
            announcements={announcements.map((row) => ({
              id: row.id,
              title: row.title,
              pinned: row.pinned,
              details: `Posted by ${row.authorName} · Published ${formatPublishedAt(row.publishedAt)} (ET)`,
            }))}
          />
        )}
      </section>
    </AdminShell>
  );
}
