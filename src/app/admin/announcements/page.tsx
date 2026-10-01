import type { Metadata } from "next";
import Link from "next/link";

import { adminEditLinkClass } from "@/components/admin-edit-link";
import { AdminRefused, AdminShell } from "@/components/admin-shell";
import {
  DeleteAnnouncementButton,
  PinAnnouncementButton,
} from "@/components/announcement-admin-buttons";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { can } from "@/lib/access";
import { announcementVideoCount, formatPublishedAt } from "@/lib/announcements";
import { getAnnouncements } from "@/queries/announcements";

import { loadAdminPage } from "../gate";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Announcements · JG War Week" };

export default async function AdminAnnouncementsPage() {
  const { warWeek, email, actor, allowed, isOrganizer, editions } =
    await loadAdminPage("/admin/announcements");
  if (!allowed) return <AdminRefused warWeek={warWeek} email={email} />;

  const announcements = await getAnnouncements(warWeek);
  // A Host edits and deletes only their own Announcements; only an
  // Organizer pins.
  const mayChange = (authorEmail: string) =>
    can(actor, "announcement.edit", { warWeekId: warWeek.id, authorEmail }) ===
    null;
  const rowActions = (row: (typeof announcements)[number]) => (
    <>
      {mayChange(row.authorEmail) && (
        <Link
          href={`/admin/announcements/${row.id}`}
          className={adminEditLinkClass}
        >
          Edit
        </Link>
      )}
      {isOrganizer && <PinAnnouncementButton id={row.id} pinned={row.pinned} />}
      {mayChange(row.authorEmail) && (
        <DeleteAnnouncementButton id={row.id} title={row.title} />
      )}
    </>
  );

  return (
    <AdminShell
      warWeek={warWeek}
      email={email}
      isOrganizer={isOrganizer}
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
          <>
            <ul className="flex flex-col gap-3 md:hidden">
              {announcements.map((row) => {
                const videos = announcementVideoCount(row);
                return (
                  <li key={row.id}>
                    <Card size="sm" className="gap-2 px-4 py-3">
                      <p className="font-medium break-words">
                        {row.title}
                        {row.pinned && (
                          <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                            Pinned
                          </span>
                        )}
                      </p>
                      <p className="text-foreground/60 text-xs break-words">
                        Posted by {row.authorEmail}
                      </p>
                      <p className="text-foreground/60 text-xs">
                        Published {formatPublishedAt(row.publishedAt)} (ET)
                        {videos > 0 && (
                          <>
                            {" · "}
                            {videos} {videos === 1 ? "video" : "videos"}
                          </>
                        )}
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        {rowActions(row)}
                      </div>
                    </Card>
                  </li>
                );
              })}
            </ul>
            <div className="relative hidden overflow-x-auto md:block">
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
                          {rowActions(row)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </AdminShell>
  );
}
