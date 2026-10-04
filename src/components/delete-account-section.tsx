"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteMyAccount } from "@/actions/account";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";

/**
 * The Profile page's Delete my account section: what goes, what stays, and
 * a destructive button that asks for the person's email. A refusal shows as
 * a toast and under the button; success redirects away.
 */
export function DeleteAccountSection({ email }: { email: string }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm(typed: string) {
    startTransition(async () => {
      const result = await deleteMyAccount({ confirmEmail: typed });
      // Success redirects, so only a refusal gets here.
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        setOpen(false);
      }
    });
  }

  return (
    <section
      aria-labelledby="delete-account-heading"
      className="border-destructive/40 mt-6 flex flex-col gap-3 rounded-lg border p-4"
    >
      <h2 id="delete-account-heading" className="text-lg font-semibold">
        Delete my account
      </h2>
      <p className="text-foreground/70 text-sm">
        This removes your login, your Profile name and picture, and your place
        on the Organizer list.
      </p>
      <p className="text-foreground/70 text-sm">
        Roster records, results, Awards, Announcements and history stay, and
        show your roster name again.
      </p>
      <p className="text-foreground/70 text-sm">
        If you sign in again later, you get a fresh account that re-links to
        your roster records by email.
      </p>
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="destructive"
          className="min-h-11 self-start sm:min-h-9"
          onClick={() => {
            setError(null);
            setOpen(true);
          }}
        >
          Delete my account
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </div>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Delete my account?"
        description="You'll be signed out and your account removed. This can't be undone."
        confirmLabel="Delete my account"
        pending={pending}
        confirmText={{ label: `Type ${email} to confirm`, expected: email }}
        onConfirm={confirm}
      />
    </section>
  );
}
