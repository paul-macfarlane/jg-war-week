"use client";

import { deleteAnnouncement } from "@/actions/announcements";
import { PinAnnouncementButton } from "@/components/announcement-admin-buttons";
import { SETUP_EDITOR, SetupListRow } from "@/components/setup-row";
import { Badge } from "@/components/ui/badge";

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
                  <Badge variant="secondary" className="ml-2">
                    Pinned
                  </Badge>
                )}
              </>
            }
            details={row.details}
            aside={
              canPin && (
                <PinAnnouncementButton id={row.id} pinned={row.pinned} />
              )
            }
            editHref={`/admin/announcements/${row.id}`}
            onDelete={() => deleteAnnouncement(row.id)}
            deleteTitle={`Delete "${row.title}"?`}
            deleteSuccess="Announcement deleted"
          />
        ))}
      </ul>
    </div>
  );
}
