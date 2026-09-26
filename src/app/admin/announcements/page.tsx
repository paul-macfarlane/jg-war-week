import type { Metadata } from "next";
import Link from "next/link";

import { AdminRefused, AdminShell } from "@/components/admin-shell";
import {
  DeleteAnnouncementButton,
  PinAnnouncementButton,
} from "@/components/announcement-admin-buttons";
import { buttonVariants } from "@/components/ui/button";
import { announcementVideoCount, formatPublishedAt } from "@/lib/announcements";
import { getAnnouncements } from "@/queries/announcements";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Announcements · JG War Week" };

export default async function AdminAnnouncementsPage() {
  const { warWeek, email, isOrganizer, editions } = await loadAdminPage(
    "/admin/announcements",
  );
  if (!isOrganizer) return <AdminRefused warWeek={warWeek} email={email} />;

  const announcements = await getAnnouncements(warWeek);

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      editions={editions}
      current="Announcements"
    >
      <section className="flex max-w-5xl flex-col gap-4">
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
          <div className="relative overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-foreground/60 border-border border-b">
                <tr>
                  <th className="py-2 pr-4 font-medium">Title</th>
                  <th className="py-2 pr-4 font-medium">Posted by</th>
                  <th className="py-2 pr-4 font-medium">Published (ET)</th>
                  <th className="py-2 pr-4 text-right font-medium">Videos</th>
                  <th className="py-2 font-medium">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {announcements.map((row) => (
                  <tr key={row.id} className="border-border border-b">
                    <td className="py-2 pr-4 font-medium">
                      {row.title}
                      {row.pinned && (
                        <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                          Pinned
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-4">{row.authorEmail}</td>
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {formatPublishedAt(row.publishedAt)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {announcementVideoCount(row)}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/announcements/${row.id}`}
                          className="text-primary text-xs underline-offset-4 hover:underline"
                        >
                          Edit
                        </Link>
                        <PinAnnouncementButton
                          id={row.id}
                          pinned={row.pinned}
                        />
                        <DeleteAnnouncementButton
                          id={row.id}
                          title={row.title}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
