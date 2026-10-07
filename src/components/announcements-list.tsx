"use client";

import { deleteAnnouncement } from "@/actions/announcements";
import { PinAnnouncementButton } from "@/components/announcement-admin-buttons";
import { AnnouncementForm } from "@/components/announcement-form";
import {
  SETUP_EDITOR,
  SetupAddButton,
  SetupListRow,
} from "@/components/setup-row";
import { Badge } from "@/components/ui/badge";
import type { Content } from "@/lib/rich-text/content";

/**
 * The admin Announcements list: each row's title, author and publish
 * time, its Pin button (Organizers), Edit (the form in a dialog) and
 * Delete, then "New Announcement" (the same form, empty).
 */
export function AnnouncementsList({
  warWeekId,
  announcements,
  canPin,
}: {
  /** The War Week this page was rendered for; creates post it. */
  warWeekId: string;
  announcements: {
    id: string;
    title: string;
    /** Already sanitized for the editor. */
    body: Content;
    pinned: boolean;
    /** "Posted by … · Published … (ET)". */
    details: string;
  }[];
  /** Only an Organizer pins. */
  canPin: boolean;
}) {
  return (
    <div {...SETUP_EDITOR} className="flex flex-col gap-3">
      {announcements.length === 0 ? (
        <p className="text-foreground/70 text-sm">No Announcements yet.</p>
      ) : (
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
              fullHeight
              form={(close) => (
                <AnnouncementForm
                  warWeekId={warWeekId}
                  announcementId={row.id}
                  canPin={canPin}
                  initial={{
                    title: row.title,
                    body: row.body,
                    pinned: row.pinned,
                  }}
                  onSaved={close}
                />
              )}
              onDelete={() => deleteAnnouncement(row.id)}
              deleteTitle={`Delete "${row.title}"?`}
              deleteSuccess="Announcement deleted"
            />
          ))}
        </ul>
      )}
      <SetupAddButton
        label="New Announcement"
        fullHeight
        form={(close) => (
          <AnnouncementForm
            warWeekId={warWeekId}
            canPin={canPin}
            onSaved={close}
          />
        )}
      />
    </div>
  );
}
