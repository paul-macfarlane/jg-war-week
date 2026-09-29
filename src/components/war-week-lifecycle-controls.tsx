"use client";

import { useRouter } from "next/navigation";
import { useActionState, useId, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type LifecycleActionResult,
  endWarWeek,
  reopenWarWeek,
  startWarWeek,
} from "@/actions/war-week-lifecycle";
import {
  ConfirmActionButton,
  ConfirmDialog,
} from "@/components/confirm-dialog";
import {
  fieldErrorsOf,
  formErrorOf,
  useFocusFirstInvalid,
} from "@/components/form-field-errors";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { WarWeek } from "@/db/schema";

/**
 * The lifecycle action for a War Week's status, behind a confirm that says
 * what changes: Start (`upcoming`), End with the Winner and highlights
 * (`live`) or Reopen (`complete`).
 */
export function WarWeekLifecycleControls({
  warWeekId,
  edition,
  status,
  suggestedWinner,
  highlights,
  unfinalizedBrackets,
}: {
  warWeekId: string;
  edition: string;
  status: WarWeek["status"];
  /**
   * The Winner End War Week will record: first place in the main
   * Standings, read-only (there is no Organizer override).
   */
  suggestedWinner: string;
  highlights: string[];
  /** Names of Brackets not yet finalized, to warn about when ending. */
  unfinalizedBrackets: string[];
}) {
  const name = edition.toUpperCase();

  if (status === "upcoming") {
    return (
      <ConfirmActionButton
        title={`Start War Week ${name}?`}
        description={`${name} goes live. It becomes the current War Week.`}
        confirmLabel="Start War Week"
        variant="default"
        size="lg"
        className="min-h-11 self-start sm:min-h-9"
        successMessage={`War Week ${name} is live`}
        action={() => startWarWeek(warWeekId)}
      >
        Start War Week
      </ConfirmActionButton>
    );
  }

  if (status === "complete") {
    return (
      <ConfirmActionButton
        title={`Reopen War Week ${name}?`}
        description={`${name} goes live again for corrections and becomes the current War Week until you end it.`}
        confirmLabel="Reopen"
        variant="outline"
        size="lg"
        className="min-h-11 self-start sm:min-h-9"
        successMessage={`War Week ${name} is live again`}
        action={() => reopenWarWeek(warWeekId)}
      >
        Reopen
      </ConfirmActionButton>
    );
  }

  return (
    <EndWarWeekButton
      warWeekId={warWeekId}
      name={name}
      suggestedWinner={suggestedWinner}
      highlights={highlights}
      unfinalizedBrackets={unfinalizedBrackets}
    />
  );
}

function EndWarWeekButton({
  warWeekId,
  name,
  suggestedWinner,
  highlights: initialHighlights,
  unfinalizedBrackets,
}: {
  warWeekId: string;
  name: string;
  suggestedWinner: string;
  highlights: string[];
  unfinalizedBrackets: string[];
}) {
  const router = useRouter();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [open, setOpen] = useState(false);
  const [highlights, setHighlights] = useState(initialHighlights.join("\n"));

  // Validation runs on the server; a refusal names its fields.
  const [result, formAction, pending] = useActionState(
    async (
      _previous: LifecycleActionResult | null,
      formData: FormData,
    ): Promise<LifecycleActionResult> => {
      const input = {
        highlights: String(formData.get("highlights") ?? ""),
      };
      const saved = await endWarWeek(warWeekId, input);
      if (!saved.ok) {
        toast.error(saved.error);
        router.refresh();
        return saved;
      }
      toast.success(`War Week ${name} is in the Archive`);
      setOpen(false);
      router.refresh();
      return saved;
    },
    null,
  );
  // Each opening starts clean: the refusal shown before a Cancel is hidden.
  const [dismissed, setDismissed] = useState<LifecycleActionResult | null>(
    null,
  );
  const shown = result === dismissed ? null : result;
  const fieldErrors = fieldErrorsOf(shown);
  const formError = formErrorOf(shown);
  useFocusFirstInvalid(formRef, result);

  const trimmed = suggestedWinner.trim();
  const endDescription = trimmed
    ? `${name} moves to the Archive with ${trimmed} as Winner.`
    : `${name} moves to the Archive with no Winner.`;
  const description =
    unfinalizedBrackets.length > 0
      ? `${endDescription} Not finalized: ${unfinalizedBrackets.join(", ")}. Their placings aren't in the Standings until you finalize them.`
      : endDescription;
  return (
    <>
      <Button
        type="button"
        size="lg"
        className="min-h-11 self-start sm:min-h-9"
        onClick={() => {
          setDismissed(result);
          setOpen(true);
        }}
      >
        End War Week
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={`End War Week ${name}?`}
        description={description}
        confirmLabel="End War Week"
        pending={pending}
        form={formId}
      >
        <form
          ref={formRef}
          id={formId}
          action={formAction}
          aria-label="End War Week"
        >
          <FieldGroup className="gap-4">
            <Field>
              <FieldLabel htmlFor="end-winner">Winner</FieldLabel>
              <p
                id="end-winner"
                className="text-foreground flex h-11 items-center rounded-md border px-3 text-sm sm:h-9"
              >
                {trimmed || "No winner"}
              </p>
              <FieldDescription>First place in the Standings.</FieldDescription>
            </Field>
            <Field data-invalid={!!fieldErrors.highlights}>
              <FieldLabel htmlFor="end-highlights">Highlights</FieldLabel>
              <Textarea
                id="end-highlights"
                name="highlights"
                rows={3}
                aria-invalid={!!fieldErrors.highlights}
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
              />
              <FieldDescription>
                Optional. One short line each.
              </FieldDescription>
              <FieldError>{fieldErrors.highlights}</FieldError>
            </Field>
            {formError && !pending && <FieldError>{formError}</FieldError>}
          </FieldGroup>
        </form>
      </ConfirmDialog>
    </>
  );
}
