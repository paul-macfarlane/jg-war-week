"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  deleteAnnouncement,
  pinAnnouncement,
  unpinAnnouncement,
} from "@/actions/announcements";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

export function PinAnnouncementButton({
  id,
  pinned,
}: {
  id: string;
  pinned: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      variant="outline"
      size="xs"
      // At least 44px on phones.
      className="min-h-11 min-w-11 sm:min-h-6 sm:min-w-0"
      disabled={pending}
      onClick={() => {
        startTransition(async () => {
          const result = pinned
            ? await unpinAnnouncement(id)
            : await pinAnnouncement(id);
          if (!result.ok) {
            toast.error(result.error);
          } else {
            toast.success(
              pinned ? "Announcement unpinned" : "Announcement pinned",
            );
          }
          router.refresh();
        });
      }}
    >
      {pending ? "Saving…" : pinned ? "Unpin" : "Pin"}
    </Button>
  );
}

export function DeleteAnnouncementButton({
  id,
  title,
}: {
  id: string;
  title: string;
}) {
  return (
    <ConfirmActionButton
      title={`Delete "${title}"?`}
      action={() => deleteAnnouncement(id)}
      successMessage="Announcement deleted"
    >
      Delete
    </ConfirmActionButton>
  );
}
