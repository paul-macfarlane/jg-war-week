"use client";

import { deleteAnnouncement } from "@/actions/announcements";
import { PinAnnouncementButton } from "@/components/announcement-admin-buttons";
import { SETUP_EDITOR, SetupListRow } from "@/components/setup-row";

/**
 * The admin Announcements list: each row's title, author and publish
 * time, its Pin button (Organizers), Edit (a link to the full-page editor)
 * and Delete, the last two only where the viewer may change it.
 */
export function AnnouncementsList({
  announcements,
  canPin,
}: {
  announcements: {
    id: string;
    title: string;
    pinned: boolean;
    /** "Posted by … · Published … (ET)". */
    details: string;
    /** May this viewer edit and delete it (their own, for a Host)? */
    mayChange: boolean;
  }[];
  /** Only an Organizer pins. */
  canPin: boolean;
}) {
  return (
    <div {...SETUP_EDITOR}>
      <ul aria-label="Announcements">
        {announcements.map((row) => (
          <SetupListRow
            key={row.id}
            id={row.id}
            label={row.title}
            name={
              <>
                {row.title}
                {row.pinned && (
                  <span className="bg-primary/10 text-primary ml-2 rounded px-1.5 py-0.5 text-xs font-medium">
                    Pinned
                  </span>
                )}
              </>
            }
            details={row.details}
            aside={
              canPin && (
                <PinAnnouncementButton id={row.id} pinned={row.pinned} />
              )
            }
            editHref={
              row.mayChange ? `/admin/announcements/${row.id}` : undefined
            }
            onDelete={
              row.mayChange ? () => deleteAnnouncement(row.id) : undefined
            }
            deleteTitle={`Delete "${row.title}"?`}
            deleteSuccess="Announcement deleted"
          />
        ))}
      </ul>
    </div>
  );
}
