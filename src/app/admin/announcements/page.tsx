import type { Metadata } from "next";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import { AnnouncementsList } from "@/components/announcements-list";
import { formatPublishedAt } from "@/lib/announcements";
import { sanitizeContent } from "@/lib/rich-text/content";
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
        <h1 className="text-2xl font-bold">Announcements</h1>

        <AnnouncementsList
          warWeekId={warWeek.id}
          canPin={isOrganizer}
          announcements={announcements.map((row) => {
            // The stored body was sanitized on write; sanitize again so the
            // editor is only ever handed the closed content set.
            const body = sanitizeContent(row.body);
            return {
              id: row.id,
              title: row.title,
              body: body.ok ? body.content : { type: "doc", content: [] },
              pinned: row.pinned,
              details: `Posted by ${row.authorName} · Published ${formatPublishedAt(row.publishedAt)} (ET)`,
            };
          })}
        />
      </section>
    </AdminShell>
  );
}
