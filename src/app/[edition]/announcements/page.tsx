import { notFound } from "next/navigation";

import { AnnouncementCard } from "@/components/announcement-card";
import { getAnnouncementCards } from "@/queries/announcements";

import { getWarWeekForEdition } from "../war-week";

export default async function AnnouncementsPage({
  params,
}: PageProps<"/[edition]/announcements">) {
  const { edition } = await params;
  const warWeek = await getWarWeekForEdition(edition);
  if (!warWeek) notFound();

  const announcements = await getAnnouncementCards(warWeek);

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 px-4 py-6 md:max-w-3xl">
      <h1 className="text-2xl font-bold">Announcements</h1>
      {announcements.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Announcements yet.</p>
      ) : (
        announcements.map((announcement) => (
          <AnnouncementCard key={announcement.id} announcement={announcement} />
        ))
      )}
    </main>
  );
}
