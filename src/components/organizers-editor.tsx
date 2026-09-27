"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { addOrganizer, removeOrganizer } from "@/actions/organizers";
import { ConfirmActionButton } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { JG_EMAIL_MESSAGE, jgEmailSchema } from "@/lib/jg-email";

/** Adds one JG email to the Organizer list. */
function AddOrganizerForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!jgEmailSchema.safeParse(email).success) {
      setError(JG_EMAIL_MESSAGE);
      return;
    }
    startTransition(async () => {
      const result = await addOrganizer(email);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      setError(null);
      setEmail("");
      toast.success("Organizer added");
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={submit}
      aria-label="Add an Organizer"
      className="flex flex-col gap-2"
    >
      <Field>
        <FieldLabel htmlFor="organizer-email">Add an Organizer</FieldLabel>
        <div className="flex flex-wrap gap-2">
          <Input
            id="organizer-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="off"
            required
            placeholder="name@jahnelgroup.com"
            className="h-11 max-w-sm flex-1 sm:h-9"
            value={email}
            aria-invalid={error ? true : undefined}
            onChange={(event) => {
              setEmail(event.target.value);
              setError(null);
            }}
          />
          <Button
            type="submit"
            className="min-h-11 sm:min-h-9"
            disabled={pending}
          >
            {pending ? "Adding…" : "Add"}
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
        <FieldDescription>
          Organizers can change everything in every War Week, including this
          list.
        </FieldDescription>
      </Field>
    </form>
  );
}

/** The global Organizer list: every Organizer, each removable, plus an add form. */
export function OrganizersEditor({
  organizers,
  actorEmail,
}: {
  organizers: { email: string; addedBy: string | null }[];
  /** The signed-in Organizer, so removing yourself says so. */
  actorEmail: string;
}) {
  const last = organizers.length === 1;
  return (
    <div className="flex flex-col gap-6">
      <ul
        aria-label="Organizers"
        className="border-border divide-border divide-y rounded-lg border"
      >
        {organizers.map((organizer) => {
          const self = organizer.email === actorEmail.toLowerCase();
          return (
            <li
              key={organizer.email}
              className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-medium">
                  {organizer.email}
                  {self && (
                    <span className="text-foreground/60 font-normal">
                      {" "}
                      (you)
                    </span>
                  )}
                </span>
                {organizer.addedBy && (
                  <span className="text-foreground/60 text-xs">
                    Added by {organizer.addedBy}
                  </span>
                )}
              </div>
              {!last && (
                <ConfirmActionButton
                  title={
                    self
                      ? "Remove yourself as an Organizer?"
                      : `Remove ${organizer.email}?`
                  }
                  description={
                    self
                      ? "You'll lose access to the Organizer pages in /admin."
                      : "They'll lose access to the Organizer pages in /admin."
                  }
                  confirmLabel="Remove"
                  action={() => removeOrganizer(organizer.email)}
                  successMessage="Organizer removed"
                >
                  Remove
                </ConfirmActionButton>
              )}
            </li>
          );
        })}
      </ul>
      {last && (
        <p className="text-foreground/70 text-sm">
          The last Organizer can&apos;t be removed.
        </p>
      )}
      <AddOrganizerForm />
    </div>
  );
}
