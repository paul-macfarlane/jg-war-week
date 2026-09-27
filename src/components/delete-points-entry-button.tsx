"use client";

import { deletePointsEntry } from "@/actions/points-entries";
import { ConfirmActionButton } from "@/components/confirm-dialog";

export function DeletePointsEntryButton({
  id,
  description,
}: {
  id: string;
  /** e.g. "5 points to Red in Tug of War", for the confirm prompt. */
  description: string;
}) {
  return (
    <ConfirmActionButton
      title={`Delete ${description}?`}
      action={() => deletePointsEntry(id)}
      successMessage="Points Entry deleted"
    >
      Delete
    </ConfirmActionButton>
  );
}
