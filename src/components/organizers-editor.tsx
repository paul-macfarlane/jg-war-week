"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { addOrganizer, removeOrganizer } from "@/actions/organizers";
import {
  SETUP_EDITOR,
  SetupListRow,
  SetupRowError,
  SetupSaveButton,
  SetupSheetFooter,
  useSetupRow,
} from "@/components/setup-row";
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

/**
 * Changes one Organizer's email, in its Sheet: adds the new email, then
 * removes the old one, so the list never loses an Organizer on a refusal.
 * `onSaved` closes the Sheet.
 */
function OrganizerForm({
  email,
  self,
  onSaved,
}: {
  email: string;
  /** Is this the signed-in Organizer? */
  self: boolean;
  onSaved: () => void;
}) {
  const id = useId();
  const [value, setValue] = useState(email);
  const { pending, formRef, formAction, error } = useSetupRow(
    async () => {
      const next = value.trim().toLowerCase();
      if (next === email) return { ok: true };
      const added = await addOrganizer(next);
      if (!added.ok) return added;
      return removeOrganizer(email);
    },
    "Organizer saved",
    onSaved,
  );

  return (
    <form
      ref={formRef}
      action={formAction}
      aria-label={`Organizer ${email}`}
      className="flex flex-col gap-4"
    >
      <Field className="px-4" data-invalid={!!error}>
        <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          inputMode="email"
          autoComplete="off"
          required
          className="h-11 sm:h-9"
          aria-invalid={error ? true : undefined}
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
        {self && (
          <FieldDescription>
            Changing your own email takes your Organizer access to the new one.
          </FieldDescription>
        )}
      </Field>
      <SetupSheetFooter>
        <SetupSaveButton pending={pending} label="Save" />
        <SetupRowError error={error} />
      </SetupSheetFooter>
    </form>
  );
}

/**
 * The global Organizer list: every Organizer with Edit (a Sheet) and
 * Delete (except the last one), plus an add form.
 */
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
    <div {...SETUP_EDITOR} className="flex flex-col gap-6">
      <ul aria-label="Organizers">
        {organizers.map((organizer) => {
          const self = organizer.email === actorEmail.toLowerCase();
          return (
            <SetupListRow
              key={organizer.email}
              id={organizer.email}
              label={organizer.email}
              name={
                <>
                  {organizer.email}
                  {self && (
                    <span className="text-foreground/60 font-normal">
                      {" "}
                      (you)
                    </span>
                  )}
                </>
              }
              details={
                organizer.addedBy ? `Added by ${organizer.addedBy}` : undefined
              }
              form={(close) => (
                <OrganizerForm
                  email={organizer.email}
                  self={self}
                  onSaved={close}
                />
              )}
              onDelete={
                last ? undefined : () => removeOrganizer(organizer.email)
              }
              deleteTitle={
                self
                  ? "Delete yourself as an Organizer?"
                  : `Delete ${organizer.email} as an Organizer?`
              }
              deleteDescription={
                self
                  ? "You'll lose access to the Organizer pages in /admin."
                  : "They'll lose access to the Organizer pages in /admin."
              }
              deleteSuccess="Organizer removed"
            />
          );
        })}
      </ul>
      {last && (
        <p className="text-foreground/70 text-sm">
          The last Organizer can&apos;t be deleted.
        </p>
      )}
      <AddOrganizerForm />
    </div>
  );
}
